/**
 * 微信分账的執行（ADR-0017）：把「到期的訂單」送去分、把「處理中」的問到終態。
 *
 * 後台的「执行分账」按鈕與定時器（`PROFIT_SHARING_AUTO_MINUTES`）跑的是同一個 `runProfitSharingOnce`。
 * 依賴全部注入（資料層、微信 API），測試用假的跑完整流程（test/profitSharingRun.test.ts）。
 *
 * 一筆訂單的一生（`profit_sharing_orders.state`）：
 *   awaiting ─(付款成功、過了退款期)→ created ─(微信受理)→ processing ─(查到 FINISHED)→ finished
 *                                        │                                └ 全部接收方都被關閉 → failed
 *                                        └(微信拒絕) → failed（管理員在後台選：重試，或只解凍、線下結）
 *
 * 【不會分兩次】`created` 之前先把單號（`PS<訂單>A<次數>`）寫進資料庫；微信那邊同一個單號重送等於一次。
 * 網路斷了、微信 5xx：留在 `created`，下一輪用**同一個單號、同一份明細**再送。
 * 【退款】到期那一刻訂單已經不是 success（退款了）就不送；所以退款期（`delayDays`）內退款不必向對方追錢。
 */
import { parseSnapshot } from '../revenueSplit/split';
import { outOrderNo, planSharing, type PlanLine, type Receiver, type SharingPlan } from './plan';
import { WechatApiError, type ProfitSharingApi, type SharingOrder } from './wechatApi';

export type SharingState = 'awaiting' | 'created' | 'processing' | 'finished' | 'failed';

/** 到期、還沒算過的訂單。 */
export interface DuePayment {
  recordId: number;
  paymentId: number;
  transactionId: string;
  amountFen: number;
  snapshot: unknown;
}

/** 算好了、還沒到終態的分账單。 */
export interface OpenRecord {
  recordId: number;
  paymentId: number;
  transactionId: string;
  state: 'created' | 'processing';
  kind: 'share' | 'unfreeze';
  outOrderNo: string;
  detail: PlanLine[];
}

export interface RecordPatch {
  state: SharingState;
  wxOrderId?: string | null;
  sharedFen?: number;
  offlineFen?: number;
  detail?: PlanLine[];
  error?: string | null;
}

export interface RunDeps {
  /** `awaiting`、訂單 success、付款超過 `delayDays` 天的。 */
  listDue(delayDays: number, limit: number): Promise<DuePayment[]>;
  listOpen(limit: number): Promise<OpenRecord[]>;
  loadReceivers(): Promise<ReadonlyMap<string, Receiver>>;
  /** awaiting → created，寫上單號與明細；只有還是 awaiting 的那一列會動（回 false＝別人先做了）。 */
  startRecord(recordId: number, input: { kind: 'share' | 'unfreeze'; attempt: number; outOrderNo: string; plan: SharingPlan }): Promise<boolean>;
  updateRecord(recordId: number, patch: RecordPatch): Promise<void>;
  api: ProfitSharingApi;
  maxBp: number;
  delayDays: number;
  log(line: string): void;
  /** 分不出去時通知人（選填）。 */
  alert?(text: string, key: string): void;
}

export interface RunResult {
  started: number;
  requested: number;
  finished: number;
  failed: number;
  /** 微信暫時沒回應，下一輪再送的。 */
  retryLater: number;
}

export const RUN_BATCH = 50;
export const SHARE_DESCRIPTION = '合作分润';
export const UNFREEZE_DESCRIPTION = '无需分账，解冻';

/** 微信那邊暫時性的錯：留在原狀態，下一輪再送。其餘的是業務拒絕，要人看。 */
function isTransient(err: unknown): boolean {
  if (!(err instanceof WechatApiError)) return true; // 網路錯、逾時
  return err.status >= 500 || err.status === 429 || /SYSTEM_ERROR|FREQUENCY_LIMITED|RATELIMIT|订单处理中|稍后/i.test(`${err.code} ${err.message}`);
}

const short = (s: string): string => (s.length > 250 ? `${s.slice(0, 250)}…` : s);

/** 微信回的終態 → 每一方實際分到多少。沒在回應裡的接收方當成沒分到。 */
export function settleLines(detail: PlanLine[], order: SharingOrder): { lines: PlanLine[]; sharedFen: number; offlineFen: number; closed: string[] } {
  const closed: string[] = [];
  const lines = detail.map(l => {
    if (!l.receiver || l.shareFen === 0) return l;
    const got = order.receivers.find(r => r.account === l.receiver!.account && r.type === l.receiver!.type);
    if (got && got.result === 'SUCCESS') return l;
    closed.push(`${l.partyKind}:${l.refId} ${got?.failReason ?? got?.result ?? 'NOT_IN_RESPONSE'}`);
    return { ...l, shareFen: 0, offlineReason: 'no_receiver' as const };
  });
  const sharedFen = lines.reduce((n, l) => n + l.shareFen, 0);
  const dueFen = lines.reduce((n, l) => n + l.dueFen, 0);
  return { lines, sharedFen, offlineFen: dueFen - sharedFen, closed };
}

async function applyOrder(deps: RunDeps, rec: OpenRecord, order: SharingOrder, result: RunResult): Promise<void> {
  if (order.state !== 'FINISHED') {
    await deps.updateRecord(rec.recordId, { state: 'processing', wxOrderId: order.orderId, error: null });
    return;
  }
  if (rec.kind === 'unfreeze') {
    await deps.updateRecord(rec.recordId, { state: 'finished', wxOrderId: order.orderId, error: null });
    result.finished += 1;
    return;
  }
  const s = settleLines(rec.detail, order);
  const allClosed = s.sharedFen === 0;
  await deps.updateRecord(rec.recordId, {
    state: allClosed ? 'failed' : 'finished',
    wxOrderId: order.orderId,
    detail: s.lines,
    sharedFen: s.sharedFen,
    offlineFen: s.offlineFen,
    error: s.closed.length ? short(`接收方分账被关闭：${s.closed.join('；')}`) : null,
  });
  if (allClosed) result.failed += 1;
  else result.finished += 1;
  if (s.closed.length) {
    deps.log(`[ProfitSharing] payment ${rec.paymentId}: receivers closed (${s.closed.join('; ')}); settle offline`);
    deps.alert?.(`订单 ${rec.paymentId} 的分账有接收方失败（${s.closed.join('；')}），这部分要线下结算。`, `ps-closed:${rec.paymentId}`);
  }
}

async function send(deps: RunDeps, rec: OpenRecord, result: RunResult): Promise<void> {
  try {
    const order =
      rec.state === 'processing'
        ? await deps.api.query(rec.transactionId, rec.outOrderNo)
        : rec.kind === 'unfreeze'
          ? await deps.api.unfreeze(rec.transactionId, rec.outOrderNo, UNFREEZE_DESCRIPTION)
          : await deps.api.share({
              transactionId: rec.transactionId,
              outOrderNo: rec.outOrderNo,
              receivers: rec.detail
                .filter(l => l.receiver && l.shareFen > 0)
                .map(l => ({ ...l.receiver!, amountFen: l.shareFen, description: SHARE_DESCRIPTION })),
            });
    if (rec.state === 'created') result.requested += 1;
    await applyOrder(deps, rec, order, result);
  } catch (err: any) {
    if (isTransient(err)) {
      result.retryLater += 1;
      deps.log(`[ProfitSharing] payment ${rec.paymentId} (${rec.outOrderNo}): ${err?.message ?? err}; will retry`);
      return;
    }
    // 查詢被拒不改狀態（錢的狀態沒變）；送出被拒＝這一次沒分出去，要人看
    if (rec.state === 'processing') {
      result.retryLater += 1;
      deps.log(`[ProfitSharing] query refused for payment ${rec.paymentId}: ${err.message}`);
      return;
    }
    result.failed += 1;
    await deps.updateRecord(rec.recordId, { state: 'failed', error: short(String(err.message)) });
    deps.log(`[ProfitSharing] payment ${rec.paymentId} refused: ${err.message}`);
    deps.alert?.(`订单 ${rec.paymentId} 的分账被微信拒绝（${err.code}）。资金仍冻结，请到后台「清分 → 微信分账」处理。`, `ps-refused:${rec.paymentId}`);
  }
}

/** 跑一輪：先把到期的算好（awaiting → created），再把 created／processing 的各送一次。一張一張來，不並發。 */
export async function runProfitSharingOnce(deps: RunDeps, batch = RUN_BATCH): Promise<RunResult> {
  const result: RunResult = { started: 0, requested: 0, finished: 0, failed: 0, retryLater: 0 };
  const due = await deps.listDue(deps.delayDays, batch);
  if (due.length > 0) {
    const receivers = await deps.loadReceivers();
    for (const p of due) {
      const snapshot = parseSnapshot(p.snapshot);
      if (!snapshot) {
        await deps.updateRecord(p.recordId, { state: 'failed', error: '订单没有清分快照，无法计算分账金额。' });
        result.failed += 1;
        continue;
      }
      const plan = planSharing(p.amountFen, snapshot, receivers, deps.maxBp);
      const ok = await deps.startRecord(p.recordId, { kind: plan.action, attempt: 1, outOrderNo: outOrderNo(p.paymentId, 1), plan });
      if (ok) result.started += 1;
    }
  }
  for (const rec of await deps.listOpen(batch)) await send(deps, rec, result);
  return result;
}

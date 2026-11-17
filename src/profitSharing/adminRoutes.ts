/**
 * 微信分账的後台端點（ADR-0017）。`src/admin/routes.ts` 只在 `PROFIT_SHARING` 開著時呼叫 `registerProfitSharingRoutes`，
 * 每一支都先過 `requireGlobal`（只有全域管理員：這裡按一下是真的把錢轉出去）。資料層與微信 API 全部注入。
 */
import type express from 'express';
import { parseSnapshot } from '../revenueSplit/split';
import { outOrderNo, planSharing, readReceiverInput, type PartyKind, type PlanLine, type ProfitSharingConfig, type Receiver, type ReceiverInput, type SharingPlan } from './plan';
import type { RunResult, SharingState } from './run';
import type { ApiReceiver } from './wechatApi';
import type { RelationType } from './plan';

export interface AdminReceiver extends Receiver {
  id: number;
  wxAddedAt: string | null;
}

export interface AdminSharingRecord {
  id: number;
  paymentId: number;
  outTradeNo: string;
  amountFen: number;
  paymentStatus: string;
  paidAt: string | null;
  state: SharingState;
  kind: 'share' | 'unfreeze' | null;
  attempt: number;
  outOrderNo: string | null;
  wxOrderId: string | null;
  detail: PlanLine[];
  sharedFen: number;
  offlineFen: number;
  error: string | null;
  snapshot: unknown;
  transactionId: string | null;
  updatedAt: string | null;
}

export interface ProfitSharingAdminDeps {
  config: ProfitSharingConfig;
  /** 微信支付設好了沒（沒設好只能看、不能加接收方也不能執行）。 */
  ready: boolean;
  listReceivers(): Promise<AdminReceiver[]>;
  loadReceiverMap(): Promise<ReadonlyMap<string, Receiver>>;
  saveReceiver(input: ReceiverInput): Promise<void>;
  /** 向微信「添加分账接收方」。 */
  addReceiverAtWechat(r: ApiReceiver & { relationType: RelationType }): Promise<void>;
  markReceiverRegistered(partyKind: PartyKind, refId: number): Promise<void>;
  setReceiverActive(partyKind: PartyKind, refId: number, active: boolean): Promise<boolean>;
  partyExists(partyKind: PartyKind, refId: number): Promise<boolean>;
  listRecords(limit: number): Promise<AdminSharingRecord[]>;
  findRecord(id: number): Promise<AdminSharingRecord | null>;
  restartRecord(id: number, input: { kind: 'share' | 'unfreeze'; attempt: number; outOrderNo: string; plan: SharingPlan }): Promise<boolean>;
  findOpenidByPhone(phone: string): Promise<string | null>;
  /** 跑一輪（同 `runProfitSharingOnce`）。 */
  run(): Promise<RunResult>;
}

export const RECORDS_LIMIT = 200;

type Guard = (req: any, res: express.Response) => boolean;

export function registerProfitSharingRoutes(router: express.Router, requireGlobal: Guard, deps: ProfitSharingAdminDeps): void {
  const fail = (res: express.Response, what: string, err: any) => {
    console.error(`[Admin] profit sharing ${what} failed:`, err?.message ?? err);
    res.status(500).json({ error: '操作失败，请稍后再试。' });
  };

  router.get('/profit-sharing', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    try {
      const [receivers, records, map] = await Promise.all([deps.listReceivers(), deps.listRecords(RECORDS_LIMIT), deps.loadReceiverMap()]);
      res.json({
        config: deps.config,
        ready: deps.ready,
        receivers,
        // 還沒送的（awaiting）附上「現在送會怎麼分」的試算；送過的照存的明細
        records: records.map(r => {
          if (r.state !== 'awaiting') return { ...r, snapshot: undefined };
          const s = parseSnapshot(r.snapshot);
          const plan = s ? planSharing(r.amountFen, s, map, deps.config.maxBp) : null;
          return { ...r, snapshot: undefined, detail: plan?.lines ?? [], sharedFen: plan?.sharedFen ?? 0, offlineFen: plan?.offlineFen ?? 0 };
        }),
      });
    } catch (err) {
      fail(res, 'list', err);
    }
  });

  // 存一個接收方，接著向微信添加。微信那邊沒加成功也照存（`registered: false`），畫面上看得到原因、可以再按一次。
  router.put('/profit-sharing/receivers', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    const input = readReceiverInput(req.body);
    if ('error' in input) return void res.status(400).json({ error: input.error });
    try {
      if (!(await deps.partyExists(input.partyKind, input.refId))) return void res.status(404).json({ error: '找不到这个对象。' });
      await deps.saveReceiver(input);
      if (!deps.ready) return void res.json({ ok: true, registered: false, wechatError: '微信支付尚未配置，暂时无法向微信添加接收方。' });
      try {
        await deps.addReceiverAtWechat({ type: input.type, account: input.account, name: input.name, relationType: input.relationType });
        await deps.markReceiverRegistered(input.partyKind, input.refId);
        res.json({ ok: true, registered: true });
      } catch (err: any) {
        console.error('[Admin] add profit sharing receiver at WeChat failed:', err?.message ?? err);
        res.json({ ok: true, registered: false, wechatError: String(err?.message ?? err).slice(0, 200) });
      }
    } catch (err) {
      fail(res, 'save receiver', err);
    }
  });

  router.post('/profit-sharing/receivers/active', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    const { partyKind, refId, active } = req.body ?? {};
    if ((partyKind !== 'company' && partyKind !== 'referrer') || !(Number.isInteger(refId) && refId > 0) || typeof active !== 'boolean') {
      return void res.status(400).json({ error: '参数不正确。' });
    }
    try {
      if (!(await deps.setReceiverActive(partyKind, refId, active))) return void res.status(404).json({ error: '找不到这个接收方。' });
      res.json({ ok: true });
    } catch (err) {
      fail(res, 'set active', err);
    }
  });

  // 用手機號查 openid（個人接收方用）：那個人要先用微信在站上走過一次付款授權。
  router.get('/profit-sharing/openid', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    if (!/^1\d{10}$/.test(phone)) return void res.status(400).json({ error: '请输入 11 位手机号。' });
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ openid: await deps.findOpenidByPhone(phone) });
    } catch (err) {
      fail(res, 'find openid', err);
    }
  });

  let running = false;
  router.post('/profit-sharing/run', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    if (!deps.ready) return void res.status(503).json({ error: '微信支付尚未配置。', code: 'PAY_NOT_READY' });
    if (running) return void res.status(409).json({ error: '上一轮还在执行，请稍后再按。', code: 'RUNNING' });
    running = true;
    try {
      res.json(await deps.run());
    } catch (err) {
      fail(res, 'run', err);
    } finally {
      running = false;
    }
  });

  // 失敗的那一張（微信沒受理過）：重新算一次再送（`share`），或放棄分账、只解凍（`unfreeze`，該給對方的線下結）。
  router.post('/profit-sharing/orders/:id/retry', async (req, res) => {
    if (!requireGlobal(req, res)) return;
    const id = /^\d{1,9}$/.test(String(req.params.id)) ? Number(req.params.id) : null;
    const mode = req.body?.mode;
    if (id === null || (mode !== 'share' && mode !== 'unfreeze')) return void res.status(400).json({ error: '参数不正确。' });
    try {
      const rec = await deps.findRecord(id);
      if (!rec) return void res.status(404).json({ error: '找不到这张分账单。' });
      if (rec.state !== 'failed' || rec.wxOrderId) {
        return void res.status(409).json({ error: '只有被微信拒绝、还没受理过的分账单可以重试。', code: 'NOT_RETRYABLE' });
      }
      const s = parseSnapshot(rec.snapshot);
      if (!s) return void res.status(409).json({ error: '订单没有清分快照，无法计算分账金额。', code: 'NO_SNAPSHOT' });
      const full = planSharing(rec.amountFen, s, await deps.loadReceiverMap(), deps.config.maxBp);
      const plan: SharingPlan =
        mode === 'share'
          ? full
          : {
              ...full,
              action: 'unfreeze',
              lines: full.lines.map(l => ({ ...l, shareFen: 0, offlineReason: l.offlineReason ?? 'no_receiver' })),
              sharedFen: 0,
              offlineFen: full.lines.reduce((n, l) => n + l.dueFen, 0),
            };
      const attempt = rec.attempt + 1;
      const ok = await deps.restartRecord(id, { kind: plan.action, attempt, outOrderNo: outOrderNo(rec.paymentId, attempt), plan });
      if (!ok) return void res.status(409).json({ error: '这张分账单的状态已经变了，请重新整理。', code: 'NOT_RETRYABLE' });
      res.json({ ok: true, kind: plan.action });
    } catch (err) {
      fail(res, 'retry', err);
    }
  });
}

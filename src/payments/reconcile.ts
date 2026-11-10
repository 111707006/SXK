/**
 * 對帳補結（2026-11-10 稽核，開關 `PAY_RECONCILE_MINUTES`）。
 *
 * 結算只有兩條路：微信的回調、家長回到頁面時的查單。家長付完直接關掉微信、回調又剛好丟了（部署重啟、網路），
 * 這張單就一直是 pending —— 錢收了，東西沒給。這裡每隔一段時間把「開單 5 分鐘以上、48 小時以內、還是 pending」
 * 的單拿去問微信，付了的走**同一個** `settle`（核對金額、條件式 UPDATE 擋重複，src/payments/paidOrderCheck.ts）。
 *
 * - 只補「付了」的：沒付、關單、查不到的一律不動（不改成 failed —— 那是另一件事，也不急）。
 * - 一次最多問 `batch` 張、一張一張問，不並發：微信查單有頻率限制，主機也小。
 * - 48 小時以前的不問：上線前開的測試單（微信那邊根本沒有）不會每輪都報錯。
 */
export interface PendingOrder {
  outTradeNo: string;
}

export interface RemoteOrder {
  tradeState: string;
  transactionId: string | null;
  amountFen: number | null;
  appid: unknown;
  mchid: unknown;
}

export interface ReconcileDeps {
  listPending: (olderThanMinutes: number, newerThanHours: number, limit: number) => Promise<PendingOrder[]>;
  query: (outTradeNo: string) => Promise<RemoteOrder>;
  settle: (outTradeNo: string, remote: RemoteOrder) => Promise<string>;
  log: (line: string) => void;
}

export interface ReconcileResult {
  checked: number;
  settled: number;
  failed: number;
}

export const RECONCILE_MIN_AGE_MINUTES = 5;
export const RECONCILE_MAX_AGE_HOURS = 48;
export const RECONCILE_BATCH = 50;

export async function reconcilePendingOnce(deps: ReconcileDeps, batch = RECONCILE_BATCH): Promise<ReconcileResult> {
  const pending = await deps.listPending(RECONCILE_MIN_AGE_MINUTES, RECONCILE_MAX_AGE_HOURS, batch);
  const result: ReconcileResult = { checked: 0, settled: 0, failed: 0 };
  for (const order of pending) {
    result.checked += 1;
    try {
      const remote = await deps.query(order.outTradeNo);
      if (remote.tradeState !== 'SUCCESS') continue;
      const outcome = await deps.settle(order.outTradeNo, remote);
      if (outcome === 'granted') {
        result.settled += 1;
        deps.log(`[Reconcile] settled ${order.outTradeNo} (callback never arrived)`);
      }
    } catch (err: any) {
      result.failed += 1;
      deps.log(`[Reconcile] query failed for ${order.outTradeNo}: ${err?.message ?? err}`);
    }
  }
  return result;
}

/** `PAY_RECONCILE_MINUTES`：不設／0＝關；5–1440 分鐘；其他值起不來。 */
export function readReconcileMinutes(raw: string | undefined): number {
  const v = (raw ?? '').trim();
  if (v === '' || v === '0') return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 5 || n > 1440) {
    throw new Error(`PAY_RECONCILE_MINUTES="${raw}" is not recognised: 0 (off) or 5–1440`);
  }
  return n;
}

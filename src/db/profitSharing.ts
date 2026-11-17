/**
 * 微信分账（ADR-0017，開關 `PROFIT_SHARING`）的資料層：`profit_sharing_receivers`、`profit_sharing_orders`。
 * 兩張都是森心康的結算設定與紀錄，不含家長資料（分账單只帶訂單 id）；後台那幾支只給全域管理員。
 */
import type mysql from 'mysql2/promise';
import { getPool } from './mysql';
import { keyOf, type PartyKind, type PlanLine, type Receiver, type ReceiverInput, type RelationType, type SharingPlan } from '../profitSharing/plan';
import type { DuePayment, OpenRecord, RecordPatch, SharingState } from '../profitSharing/run';

function pool(): mysql.Pool {
  const p = getPool();
  if (!p) throw new Error('profitSharing：資料庫沒有設定');
  return p;
}

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);

function parseDetail(raw: unknown): PlanLine[] {
  let x: unknown = raw;
  if (typeof raw === 'string') {
    try {
      x = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(x) ? (x as PlanLine[]) : [];
}

export interface ReceiverRecord extends Receiver {
  id: number;
  wxAddedAt: string | null;
}

function receiverOf(r: any): ReceiverRecord {
  return {
    id: Number(r.id),
    partyKind: r.party_kind === 'company' ? 'company' : 'referrer',
    refId: Number(r.ref_id),
    type: r.account_type === 'MERCHANT_ID' ? 'MERCHANT_ID' : 'PERSONAL_OPENID',
    account: String(r.account),
    name: r.name === null || r.name === undefined ? null : String(r.name),
    relationType: String(r.relation_type) as RelationType,
    active: Number(r.active) === 1,
    registered: r.wx_added_at !== null && r.wx_added_at !== undefined,
    wxAddedAt: iso(r.wx_added_at),
  };
}

export async function listReceivers(): Promise<ReceiverRecord[]> {
  const [rows] = await pool().execute('SELECT * FROM profit_sharing_receivers ORDER BY party_kind, ref_id');
  return (rows as any[]).map(receiverOf);
}

export async function loadReceiverMap(): Promise<Map<string, Receiver>> {
  return new Map((await listReceivers()).map(r => [keyOf(r.partyKind, r.refId), r]));
}

/** 存一個接收方。帳號、類型或名稱一改，就當成微信那邊還沒加過（`wx_added_at` 清掉），要重新加成功才能分。 */
export async function saveReceiver(input: ReceiverInput): Promise<void> {
  await pool().execute(
    `INSERT INTO profit_sharing_receivers (party_kind, ref_id, account_type, account, name, relation_type, active, wx_added_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
     ON DUPLICATE KEY UPDATE
       wx_added_at = IF(account_type = VALUES(account_type) AND account = VALUES(account) AND name <=> VALUES(name), wx_added_at, NULL),
       account_type = VALUES(account_type), account = VALUES(account), name = VALUES(name),
       relation_type = VALUES(relation_type), active = 1`,
    [input.partyKind, input.refId, input.type, input.account, input.name, input.relationType]
  );
}

export async function markReceiverRegistered(partyKind: PartyKind, refId: number): Promise<void> {
  await pool().execute('UPDATE profit_sharing_receivers SET wx_added_at = NOW() WHERE party_kind = ? AND ref_id = ?', [partyKind, refId]);
}

export async function setReceiverActive(partyKind: PartyKind, refId: number, active: boolean): Promise<boolean> {
  const [r] = await pool().execute('UPDATE profit_sharing_receivers SET active = ? WHERE party_kind = ? AND ref_id = ?', [active ? 1 : 0, partyKind, refId]);
  return (r as mysql.ResultSetHeader).affectedRows === 1;
}

/** 開單時記一列：這一筆帶了分账標記。寫不進去就丟錯（呼叫端不往微信下單）。 */
export async function flagPayment(paymentId: number): Promise<void> {
  await pool().execute("INSERT INTO profit_sharing_orders (payment_id, state) VALUES (?, 'awaiting')", [paymentId]);
}

export async function listDue(delayDays: number, limit: number): Promise<DuePayment[]> {
  const [rows] = await pool().query(
    `SELECT o.id AS record_id, pay.id AS payment_id, pay.transaction_id, pay.amount_fen, pay.split_snapshot
       FROM profit_sharing_orders o
       JOIN payments pay ON pay.id = o.payment_id
      WHERE o.state = 'awaiting' AND pay.status = 'success' AND pay.transaction_id IS NOT NULL
        AND pay.paid_at <= NOW() - INTERVAL ? DAY
      ORDER BY pay.paid_at ASC
      LIMIT ?`,
    [delayDays, limit]
  );
  return (rows as any[]).map(r => ({
    recordId: Number(r.record_id),
    paymentId: Number(r.payment_id),
    transactionId: String(r.transaction_id),
    amountFen: Number(r.amount_fen),
    snapshot: r.split_snapshot ?? null,
  }));
}

export async function listOpen(limit: number): Promise<OpenRecord[]> {
  const [rows] = await pool().query(
    `SELECT o.id AS record_id, o.payment_id, o.state, o.kind, o.out_order_no, o.detail, pay.transaction_id
       FROM profit_sharing_orders o
       JOIN payments pay ON pay.id = o.payment_id
      WHERE o.state IN ('created','processing') AND o.out_order_no IS NOT NULL AND pay.transaction_id IS NOT NULL
      ORDER BY o.updated_at ASC
      LIMIT ?`,
    [limit]
  );
  return (rows as any[]).map(r => ({
    recordId: Number(r.record_id),
    paymentId: Number(r.payment_id),
    transactionId: String(r.transaction_id),
    state: r.state === 'processing' ? 'processing' : 'created',
    kind: r.kind === 'unfreeze' ? 'unfreeze' : 'share',
    outOrderNo: String(r.out_order_no),
    detail: parseDetail(r.detail),
  }));
}

type StartInput = { kind: 'share' | 'unfreeze'; attempt: number; outOrderNo: string; plan: SharingPlan };

async function moveToCreated(recordId: number, from: 'awaiting' | 'failed', input: StartInput): Promise<boolean> {
  // failed → created 只在微信沒受理過時（wx_order_id IS NULL）：受理過的那一張資金已經解凍，再送只會被拒
  const [r] = await pool().execute(
    `UPDATE profit_sharing_orders
        SET state = 'created', kind = ?, attempt = ?, out_order_no = ?, detail = ?, shared_fen = ?, offline_fen = ?, error = NULL
      WHERE id = ? AND state = ?${from === 'failed' ? ' AND wx_order_id IS NULL' : ''}`,
    [input.kind, input.attempt, input.outOrderNo, JSON.stringify(input.plan.lines), input.plan.sharedFen, input.plan.offlineFen, recordId, from]
  );
  return (r as mysql.ResultSetHeader).affectedRows === 1;
}

export const startRecord = (recordId: number, input: StartInput): Promise<boolean> => moveToCreated(recordId, 'awaiting', input);
export const restartRecord = (recordId: number, input: StartInput): Promise<boolean> => moveToCreated(recordId, 'failed', input);

export async function updateRecord(recordId: number, patch: RecordPatch): Promise<void> {
  const sets = ['state = ?'];
  const args: unknown[] = [patch.state];
  if (patch.wxOrderId !== undefined) (sets.push('wx_order_id = ?'), args.push(patch.wxOrderId));
  if (patch.sharedFen !== undefined) (sets.push('shared_fen = ?'), args.push(patch.sharedFen));
  if (patch.offlineFen !== undefined) (sets.push('offline_fen = ?'), args.push(patch.offlineFen));
  if (patch.detail !== undefined) (sets.push('detail = ?'), args.push(JSON.stringify(patch.detail)));
  if (patch.error !== undefined) (sets.push('error = ?'), args.push(patch.error));
  args.push(recordId);
  await pool().execute(`UPDATE profit_sharing_orders SET ${sets.join(', ')} WHERE id = ?`, args as any[]);
}

/** 後台看的一列。 */
export interface SharingRecordView {
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

function viewOf(r: any): SharingRecordView {
  return {
    id: Number(r.id),
    paymentId: Number(r.payment_id),
    outTradeNo: String(r.out_trade_no),
    amountFen: Number(r.amount_fen),
    paymentStatus: String(r.status),
    paidAt: iso(r.paid_at),
    state: r.state,
    kind: r.kind ?? null,
    attempt: Number(r.attempt),
    outOrderNo: r.out_order_no ?? null,
    wxOrderId: r.wx_order_id ?? null,
    detail: parseDetail(r.detail),
    sharedFen: Number(r.shared_fen),
    offlineFen: Number(r.offline_fen),
    error: r.error ?? null,
    snapshot: r.split_snapshot ?? null,
    transactionId: r.transaction_id ?? null,
    updatedAt: iso(r.updated_at),
  };
}

const VIEW_SQL = `SELECT o.*, pay.out_trade_no, pay.amount_fen, pay.status, pay.paid_at, pay.split_snapshot, pay.transaction_id
                    FROM profit_sharing_orders o JOIN payments pay ON pay.id = o.payment_id`;

/** 最近的分账單（付了款的才列；沒付的 awaiting 不佔版面）。 */
export async function listRecords(limit: number): Promise<SharingRecordView[]> {
  const [rows] = await pool().query(`${VIEW_SQL} WHERE pay.status IN ('success','refunded') ORDER BY o.id DESC LIMIT ?`, [limit]);
  return (rows as any[]).map(viewOf);
}

export async function findRecord(recordId: number): Promise<SharingRecordView | null> {
  const [rows] = await pool().execute(`${VIEW_SQL} WHERE o.id = ? LIMIT 1`, [recordId]);
  const row = (rows as any[])[0];
  return row ? viewOf(row) : null;
}

/** 用手機號找這個人在服務號底下的 openid（他要先用微信在站上走過一次付款授權）；找不到回 null。 */
export async function findOpenidByPhone(phone: string, appid: string): Promise<string | null> {
  const [rows] = await pool().execute(
    `SELECT w.openid FROM users u JOIN wechat_openids w ON w.user_id = u.id AND w.appid = ?
      WHERE u.phone = ? ORDER BY w.updated_at DESC LIMIT 1`,
    [appid, phone]
  );
  const row = (rows as any[])[0];
  return row && typeof row.openid === 'string' && row.openid !== '' ? row.openid : null;
}

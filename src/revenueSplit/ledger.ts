/**
 * 清分對帳（ADR-0016）：訂單 → 每一列各方金額、合計。後台畫面與 `.xlsx` 匯出共用（純函式，前端可以載）。
 */
import { computeSplit, parseSnapshot, percentLabel, type SplitAmounts, type SplitSnapshot } from './split';

export interface LedgerOrder {
  id: number;
  userId: number;
  outTradeNo: string;
  transactionId: string | null;
  scope: 't2' | 't3' | 'plan';
  months: number | null;
  amountFen: number;
  status: 'success' | 'refunded';
  paidAt: string | null;
  snapshot: unknown;
}

export interface LedgerRow {
  id: number;
  userId: number;
  outTradeNo: string;
  transactionId: string | null;
  product: string;
  status: 'success' | 'refunded';
  paidAt: string | null;
  /** 「平台」「合作公司 · 某公司」「推荐人 · 王老师（治疗师）」「某公司 ＋ 王老师（治疗师）」；沒記快照是「未记录」。 */
  party: string;
  companyName: string | null;
  referrerName: string | null;
  /** 「平台 20% · 公司 20%／治疗师 80%」。 */
  rates: string;
  /** 沒記快照是 null（不猜）。退款的照樣算出原本該分多少，`status` 另外標。 */
  amounts: SplitAmounts | null;
}

const PRODUCT: Record<LedgerOrder['scope'], string> = { t2: 'T2 深度评估', t3: 'T3 单项', plan: '训练计划' };
const KIND = { channel: '渠道商', therapist: '治疗师' } as const;

function partyOf(s: SplitSnapshot): { party: string; companyName: string | null; referrerName: string | null } {
  const p = s.party;
  switch (p.kind) {
    case 'none':
      return { party: '平台（无合作方）', companyName: null, referrerName: null };
    case 'company':
      return { party: `合作公司 · ${p.companyName}`, companyName: p.companyName, referrerName: null };
    case 'referrer':
      return { party: `推荐人 · ${p.referrerName}（${KIND[p.referrerKind]}）`, companyName: null, referrerName: p.referrerName };
    case 'company_referrer':
      return {
        party: `${p.companyName} ＋ ${p.referrerName}（${KIND[p.referrerKind]}）`,
        companyName: p.companyName,
        referrerName: p.referrerName,
      };
  }
}

function ratesOf(s: SplitSnapshot): string {
  if (s.party.kind === 'none') return '平台 100%';
  const head = `平台 ${percentLabel(s.platformBp)}`;
  if (s.party.kind !== 'company_referrer') return head;
  const c = s.companyBp ?? 0;
  return `${head} · 公司 ${percentLabel(c)}／${KIND[s.party.referrerKind]} ${percentLabel(10000 - c)}`;
}

export function ledgerRows(orders: ReadonlyArray<LedgerOrder>): LedgerRow[] {
  return orders.map(o => {
    const product = o.scope === 'plan' && o.months ? `${PRODUCT.plan} ${o.months} 个月` : PRODUCT[o.scope];
    const base = { id: o.id, userId: o.userId, outTradeNo: o.outTradeNo, transactionId: o.transactionId, product, status: o.status, paidAt: o.paidAt };
    const s = parseSnapshot(o.snapshot);
    if (!s) return { ...base, party: '未记录', companyName: null, referrerName: null, rates: '', amounts: null };
    return { ...base, ...partyOf(s), rates: ratesOf(s), amounts: computeSplit(o.amountFen, s) };
  });
}

export interface LedgerTotals {
  orders: number;
  /** 沒記快照的筆數（不進下面的合計）。 */
  unrecorded: number;
  amountFen: number;
  feeFen: number;
  netFen: number;
  platformFen: number;
  companyFen: number;
  referrerFen: number;
}

/** 合計只算付款成功、有快照的；退款的不算進要分的錢。 */
export function ledgerTotals(rows: ReadonlyArray<LedgerRow>): LedgerTotals {
  const t: LedgerTotals = { orders: 0, unrecorded: 0, amountFen: 0, feeFen: 0, netFen: 0, platformFen: 0, companyFen: 0, referrerFen: 0 };
  for (const r of rows) {
    if (r.status !== 'success') continue;
    if (!r.amounts) {
      t.unrecorded++;
      continue;
    }
    t.orders++;
    t.amountFen += r.amounts.amountFen;
    t.feeFen += r.amounts.feeFen;
    t.netFen += r.amounts.netFen;
    t.platformFen += r.amounts.platformFen;
    t.companyFen += r.amounts.companyFen;
    t.referrerFen += r.amounts.referrerFen;
  }
  return t;
}

/** 依對方合計（給「這個月要付誰多少」看）：只算付款成功、有快照的。鍵是對方那一格的字。 */
export function ledgerByParty(rows: ReadonlyArray<LedgerRow>): Array<{ party: string; orders: number; companyFen: number; referrerFen: number; platformFen: number }> {
  const m = new Map<string, { party: string; orders: number; companyFen: number; referrerFen: number; platformFen: number }>();
  for (const r of rows) {
    if (r.status !== 'success' || !r.amounts) continue;
    const e = m.get(r.party) ?? { party: r.party, orders: 0, companyFen: 0, referrerFen: 0, platformFen: 0 };
    e.orders++;
    e.companyFen += r.amounts.companyFen;
    e.referrerFen += r.amounts.referrerFen;
    e.platformFen += r.amounts.platformFen;
    m.set(r.party, e);
  }
  return [...m.values()].sort((a, b) => b.companyFen + b.referrerFen - (a.companyFen + a.referrerFen) || (a.party < b.party ? -1 : 1));
}

/** 分 → 「199.00」。 */
export function yuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

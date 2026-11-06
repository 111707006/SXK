/**
 * 清分（客戶 11/03〈清分〉，ADR-0016）：每一筆訂單成立時記下「這一筆怎麼分」，之後照記下的算出各方金額。
 *
 * 【這一層】純函式：沒有 I/O、沒有時鐘。伺服器開單時呼叫 `resolveSplit`（比例設定＋這位家長的歸屬 → 快照），
 * 存進 `payments.split_snapshot`；後台對帳時呼叫 `computeSplit`（金額＋快照 → 各方的分）。
 *
 * 【誰是對方】（暫採，ADR-0016）
 * 1. 家長綁了推薦人（`referrer_bindings`）：
 *    - 推薦人隸屬合作公司 → 三方：平台、合作公司、治療師（推薦人）。平台比例看那家公司的設定；
 *      公司與治療師之間再分一次，看那位推薦人的設定、沒有再看公司的、再沒有用預設。
 *    - 沒有隸屬 → 兩方：平台、推薦人。平台比例看那位推薦人的設定，沒有用預設。
 * 2. 沒綁推薦人、家長歸屬某家合作公司（進站代號 `?c=`）→ 兩方：平台、合作公司。
 * 3. 都沒有 → 全部是平台的。
 *
 * 【怎麼算】分的是扣掉微信手續費之後的金額（`feeBp`，萬分比，開單時的設定記在快照上）：
 * 手續費＝金額 × feeBp ÷ 10000 四捨五入；對方的份＝淨額 ×（1 − 平台比例）往下取整；
 * 三方時公司的份＝對方的份 × 公司比例 往下取整、治療師拿剩下的；平台拿淨額扣掉其餘（所有取整的零頭歸平台）。
 */

/** 萬分比：2000 ＝ 20%。 */
export type Bp = number;

export const BP_MAX = 10000;
/** 預設：平台 20%、對方 80%；三方時合作公司 20%、治療師 80%（客戶 11/03）。 */
export const DEFAULT_PLATFORM_BP: Bp = 2000;
export const DEFAULT_COMPANY_BP: Bp = 2000;
/** 微信支付手續費（暫採 0.6%，一般行業費率；以商戶號實際簽的為準，`WECHAT_FEE_BP` 可改）。 */
export const DEFAULT_FEE_BP: Bp = 60;

export function isBp(x: unknown): x is Bp {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= BP_MAX;
}

/** 一組設定。`null` ＝ 沒設，往上一層找。 */
export interface RateRow {
  /** 平台拿淨額的幾成。 */
  platformBp: Bp | null;
  /** 三方時合作公司拿「對方那一份」的幾成（其餘給治療師）。 */
  companyBp: Bp | null;
}

export interface SplitRates {
  /** 預設那一組；資料庫沒有那一列時兩個都是 `null`，用程式裡的預設值。 */
  default: RateRow;
  company: ReadonlyMap<number, RateRow>;
  referrer: ReadonlyMap<number, RateRow>;
}

/** 這位家長的歸屬（開單那一刻讀出來的）。名字一起記，對帳時公司改名、推薦人停用也看得出是誰。 */
export interface SplitAttribution {
  company: { id: number; name: string } | null;
  referrer: { id: number; name: string; kind: 'channel' | 'therapist'; company: { id: number; name: string } | null } | null;
}

export type SplitParty =
  | { kind: 'none' }
  | { kind: 'company'; companyId: number; companyName: string }
  | { kind: 'referrer'; referrerId: number; referrerName: string; referrerKind: 'channel' | 'therapist' }
  | {
      kind: 'company_referrer';
      companyId: number;
      companyName: string;
      referrerId: number;
      referrerName: string;
      referrerKind: 'channel' | 'therapist';
    };

/** 存在 `payments.split_snapshot` 的那一份。 */
export interface SplitSnapshot {
  v: 1;
  party: SplitParty;
  feeBp: Bp;
  platformBp: Bp;
  /** 只有 `company_referrer` 有。 */
  companyBp: Bp | null;
}

const pick = (...xs: Array<Bp | null | undefined>): Bp | null => {
  for (const x of xs) if (x !== null && x !== undefined) return x;
  return null;
};

/** 比例設定＋歸屬 → 這一筆的快照（檔頭「誰是對方」）。 */
export function resolveSplit(rates: SplitRates, who: SplitAttribution, feeBp: Bp = DEFAULT_FEE_BP): SplitSnapshot {
  if (!isBp(feeBp)) throw new Error(`revenueSplit：手續費要是 0–10000 的整數萬分比，拿到 ${feeBp}`);
  const dflt = rates.default;
  const r = who.referrer;
  if (r && r.company) {
    const c = rates.company.get(r.company.id);
    const ref = rates.referrer.get(r.id);
    return {
      v: 1,
      party: {
        kind: 'company_referrer',
        companyId: r.company.id,
        companyName: r.company.name,
        referrerId: r.id,
        referrerName: r.name,
        referrerKind: r.kind,
      },
      feeBp,
      platformBp: pick(c?.platformBp, dflt.platformBp) ?? DEFAULT_PLATFORM_BP,
      companyBp: pick(ref?.companyBp, c?.companyBp, dflt.companyBp) ?? DEFAULT_COMPANY_BP,
    };
  }
  if (r) {
    const ref = rates.referrer.get(r.id);
    return {
      v: 1,
      party: { kind: 'referrer', referrerId: r.id, referrerName: r.name, referrerKind: r.kind },
      feeBp,
      platformBp: pick(ref?.platformBp, dflt.platformBp) ?? DEFAULT_PLATFORM_BP,
      companyBp: null,
    };
  }
  if (who.company) {
    const c = rates.company.get(who.company.id);
    return {
      v: 1,
      party: { kind: 'company', companyId: who.company.id, companyName: who.company.name },
      feeBp,
      platformBp: pick(c?.platformBp, dflt.platformBp) ?? DEFAULT_PLATFORM_BP,
      companyBp: null,
    };
  }
  return { v: 1, party: { kind: 'none' }, feeBp, platformBp: BP_MAX, companyBp: null };
}

export interface SplitAmounts {
  amountFen: number;
  feeFen: number;
  netFen: number;
  platformFen: number;
  companyFen: number;
  referrerFen: number;
}

/** 金額（分）＋快照 → 各方的分。加總恆等於淨額。 */
export function computeSplit(amountFen: number, s: SplitSnapshot): SplitAmounts {
  if (!Number.isInteger(amountFen) || amountFen < 0) throw new Error(`revenueSplit：金額要是非負整數（分），拿到 ${amountFen}`);
  const feeFen = Math.min(amountFen, Math.floor((amountFen * s.feeBp) / BP_MAX + 0.5));
  const netFen = amountFen - feeFen;
  const counterFen = s.party.kind === 'none' ? 0 : Math.floor((netFen * (BP_MAX - s.platformBp)) / BP_MAX);
  let companyFen = 0;
  let referrerFen = 0;
  switch (s.party.kind) {
    case 'company':
      companyFen = counterFen;
      break;
    case 'referrer':
      referrerFen = counterFen;
      break;
    case 'company_referrer':
      companyFen = Math.floor((counterFen * (s.companyBp ?? DEFAULT_COMPANY_BP)) / BP_MAX);
      referrerFen = counterFen - companyFen;
      break;
  }
  return { amountFen, feeFen, netFen, platformFen: netFen - companyFen - referrerFen, companyFen, referrerFen };
}

/** 讀回存著的快照；形狀不對回 `null`（對帳表上寫「未记录」，不猜）。 */
export function parseSnapshot(raw: unknown): SplitSnapshot | null {
  let x: unknown = raw;
  if (typeof raw === 'string') {
    try {
      x = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || !isBp(o.feeBp) || !isBp(o.platformBp)) return null;
  if (!(o.companyBp === null || isBp(o.companyBp))) return null;
  const p = o.party as Record<string, unknown> | null;
  if (typeof p !== 'object' || p === null) return null;
  const id = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
  const str = (v: unknown) => typeof v === 'string';
  const rk = (v: unknown) => v === 'channel' || v === 'therapist';
  switch (p.kind) {
    case 'none':
      break;
    case 'company':
      if (!id(p.companyId) || !str(p.companyName)) return null;
      break;
    case 'referrer':
      if (!id(p.referrerId) || !str(p.referrerName) || !rk(p.referrerKind)) return null;
      break;
    case 'company_referrer':
      if (!id(p.companyId) || !str(p.companyName) || !id(p.referrerId) || !str(p.referrerName) || !rk(p.referrerKind)) return null;
      if (o.companyBp === null) return null;
      break;
    default:
      return null;
  }
  return o as unknown as SplitSnapshot;
}

/** 後台輸入的百分比（0–100，最多兩位小數）→ 萬分比；`null`／空字串＝清掉（沿用上一層）。認不得回 `undefined`。 */
export function bpFromPercent(raw: unknown): Bp | null | undefined {
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{1,3}(\.\d{1,2})?$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  const bp = Math.round(n * 100);
  return Math.abs(bp - n * 100) < 1e-6 ? bp : undefined;
}

/** 2000 → 「20%」，1250 → 「12.5%」。 */
export function percentLabel(bp: Bp): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}

/** 讀伺服器的手續費設定（`WECHAT_FEE_BP`）：不設＝預設；認不得起不來。 */
export function resolveFeeBp(raw: string | undefined): Bp {
  if (raw === undefined || raw === '') return DEFAULT_FEE_BP;
  const n = Number(raw);
  if (!/^\d{1,5}$/.test(raw) || !isBp(n) || n > 1000) {
    throw new Error(`WECHAT_FEE_BP is not recognised: ${JSON.stringify(raw)}. 要是 0–1000 的整數萬分比（60＝0.6%）。`);
  }
  return n;
}

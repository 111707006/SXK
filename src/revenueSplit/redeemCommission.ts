/**
 * 兌換碼的佣金（ADR-0020 第 7 點，#122）：碼發給推薦人，同時算推薦人與所屬單位，比例同清分（預設單位 20%、推薦人 80%）。
 * 純函式，前端也能載。
 *
 * 【暫採】（#122 已在議題上問使用者，答覆前照這樣）
 * - 碼沒有價錢：面額＝那個月數的訓練計劃價錢（`TRAINING_PLAN_PRICES_FEN`）。沒設價錢、或那個月數沒有價錢 → 空白，不猜。
 * - 不扣平台那一份、不扣微信手續費（碼不經微信付款）：整個面額在單位與推薦人之間分。
 * - 單位與推薦人怎麼分看清分的公司比例：推薦人自己的 → 單位的 → 預設 → 20%（與清分三方時同一條）；
 *   用的是**匯出當下**的比例（碼沒有開單那一刻可以記快照）。
 * - 只算已用的碼；推薦人沒有隸屬單位 → 空白（ADR-0020 之後推薦人一律屬於某個單位，舊資料才會沒有）。
 * - 單位往下取整、零頭歸推薦人（同清分三方）。
 */
import { BP_MAX, DEFAULT_COMPANY_BP, type RateRow, type SplitRates } from './split';

/** 後台讀出的比例列（`adminStore.listSplitRates`）→ 設定。只用得到公司比例，篩查渠道比例不看。 */
export function ratesFromRecords(
  records: ReadonlyArray<{ scope: 'default' | 'company' | 'referrer'; refId: number; platformBp: number | null; companyBp: number | null }>
): SplitRates {
  let dflt: RateRow = { platformBp: null, companyBp: null };
  const company = new Map<number, RateRow>();
  const referrer = new Map<number, RateRow>();
  for (const r of records) {
    const row = { platformBp: r.platformBp, companyBp: r.companyBp };
    if (r.scope === 'default') dflt = row;
    else if (r.scope === 'company') company.set(r.refId, row);
    else referrer.set(r.refId, row);
  }
  return { default: dflt, company, referrer };
}

export interface RedeemCommissionInput {
  months: number;
  status: 'unused' | 'used' | 'void';
  referrerId: number;
  /** 推薦人隸屬的單位；沒有是 null。 */
  companyId: number | null;
}

export interface RedeemCommission {
  faceFen: number;
  companyFen: number;
  referrerFen: number;
}

export function redeemCommission(
  code: RedeemCommissionInput,
  prices: Partial<Record<number, number>> | null,
  rates: SplitRates,
): RedeemCommission | null {
  if (code.status !== 'used' || code.companyId === null) return null;
  const faceFen = prices?.[code.months];
  if (faceFen === undefined || !Number.isInteger(faceFen) || faceFen <= 0) return null;
  const pick = [rates.referrer.get(code.referrerId)?.companyBp, rates.company.get(code.companyId)?.companyBp, rates.default.companyBp];
  const bp = pick.find(x => x !== null && x !== undefined) ?? DEFAULT_COMPANY_BP;
  const companyFen = Math.floor((faceFen * bp) / BP_MAX);
  return { faceFen, companyFen, referrerFen: faceFen - companyFen };
}

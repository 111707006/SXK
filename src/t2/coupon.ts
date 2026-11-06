/**
 * T1 → T2 優惠券（客戶 11/03 簡報第 21、29 頁，規格 `docs/specs/client-changes-2026-11-03.md`〈優惠券〉，開關 `T2_COUPON`）。
 * 與「VIP 兑换」（換線上家庭訓練的使用期，`src/redeem/`、`src/db/redeemCodes.ts`）是兩條線：這一條只折 T2 的價錢。
 *
 * - 折扣存在**批次**上（一批碼同一種折法），後台可改；預設半價（五折）。
 * - 兩種折法：`percent`＝打幾折，`value` 是**實付的百分比**（50＝五折＝半價，85＝八五折）；
 *   `amount`＝減固定金額，`value` 是分。
 * - 折完至少 1 分（微信支付的下限）；不會折成 0 或負數。
 *
 * 碼的形狀沿用兌換碼（10 碼、去掉易混字元，`src/redeem/codes.ts`）。純函式，前端與伺服器共用。
 */
import { formatFen } from '../utils/price';

export type CouponDiscountKind = 'percent' | 'amount';

export interface CouponDiscount {
  kind: CouponDiscountKind;
  value: number;
}

/** 預設半價（使用者 2026-11-06）。 */
export const DEFAULT_COUPON_DISCOUNT: CouponDiscount = { kind: 'percent', value: 50 };

/** 減固定金額的上限（分）：¥1000，比 T2 最高的套餐價高很多，打錯數字才會超過。 */
export const MAX_COUPON_AMOUNT_FEN = 100000;

/** 一批最多幾張（同兌換碼）。 */
export const MAX_COUPON_BATCH = 500;

/** 批次備註的長度上限（給後台自己認批次用，不給家長看）。 */
export const MAX_COUPON_NOTE = 40;

/** 送上來的折扣 → 認得的折扣；不對回 null。打折 1–99（100 等於沒折），減額 1 分到 ¥1000。 */
export function readCouponDiscount(kind: unknown, value: unknown): CouponDiscount | null {
  if (!Number.isInteger(value)) return null;
  const v = value as number;
  if (kind === 'percent') return v >= 1 && v <= 99 ? { kind, value: v } : null;
  if (kind === 'amount') return v >= 1 && v <= MAX_COUPON_AMOUNT_FEN ? { kind, value: v } : null;
  return null;
}

/** 原價（分）→ 折後價（分），至少 1 分。原價不是正整數就原樣回（不該發生；不讓它變成某個價錢）。 */
export function applyCouponDiscount(priceFen: number, discount: CouponDiscount): number {
  if (!Number.isInteger(priceFen) || priceFen <= 0) return priceFen;
  const off = discount.kind === 'percent' ? Math.round((priceFen * discount.value) / 100) : priceFen - discount.value;
  return Math.max(1, Math.min(priceFen, off));
}

/** 給人看的折法：「5 折」「8.5 折」「减 ¥10」。 */
export function couponDiscountLabel(discount: CouponDiscount): string {
  if (discount.kind === 'percent') return `${String(discount.value / 10)} 折`;
  return `减 ¥${formatFen(discount.value)}`;
}

/** 到期日（`YYYY-MM-DD`，含當天）還能不能兌；`null`＝不過期。 */
export function couponOpenOn(expiresOn: string | null, today: string): boolean {
  return expiresOn === null || today <= expiresOn;
}

/** 後台送的到期日：空的／null＝不過期；要是真的日期。不對回 undefined。 */
export function readCouponExpiry(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [y, m, d] = raw.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return days !== undefined && d >= 1 && d <= days ? raw : undefined;
}

/** 家長端看到的「我用了哪一張」（`GET /api/t2/coupon`）。 */
export interface ParentCoupon {
  /** 顯示用的碼 `XXXX-XXXX-XX`。 */
  code: string;
  discount: CouponDiscount;
  label: string;
}

// 家長端的字（輸入欄）
export const COUPON_FIELD_LABEL = '优惠码兑换';
export const COUPON_FIELD_PLACEHOLDER = '输入优惠码';
export const COUPON_FIELD_SUBMIT = '兑换';
export const COUPON_INVALID = '优惠码不正确、已使用或已过期';
export const COUPON_ALREADY_CLAIMED = '每位家长只能使用一次优惠码';
export const COUPON_RATE_LIMITED = '试得太多次了，请过一小时再试。';
export const couponAppliedLine = (c: ParentCoupon) => `已使用优惠码 ${c.code}（${c.label}）`;
export const COUPON_PRICE_LABEL = '折后价';

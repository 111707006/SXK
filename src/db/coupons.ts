/**
 * 家長用優惠券（客戶 11/03，開關 `T2_COUPON`，`src/t2/coupon.ts`）。後台的產碼、列碼、改折法、作廢在 `src/admin/adminStore.ts`。
 *
 * 兌換那一刻就算用掉：碼從「未用」改「已用」、綁在這位家長身上（`used_by`）。之後這位家長的 T2 訂單照那一批的折法收
 * （`/api/payment/create`）。每位家長只能用一張：`coupon_codes.used_by` 是 UNIQUE，兩個分頁同時兌兩張只有一張改得到。
 */
import { getPool } from './mysql';
import type { CouponDiscount } from '../t2/coupon';

export type CouponClaimOutcome =
  | { ok: true; coupon: StoredCoupon }
  | { ok: false; reason: 'invalid' | 'already_claimed' };

export interface StoredCoupon {
  id: number;
  code: string;
  discount: CouponDiscount;
}

function rowToCoupon(row: any): StoredCoupon {
  return {
    id: Number(row.id),
    code: String(row.code),
    discount: { kind: row.discount_kind === 'amount' ? 'amount' : 'percent', value: Number(row.discount_value) },
  };
}

/** 這位家長用掉的那一張（沒有回 null）。折法讀批次現在的值（後台改了就跟著改）。 */
export async function couponOfUser(userId: number): Promise<StoredCoupon | null> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT c.id, c.code, b.discount_kind, b.discount_value
       FROM coupon_codes c JOIN coupon_batches b ON b.id = c.batch_id
      WHERE c.used_by = ? AND c.status = 'used' LIMIT 1`,
    [userId],
  );
  const row = (rows as any[])[0];
  return row ? rowToCoupon(row) : null;
}

/**
 * 兌一張。`today`（Asia/Shanghai 的日期）由伺服器給，過期的那一批（`expires_on < today`）兌不到。
 * 已用、作廢、不存在、過期都是 `invalid`（不告訴試碼的人是哪一種）；這位家長已經用過一張是 `already_claimed`。
 */
export async function claimCouponForUser(userId: number, code: string, today: string): Promise<CouponClaimOutcome> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  if (await couponOfUser(userId)) return { ok: false, reason: 'already_claimed' };
  try {
    const [upd] = await p.execute(
      `UPDATE coupon_codes c JOIN coupon_batches b ON b.id = c.batch_id
          SET c.status = 'used', c.used_by = ?, c.used_at = NOW()
        WHERE c.code = ? AND c.status = 'unused' AND (b.expires_on IS NULL OR b.expires_on >= ?)`,
      [userId, code, today],
    );
    if ((upd as { affectedRows: number }).affectedRows !== 1) return { ok: false, reason: 'invalid' };
  } catch (err: any) {
    // 同一位家長同時兌兩張：第二張撞 `uk_coupon_codes_used_by`，那一張沒改到（整句退回）
    if (err?.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'already_claimed' };
    throw err;
  }
  const coupon = await couponOfUser(userId);
  if (!coupon) throw new Error('coupon claimed but not readable');
  return { ok: true, coupon };
}

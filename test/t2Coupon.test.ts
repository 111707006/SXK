import { describe, it, expect } from 'vitest';
import {
  applyCouponDiscount,
  couponDiscountLabel,
  couponOpenOn,
  DEFAULT_COUPON_DISCOUNT,
  readCouponDiscount,
  readCouponExpiry,
} from '../src/t2/coupon';
import { discountFromInput, inputFromDiscount } from '../src/admin/panels/CouponsPanel';

/** T2 優惠券的折扣計算（客戶 11/03，`src/t2/coupon.ts`）。 */
describe('折扣計算', () => {
  it('預設半價：¥19.9 → ¥9.95，¥29.9 → ¥14.95', () => {
    expect(DEFAULT_COUPON_DISCOUNT).toEqual({ kind: 'percent', value: 50 });
    expect(applyCouponDiscount(1990, DEFAULT_COUPON_DISCOUNT)).toBe(995);
    expect(applyCouponDiscount(2990, DEFAULT_COUPON_DISCOUNT)).toBe(1495);
  });

  it('打折四捨五入到分', () => {
    expect(applyCouponDiscount(1990, { kind: 'percent', value: 85 })).toBe(1692); // 1691.5
    expect(applyCouponDiscount(3990, { kind: 'percent', value: 1 })).toBe(40);
  });

  it('減固定金額；減到不夠時收 1 分，不會是 0 或負數', () => {
    expect(applyCouponDiscount(1990, { kind: 'amount', value: 1000 })).toBe(990);
    expect(applyCouponDiscount(1990, { kind: 'amount', value: 1990 })).toBe(1);
    expect(applyCouponDiscount(1990, { kind: 'amount', value: 50000 })).toBe(1);
    expect(applyCouponDiscount(1, { kind: 'percent', value: 1 })).toBe(1);
  });

  it('原價不是正整數就原樣回，不變成某個價錢', () => {
    expect(applyCouponDiscount(0, DEFAULT_COUPON_DISCOUNT)).toBe(0);
    expect(applyCouponDiscount(19.9, DEFAULT_COUPON_DISCOUNT)).toBe(19.9);
  });

  it('給人看的折法', () => {
    expect(couponDiscountLabel({ kind: 'percent', value: 50 })).toBe('5 折');
    expect(couponDiscountLabel({ kind: 'percent', value: 85 })).toBe('8.5 折');
    expect(couponDiscountLabel({ kind: 'amount', value: 1000 })).toBe('减 ¥10');
    expect(couponDiscountLabel({ kind: 'amount', value: 990 })).toBe('减 ¥9.9');
  });
});

describe('後台送的折扣與到期日', () => {
  it.each([
    ['percent', 50, { kind: 'percent', value: 50 }],
    ['percent', 99, { kind: 'percent', value: 99 }],
    ['amount', 1, { kind: 'amount', value: 1 }],
    ['amount', 100000, { kind: 'amount', value: 100000 }],
  ])('%s %s 收', (kind, value, want) => {
    expect(readCouponDiscount(kind, value)).toEqual(want);
  });

  it.each([
    ['percent', 0], ['percent', 100], ['percent', 50.5], ['amount', 0], ['amount', 100001], ['amount', '100'], ['free', 50], [undefined, 50],
  ])('%s %s 退', (kind, value) => {
    expect(readCouponDiscount(kind, value)).toBeNull();
  });

  it('到期日含當天；null 不過期', () => {
    expect(couponOpenOn('2026-11-30', '2026-11-30')).toBe(true);
    expect(couponOpenOn('2026-11-30', '2026-12-01')).toBe(false);
    expect(couponOpenOn(null, '2099-01-01')).toBe(true);
  });

  it('到期日格式', () => {
    expect(readCouponExpiry('')).toBeNull();
    expect(readCouponExpiry(null)).toBeNull();
    expect(readCouponExpiry('2026-12-31')).toBe('2026-12-31');
    expect(readCouponExpiry('2026-02-30')).toBeUndefined();
    expect(readCouponExpiry('明天')).toBeUndefined();
  });
});

describe('後台畫面的輸入', () => {
  it('打折填「几折」、減額填元', () => {
    expect(discountFromInput('percent', '5')).toEqual({ kind: 'percent', value: 50 });
    expect(discountFromInput('percent', '8.5')).toEqual({ kind: 'percent', value: 85 });
    expect(discountFromInput('percent', '10')).toBeNull();
    expect(discountFromInput('percent', '8.55')).toBeNull();
    expect(discountFromInput('amount', '10')).toEqual({ kind: 'amount', value: 1000 });
    expect(discountFromInput('amount', '9.9')).toEqual({ kind: 'amount', value: 990 });
    expect(discountFromInput('amount', '')).toBeNull();
    expect(inputFromDiscount({ kind: 'percent', value: 50 })).toBe('5');
    expect(inputFromDiscount({ kind: 'amount', value: 990 })).toBe('9.9');
  });
});

import { describe, it, expect } from 'vitest';
import { assertDistinctTestCodes, resolveTestCode, TEST_COUPON_DISCOUNT, TEST_VIP_MONTHS } from '../src/redeem/testCodes';
import { applyCouponDiscount } from '../src/t2/coupon';

describe('測試用的可重複使用碼（TEST_VIP_CODE／TEST_COUPON_CODE）', () => {
  it('不設＝沒有；大小寫與分隔符不拘', () => {
    expect(resolveTestCode('TEST_VIP_CODE', undefined)).toBeNull();
    expect(resolveTestCode('TEST_VIP_CODE', '  ')).toBeNull();
    expect(resolveTestCode('TEST_VIP_CODE', 'abcd-efgh-jk')).toBe('ABCDEFGHJK');
  });

  it('形狀不對起不來（太短、含 0／1／I／O）', () => {
    for (const bad of ['ABC', 'ABCD-EFGH-J0', 'IIII-OOOO-11']) {
      expect(() => resolveTestCode('TEST_VIP_CODE', bad)).toThrow(/TEST_VIP_CODE/);
    }
  });

  it('兩個測試碼不能一樣', () => {
    expect(() => assertDistinctTestCodes('ABCDEFGHJK', 'ABCDEFGHJK')).toThrow();
    expect(() => assertDistinctTestCodes('ABCDEFGHJK', 'ZZZZZZZZZZ')).not.toThrow();
    expect(() => assertDistinctTestCodes(null, null)).not.toThrow();
  });

  it('VIP 一次一個月、優惠券半價', () => {
    expect(TEST_VIP_MONTHS).toBe(1);
    expect(applyCouponDiscount(1990, TEST_COUPON_DISCOUNT)).toBe(995);
  });
});

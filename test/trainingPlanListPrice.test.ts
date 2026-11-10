import { describe, expect, it } from 'vitest';
import { PLAN_LIST_PRICE_FEN, planListPriceFen, planYuan } from '../src/t2/trainingPlanCopy';

describe('訓練方案的原價（使用者 2026-11-10：文字文稿16 原價 199／399／699／999、實收 19.9／29.9／39.9／99.9）', () => {
  it('四個方案都有原價', () => {
    expect(PLAN_LIST_PRICE_FEN).toEqual({ 1: 19900, 3: 39900, 6: 69900, 12: 99900 });
  });

  it('實收是折扣價時畫原價；實收不低於原價、或讀不到價錢時不畫', () => {
    expect(planListPriceFen(1, 1990)).toBe(19900);
    expect(planListPriceFen(3, 2990)).toBe(39900);
    expect(planListPriceFen(6, 3990)).toBe(69900);
    expect(planListPriceFen(12, 9990)).toBe(99900);
    expect(planListPriceFen(3, 39900)).toBeNull();
    expect(planListPriceFen(6, null)).toBeNull();
  });

  it('顯示的金額', () => {
    expect([1990, 2990, 3990, 19900, 29900, 39900].map(planYuan)).toEqual(['¥19.9', '¥29.9', '¥39.9', '¥199', '¥299', '¥399']);
  });
});

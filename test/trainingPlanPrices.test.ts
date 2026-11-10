import { describe, it, expect } from 'vitest';
import { resolvePlanPrices } from '../src/t2/trainingPlanPrices';

/** 訓練計劃價錢的設定（#111）：1／3／6 都要、12 可省、正整數；認不得起不來；沒設＝價格待定。 */
describe('TRAINING_PLAN_PRICES_FEN', () => {
  it('沒設是 null', () => {
    expect(resolvePlanPrices(undefined)).toBeNull();
    expect(resolvePlanPrices('  ')).toBeNull();
  });

  it('讀得懂（順序不拘、空白不拘）', () => {
    expect(resolvePlanPrices('6:13990, 1:2990 ,3:7990')).toEqual({ 1: 2990, 3: 7990, 6: 13990 });
    expect(resolvePlanPrices('1:1990,3:2990,6:3990,12:9990')).toEqual({ 1: 1990, 3: 2990, 6: 3990, 12: 9990 });
  });

  it.each(['1:2990,3:7990', '1:2990,3:7990,6:0', '1:2990,3:7990,6:13990,24:1', '1:2990,3:7990,6:13990,12:0', '1:2990,1:2990,6:1', '1=2990,3:7990,6:13990', 'abc'])('認不得：%s', raw => {
    expect(() => resolvePlanPrices(raw)).toThrow(/TRAINING_PLAN_PRICES_FEN/);
  });
});

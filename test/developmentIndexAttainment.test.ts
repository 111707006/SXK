import { describe, it, expect } from 'vitest';
import { attainmentIndex, attainmentRate } from '../src/developmentIndex/attainment';
import { developmentIndexFor, resolveDevIndexBasis } from '../src/developmentIndex/basis';
import { developmentIndex } from '../src/developmentIndex/developmentIndex';
import { T1_AGE_BANDS } from '../src/t1Data';
import { bandScores } from './helpers/t1Scores';

/**
 * 發育指數的達成率算法（開關 `DEV_INDEX_BASIS=attainment`）：照客戶 SXK-ASQ3 HTML，
 * `Math.round(總分 / 滿分 × 100)`，85／70／55 分檔，55 以下再以 40 切（暫採）。
 */

/** 九維總分恰好是 `total`（0–72）：從第一維開始，每題給 2 直到用完，剩下的 1 分給下一題。 */
function withTotal(age: number, total: number) {
  let left = total;
  return bandScores(age, () => {
    const v = Math.min(2, left) as 0 | 1 | 2;
    left -= v;
    return v;
  });
}

describe('attainmentRate', () => {
  it('照客戶的四捨五入：61/72＝84.7 → 85、60/72＝83.3 → 83', () => {
    expect(attainmentRate(withTotal(30, 72))).toBe(100);
    expect(attainmentRate(withTotal(30, 61))).toBe(85);
    expect(attainmentRate(withTotal(30, 60))).toBe(83);
    expect(attainmentRate(withTotal(30, 0))).toBe(0);
  });

  it('九維不齊、分數壞掉、不是陣列 → null', () => {
    expect(attainmentRate(withTotal(30, 72).slice(1))).toBeNull();
    const bad = withTotal(30, 72);
    bad[0] = { ...bad[0], score: 9 };
    expect(attainmentRate(bad)).toBeNull();
    expect(attainmentRate(null)).toBeNull();
    expect(attainmentRate([])).toBeNull();
  });

  it('各維落在不同年齡段（跨了兩次篩查，題目不是同一份）→ null', () => {
    const mixed = [...withTotal(30, 72).slice(0, 8), withTotal(60, 72)[8]];
    expect(attainmentRate(mixed)).toBeNull();
  });

  it('只看 T1：T2／T3 的成績不算進去', () => {
    const scores = [...withTotal(30, 72), { dimensionId: 'language', tierId: 'T2', score: 0, maxScore: 8 }];
    expect(attainmentRate(scores)).toBe(100);
  });
});

describe('attainmentIndex', () => {
  it.each([
    [72, 100], [61, 100], // 85
    [60, 90], [51, 90], // 83、71
    [50, 80], [40, 80], // 69、56
    [39, 75], [29, 75], // 54、40
    [28, 70], [0, 70], // 39、0
  ])('總分 %i/72 → %i', (total, expected) => {
    expect(attainmentIndex(withTotal(30, total))).toBe(expected);
  });

  it.each(T1_AGE_BANDS.map(b => b.id))('年齡段 %s：只出那五個值', id => {
    const age = { A: 18, B: 30, C: 60, D: 90, E: 150 }[id as 'A' | 'B' | 'C' | 'D' | 'E'];
    for (let t = 0; t <= 72; t++) expect([100, 90, 80, 75, 70]).toContain(attainmentIndex(withTotal(age, t)));
  });

  it('沒有逐題作答的舊成績也算得出來（同齡估算算不出來）', () => {
    const old = bandScores(30, () => 2, false);
    expect(attainmentIndex(old)).toBe(100);
    expect(developmentIndex(old, 30)).toBeNull();
  });
});

describe('DEV_INDEX_BASIS', () => {
  it('不設、空字串、peer → 同齡估算；attainment → 達成率', () => {
    expect(resolveDevIndexBasis(undefined)).toBe('peer');
    expect(resolveDevIndexBasis('')).toBe('peer');
    expect(resolveDevIndexBasis('peer')).toBe('peer');
    expect(resolveDevIndexBasis('attainment')).toBe('attainment');
    expect(developmentIndexFor('peer')).toBe(developmentIndex);
    expect(developmentIndexFor('attainment')).toBe(attainmentIndex);
  });

  it.each(['1', 'true', 'Attainment', 'rate', ' peer'])('認不得的值 %j 起不來', raw => {
    expect(() => resolveDevIndexBasis(raw)).toThrow(/DEV_INDEX_BASIS/);
  });
});

import { describe, it, expect } from 'vitest';
import { askedItems, defaultGrade, scoreKitV3, type KitV3Answers, type LdScoring } from '../src/t2/kitv3/score';
import { BANK as LDP } from '../src/t2/kitv3/sxk-ldp';
import { BANK as LDS } from '../src/t2/kitv3/sxk-lds';
import { SXK_LDP as OLD_LDP } from '../src/t2/toolkit/sxk-ldp';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * SXK-LDP、SXK-LDS（T2 v3 題庫規格 §4.2、§4.3；頁面公式見 `scripts/t2/kitv3-recipes/ld.ts` 檔頭）。
 * 題數逐年級對盤點（`docs/reference/T2完整版工具包盤點-2026-10-07/3-…` §5.3、§6.3）。
 */

const keys = (bank: KitV3Bank, grade: number) => askedItems(bank, { ageM: 120, grade }).map(a => a.item.key);

function withSum(bank: KitV3Bank, grade: number, sum: number): KitV3Answers {
  const out: Record<string, number> = {};
  let left = sum;
  for (const k of keys(bank, grade)) {
    out[k] = Math.min(3, left);
    left -= out[k];
  }
  return out;
}

function sumFor(n: number, target: number): number {
  for (let s = 0; s <= n * 3; s++) if (Math.round((s / (n * 3)) * 100) === target) return s;
  throw new Error(`${n} 題湊不出 ${target}％`);
}

describe('月齡推年級（R-27 暫採）', () => {
  it.each([
    [60, 1],
    [72, 1],
    [83, 1],
    [84, 2],
    [143, 6],
    [144, 7],
    [215, 12],
    [300, 12],
  ])('LDP：%i 個月 → %i 年級', (m, g) => expect(defaultGrade(m, (LDP.scoring as LdScoring).gradeRange)).toBe(g));

  it('LDS 從初一起：143 個月也是 7', () => {
    expect(defaultGrade(143, (LDS.scoring as LdScoring).gradeRange)).toBe(7);
    expect(defaultGrade(156, (LDS.scoring as LdScoring).gradeRange)).toBe(8);
  });

  it('沒給年級就用月齡推的；給了照給的；超出範圍丟錯', () => {
    expect(askedItems(LDP, { ageM: 72 })).toHaveLength(39);
    expect(askedItems(LDP, { ageM: 72, grade: 3 })).toHaveLength(69);
    expect(() => askedItems(LDS, { ageM: 150, grade: 6 })).toThrow();
  });
});

describe('SXK-LDP', () => {
  it('80 題、七面向；逐年級題數 39／54／69／74／74／72／76…76', () => {
    expect(LDP.forms[0].sections.flatMap(s => s.items)).toHaveLength(80);
    expect(Array.from({ length: 12 }, (_, i) => keys(LDP, i + 1).length)).toEqual([39, 54, 69, 74, 74, 72, 76, 76, 76, 76, 76, 76]);
  });

  it('一年級各面向：RD8 RC2 WR7 WE0 MA6 LG9 AT7', () => {
    const r = scoreKitV3(LDP, withSum(LDP, 1, 0), { ageM: 72, grade: 1 });
    expect(r.facets.map(f => [f.key, f.n])).toEqual([['RD', 8], ['RC', 2], ['WR', 7], ['WE', 0], ['MA', 6], ['LG', 9], ['AT', 7]]);
    expect(r.facets.find(f => f.key === 'WE')).toMatchObject({ value: null, band: null });
  });

  it('舊版 30 題有 27 題原字留在新版', () => {
    const now = new Set(LDP.forms[0].sections.flatMap(s => s.items.map(i => i.text)));
    expect(OLD_LDP.sections.flatMap(s => s.items).filter(i => now.has(i.text))).toHaveLength(27);
  });

  it.each([
    [16, 0],
    [17, 1],
    [33, 1],
    [34, 2],
    [49, 2],
    [50, 3],
  ])('困難指數 %i → 0–3 是 %i（切點 17／34／50）', (pct, grade) => {
    const r = scoreKitV3(LDP, withSum(LDP, 7, sumFor(76, pct)), { ageM: 150, grade: 7 });
    expect([r.total.value, r.total.band]).toEqual([pct, grade]);
    expect(r.grade03).toEqual({ LEARN: grade });
  });

  it('這個年級不出的題不算缺答；出的題沒答照列', () => {
    const ans: Record<string, number | null> = { ...withSum(LDP, 1, 0) };
    expect(scoreKitV3(LDP, ans, { ageM: 72, grade: 1 }).missing).toEqual([]);
    const first = keys(LDP, 1)[0];
    delete ans[first];
    expect(scoreKitV3(LDP, ans, { ageM: 72, grade: 1 }).missing).toEqual([first]);
  });
});

describe('SXK-LDS', () => {
  it('84 題、七面向；初一 74、初二初三 81、高中 84', () => {
    expect(LDS.forms[0].sections.map(s => s.key)).toEqual(['RD', 'RC', 'WR', 'WE', 'MA', 'LG', 'EF']);
    expect([7, 8, 9, 10, 11, 12].map(g => keys(LDS, g).length)).toEqual([74, 81, 81, 84, 84, 84]);
  });

  it.each([
    [16, 0],
    [17, 1],
    [49, 2],
    [50, 3],
  ])('困難指數 %i → 0–3 是 %i', (pct, grade) => {
    const r = scoreKitV3(LDS, withSum(LDS, 10, sumFor(84, pct)), { ageM: 180, grade: 10 });
    expect(r.grade03).toEqual({ LEARN: grade });
  });
});

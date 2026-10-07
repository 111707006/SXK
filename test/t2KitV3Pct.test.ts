import { describe, it, expect } from 'vitest';
import { askedItems, scoreKitV3, type KitV3Answers } from '../src/t2/kitv3/score';
import type { PctScoring } from '../src/t2/kitv3/score';
import { BANK as GM } from '../src/t2/kitv3/sxk-gm';
import { BANK as SOC } from '../src/t2/kitv3/sxk-soc';
import { BANK as ADP } from '../src/t2/kitv3/sxk-adp';
import { BANK as PLC } from '../src/t2/kitv3/sxk-plc';
import { BANK as LANG } from '../src/t2/kitv3/sxk-lang';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * 達成率族（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/pct.ts` 檔頭）。
 * 期望值是照頁面的 `domStat`／`totPct`（LANG 的 `domScore`／`overall`）與 `band(p)` 算的：
 * 面向％＝round(實得 ÷ 題數×2 × 100)、總％＝全部計分題合算、第一個 p ≥ min 的那段。
 */

const asked = (bank: KitV3Bank, ageM: number) => askedItems(bank, { ageM }).map(a => a.item.key);

/** 讓總％剛好是 `target` 的一組作答：先放 2、再放一個 1、其餘 0；做不到回 null。 */
function answersFor(bank: KitV3Bank, ageM: number, target: number): KitV3Answers | null {
  const keys = asked(bank, ageM);
  const max = keys.length * 2;
  for (let got = 0; got <= max; got++) {
    if (Math.round((got / max) * 100) !== target) continue;
    const out: Record<string, number> = {};
    keys.forEach((k, i) => {
      const left = got - i * 2;
      out[k] = left >= 2 ? 2 : left === 1 ? 1 : 0;
    });
    return out;
  }
  return null;
}

describe('達成率族：題目與月齡', () => {
  it('每支只出家長版、選項 2／1／0、主維度照客規', () => {
    const dims: Array<[KitV3Bank, string]> = [[GM, 'MOT'], [SOC, 'SOC'], [ADP, 'COG'], [PLC, 'LANG'], [LANG, 'LANG']];
    for (const [b, dim] of dims) {
      expect(b.forms.map(f => f.key), b.code).toEqual(['p']);
      expect(b.options.main.map(o => o.value), b.code).toEqual([2, 1, 0]);
      expect((b.scoring as PctScoring).dim, b.code).toBe(dim);
    }
  });

  it('GM、SOC、ADP 各 84 題、七面向；LANG 132 題', () => {
    for (const b of [GM, SOC, ADP]) {
      expect(b.forms[0].sections, b.code).toHaveLength(7);
      expect(b.forms[0].sections.flatMap(s => s.items), b.code).toHaveLength(84);
    }
    expect(LANG.forms[0].sections.flatMap(s => s.items)).toHaveLength(132);
  });

  it('實足月齡 ≥ 題目月齡的全部出（盤點逐月數的：GM 12／36／60 月 39／68／81、SOC 25／54／78）', () => {
    expect([12, 36, 60].map(m => asked(GM, m).length)).toEqual([39, 68, 81]);
    expect([12, 36, 60].map(m => asked(SOC, m).length)).toEqual([25, 54, 78]);
    expect([12, 36, 60].map(m => asked(ADP, m).length)).toEqual([22, 45, 80]);
    expect([12, 36, 60].map(m => asked(PLC, m).length)).toEqual([36, 78, 84]);
    expect([12, 36, 60].map(m => asked(LANG, m).length)).toEqual([22, 59, 92]);
    expect(asked(GM, 84)).toHaveLength(84);
  });

  it('LANG 的前語言（PL）過了 60 個月不出', () => {
    expect(asked(LANG, 60).some(k => k.startsWith('PL.'))).toBe(true);
    expect(asked(LANG, 61).some(k => k.startsWith('PL.'))).toBe(false);
    expect((LANG.scoring as PctScoring).sectionMaxMonth).toEqual({ PL: 60 });
  });
});

describe('達成率族：分段（每個切點兩側各一組）', () => {
  const cases: Array<[KitV3Bank, number[]]> = [
    [GM, [85, 70, 55]],
    [SOC, [85, 70, 55]],
    [ADP, [85, 70, 55]],
    [PLC, [85, 70, 55]],
    [LANG, [85, 70, 50]], // LANG 最低一檔是 50，不是 55
  ];

  it('切點照頁面的 LEVELS', () => {
    for (const [b, cuts] of cases) expect((b.scoring as PctScoring).levels.map(l => l.min), b.code).toEqual([...cuts, 0]);
  });

  it.each(cases.map(([b, cuts]) => [b.code, b, cuts] as const))('%s', (_, bank, cuts) => {
    const ageM = 84;
    cuts.forEach((cut, i) => {
      const at = answersFor(bank, ageM, cut);
      const below = answersFor(bank, ageM, cut - 1);
      expect(at, `${cut}`).not.toBeNull();
      expect(below, `${cut - 1}`).not.toBeNull();
      const a = scoreKitV3(bank, at!, { ageM });
      const b = scoreKitV3(bank, below!, { ageM });
      expect([a.total.value, a.total.band], `${cut}`).toEqual([cut, i]);
      expect([b.total.value, b.total.band], `${cut - 1}`).toEqual([cut - 1, i + 1]);
      expect(Object.values(a.grade03)).toEqual([i]);
    });
  });
});

describe('達成率族：面向與缺答', () => {
  it('題數 < 3 的面向不單獨判（GM 12 個月的 G6、G7 沒有題），但照樣進總％', () => {
    const keys = asked(GM, 12);
    const all2 = Object.fromEntries(keys.map(k => [k, 2]));
    const r = scoreKitV3(GM, all2, { ageM: 12 });
    const g6 = r.facets.find(f => f.key === 'G6')!;
    expect([g6.n, g6.value, g6.band]).toEqual([0, null, null]);
    expect(r.total).toMatchObject({ value: 100, band: 0 });
  });

  it('總％是全部計分題合算，不是面向平均', () => {
    const keys = asked(GM, 24);
    const g1 = keys.filter(k => k.startsWith('G1.'));
    const ans = Object.fromEntries(keys.map(k => [k, g1.includes(k) ? 2 : 0]));
    const r = scoreKitV3(GM, ans, { ageM: 24 });
    expect(r.total.value).toBe(Math.round((g1.length * 2) / (keys.length * 2) * 100));
  });

  it('沒答的題列在 missing（月齡沒到的題不算缺答）', () => {
    const keys = asked(GM, 24);
    const ans = Object.fromEntries(keys.slice(1).map(k => [k, 2]));
    expect(scoreKitV3(GM, ans, { ageM: 24 }).missing).toEqual([keys[0]]);
  });
});

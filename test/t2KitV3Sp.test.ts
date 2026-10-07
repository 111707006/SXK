import { describe, it, expect } from 'vitest';
import { askedItems, formFor, scoreKitV3, type ConcernScoring, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as SP } from '../src/t2/kitv3/sxk-sp';
import { BANK as SPB } from '../src/t2/kitv3/sxk-spb';
import { SXK_SPA as OLD_SPA } from '../src/t2/toolkit/sxk-spa';
import { SXK_SPB as OLD_SPB } from '../src/t2/toolkit/sxk-spb';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * SXK-SP、SXK-SPb（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/sp.ts` 檔頭）。
 */

const scored = (bank: KitV3Bank, ageM: number) => askedItems(bank, { ageM }).filter(a => a.section !== 'IMP').map(a => a.item.key);

function withSum(bank: KitV3Bank, ageM: number, sum: number, over: Record<string, number> = {}): KitV3Answers {
  const out: Record<string, number> = {};
  for (const a of askedItems(bank, { ageM })) out[a.item.key] = 0;
  let left = sum;
  for (const k of scored(bank, ageM)) {
    out[k] = Math.min(3, left);
    left -= out[k];
  }
  return { ...out, ...over };
}

function sumFor(n: number, target: number): number {
  for (let s = 0; s <= n * 3; s++) if (Math.round((s / (n * 3)) * 100) === target) return s;
  throw new Error(`${n} 題湊不出 ${target}％`);
}

describe('SXK-SP', () => {
  it('只有幼兒家庭版 H25：9 面向 × 7 題＋影響 4 項', () => {
    expect(SP.forms.map(f => f.key)).toEqual(['H25']);
    expect(scored(SP, 36)).toHaveLength(63);
    expect(askedItems(SP, { ageM: 36 }).filter(a => a.section === 'IMP')).toHaveLength(4);
  });

  it('與 9/08 的 SPa 有 42 題原字相同（盤點）', () => {
    const old = new Set(OLD_SPA.sections.flatMap(s => s.items.map(i => i.text)));
    expect(SP.forms[0].sections.flatMap(s => s.items).filter(i => old.has(i.text))).toHaveLength(42);
  });

  it.each([
    [28, 0, 0],
    [29, 1, 1],
    [45, 1, 1],
    [46, 2, 3],
  ])('％ %i → 第 %i 段、0–3 是 %i（切點 28／45）', (pct, band, grade) => {
    const r = scoreKitV3(SP, withSum(SP, 36, sumFor(63, pct)), { ageM: 36 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({ SEN: grade });
  });

  it('影響全勾「有」也不改分段；但要答', () => {
    const imp = { 'imp.adl': 1, 'imp.sch': 1, 'imp.soc': 1, 'imp.learn': 1 };
    expect(scoreKitV3(SP, withSum(SP, 36, 0, imp), { ageM: 36 }).grade03).toEqual({ SEN: 0 });
    const { 'imp.soc': _, ...rest } = withSum(SP, 36, 0);
    expect(scoreKitV3(SP, rest, { ageM: 36 }).missing).toEqual(['imp.soc']);
  });

  it('切點來自頁面', () => {
    expect((SP.scoring as ConcernScoring).levels.map(l => l.max)).toEqual([28, 45, 100]);
  });
});

describe('SXK-SPb', () => {
  it('60–143 月 H512（R-20：頁面從 72 起，60–71 也給 H512）、144 起 H1215', () => {
    expect([60, 71, 72, 143, 144, 180].map(m => formFor(SPB, m).key)).toEqual(['H512', 'H512', 'H512', 'H512', 'H1215', 'H1215']);
    expect(() => formFor(SPB, 59)).toThrow();
  });

  it('兩表各 63 題；H512 與 9/08 的 SPb 有 19 題原字相同（盤點）', () => {
    expect([96, 160].map(m => scored(SPB, m).length)).toEqual([63, 63]);
    const old = new Set(OLD_SPB.sections.flatMap(s => s.items.map(i => i.text)));
    expect(SPB.forms[0].sections.flatMap(s => s.items).filter(i => old.has(i.text))).toHaveLength(19);
  });

  it.each([
    [28, 0],
    [29, 1],
    [46, 3],
  ])('H1215：％ %i → 0–3 是 %i', (pct, grade) => {
    const r = scoreKitV3(SPB, withSum(SPB, 160, sumFor(63, pct)), { ageM: 160 });
    expect(r.form).toBe('H1215');
    expect(r.grade03).toEqual({ SEN: grade });
  });
});

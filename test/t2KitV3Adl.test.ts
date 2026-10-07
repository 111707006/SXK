import { describe, it, expect } from 'vitest';
import { askedItems, scoreKitV3, type AdlScoring, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as ADL } from '../src/t2/kitv3/sxk-adl';

/**
 * SXK-ADL（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/adl.ts` 檔頭）。
 * 七級 7 最好；獨立率＝(Σ − n) ÷ 6n；≥ 72／45–71／< 45 → 0／1／3。
 */

const keys = (ageM: number) => askedItems(ADL, { ageM }).map(a => a.item.key);

/** 每題從 1 起，往上加到總分剛好是 `got`。 */
function withGot(ageM: number, got: number): KitV3Answers {
  const ks = keys(ageM);
  const out: Record<string, number> = {};
  let left = got - ks.length;
  for (const k of ks) {
    const add = Math.min(6, left);
    out[k] = 1 + add;
    left -= add;
  }
  if (left !== 0) throw new Error(`湊不出 ${got}`);
  return out;
}

function gotFor(n: number, pct: number): number {
  for (let g = n; g <= n * 7; g++) if (Math.round(((g - n) / (n * 6)) * 100) === pct) return g;
  throw new Error(`${n} 題湊不出 ${pct}％`);
}

describe('SXK-ADL', () => {
  it('62 題、七級 7→1；逐月題數 9／13／22／30／36／45／54／58／60／61／62（盤點）', () => {
    expect(ADL.forms[0].sections.flatMap(s => s.items)).toHaveLength(62);
    expect(ADL.options.main.map(o => o.value)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect([18, 24, 30, 36, 42, 48, 60, 72, 84, 108, 120].map(m => keys(m).length)).toEqual([9, 13, 22, 30, 36, 45, 54, 58, 60, 61, 62]);
  });

  it('全 1 → 0％、全 7 → 100％', () => {
    const n = keys(60).length;
    expect(scoreKitV3(ADL, withGot(60, n), { ageM: 60 }).total.value).toBe(0);
    expect(scoreKitV3(ADL, withGot(60, n * 7), { ageM: 60 }).total.value).toBe(100);
  });

  it.each([
    [72, 0, 0],
    [71, 1, 1],
    [45, 1, 1],
    [44, 2, 3],
  ])('獨立率 %i → 第 %i 段、0–3 是 %i（越高越好）', (pct, band, grade) => {
    const r = scoreKitV3(ADL, withGot(120, gotFor(62, pct)), { ageM: 120 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({ ADL: grade });
  });

  it('領域不到 2 題不單獨判', () => {
    const r = scoreKitV3(ADL, withGot(18, 9), { ageM: 18 });
    for (const f of r.facets) {
      if (f.n < 2) expect(f.band, f.key).toBeNull();
      else expect(f.band, f.key).not.toBeNull();
    }
    expect(r.facets.some(f => f.n === 1 || f.n === 0)).toBe(true);
  });

  it('切點來自頁面', () => {
    expect((ADL.scoring as AdlScoring).levels.map(l => l.min)).toEqual([72, 45, 0]);
  });
});

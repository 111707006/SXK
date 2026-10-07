import { describe, it, expect } from 'vitest';
import { scoreKitV3, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as SNAP } from '../src/t2/kitv3/snap-iv';
import { BANK as CHEXI } from '../src/t2/kitv3/chexi';
import { SNAP_IV as OLD_SNAP } from '../src/t2/toolkit/snap-iv';
import { CHEXI as OLD_CHEXI } from '../src/t2/toolkit/chexi';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * SNAP-IV、CHEXI（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/snapchexi.ts` 檔頭）。
 */

const keysOf = (bank: KitV3Bank, sec?: string) => bank.forms[0].sections.filter(s => !sec || s.key === sec).flatMap(s => s.items.map(i => i.key));

/** 某些題的總分剛好是 `sum`（每題上限 `max`，下限 `min`），其餘題放 `min`。 */
function spread(keys: string[], sum: number, min: number, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = sum - keys.length * min;
  for (const k of keys) {
    const add = Math.min(max - min, Math.max(0, left));
    out[k] = min + add;
    left -= add;
  }
  if (left !== 0) throw new Error(`湊不出 ${sum}`);
  return out;
}

describe('SNAP-IV', () => {
  it('26 題、三個分量表 9／9／8；題目同 9/08 版（只差全形括號）', () => {
    expect(SNAP.forms[0].sections.map(s => [s.key, s.items.length])).toEqual([['IA', 9], ['HI', 9], ['OD', 8]]);
    const norm = (t: string) => t.replace(/（/g, '(').replace(/）/g, ')');
    const old = OLD_SNAP.sections.flatMap(s => s.items.map(i => norm(i.text)));
    expect(SNAP.forms[0].sections.flatMap(s => s.items.map(i => norm(i.text)))).toEqual(old);
  });

  const zeros = (): Record<string, number> => Object.fromEntries(keysOf(SNAP).map(k => [k, 0]));

  // 9 題：10→1.11、11→1.22、16→1.78、17→1.89（參考點 1.2／1.8 嚴格大於）
  it.each([
    [10, 0, 0],
    [11, 1, 1],
    [16, 1, 1],
    [17, 2, 3],
  ])('注意力不足總和 %i → 第 %i 級、0–3 是 %i', (sum, band, grade) => {
    const r = scoreKitV3(SNAP, { ...zeros(), ...spread(keysOf(SNAP, 'IA'), sum, 0, 3) }, { ageM: 96 });
    expect(r.facets[0].band).toBe(band);
    expect(r.total.band).toBe(band);
    expect(r.grade03).toEqual({ ATT: grade });
  });

  it('取三個分量表最重的（只有对立违抗高也算）', () => {
    const r = scoreKitV3(SNAP, { ...zeros(), ...spread(keysOf(SNAP, 'OD'), 24, 0, 3) }, { ageM: 96 });
    expect(r.facets.map(f => f.band)).toEqual([0, 0, 2]);
    expect(r.total).toMatchObject({ value: 3, band: 2, bandName: '高于诊断参考点' });
    expect(r.grade03).toEqual({ ATT: 3 });
  });

  it('症狀數（評 2 或 3）進 detail；缺答照列', () => {
    const ans: Record<string, number> = { ...zeros(), 'IA.1': 2, 'IA.2': 3, 'IA.3': 1 };
    delete ans['OD.26'];
    const r = scoreKitV3(SNAP, ans, { ageM: 96 });
    expect(r.facets[0].detail).toEqual({ sx: 2 });
    expect(r.missing).toEqual(['OD.26']);
  });
});

describe('CHEXI', () => {
  it('24 題原題序、1–5；副量表同 9/08 版', () => {
    const items = CHEXI.forms[0].sections[0].items;
    expect(items.map(i => i.key)).toEqual(Array.from({ length: 24 }, (_, i) => `Q.${i + 1}`));
    expect(CHEXI.options.main.map(o => o.value)).toEqual([1, 2, 3, 4, 5]);
    const oldSub = new Map(OLD_CHEXI.sections.flatMap(s => s.items.map(i => [i.sourceNo, s.key.toLowerCase()] as const)));
    expect(items.map(i => i.tags![0])).toEqual(items.map((_, i) => oldSub.get(i + 1)));
  });

  const all = (sum: number): KitV3Answers => spread(keysOf(CHEXI), sum, 1, 5);

  it.each([
    [24, 0, 0],
    [51, 0, 0],
    [52, 1, 1],
    [72, 1, 1],
    [73, 2, 3],
    [120, 2, 3],
  ])('總分 %i → 第 %i 級、0–3 是 %i（官方總分表 52／73）', (sum, band, grade) => {
    const r = scoreKitV3(CHEXI, all(sum), { ageM: 96 });
    expect([r.total.value, r.total.band]).toEqual([sum, band]);
    expect(r.grade03).toEqual({ ATT: grade });
  });

  it.each([
    [28, 0],
    [29, 1],
    [34, 1],
    [35, 2],
  ])('因素「工作記憶」（wm＋pl）%i → 第 %i 段（29／35），不改總分的級', (f1, band) => {
    const items = CHEXI.forms[0].sections[0].items;
    const f1Keys = items.filter(i => ['wm', 'pl'].includes(i.tags![0])).map(i => i.key);
    const rest = items.filter(i => !f1Keys.includes(i.key)).map(i => i.key);
    const r = scoreKitV3(CHEXI, { ...spread(f1Keys, f1, 1, 5), ...spread(rest, 11, 1, 5) }, { ageM: 96 });
    expect(r.facets[0]).toMatchObject({ key: 'F1', n: 13, value: f1, band });
    expect(r.total.band).toBe(0);
  });

  it.each([
    [32, 0],
    [33, 1],
    [39, 1],
    [40, 2],
  ])('因素「抑制力」（rg＋ib）%i → 第 %i 段（33／40）', (f2, band) => {
    const items = CHEXI.forms[0].sections[0].items;
    const f2Keys = items.filter(i => ['rg', 'ib'].includes(i.tags![0])).map(i => i.key);
    const rest = items.filter(i => !f2Keys.includes(i.key)).map(i => i.key);
    const r = scoreKitV3(CHEXI, { ...spread(f2Keys, f2, 1, 5), ...spread(rest, 13, 1, 5) }, { ageM: 96 });
    expect(r.facets[1]).toMatchObject({ key: 'F2', n: 11, value: f2, band });
  });
});

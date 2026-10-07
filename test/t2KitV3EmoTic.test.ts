import { describe, it, expect } from 'vitest';
import { scoreKitV3, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as EMO } from '../src/t2/kitv3/sxk-emo';
import { BANK as TIC } from '../src/t2/kitv3/sxk-tic';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * SXK-EMO、SXK-TIC（T2 v3 題庫規格 §4.2、§4.3；頁面公式見 `scripts/t2/kitv3-recipes/emotic.ts` 檔頭）。
 */

const keysOf = (bank: KitV3Bank, secs: string[]) => bank.forms[0].sections.filter(s => secs.includes(s.key)).flatMap(s => s.items.map(i => i.key));

function spread(keys: string[], sum: number, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = sum;
  for (const k of keys) {
    out[k] = Math.min(max, left);
    left -= out[k];
  }
  if (left !== 0) throw new Error(`湊不出 ${sum}`);
  return out;
}

function sumFor(n: number, target: number): number {
  for (let s = 0; s <= n * 3; s++) if (Math.round((s / (n * 3)) * 100) === target) return s;
  throw new Error(`${n} 題湊不出 ${target}％`);
}

describe('SXK-EMO', () => {
  const SYM = keysOf(EMO, ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  const IMP = keysOf(EMO, ['IMP']);
  /** 症狀總分 `sym`、影響總分 `imp`，持續時間一至三個月。 */
  const ans = (sym: number, imp: number, over: Record<string, number | null> = {}): KitV3Answers => ({
    ...spread(SYM, sym, 3),
    ...spread(IMP, imp, 3),
    dur: 2,
    ...over,
  });

  it('7 面向 × 6 題＋影響 6 項＋持續時間；「未观察到」「不适用」是 null；不出安全篩檢三題（R-21）', () => {
    expect(SYM).toHaveLength(42);
    expect(IMP).toHaveLength(6);
    expect(EMO.options.freq.at(-1)).toEqual({ value: null, label: '未观察到' });
    expect(EMO.options.impact.at(-1)).toEqual({ value: null, label: '不适用' });
    expect(EMO.forms[0].sections.map(s => s.key)).not.toContain('SAFETY');
    expect(JSON.stringify(EMO)).not.toContain('不想活');
  });

  it.each([
    [14, 0],
    [15, 1],
    [29, 1],
    [30, 2],
    [49, 2],
    [50, 3],
  ])('影響低：症狀 %i％ → 0–3 是 %i（切點 15／30／50）', (pct, grade) => {
    const r = scoreKitV3(EMO, ans(sumFor(42, pct), 0), { ageM: 72 });
    expect(r.total.value).toBe(pct);
    expect(r.grade03).toEqual({ EMO: grade });
  });

  it('影響 ≥ 20（6 項總分 4 → 22％）且症狀 < 30 → 抬到 2；影響 17％ 不抬', () => {
    expect(scoreKitV3(EMO, ans(sumFor(42, 14), 4), { ageM: 72 }).grade03).toEqual({ EMO: 2 });
    expect(scoreKitV3(EMO, ans(sumFor(42, 29), 4), { ageM: 72 }).grade03).toEqual({ EMO: 2 });
    expect(scoreKitV3(EMO, ans(sumFor(42, 14), 3), { ageM: 72 }).grade03).toEqual({ EMO: 0 });
    expect(scoreKitV3(EMO, ans(sumFor(42, 50), 4), { ageM: 72 }).grade03).toEqual({ EMO: 3 });
  });

  it('「未观察到」分子分母都不算', () => {
    const half = Object.fromEntries(SYM.map((k, i) => [k, i < 21 ? null : 3]));
    expect(scoreKitV3(EMO, ans(0, 0, half), { ageM: 72 }).total.value).toBe(100);
  });

  it('症狀或影響沒有一題已評 → 资料不足，不給 0–3', () => {
    const noImp = Object.fromEntries(IMP.map(k => [k, null]));
    const r = scoreKitV3(EMO, ans(60, 0, noImp), { ageM: 72 });
    expect(r.grade03).toEqual({});
    expect(r.flags).toEqual(['insufficient']);
    const noSym = Object.fromEntries(SYM.map(k => [k, null]));
    expect(scoreKitV3(EMO, ans(0, 0, noSym), { ageM: 72 }).grade03).toEqual({});
  });

  it('持續時間要答、不改分級', () => {
    const { dur: _, ...rest } = ans(0, 0);
    expect(scoreKitV3(EMO, rest, { ageM: 72 }).missing).toEqual(['dur']);
    expect(scoreKitV3(EMO, ans(0, 0, { dur: 0 }), { ageM: 72 }).grade03).toEqual({ EMO: 0 });
  });
});

describe('SXK-TIC', () => {
  const SEV = keysOf(TIC, ['M', 'V']);
  const REST = keysOf(TIC, ['IMP', 'URGE']);
  const ans = (sev: number, over: Record<string, number> = {}): KitV3Answers => ({
    ...spread(SEV, sev, 5),
    ...Object.fromEntries(REST.map(k => [k, 0])),
    ...over,
  });

  it('家長報告版：運動、發聲各 5 維度、影響 4、前驅衝動 1，每項 6 個錨點', () => {
    expect([SEV.length, REST.length]).toEqual([10, 5]);
    expect(TIC.forms[0].sections.filter(s => s.key !== 'FLAGS').flatMap(s => s.items).every(i => i.anchors?.length === 6)).toBe(true);
  });

  it.each([
    [12, 0],
    [13, 1],
    [25, 1],
    [26, 2],
    [37, 2],
    [38, 3],
    [50, 3],
  ])('嚴重度 %i → 0–3 是 %i（13／26／38）', (sev, grade) => {
    const r = scoreKitV3(TIC, ans(sev), { ageM: 96 });
    expect([r.total.value, r.total.band]).toEqual([sev, grade]);
    expect(r.grade03).toEqual({ EMO: grade });
  });

  it('生活影響與前驅衝動不進嚴重度', () => {
    const r = scoreKitV3(TIC, ans(12, Object.fromEntries(REST.map(k => [k, 5]))), { ageM: 96 });
    expect(r.grade03).toEqual({ EMO: 0 });
    expect(r.facets.find(f => f.key === 'IMP')!.value).toBe(20);
  });

  it('旗標不改分級：自傷／頸部／呼吸吞嚥／突發 → refer＋priority；其他 → priority；不勾不算缺答', () => {
    expect(scoreKitV3(TIC, ans(0, { 'flag.neck': 1 }), { ageM: 96 })).toMatchObject({ grade03: { EMO: 0 }, flags: ['refer', 'priority'], missing: [] });
    expect(scoreKitV3(TIC, ans(0, { 'flag.bully': 1 }), { ageM: 96 }).flags).toEqual(['priority']);
    expect(scoreKitV3(TIC, ans(0), { ageM: 96 }).flags).toBeUndefined();
  });
});

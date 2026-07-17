import { describe, it, expect } from 'vitest';
import { collectCpmv, buildCpmvSummary, buildCpmvSuggest, CpmvItemStates, CpmvItemScore } from '../src/utils/cpmvReport';
import { CPMV_ITEMS } from '../src/cpmvData';

function makeStates(scores: Record<number, CpmvItemScore> = {}, flags: Record<number, string[]> = {}): CpmvItemStates {
  const st: CpmvItemStates = {};
  for (const it of CPMV_ITEMS) {
    const f: Record<string, boolean> = {};
    (flags[it.id] || []).forEach(k => { f[k] = true; });
    st[it.id] = { score: it.id in scores ? scores[it.id] : null, flags: f };
  }
  return st;
}

describe('collectCpmv', () => {
  it('handles an empty assessment (all null)', () => {
    const r = collectCpmv(makeStates());
    expect(r.testedIds).toEqual([]);
    expect(r.sum).toBe(0);
    expect(r.max).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.lowItemIds).toEqual([]);
    expect(r.domains.every(d => d.pct === null)).toBe(true);
  });

  it('scores a perfect assessment (all 2)', () => {
    const all2: Record<number, CpmvItemScore> = {};
    CPMV_ITEMS.forEach(it => { all2[it.id] = 2; });
    const r = collectCpmv(makeStates(all2));
    expect(r.testedIds).toHaveLength(20);
    expect(r.sum).toBe(40);
    expect(r.max).toBe(40);
    expect(r.pct).toBe(100);
    expect(r.lowItemIds).toEqual([]);
    expect(r.domains.every(d => d.pct === 100)).toBe(true);
  });

  it('collects low items (score 0 or 1) but not 2', () => {
    const r = collectCpmv(makeStates({ 1: 2, 2: 1, 3: 0, 4: 2 }));
    expect(r.lowItemIds).toEqual([2, 3]);
    expect(r.testedIds).toEqual([1, 2, 3, 4]);
    expect(r.sum).toBe(5); // 2+1+0+2
    expect(r.max).toBe(8);
    expect(r.pct).toBe(63); // 5/8 = 62.5 → 63
  });

  it('treats "nt" as not-tested, tracked separately', () => {
    const r = collectCpmv(makeStates({ 1: 2, 2: 'nt', 3: 'nt' }));
    expect(r.ntIds).toEqual([2, 3]);
    expect(r.testedIds).toEqual([1]);
    expect(r.max).toBe(2);
  });

  it('computes per-domain score rates', () => {
    // static domain = items [1,2,4,15]
    const r = collectCpmv(makeStates({ 1: 2, 2: 1, 4: 0 }));
    const staticDomain = r.domains.find(d => d.key === 'static')!;
    expect(staticDomain.testedN).toBe(3);
    expect(staticDomain.sum).toBe(3); // 2+1+0
    expect(staticDomain.max).toBe(6);
    expect(staticDomain.pct).toBe(50);
    // an untouched domain stays null
    expect(r.domains.find(d => d.key === 'hand')!.pct).toBeNull();
  });

  it('aggregates flags per key with item ids', () => {
    const r = collectCpmv(makeStates({ 5: 1, 11: 1 }, { 5: ['tremor', 'worseR'], 11: ['tremor'] }));
    expect(r.flagStats.tremor.n).toBe(2);
    expect(r.flagStats.tremor.items).toEqual([5, 11]);
    expect(r.flagStats.worseR.n).toBe(1);
    expect(r.flagStats.worseR.items).toEqual([5]);
    expect(r.flagStats.comp.n).toBe(0);
  });
});

describe('buildCpmvSummary', () => {
  it('states totals, grade and flags the weak domain', () => {
    // only static domain scored, all 0 → weak domain
    const r = collectCpmv(makeStates({ 1: 0, 2: 0, 4: 0, 15: 0 }));
    const lines = buildCpmvSummary(r);
    expect(lines[0]).toContain('4/20');
    expect(lines[0]).toContain('0/8');
    expect(lines[0]).toContain('0%');
    expect(lines.join('')).toContain('静态姿势与直立性'); // weak domain named
  });

  it('reports tremor and lateralised weakness when flagged', () => {
    const r = collectCpmv(
      makeStates({ 11: 1, 12: 1, 5: 1, 19: 1 }, { 11: ['tremor'], 12: ['tremor'], 5: ['worseR'], 19: ['worseR'] })
    );
    const text = buildCpmvSummary(r).join('');
    expect(text).toContain('震颤');
    expect(text).toContain('右侧偏侧性');
  });
});

describe('buildCpmvSuggest', () => {
  it('lists low-scoring item ids for re-capture', () => {
    const r = collectCpmv(makeStates({ 6: 0, 7: 1, 8: 2 }));
    const text = buildCpmvSuggest(r).join('');
    // items 6 and 7 are low (0/1); 8 is not
    expect(text).toContain('第 6、7 项');
  });

  it('recommends OT hand training when hand domain is weak', () => {
    // hand domain = [6,7,8,9,10]; all 0 → weak
    const r = collectCpmv(makeStates({ 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }));
    const text = buildCpmvSuggest(r).join('');
    expect(text).toContain('作业治疗(OT)手功能专项');
  });
});

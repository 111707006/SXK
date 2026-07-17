import { describe, it, expect } from 'vitest';
import { CPMV_ITEMS, CPMV_MODULES, CPMV_FLAGS, CPMV_DOMAINS, cpmvGrade } from '../src/cpmvData';

describe('CPMV-20 scale data integrity', () => {
  it('has exactly 20 items with unique ids 1..20', () => {
    expect(CPMV_ITEMS).toHaveLength(20);
    const ids = CPMV_ITEMS.map(i => i.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('every item has all required text fields and a valid module', () => {
    const moduleKeys = Object.keys(CPMV_MODULES);
    for (const it of CPMV_ITEMS) {
      expect(moduleKeys).toContain(it.mod);
      for (const field of ['name', 'age', 'cmd', 'film', 'watch', 'ai', 's2', 's1', 's0'] as const) {
        expect(typeof (it as any)[field]).toBe('string');
        expect((it as any)[field].length).toBeGreaterThan(0);
      }
    }
  });

  it('defines 5 modules A..E', () => {
    expect(Object.keys(CPMV_MODULES).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('domains partition all 20 items exactly once (no gaps, no overlaps)', () => {
    const all = CPMV_DOMAINS.flatMap(d => d.items).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    // no duplicates → set size equals length
    expect(new Set(all).size).toBe(20);
  });

  it('every domain item id refers to a real item', () => {
    const ids = new Set(CPMV_ITEMS.map(i => i.id));
    for (const d of CPMV_DOMAINS) {
      for (const id of d.items) expect(ids.has(id)).toBe(true);
    }
  });

  it('has 5 flags with unique keys; side flags flagged correctly', () => {
    expect(CPMV_FLAGS).toHaveLength(5);
    const keys = CPMV_FLAGS.map(f => f.k);
    expect(new Set(keys).size).toBe(5);
    expect(keys).toEqual(expect.arrayContaining(['tremor', 'assoc', 'comp', 'worseL', 'worseR']));
    expect(CPMV_FLAGS.find(f => f.k === 'worseL')!.side).toBe(true);
    expect(CPMV_FLAGS.find(f => f.k === 'worseR')!.side).toBe(true);
  });
});

describe('cpmvGrade thresholds', () => {
  it('maps score-rate to the correct grade band', () => {
    expect(cpmvGrade(100).t).toBe('功能良好 / 轻微受限');
    expect(cpmvGrade(85).t).toBe('功能良好 / 轻微受限');
    expect(cpmvGrade(84).t).toBe('轻–中度受限');
    expect(cpmvGrade(60).t).toBe('轻–中度受限');
    expect(cpmvGrade(59).t).toBe('中度受限');
    expect(cpmvGrade(35).t).toBe('中度受限');
    expect(cpmvGrade(34).t).toBe('重度受限');
    expect(cpmvGrade(0).t).toBe('重度受限');
  });

  it('always returns a colour', () => {
    for (const p of [0, 34, 35, 59, 60, 84, 85, 100]) {
      expect(cpmvGrade(p).c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

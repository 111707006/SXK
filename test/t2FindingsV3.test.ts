import { describe, it, expect } from 'vitest';
import { buildFindingsV3, isFindingsV3, recentResultsV3, RECENT_DAYS } from '../src/t2/findingsV3';
import type { Grade03 } from '../src/t2/kitv3/score';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag } from '../src/t2/types';

/**
 * 完整版的報告快照（題庫規格 §5.2）：挑哪幾筆、判定、旗標、版本分流。
 */

const NOW = new Date('2026-10-07T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const T1 = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, T1Flag>;

function rec(toolId: string, daysAgo: number, grade03: Partial<Record<DimensionCode, Grade03>>, extra: { age?: number; flags?: string[] } = {}) {
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  const result: ToolResultV3 = {
    toolkitVersion: 'kit-20260923',
    toolId,
    assessedAgeMonth: extra.age ?? 48,
    rater: 'mother',
    context: { ageM: extra.age ?? 48 },
    answers: {},
    score: { code: toolId, form: 'x', facets: [], total: { value: null, band: null, bandName: null }, grade03, missing: [], ...(extra.flags ? { flags: extra.flags } : {}) },
    computedAt: createdAt,
  };
  return { createdAt, result };
}

describe('recentResultsV3', () => {
  it(`每支最新一筆、只收近 ${RECENT_DAYS} 天、依交卷順序`, () => {
    const got = recentResultsV3([rec('SXK-AB', 100, { ATT: 3 }), rec('SXK-GM', 30, { MOT: 1 }), rec('SXK-AB', 20, { ATT: 1 }), rec('SXK-GM', 10, { MOT: 2 })], NOW);
    expect(got.map(r => [r.result.toolId, r.result.score.grade03])).toEqual([
      ['SXK-AB', { ATT: 1 }],
      ['SXK-GM', { MOT: 2 }],
    ]);
  });

  it('剛好 90 天收、91 天不收', () => {
    expect(recentResultsV3([rec('SXK-AB', 90, {})], NOW)).toHaveLength(1);
    expect(recentResultsV3([rec('SXK-AB', 91, {})], NOW)).toHaveLength(0);
  });

  it('超過 90 天的較新那筆不會被更舊的蓋掉；只剩過期的就是沒做', () => {
    expect(recentResultsV3([rec('SXK-AB', 200, { ATT: 3 }), rec('SXK-AB', 95, { ATT: 0 })], NOW)).toEqual([]);
  });
});

describe('buildFindingsV3', () => {
  const base = { t1: { ...T1, ATT: 2 as T1Flag, SEN: 1 as T1Flag }, recommended: ['SXK-AB', 'SXK-EMO'], sex: 'boy' as const, fallbackAgeMonth: 50, now: NOW };

  it('版本、九維判定、推了哪些、測評月齡取最新一筆', () => {
    const f = buildFindingsV3({ ...base, records: [rec('SXK-AB', 5, { ATT: 3 }, { age: 49 }), rec('SXK-GM', 2, { MOT: 0 }, { age: 50 })] });
    expect(f).toMatchObject({ version: 4, toolkitVersion: 'kit-20260923', rulesVersion: 'v3-2026-10-07', child: { assessedAgeMonth: 50, sex: 'boy' }, recommended: ['SXK-AB', 'SXK-EMO'] });
    expect(f.dimensions.map(d => d.dimensionId)).toEqual([...DIMENSION_CODES]);
    const by = Object.fromEntries(f.dimensions.map(d => [d.dimensionId, d.band]));
    expect(by).toMatchObject({ ATT: 'refer', MOT: 'clear', SEN: 'no_tool', EMO: 'clear' });
    expect(f.toolResults.map(r => r.toolId)).toEqual(['SXK-AB', 'SXK-GM']);
    expect(f.computedAt).toBe(NOW.toISOString());
  });

  it('沒有任何結果：月齡用 fallback；T1 紅、推了沒做 → partial', () => {
    const f = buildFindingsV3({ ...base, records: [] });
    expect(f.child.assessedAgeMonth).toBe(50);
    expect(f.dimensions.find(d => d.dimensionId === 'ATT')!.band).toBe('partial');
  });

  it('notices 收報告最上方要講的旗標（TIC 轉介、EMO 影響高……），no_norm 不收', () => {
    const f = buildFindingsV3({
      ...base,
      records: [
        rec('SXK-TIC', 3, { EMO: 0 }, { flags: ['refer', 'priority'] }),
        rec('SXK-EMO', 2, { EMO: 2 }, { flags: ['impact_high'] }),
        rec('ITQ/TTS/BSQ', 1, {}, { flags: ['no_norm'] }),
      ],
    });
    expect(f.notices).toEqual([
      { toolId: 'SXK-TIC', flag: 'refer' },
      { toolId: 'SXK-TIC', flag: 'priority' },
      { toolId: 'SXK-EMO', flag: 'impact_high' },
    ]);
  });

  it('isFindingsV3 只看 toolkitVersion', () => {
    expect(isFindingsV3(buildFindingsV3({ ...base, records: [] }))).toBe(true);
    expect(isFindingsV3({ toolkitVersion: 'kit-20260908' })).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { recommend } from '../src/t2/recommend/engine';
import { NO_T2_TEXT, parentPlanV3, raterOf, reasonOf, runRecommendation } from '../src/t2/recommend/parentPlan';
import type { DxCode, Level, RecommendInput, ToolClass } from '../src/t2/recommend/types';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode } from '../src/t2/types';

/**
 * T2 v3 入口的家長端字（`src/t2/recommend/parentPlan.ts`）：引擎的客規原句一句都不出去；每一種推薦結果組出來的字過用字掃描。
 */

const LEVELS0 = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
const input = (over: Partial<RecommendInput>): RecommendInput => ({
  ageM: 48, levels: LEVELS0, rfdims: [], items: {}, dx: [], school: true, done: [], extraTags: [], hearingChecked: true, ...over,
});

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('家長端的字過用字掃描（含引擎每一種組合）', () => {
  it('月齡 12–216 × 抽樣等級／診斷／標籤：組出來的每一句都沒有禁字、不含客規原句', () => {
    const r = rng(7);
    const DXS: DxCode[][] = [[], ['LDADHD'], ['ASD'], ['GDD'], ['CP'], ['EMO'], ['LANG']];
    const hits: string[] = [];
    for (let ageM = 12; ageM <= 216; ageM += 3) {
      for (let k = 0; k < 4; k++) {
        const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, (r() < 0.5 ? 0 : Math.floor(r() * 4)) as Level])) as Record<DimensionCode, Level>;
        const rec = recommend(input({ ageM, levels, rfdims: DIMENSION_CODES.filter(d => levels[d] >= 2 && r() < 0.3), dx: DXS[Math.floor(r() * DXS.length)], extraTags: r() < 0.2 ? ['TIC', 'SAFETY'] : [], hearingChecked: r() < 0.5 ? false : null }));
        const plan = parentPlanV3(rec, r() < 0.3);
        const text = [...plan.tools.flatMap(t => [t.reason, t.rater]), ...plan.notices.map(n => n.text), ...plan.gaps.map(g => g.text), plan.noT2Text ?? ''].join('\n');
        hits.push(...findBannedWords(text));
        for (const t of rec.tools) expect(text).not.toContain(t.reason);
      }
    }
    expect([...new Set(hits)]).toEqual([]);
  });

  it('每一個類別都有自己的理由句', () => {
    const classes: ToolClass[] = ['rule', 'dx', 'P1', 'P2', 'P3', 'depth', 'P4', 'P5', 'base', 'fill'];
    for (const cls of classes) {
      const s = reasonOf({ code: 'SXK-GM', cls, dim: 'MOT' });
      expect(s.length, cls).toBeGreaterThan(0);
      expect(findBannedWords(s), cls).toEqual([]);
    }
    expect(reasonOf({ code: 'SXK-EMO', cls: 'rule', dim: 'EMO' })).toContain('专业人员陪同');
  });

  it('誰填：家長能填就是家長；只有本人版 → 孩子在您的手機上；只有教師版 → 請老師', () => {
    expect(raterOf(['P', 'T'])).toBe('家长填写');
    expect(raterOf(['S'])).toContain('孩子自己填写');
    expect(raterOf(['T'])).toBe('请老师填写');
  });
});

describe('形狀', () => {
  it('T1 全綠、沒有診斷 → NO_T2，附那一句、沒有量表', () => {
    const plan = parentPlanV3(recommend(input({})), false);
    expect(plan).toMatchObject({ status: 'NO_T2', tools: [], noT2Text: NO_T2_TEXT });
  });

  it('有推薦：分鐘、第幾次、維度照引擎；T3 不出', () => {
    const rec = recommend(input({ levels: { ...LEVELS0, ATT: 3, LANG: 2 }, ageM: 72 }));
    const plan = parentPlanV3(rec, false);
    expect(plan.status).toBe('RECOMMEND');
    expect(plan.tools.map(t => [t.code, t.minutes, t.session, t.dimension])).toEqual(rec.tools.map(t => [t.code, t.minutes, t.session, t.dim]));
    expect(plan.totalMinutes).toBe(rec.parentMinutes);
    expect(JSON.stringify(plan)).not.toContain('t3');
  });

  it('T1 沒有逐題資料 → 多一條提示；同一種提示只出一次', () => {
    const plan = parentPlanV3(recommend(input({ levels: { ...LEVELS0, LANG: 2 }, hearingChecked: false })), true);
    const kinds = plan.notices.map(n => n.kind);
    expect(kinds).toContain('ITEMS_MISSING');
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('runRecommendation', () => {
  const t1 = (dim: string, score: number, assessedAgeMonth?: number) => ({ tierId: 'T1', dimensionId: dim, score, ...(assessedAgeMonth !== undefined ? { assessedAgeMonth } : {}) });

  it('月齡用最新一筆 T1 的測評月齡，沒有才用今天的', () => {
    expect(runRecommendation({ child: {}, t1Scores: [t1('attention', 2, 50)], liveAgeMonth: 60, doneCodes: [] }).ageM).toBe(50);
    expect(runRecommendation({ child: {}, t1Scores: [t1('attention', 2)], liveAgeMonth: 60, doneCodes: [] }).ageM).toBe(60);
  });

  it('rec 排除近 90 天做過的；full 不排除（報告快照的「推了哪些」）', () => {
    const args = { child: {}, t1Scores: [t1('attention', 1, 96)], liveAgeMonth: 96 };
    const first = runRecommendation({ ...args, doneCodes: [] });
    const done = first.rec.tools[0].code;
    const again = runRecommendation({ ...args, doneCodes: [done] });
    expect(again.rec.tools.map(t => t.code)).not.toContain(done);
    expect(again.full.tools.map(t => t.code)).toEqual(first.rec.tools.map(t => t.code));
  });
});

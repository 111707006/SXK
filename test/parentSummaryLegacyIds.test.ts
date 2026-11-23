import { describe, it, expect } from 'vitest';
import { LEGACY_T1_DIMENSION_IDS, SUMMARY_DIMENSIONS, summaryRowOf, type SummarySource } from '../src/admin/parentSummary';
import { DIMENSIONS_DATA } from '../src/data';

/**
 * 2026-07-29 九維正名（2a1f4d8）之前的成績用舊 id。正式站直屬視野有兩位 07-18／07-19 篩查的家長：
 * 列表（讀 `dimensionName`）九個都列得出，彙總（照 id 對格）「感觉处理」「情绪与行为」「学习能力」三格是空的、需关注少算三個。
 */
const T = (dimensionId: string, dimensionName: string, status: string, completedAt = '2026-07-19T02:00:00.000Z') => ({
  dimensionId, dimensionName, tierId: 'T1' as const, score: 3, maxScore: 8, status: status as any, completedAt,
});

const OLD_SHAPE: Array<[string, string]> = [
  ['gross_motor', '动作发展'], ['fine_motor', '感觉处理'], ['sensory', '情绪与行为'], ['language', '语言沟通'],
  ['social_emotional', '社交互动'], ['cognitive', '认知'], ['attention', '注意力与执行'], ['self_care', '生活自理与适应'],
  ['family_env', '学习能力'],
];

const source = (scores: any[]): SummarySource => ({
  userId: 1, phone: null, companyId: null, companyName: null, child: { name: '小安' },
  scores, reportHistory: [], bookingCount: 0, handoffImports: [],
});

describe('彙總：正名之前的舊維度 id', () => {
  it('舊 id 換成現在的：九格都有、需关注九個', () => {
    const row = summaryRowOf(source(OLD_SHAPE.map(([id, name]) => T(id, name, 'delay'))), { multiCompany: false })!;
    expect(row.cells.every(c => c !== null)).toBe(true);
    expect(row.flaggedCount).toBe(9);
  });

  it('換過去的那一格就是同名的那一格（舊資料的名字＝現在那個 id 的名字）', () => {
    for (const [oldId, name] of OLD_SHAPE.filter(([id]) => id in LEGACY_T1_DIMENSION_IDS)) {
      const target = LEGACY_T1_DIMENSION_IDS[oldId];
      expect(DIMENSIONS_DATA.find(d => d.id === target)?.name, oldId).toBe(name);
      const row = summaryRowOf(source([T(oldId, name, 'borderline')]), { multiCompany: false })!;
      const filled = SUMMARY_DIMENSIONS.filter((_, i) => row.cells[i] !== null).map(d => d.id);
      expect(filled).toEqual([target]);
    }
  });

  it('同一個維度舊 id 與新 id 都有：取時間晚的那一格', () => {
    const row = summaryRowOf(
      source([T('sensory', '情绪与行为', 'delay', '2026-07-19T02:00:00.000Z'), T('emotion_behavior', '情绪与行为', 'normal', '2026-10-01T02:00:00.000Z')]),
      { multiCompany: false }
    )!;
    const i = SUMMARY_DIMENSIONS.findIndex(d => d.id === 'emotion_behavior');
    expect(row.cells[i]?.status).toBe('normal');
    expect(row.screenedAt).toBe('2026-10-01T02:00:00.000Z');
  });
});

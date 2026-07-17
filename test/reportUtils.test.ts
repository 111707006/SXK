import { describe, it, expect } from 'vitest';
import { generateSpecializedReportRecord, SPECIALIZED_TEMPLATES } from '../src/utils/reportUtils';
import { Child, DimensionScore, AssessmentRecord } from '../src/types';

const child: Child = { name: '小测', ageMonth: 42, gender: 'boy' };

function t3(dimensionId: string, score: number, maxScore = 50): DimensionScore {
  return { dimensionId, dimensionName: '语言沟通', tierId: 'T3', score, maxScore, status: 'delay', completedAt: '2026-07-16' };
}

describe('generateSpecializedReportRecord', () => {
  const scores: DimensionScore[] = [
    { dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T2', score: 20, maxScore: 50, status: 'delay', completedAt: '2026-07-16' },
    { dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T3', score: 15, maxScore: 50, status: 'delay', completedAt: '2026-07-16' },
    { dimensionId: 'cognitive', dimensionName: '认知', tierId: 'T2', score: 40, maxScore: 50, status: 'normal', completedAt: '2026-07-16' },
  ];

  it('produces a T2_T3_SPECIALIZED record for the dimension', () => {
    const rec = generateSpecializedReportRecord(child, scores, 'language', t3('language', 15));
    expect(rec.type).toBe('T2_T3_SPECIALIZED');
    expect(rec.dimensionId).toBe('language');
    expect(rec.dimensionName).toBe('语言沟通');
    expect(rec.child).toEqual(child);
  });

  it('keeps only this dimension\'s scores', () => {
    const rec = generateSpecializedReportRecord(child, scores, 'language', t3('language', 15));
    expect(rec.scores.every(s => s.dimensionId === 'language')).toBe(true);
    expect(rec.scores).toHaveLength(2);
  });

  it('falls back to the per-dimension template when no AI override', () => {
    const rec = generateSpecializedReportRecord(child, scores, 'language', t3('language', 15));
    expect(rec.aiReport!.summary).toBe(SPECIALIZED_TEMPLATES.language.summary);
    expect(rec.aiReport!.rehabSuggestions).toEqual(SPECIALIZED_TEMPLATES.language.rehabSuggestions);
  });

  it('uses the AI override when provided', () => {
    const override: AssessmentRecord['aiReport'] = {
      summary: 'AI 生成的摘要',
      neuralPathwayAnalysis: 'AI 分析',
      rehabSuggestions: ['建议一'],
      homeGuidance: ['家庭一'],
      prognosisPrediction: '预后',
      criticalMetrics: { neuralPlasticity: 70, sensoryIntegration: 66, familyEnvironmentScore: 80, motorControlIndex: 60 },
    };
    const rec = generateSpecializedReportRecord(child, scores, 'language', t3('language', 15), override);
    expect(rec.aiReport).toEqual(override);
    expect(rec.aiReport!.summary).toBe('AI 生成的摘要');
  });

  it('clamps template metrics into the 50..98 range regardless of score', () => {
    for (const score of [0, 25, 50]) {
      const rec = generateSpecializedReportRecord(child, scores, 'gross_motor', {
        dimensionId: 'gross_motor', dimensionName: '动作发展', tierId: 'T3', score, maxScore: 50, status: 'delay', completedAt: '2026-07-16',
      });
      const m = rec.aiReport!.criticalMetrics;
      for (const v of Object.values(m)) {
        expect(v).toBeGreaterThanOrEqual(50);
        expect(v).toBeLessThanOrEqual(98);
      }
    }
  });

  it('falls back to the language template for an unknown dimension', () => {
    const rec = generateSpecializedReportRecord(child, scores, 'does_not_exist', t3('does_not_exist', 10));
    expect(rec.aiReport!.summary).toBe(SPECIALIZED_TEMPLATES.language.summary);
  });
});

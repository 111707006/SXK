import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { t1OnlyFindings } from '../src/t2/t1OnlySnapshot';
import { planPeriod } from '../src/t2/trainingPush';
import { dimensionColors } from '../src/t2/trainingPush';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES, type T1Flag } from '../src/t2/types';
import { T2ReportSnapshot } from '../src/components/T2Report';

/**
 * 「只有 T1」的快照（#92）：推送規則吃得下、排得出一期（顏色都是 T1 推定）；報告頁畫九宮格、沒有作答回顧。
 */

const flags = Object.fromEntries(DIMENSION_CODES.map(d => [d, (d === 'LANG' ? 2 : d === 'ATT' ? 1 : 0) as T1Flag])) as Record<(typeof DIMENSION_CODES)[number], T1Flag>;
const findings = t1OnlyFindings({ t1Flags: flags, assessedAgeMonth: 48, sex: 'boy', now: new Date('2026-10-23T00:00:00Z') });

describe('推送規則', () => {
  it('九個方面都是 T1 推定', () => {
    const colors = dimensionColors(findings.dimensions);
    expect(colors).toHaveLength(9);
    expect(colors.every(c => c.source === 't1')).toBe(true);
    expect(colors.find(c => c.dimension === 'LANG')!.color).toBe('red');
  });

  it('排得出一期：12 週 × 3 格、不重複', () => {
    const plan = planPeriod({ dimensions: findings.dimensions, ageMonth: 48, library: ACTIVITY_SEED });
    const ids = plan.weeks.flat().map(s => s.activityId);
    expect(plan.weeks).toHaveLength(12);
    expect(ids.filter(Boolean)).toHaveLength(36);
    expect(new Set(ids).size).toBe(36);
  });
});

describe('報告頁', () => {
  it('畫九宮格與「按 T1 儿少综合发展评估推定」，沒有作答回顧', () => {
    const html = renderToStaticMarkup(createElement(T2ReportSnapshot, {
      entry: { id: 1, createdAt: '2026-10-23T00:00:00Z', findings, prose: null, isAiGenerated: false, aiEngine: 't1-only' } as never,
    }));
    expect(html).toContain('id="t2-non-scale-report"');
    expect(html).toContain('按 T1 儿少综合发展评估推定');
    expect(html.match(/data-band="not_assessed"/g)?.length).toBeGreaterThanOrEqual(8);
    expect(html).not.toContain('作答回顾');
  });
});

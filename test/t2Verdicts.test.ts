import { describe, expect, it } from 'vitest';
import { applyT2Verdicts, t2VerdictsFrom } from '../src/t2/t2Verdicts';
import type { DimensionScore } from '../src/types';

const t1 = (dimensionId: string, status: DimensionScore['status']): DimensionScore => ({
  dimensionId, dimensionName: dimensionId, tierId: 'T1', score: 2, maxScore: 8, status, completedAt: '2026-11-10T00:00:00Z',
});

describe('做過 T2 的方面照 T2 判定', () => {
  it('只收有量表判定的 clear／watch／refer', () => {
    const v = t2VerdictsFrom({
      dimensions: [
        { dimensionId: 'MOT', band: 'watch', drivenBy: 'SXK-GM' },
        { dimensionId: 'LANG', band: 'refer', drivenBy: 'SXK-LANG' },
        { dimensionId: 'SEN', band: 'clear', drivenBy: 'SXK-SEN' },
        // T1 綠、沒推量表：v3 也寫 clear，但不是 T2 判的
        { dimensionId: 'COG', band: 'clear', drivenBy: null },
        { dimensionId: 'ATT', band: 'not_assessed', drivenBy: null },
        { dimensionId: 'SOC', band: 'partial', drivenBy: null },
      ],
    });
    expect(v).toEqual({ gross_motor: 'borderline', language: 'delay', sensory_processing: 'normal' });
  });

  it('沒有快照就是空的', () => {
    expect(t2VerdictsFrom(null)).toEqual({});
    expect(t2VerdictsFrom({})).toEqual({});
  });

  it('換掉 T1 的判定、分數不動；沒有 T2 判定的照舊', () => {
    const out = applyT2Verdicts([t1('gross_motor', 'delay'), t1('attention', 'delay')], { gross_motor: 'borderline' });
    expect(out[0]).toMatchObject({ dimensionId: 'gross_motor', status: 'borderline', score: 2 });
    expect(out[1].status).toBe('delay');
  });
});

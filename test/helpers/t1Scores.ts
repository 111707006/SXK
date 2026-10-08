import { getT1AgeBand } from '../../src/t1Data';

/** 一個年齡段的九維成績，逐題作答由 `pick(維度, 第幾題)` 決定。 */
export function bandScores(ageMonth: number, pick: (dimId: string, i: number) => 0 | 1 | 2, withItems = true) {
  const band = getT1AgeBand(ageMonth);
  const dims = [...new Set(band.questions.map(q => q.dimensionId))];
  return dims.map(dimId => {
    const qs = band.questions.filter(q => q.dimensionId === dimId);
    const items = qs.map((_, i) => pick(dimId, i));
    const score = items.reduce<number>((a, b) => a + b, 0);
    return {
      dimensionId: dimId,
      dimensionName: qs[0].dimensionName,
      tierId: 'T1' as const,
      score,
      maxScore: 8,
      status: score <= 5 ? 'delay' as const : score < 8 ? 'borderline' as const : 'normal' as const,
      completedAt: '2026-10-01T00:00:00.000Z',
      assessedAgeMonth: ageMonth,
      ...(withItems ? { items } : {}),
    };
  });
}


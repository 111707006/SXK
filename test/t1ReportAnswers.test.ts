import { describe, it, expect } from 'vitest';
import { T1_AGE_BANDS, getT1AgeBand } from '../src/t1Data';
import { bandScores } from './helpers/t1Scores';
import {
  SCREENING_SERIES_MAX, flaggedDimensions, screeningSeries, t1AnswersOf, toConcernScore,
} from '../src/t1report/answers';

describe('t1AnswersOf：逐題作答對到題目', () => {
  it.each(T1_AGE_BANDS.map(b => [b.id, b.minAge] as const))('%s 段：九維、36 題、題目原文照年齡段', (_id, age) => {
    const scores = bandScores(age, (_d, i) => (i === 0 ? 0 : i === 1 ? 1 : 2));
    const a = t1AnswersOf(scores);
    expect(a.dimensions).toHaveLength(9);
    expect(a.counts).toEqual({ can: 18, partly: 9, notYet: 9, total: 36 });
    const band = getT1AgeBand(age);
    expect(a.bandName).toBe(band.name);
    for (const d of a.dimensions) {
      const qs = band.questions.filter(q => q.dimensionId === d.dimensionId);
      expect(d.items!.map(i => i.text)).toEqual(qs.map(q => q.text));
      expect(d.items![0].answer).toBe(0);
    }
  });

  it('年齡段照測評月齡找，不照退路月齡', () => {
    const scores = bandScores(18, () => 2);
    expect(t1AnswersOf(scores, 100).bandName).toBe(getT1AgeBand(18).name);
  });

  it('舊成績沒有逐題作答：每一維 items 是 null，counts 是 null（不補數字）', () => {
    const scores = bandScores(30, () => 1, false);
    const a = t1AnswersOf(scores, 30);
    expect(a.dimensions.every(d => d.items === null)).toBe(true);
    expect(a.counts).toBeNull();
  });

  it('少一維的逐題作答：counts 是 null（少一維的 X / 36 是錯的數字）', () => {
    const scores = bandScores(30, () => 2);
    delete (scores[3] as any).items;
    expect(t1AnswersOf(scores).counts).toBeNull();
    expect(t1AnswersOf(scores).dimensions.filter(d => d.items).length).toBe(8);
  });

  it('沒有月齡（沒有測評月齡、也沒給退路）：讀不出題目，不猜', () => {
    const scores = bandScores(30, () => 2).map(({ assessedAgeMonth: _drop, ...s }) => s);
    const a = t1AnswersOf(scores);
    expect(a.ageMonth).toBeNull();
    expect(a.counts).toBeNull();
  });

  it('壞資料不丟例外：題數不對、值域外、非陣列、深度評估成績都略過', () => {
    const scores: any[] = bandScores(30, () => 2);
    scores[0].items = [2, 2, 2];
    scores[1].items = [2, 2, 2, 3];
    scores.push({ dimensionId: 'language', tierId: 'T2', score: 10, maxScore: 50, status: 'delay' });
    scores.push(null, 'x', { dimensionId: '' });
    const a = t1AnswersOf(scores);
    expect(a.dimensions).toHaveLength(9);
    expect(a.dimensions.find(d => d.dimensionId === scores[0].dimensionId)!.items).toBeNull();
    expect(a.dimensions.find(d => d.dimensionId === scores[1].dimensionId)!.items).toBeNull();
    expect(t1AnswersOf(undefined).dimensions).toEqual([]);
    expect(t1AnswersOf({}).counts).toBeNull();
  });

  it('被標記的維度：紅燈在前、黃燈在後，綠燈不在', () => {
    const scores = bandScores(30, (d, i) => (d === 'language' ? 0 : d === 'attention' && i === 0 ? 1 : 2));
    const f = flaggedDimensions(t1AnswersOf(scores));
    expect(f.map(d => d.dimensionId)).toEqual(['language', 'attention']);
  });
});

describe('screeningSeries：歷次報告的關注分', () => {
  const rec = (id: string, createdAt: string, pick: () => 0 | 1 | 2, extra: Record<string, unknown> = {}) => ({
    id, createdAt, type: 'T1_SCREENING', child: { name: '森森', ageMonth: 30 },
    scores: bandScores(30, pick), aiReport: { summary: 'x' }, ...extra,
  });

  it('只有這一份：一個點', () => {
    const s = screeningSeries([], { id: 'r1', createdAt: '2026-10-01', scores: bandScores(30, () => 2) });
    expect(s).toHaveLength(1);
    expect(s[0].dimensions.language).toEqual({ concern: 0, status: 'normal' });
  });

  it('由舊到新，這一份在最後；比它新的、深度評估、沒有報告的篩查都不算', () => {
    const history = [
      rec('r3', '2026-09-01', () => 1),
      rec('r1', '2026-03-01', () => 0),
      rec('future', '2026-12-01', () => 2),
      rec('t2', '2026-05-01', () => 2, { type: 'T2_T3_SPECIALIZED' }),
      { ...rec('noai', '2026-06-01', () => 2), aiReport: undefined },
      rec('cur', '2026-10-01', () => 2),
    ];
    const s = screeningSeries(history, { id: 'cur', createdAt: '2026-10-01', scores: bandScores(30, () => 2) });
    expect(s.map(p => p.id)).toEqual(['r1', 'r3', 'cur']);
    expect(s[0].dimensions.language.concern).toBe(toConcernScore(0, 8));
    expect(s[0].dimensions.language.status).toBe('delay');
  });

  it('剛生成、還沒進歷史的那一份（沒有 createdAt）：歷史全收，它補在最後', () => {
    const s = screeningSeries([rec('a', '2026-01-01', () => 1)], { id: null, scores: bandScores(30, () => 2) });
    expect(s.map(p => p.id)).toEqual(['a', 'current']);
  });

  it(`最多 ${SCREENING_SERIES_MAX} 份（最近的）`, () => {
    const history = Array.from({ length: 10 }, (_, i) => rec(`r${i}`, `2026-0${i}-01`.replace('-0' + i, `-${String(i + 1).padStart(2, '0')}`), () => 2));
    const s = screeningSeries(history, { id: 'x', createdAt: '2027-01-01', scores: bandScores(30, () => 2) });
    expect(s).toHaveLength(SCREENING_SERIES_MAX);
    expect(s[s.length - 1].id).toBe('x');
  });

  it('壞資料不丟例外', () => {
    expect(() => screeningSeries('junk', { scores: null })).not.toThrow();
    expect(screeningSeries([null, 1, { id: 3 }], { scores: [] })).toHaveLength(1);
  });
});

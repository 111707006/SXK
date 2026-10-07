import { describe, it, expect } from 'vitest';
import {
  PUSH_RULES_VERSION,
  periodCompletion,
  periodForWeek,
  periodPosition,
  reportActivitiesOf,
  weeklyActivitiesOf,
  type PeriodContext,
  type PeriodDeps,
} from '../src/t2/trainingPeriodService';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { addCalendarDays } from '../src/t2/weeks';
import { DIMENSION_CODES } from '../src/t2/types';
import type { TrainingPeriodInsert, TrainingPeriodRecord } from '../src/db/t2TrainingPeriods';
import type { PracticeCheckin } from '../src/t2/practiceStats';

/**
 * 一期的生命週期（T2 v3 規格 §3、§5.2）：用記憶體替身跑資料層。
 */

const FIRST = '2026-10-05'; // 星期一

function memoryDeps(checkins: PracticeCheckin[] = []) {
  const rows: TrainingPeriodRecord[] = [];
  const updates: number[] = [];
  const deps: PeriodDeps = {
    latest: async findingsId =>
      rows.filter(r => r.findingsId === findingsId).sort((a, b) => b.periodNo - a.periodNo)[0] ?? null,
    insert: async (input: TrainingPeriodInsert) => {
      const record = { id: rows.length + 1, createdAt: null, ...input };
      rows.push(record);
      return record;
    },
    updatePlan: async (id, plan) => {
      updates.push(id);
      rows.find(r => r.id === id)!.plan = plan;
    },
    checkins: async (from, to) => checkins.filter(c => c.checkinDate >= from && c.checkinDate <= to),
  };
  return { deps, rows, updates };
}

function ctx(over: Partial<PeriodContext> = {}): PeriodContext {
  return {
    findingsId: 9,
    dimensions: DIMENSION_CODES.map(d => ({ dimensionId: d, band: d === 'LANG' ? 'refer' : d === 'MOT' ? 'watch' : 'clear', t1Flag: 0 as const })),
    t1Scores: {},
    library: ACTIVITY_SEED,
    sampleOnly: false,
    ageMonthAt: () => 48,
    ...over,
  };
}

const weekOf = (n: number) => addCalendarDays(FIRST, (n - 1) * 7);

describe('periodForWeek', () => {
  it('第一次：以這一週為第 1 週開第 1 期（adjustment none、記規則版本）', async () => {
    const { deps, rows } = memoryDeps();
    const got = await periodForWeek(FIRST, ctx(), deps);
    expect(got.kind).toBe('ok');
    if (got.kind !== 'ok') return;
    expect(got.week).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ periodNo: 1, firstWeekStart: FIRST, ageMonth: 48, adjustment: 'none', completion: null, rulesVersion: PUSH_RULES_VERSION });
  });

  it('同一期的第 5 週：不再開新的，回第 5 週', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const got = await periodForWeek(weekOf(5), ctx(), deps);
    expect(got.kind === 'ok' && got.week).toBe(5);
    expect(rows).toHaveLength(1);
  });

  it('在這一期第 1 週之前（沒存過的舊週次）→ before_period', async () => {
    const { deps } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    expect((await periodForWeek(addCalendarDays(FIRST, -7), ctx(), deps)).kind).toBe('before_period');
  });

  it('月齡算不出來 → age_unknown，不開期', async () => {
    const { deps, rows } = memoryDeps();
    expect((await periodForWeek(FIRST, ctx({ ageMonthAt: () => null }), deps)).kind).toBe('age_unknown');
    expect(rows).toHaveLength(0);
  });

  it('過了第 12 週、沒打卡：完成率 0 → 執行困難，第 2 期每週 2 支、全用简单', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const got = await periodForWeek(weekOf(13), ctx(), deps);
    expect(got.kind === 'ok' && got.week).toBe(1);
    expect(rows[1]).toMatchObject({ periodNo: 2, firstWeekStart: weekOf(13), adjustment: 'hard', completion: 0 });
    expect(rows[1].plan!.perWeek).toBe(2);
  });

  it('過了第 12 週、每一支都打過卡 → 進步良好；第 2 期全用难一点', async () => {
    const first = memoryDeps();
    await periodForWeek(FIRST, ctx(), first.deps);
    const plan = first.rows[0].plan!;
    const checkins = plan.weeks.flatMap((w, i) => w.map(s => ({ activityId: s.activityId!, checkinDate: addCalendarDays(weekOf(i + 1), 2) })));
    const { deps, rows } = memoryDeps(checkins);
    await periodForWeek(FIRST, ctx(), deps);
    await periodForWeek(weekOf(13), ctx(), deps);
    expect(rows[1]).toMatchObject({ adjustment: 'good', completion: 1 });
    expect(rows[1].plan!.weeks.flat().every(s => s.variant === 'hard')).toBe(true);
  });

  it('新報告（另一個 findingsId）從第 1 期重來，不帶調整', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    await periodForWeek(weekOf(20), ctx({ findingsId: 10 }), deps);
    expect(rows[1]).toMatchObject({ findingsId: 10, periodNo: 1, adjustment: 'none' });
  });

  it('那一週有活動被停用：補下一支並寫回（只改那一期）', async () => {
    const { deps, rows, updates } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const victim = rows[0].plan!.weeks[2][0].activityId!;
    const library = ACTIVITY_SEED.map(a => (a.id === victim ? { ...a, active: false } : a));
    const got = await periodForWeek(weekOf(3), ctx({ library }), deps);
    expect(updates).toEqual([1]);
    expect(got.kind === 'ok' && got.period.plan.weeks[2][0].activityId).not.toBe(victim);
    expect(rows[0].plan!.weeks[2][0].reason.replaced).toBe(true);
  });

  it('最新一期的 plan 壞了（讀回 null）→ 接著編號開一期', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    rows[0].plan = null;
    await periodForWeek(weekOf(2), ctx(), deps);
    expect(rows[1]).toMatchObject({ periodNo: 2, firstWeekStart: weekOf(2), adjustment: 'none' });
  });
});

describe('格子 → 每週活動那一列、報告、計劃頁', () => {
  it('每週活動：3 支、reason 照舊形狀（band 由顏色換回）、push 記期、週、做法、顏色來源', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const period = { periodNo: 1, plan: rows[0].plan! };
    const w = weeklyActivitiesOf(period, 1, ACTIVITY_SEED);
    expect(w.picks).toHaveLength(3);
    const lang = w.picks.find(p => p.dimension === 'LANG')!;
    expect(lang.reason.band).toBe('refer');
    expect(lang.reason.matchedTags).toEqual([]);
    expect(lang.push).toMatchObject({ periodNo: 1, week: 1, color: 'red', source: 't2', variant: 'easy', relaxed: false });
    expect(w.preparing).toEqual([]);
    expect(w.alternates).toBeDefined();
  });

  it('報告的提示：同一週的那幾支，形狀照 WeeklyActivities', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const r = reportActivitiesOf(rows[0].plan!, 1, ACTIVITY_SEED);
    expect(r.picks.map(p => p.activity.id)).toEqual(rows[0].plan!.weeks[0].map(s => s.activityId));
  });

  it('計劃頁的位置：第幾週、第幾期、第幾個月、本月做法、能力表用這個月的窗口', async () => {
    const { deps } = memoryDeps();
    const got = await periodForWeek(FIRST, ctx(), deps);
    if (got.kind !== 'ok') throw new Error();
    const pos = periodPosition(got.period, 6);
    expect(pos).toMatchObject({ weekIndex: 6, totalWeeks: 12, periodNo: 1, monthIndex: 1, variant: 'standard', perWeek: 3, adjustment: 'none' });
    const lang = pos.dimensions.find(d => d.dimension === 'LANG')!;
    expect(lang.window).toEqual(got.period.plan.dimensions.find(d => d.dimension === 'LANG')!.monthWindows[1]);
  });

  it('完成率：每週練過的計劃活動 ÷ 每週格數，12 週加總', async () => {
    const { deps, rows } = memoryDeps();
    await periodForWeek(FIRST, ctx(), deps);
    const plan = rows[0].plan!;
    // 前 6 週每週練了一支 → 6 ÷ 36
    const checkins = plan.weeks.slice(0, 6).map((w, i) => ({ activityId: w[0].activityId!, checkinDate: weekOf(i + 1) }));
    expect(periodCompletion({ firstWeekStart: FIRST, plan }, checkins)).toBeCloseTo(6 / 36);
  });
});

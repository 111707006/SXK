/**
 * 線上干預 v3：一期怎麼開、這一週取哪幾格（規格 §3、§5.2、§6）。`server.ts` 只把資料層接進來（`PeriodDeps`）。
 *
 * 【為什麼不寫在 server.ts】
 * 開期、期末判檔、停用補位、把格子換成每週活動那一列 —— 這幾件事有分支、有順序，要能不開伺服器就測完
 *（`test/t2TrainingPeriodService.test.ts` 用記憶體替身）。端點本身只剩「讀快照、讀活動庫、呼叫這裡、存那一列」。
 *
 * 【一期的生命週期】
 * - 沒有一期、或最新那一期的 `plan` 壞了 → 以這一週為第 1 週開一期（第 1 期、或接著編號），`adjustment = 'none'`。
 * - 這一週落在最新那一期的 12 週裡 → 用它。
 * - 這一週在最新那一期之前（翻舊週次、而那一週沒有存過）→ `before_period`，端點回 400。
 * - 這一週已經過了最新那一期的第 12 週 → 算那一期的完成率、判檔（`adjustmentFromCompletion`），以這一週為第 1 週開下一期。
 * 重新生成報告是新的快照（`findingsId` 不同），從第 1 期重來，不帶調整。
 */

import { BAND_OF_COLOR, adjustmentFromCompletion, monthIndexOf, periodAlternates, planActivityIds, planPeriod, replaceInactive } from './trainingPush';
import type { PeriodAdjustment, PeriodPlan, PeriodSlot, PlanPeriodInput } from './trainingPush';
import { completionRate } from './practiceStats';
import type { PracticeCheckin } from './practiceStats';
import { PLAN_TOTAL_WEEKS, planPosition } from './trainingPlan';
import { addCalendarDays } from './weeks';
import { DIMENSION_CODES } from './types';
import type { Activity, DimensionCode } from './types';
import type { StoredPeriodPlan, TrainingPeriodInsert, TrainingPeriodRecord } from '../db/t2TrainingPeriods';
import type { StoredPick, StoredWeeklyActivities } from '../db/t2WeeklyPlans';
import type { WeeklyActivities } from './activityMatch';

/** 推送規則的版本：規則換了就換，存在每一期上。 */
export const PUSH_RULES_VERSION = 'push-v3-2026-10-07';

export interface PeriodDeps {
  /** 這份快照最新的一期。 */
  latest(findingsId: number): Promise<TrainingPeriodRecord | null>;
  /** 存一期；同一期被別的請求先存了就回那一筆（唯一索引撞到不是錯誤）。 */
  insert(input: TrainingPeriodInsert): Promise<TrainingPeriodRecord>;
  updatePlan(id: number, plan: StoredPeriodPlan): Promise<void>;
  /** 一段日期（頭尾都含）的打卡，期末算完成率用。 */
  checkins(from: string, to: string): Promise<ReadonlyArray<PracticeCheckin>>;
}

export interface PeriodContext {
  findingsId: number;
  dimensions: PlanPeriodInput['dimensions'];
  t1Scores: PlanPeriodInput['t1Scores'];
  library: ReadonlyArray<Activity>;
  sampleOnly: boolean;
  /** 那一週星期一的實足月齡；算不出來（那一週在出生之前）是 `null`。 */
  ageMonthAt(weekStart: string): number | null;
}

export type PeriodForWeek =
  | { kind: 'ok'; period: TrainingPeriodRecord & { plan: StoredPeriodPlan }; week: number }
  | { kind: 'before_period' }
  | { kind: 'age_unknown' };

/** 一期 12 週的每一週星期一。 */
function periodWeekStarts(firstWeekStart: string): string[] {
  return Array.from({ length: PLAN_TOTAL_WEEKS }, (_, i) => addCalendarDays(firstWeekStart, i * 7));
}

/** 這一期的完成率（規格 §5.2）：12 週，每週「練過的計劃活動數」÷ 每週格數。 */
export function periodCompletion(period: { firstWeekStart: string; plan: StoredPeriodPlan }, checkins: ReadonlyArray<PracticeCheckin>): number | null {
  const starts = periodWeekStarts(period.firstWeekStart);
  return completionRate(
    checkins,
    starts.map((weekStart, i) => ({
      weekStart,
      planActivityIds: period.plan.weeks[i].flatMap(s => (s.activityId ? [s.activityId] : [])),
    })),
  ).rate;
}

/** 這一週屬於哪一期、第幾週；需要時開新的一期（檔頭「生命週期」），需要時補停用的那幾格（§4.6）。 */
export async function periodForWeek(weekStart: string, ctx: PeriodContext, deps: PeriodDeps): Promise<PeriodForWeek> {
  const latest = await deps.latest(ctx.findingsId);

  let adjustment: PeriodAdjustment = 'none';
  let completion: number | null = null;
  let previousIds: string[] = [];
  if (latest && latest.plan) {
    if (weekStart < latest.firstWeekStart) return { kind: 'before_period' };
    const { weekIndex } = planPosition(weekStart, latest.firstWeekStart);
    if (weekIndex <= PLAN_TOTAL_WEEKS) return withReplacements({ ...latest, plan: latest.plan }, weekIndex, ctx, deps);
    // 期末：上一期 12 週的完成率 → 判檔
    const starts = periodWeekStarts(latest.firstWeekStart);
    const checkins = await deps.checkins(starts[0], addCalendarDays(starts[starts.length - 1], 6));
    completion = periodCompletion({ firstWeekStart: latest.firstWeekStart, plan: latest.plan }, checkins);
    adjustment = adjustmentFromCompletion(completion);
    previousIds = planActivityIds(latest.plan);
  }

  const ageMonth = ctx.ageMonthAt(weekStart);
  if (ageMonth === null) return { kind: 'age_unknown' };
  const plan = planPeriod({
    dimensions: ctx.dimensions,
    t1Scores: ctx.t1Scores,
    ageMonth,
    library: ctx.library,
    adjustment,
    previousIds,
    sampleOnly: ctx.sampleOnly,
  });
  const stored = await deps.insert({
    findingsId: ctx.findingsId,
    periodNo: (latest?.periodNo ?? 0) + 1,
    firstWeekStart: weekStart,
    ageMonth,
    adjustment,
    completion,
    plan: { perWeek: plan.perWeek, sampleOnly: plan.sampleOnly, dimensions: plan.dimensions, weeks: plan.weeks },
    rulesVersion: PUSH_RULES_VERSION,
  });
  if (!stored.plan) throw new Error('trainingPeriodService：剛存的一期讀回來 plan 是壞的');
  const week = planPosition(weekStart, stored.firstWeekStart).weekIndex;
  return withReplacements({ ...stored, plan: stored.plan }, week, ctx, deps);
}

async function withReplacements(
  period: TrainingPeriodRecord & { plan: StoredPeriodPlan },
  week: number,
  ctx: PeriodContext,
  deps: PeriodDeps,
): Promise<PeriodForWeek> {
  const full: PeriodPlan = { ...period.plan, adjustment: period.adjustment, ageMonth: period.ageMonth };
  const next = replaceInactive(full, week, ctx.library);
  if (next === full) return { kind: 'ok', period, week };
  const plan: StoredPeriodPlan = { perWeek: next.perWeek, sampleOnly: next.sampleOnly, dimensions: next.dimensions, weeks: next.weeks };
  await deps.updatePlan(period.id, plan);
  return { kind: 'ok', period: { ...period, plan }, week };
}

/** 格子 → 每週活動那一列的一支。`reason` 照舊形狀存一份（band 由顏色換回），v3 的東西放 `push`。 */
function pickOf(slot: PeriodSlot, periodNo: number, activity: Activity | undefined): StoredPick {
  const [lo, hi] = slot.reason.window;
  return {
    id: slot.activityId!,
    dimension: slot.dimension,
    reason: {
      band: BAND_OF_COLOR[slot.reason.color],
      window: { lo, hi },
      matchedTags: [],
      belowWindow: slot.reason.relaxed && activity !== undefined && activity.ageMonths.max < lo,
    },
    push: {
      periodNo,
      week: slot.week,
      color: slot.reason.color,
      source: slot.reason.source,
      module: slot.reason.module,
      window: [lo, hi],
      variant: slot.variant,
      relaxed: slot.reason.relaxed,
      ...(slot.reason.replaced ? { replaced: true } : {}),
    },
  };
}

/** 這一期第 `week` 週 → `t2_weekly_plans` 那一列的 `activities`（picks、準備中、換著玩）。 */
export function weeklyActivitiesOf(
  period: { periodNo: number; plan: StoredPeriodPlan },
  week: number,
  library: ReadonlyArray<Activity>,
): StoredWeeklyActivities {
  const byId = new Map(library.map(a => [a.id, a] as const));
  const slots = period.plan.weeks[week - 1] ?? [];
  const picks = slots.filter(s => s.activityId !== null).map(s => pickOf(s, period.periodNo, byId.get(s.activityId!)));
  const preparing = DIMENSION_CODES.filter(d => slots.some(s => s.dimension === d && s.activityId === null));
  const alternates: Partial<Record<DimensionCode, string[]>> = {};
  for (const [d, list] of Object.entries(periodAlternates(period.plan, week, library)) as Array<[DimensionCode, Activity[]]>) {
    alternates[d] = list.map(a => a.id);
  }
  return { picks, preparing, alternates };
}

/** 報告的提示要的形狀（`WeeklyActivities`）：這一期第 `week` 週的那幾支。查不到內容的略過。 */
export function reportActivitiesOf(plan: Pick<PeriodPlan, 'weeks'>, week: number, library: ReadonlyArray<Activity>): WeeklyActivities {
  const byId = new Map(library.map(a => [a.id, a] as const));
  const slots = plan.weeks[week - 1] ?? [];
  const picks = slots.flatMap(slot => {
    const activity = slot.activityId ? byId.get(slot.activityId) : undefined;
    if (!activity) return [];
    const { reason } = pickOf(slot, 0, activity);
    return [{ activity, dimension: slot.dimension, score: 0, reason }];
  });
  const preparing = DIMENSION_CODES.filter(d => slots.some(s => s.dimension === d && s.activityId === null));
  return { picks, preparing };
}

/** 計劃頁要的位置（`plan` 那一塊）：第幾週、第幾期、第幾個月、本月做法、每週幾支、能力表。 */
export function periodPosition(period: TrainingPeriodRecord & { plan: StoredPeriodPlan }, week: number) {
  const m = monthIndexOf(week);
  return {
    weekIndex: week,
    totalWeeks: PLAN_TOTAL_WEEKS,
    firstWeekStart: period.firstWeekStart,
    periodNo: period.periodNo,
    monthIndex: m,
    variant: period.plan.weeks[week - 1]?.[0]?.variant ?? 'standard',
    perWeek: period.plan.perWeek,
    adjustment: period.adjustment,
    dimensions: period.plan.dimensions.map(d => ({
      dimension: d.dimension,
      color: d.color,
      source: d.source,
      window: d.monthWindows[m],
      quota: d.quota,
      modules: d.modules,
    })),
  };
}

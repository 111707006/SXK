/**
 * 家庭訓練畫面的資料整形（Keep 規格 §3.1、§3.2、§4.5）。純函式，不碰 fetch、不碰 React。
 *
 * 資料只有三個來源，這一檔不另編任何一份：
 * - `GET /api/t2/weekly-plan`：這一週的四支、準備中的維度、換著玩（K08）、第幾週（§4.5）。
 * - `GET /api/t2/checkins?from=&to=`：打卡；統計照 `src/t2/practiceStats.ts`（與伺服器同一份）。
 * - 報告快照（`T2Report.tsx` 手上的 findings）：評估結果的半圓儀表與各維度的卡。
 *
 * 【日期】一律照 `src/t2/weeks.ts`（Asia/Shanghai、一週從星期一開始），不用瀏覽器的本地時區。
 */

import { addCalendarDays, weekStartOf } from '../../t2/weeks';
import { MAX_CHECKIN_RANGE_DAYS } from '../../t2/practice';
import { PLAN_TOTAL_WEEKS, type PlanPosition } from '../../t2/trainingPlan';
import { dimensionStatus, gridDimensions } from '../../t2/reportCopy';
import type { PickReason } from '../../t2/activityMatch';
import type { AssessmentStatus } from '../../types';
import { DIMENSION_CODES } from '../../t2/types';
import type { Activity, DimensionCode, DimensionFinding, T2Findings } from '../../t2/types';

/** 這一週的一支（`activities[]`）。 */
export interface WeeklyPick {
  activity: Activity;
  dimension: DimensionCode;
  reason: PickReason;
}

/** `GET /api/t2/weekly-plan` 的回應（票 #60 ＋ Keep 規格 §5.1）。 */
export interface WeeklyPlanResponse {
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  findingsId: number;
  /** 配對用的實足月齡與它落在哪一個年齡段。 */
  ageMonth: number;
  ageKey: string;
  /** 報告用的測評月齡。與 `ageMonth` 不同時畫面要說明。 */
  reportAgeMonth: number;
  activities: WeeklyPick[];
  preparing: DimensionCode[];
  /**
   * 換著玩（K08）：只放有備選的維度；鍵的順序不是契約（畫面自己排，`alternateRows`）。
   * **沒有這一欄＝K08 之前存的週次**，畫面不出換著玩。
   */
  alternates?: Partial<Record<DimensionCode, Activity[]>>;
  plan?: PlanPosition;
}

/** 一段要查的打卡日期（頭尾含在內）。 */
export interface DateRange {
  from: string;
  to: string;
}

/** 兩個日曆日之間差幾天（`b − a`）。 */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / 86_400_000);
}

/** 一段日期切成每段最多 `MAX_CHECKIN_RANGE_DAYS` 天。 */
function chunk(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  let from = range.from;
  while (from <= range.to) {
    const end = addCalendarDays(from, MAX_CHECKIN_RANGE_DAYS - 1);
    const to = end < range.to ? end : range.to;
    out.push({ from, to });
    from = addCalendarDays(to, 1);
  }
  return out;
}

/**
 * 計劃頁要的打卡查哪幾段：12 週的打卡格（第 1 週起 84 天，今天以後的不查）加上這一週
 *（本週次數、x/4）。兩段接得上就併成一段，再照 API 的上限（62 天）切。
 *
 * 過了 12 週之後，格子那一段與這一週中間隔著的那幾週不查——畫面上沒有地方用到它們。
 */
export function checkinRanges(firstWeekStart: string, today: string): DateRange[] {
  const gridEnd = addCalendarDays(firstWeekStart, PLAN_TOTAL_WEEKS * 7 - 1);
  const grid: DateRange = { from: firstWeekStart, to: gridEnd < today ? gridEnd : today };
  const week: DateRange = { from: weekStartOf(today), to: today };

  const ranges: DateRange[] =
    daysBetween(grid.to, week.from) <= 1
      ? [{ from: grid.from < week.from ? grid.from : week.from, to: today }]
      : [grid, week];
  return ranges.flatMap(chunk);
}

// ── 第幾週 ──────────────────────────────────────────────────────────────

/**
 * 這一週是計劃的第幾週（§4.5，伺服器算好的 `plan`）。沒帶（B5 之前的伺服器、或快取的舊回應）就當
 * 第 1 週、第 1 週就是這一週 —— 不編一個更大的數字給畫面。
 */
export function planPositionOf(plan: WeeklyPlanResponse): PlanPosition {
  return plan.plan ?? { weekIndex: 1, totalWeeks: PLAN_TOTAL_WEEKS, firstWeekStart: plan.weekStart };
}

/**
 * STEP 1 的階梯站在哪一階：第 1–4 週第 1 個月、5–8 週第 2 個月、9–12 週第 3 個月，
 * 過了 12 週是最後那一階「再評估」。回 0–3。
 */
export function staircaseStage(weekIndex: number): number {
  if (weekIndex > PLAN_TOTAL_WEEKS) return 3;
  return Math.min(2, Math.floor((Math.max(1, weekIndex) - 1) / 4));
}

/** STEP 4 的打卡格：12 週 × 7 天的日期，從第 1 週的星期一起。 */
export function planGrid(firstWeekStart: string): string[][] {
  return Array.from({ length: PLAN_TOTAL_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addCalendarDays(firstWeekStart, w * 7 + d)),
  );
}

// ── 這一週 ──────────────────────────────────────────────────────────────

/** 本週有活動的維度，照四支出現的順序（維度篩選、佔比條）。 */
export function weekDimensions(picks: ReadonlyArray<WeeklyPick>): DimensionCode[] {
  return [...new Set(picks.map(p => p.dimension))];
}

export interface DimensionShare {
  dimension: DimensionCode;
  count: number;
  /** 佔本週幾成，四捨五入到整數（只給畫面看，加起來不一定剛好 100）。 */
  percent: number;
  titles: string[];
}

/** 「这周练哪几块」：各維度佔本週幾支。 */
export function dimensionShares(picks: ReadonlyArray<WeeklyPick>): DimensionShare[] {
  return weekDimensions(picks).map(dimension => {
    const mine = picks.filter(p => p.dimension === dimension);
    return {
      dimension,
      count: mine.length,
      percent: Math.round((mine.length / picks.length) * 100),
      titles: mine.map(p => p.activity.title),
    };
  });
}

/**
 * 「开始今天的活动」點進哪一支：本週第一支還沒練過的；都練過了就第一支。
 * 打卡讀不出來（`null`）時也是第一支 —— 不假裝知道哪一支練過。
 */
export function nextToStart(
  picks: ReadonlyArray<WeeklyPick>,
  timesByActivity: Readonly<Record<string, number>> | null,
): WeeklyPick | null {
  if (picks.length === 0) return null;
  if (!timesByActivity) return picks[0];
  return picks.find(p => !timesByActivity[p.activity.id]) ?? picks[0];
}

export interface AlternateRow {
  dimension: DimensionCode;
  activities: Activity[];
}

/**
 * 換著玩一個維度一列（§3.1 第 5 項）。回應裡鍵的順序不是契約：本週有的維度排前面（照四支的順序），
 * 其餘照九個維度的固定順序。舊週次（沒有 `alternates`）與空的維度都不出列。
 */
export function alternateRows(plan: WeeklyPlanResponse): AlternateRow[] {
  const alternates = plan.alternates;
  if (!alternates) return [];
  const week = weekDimensions(plan.activities);
  const order = [...week, ...DIMENSION_CODES.filter(d => !week.includes(d))];
  return order
    .map(dimension => ({ dimension, activities: alternates[dimension] ?? [] }))
    .filter(row => row.activities.length > 0);
}

// ── 我的评估结果（報告快照） ────────────────────────────────────────────

export interface ResultSummary {
  /** 三級各幾項（半圓儀表）。沒有判定的、不篩的不算進任何一級。 */
  counts: Record<AssessmentStatus, number>;
  /** 有標記的維度（refer、watch）：需要較多支持的在前，其餘照快照的順序。 */
  flagged: DimensionFinding[];
  /** 「其他 N 项」那一張。 */
  others: {
    total: number;
    /** 其中發展穩定的幾項。 */
    stable: number;
    /** 其中沒有判定的（還沒做完、這次沒做、暫無問卷），畫面寫出名字與狀態。 */
    unjudged: DimensionFinding[];
  };
}

/**
 * 計劃頁「我的评估结果」要的數字，全從報告快照來。維度走 `gridDimensions`（不篩的整格不出，與報告
 * 九宮格同一個出口），狀態走 `dimensionStatus(維度, 測評月齡)`（→ `statusWording.ts`），與九宮格同一支。
 */
export function resultSummary(findings: T2Findings): ResultSummary {
  const dims = gridDimensions(findings);
  const ageMonth = findings.child.assessedAgeMonth;
  const counts: Record<AssessmentStatus, number> = { normal: 0, borderline: 0, delay: 0 };
  const unjudged: DimensionFinding[] = [];
  for (const d of dims) {
    const s = dimensionStatus(d, ageMonth);
    if (s.kind === 'band') counts[s.status] += 1;
    else unjudged.push(d);
  }
  const flagged = [
    ...dims.filter(d => d.band === 'refer'),
    ...dims.filter(d => d.band === 'watch'),
  ];
  const others = dims.filter(d => d.band !== 'refer' && d.band !== 'watch');
  return { counts, flagged, others: { total: others.length, stable: counts.normal, unjudged } };
}

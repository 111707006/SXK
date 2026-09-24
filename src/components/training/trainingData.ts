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
import { MAX_CHECKIN_RANGE_DAYS, type Checkin, type CheckinMood } from '../../t2/practice';
import { weekPractice } from '../../t2/practiceStats';
import type { LibraryEntry } from '../../t2/libraryRoutes';
import type { DetailSource } from './layerStack';
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

// ── 活動詳情（§3.3，票 7） ─────────────────────────────────────────────

/** 有沒有示範片：`videoUrl` 非空才算（後台清掉是空字串）。 */
export function hasClip(activity: Pick<Activity, 'videoUrl'>): boolean {
  return typeof activity.videoUrl === 'string' && activity.videoUrl.trim() !== '';
}

/** 示範片長度「0:10」。不知道長度（還沒上片、或沒填）是空字串，畫面上不寫。 */
export function clipClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface PlanPlace {
  /** 本週四支之一：配對的那一筆（理由、維度）。 */
  pick: WeeklyPick | null;
  /** 換著玩的備選：是哪個維度的。 */
  swapDimension: DimensionCode | null;
  /** 在每週活動那一份裡找到的內容；找不到（片庫的一支）要另外讀單支。 */
  activity: Activity | null;
}

/**
 * 這一支在這週的計劃裡是什麼身分。先找四支、再找換著玩 —— 同一支不會兩邊都在（備選扣掉了本週四支，
 * Keep §5.2）。決定詳情頁「为什么这周排这一个」說哪一句，與點進來的地方（`from`）無關：片庫裡點到
 * 本週的一支，理由照樣是配對的那一句。
 */
export function findInPlan(plan: WeeklyPlanResponse | null, id: string): PlanPlace {
  const none: PlanPlace = { pick: null, swapDimension: null, activity: null };
  if (!plan) return none;
  const pick = plan.activities.find(p => p.activity.id === id);
  if (pick) return { pick, swapDimension: null, activity: pick.activity };
  for (const [dimension, list] of Object.entries(plan.alternates ?? {}) as Array<[DimensionCode, Activity[]]>) {
    const activity = list.find(a => a.id === id);
    if (activity) return { pick: null, swapDimension: dimension, activity };
  }
  return none;
}

export interface SeriesItem {
  id: string;
  title: string;
  hasClip: boolean;
}

export interface DetailSeries {
  /** 哪一組：本週計劃、某個維度的換著玩、示範片庫。 */
  kind: DetailSource;
  /** 換著玩那一組是哪個維度的。 */
  dimension: DimensionCode | null;
  items: SeriesItem[];
  /** 這一支在那一組裡是第幾支（0 起）。 */
  index: number;
}

/**
 * 詳情頁的「系列列」（§3.3）：從哪裡點進來，就列哪一組 —— 本週四支、換著玩的那個維度、示範片庫。
 * 那一組還沒讀到、或這一支不在那一組裡（歷史上留著的舊一格），回 `null`，畫面不出那一列。
 */
export function detailSeries(
  from: DetailSource,
  id: string,
  plan: WeeklyPlanResponse | null,
  library: ReadonlyArray<LibraryEntry> | null,
): DetailSeries | null {
  let items: SeriesItem[] | null = null;
  let dimension: DimensionCode | null = null;
  if (from === 'plan' && plan) {
    items = plan.activities.map(p => ({ id: p.activity.id, title: p.activity.title, hasClip: hasClip(p.activity) }));
  } else if (from === 'swap' && plan) {
    dimension = findInPlan(plan, id).swapDimension;
    const list = dimension ? plan.alternates?.[dimension] ?? [] : [];
    items = list.map(a => ({ id: a.id, title: a.title, hasClip: hasClip(a) }));
  } else if (from === 'library' && library) {
    // 片庫只收有示範片的活動（`libraryEntries`）
    items = library.map(e => ({ id: e.id, title: e.title, hasClip: true }));
  }
  if (!items) return null;
  const index = items.findIndex(i => i.id === id);
  return index < 0 ? null : { kind: from, dimension, items, index };
}

/**
 * 孩子現在的月齡落在活動的適齡區間哪裡（頭尾都含）。`tooOld` 與 `tooYoung` 分開：配對會為了
 * 「從做得到的開始」往前取適齡較小的活動（`activityMatch.ts` 不拿 `ageMonths` 當閘），那種不該
 * 被說成「先看看示范片就好」。
 */
export function ageFit(range: Activity['ageMonths'], childAgeMonth: number | null): 'fits' | 'tooYoung' | 'tooOld' | 'unknown' {
  if (childAgeMonth === null || !Number.isFinite(childAgeMonth)) return 'unknown';
  if (childAgeMonth < range.min) return 'tooYoung';
  if (childAgeMonth > range.max) return 'tooOld';
  return 'fits';
}

// ── 打卡成功（§3.6，票 7） ─────────────────────────────────────────────

/** 勾／取消腳本「怎么看出有进步」的第幾條，由小到大（API 存的也是這個順序）。 */
export function toggleProgress(progress: ReadonlyArray<number>, index: number): number[] {
  const next = progress.includes(index) ? progress.filter(i => i !== index) : [...progress, index];
  return next.sort((a, b) => a - b);
}

/** 心情三選一、選填、可改：點選中的那一個就是取消。 */
export function nextMood(current: CheckinMood | null, clicked: CheckinMood): CheckinMood | null {
  return current === clicked ? null : clicked;
}

export interface CheckinSummary {
  /** 本週打卡次數（含剛打的這一筆；換著玩、片庫的也算）。 */
  sessions: number;
  /** 本週練過的計劃活動 x/4。手上的每週活動不是打卡那一週（或還沒讀到）時是 `null`，畫面不出。 */
  plan: { practiced: number; total: number } | null;
  /** 打卡那一週的星期一到星期日。`today` 是打卡那一天。 */
  days: Array<{ date: string; done: boolean; today: boolean }>;
}

/**
 * 打卡成功頁的數字。`just` 是 POST 剛回來的那一筆：畫面手上的清單可能還沒重讀（算進去），也可能
 * 已經重讀過（照 id 去重，不算兩次）。打卡清單讀不出來（`null`）整組回 `null` —— 只憑剛打的
 * 這一筆寫「本周打卡 1 次」，是在說一件不知道真假的事。
 */
export function checkinSummary(
  checkins: ReadonlyArray<Pick<Checkin, 'id' | 'activityId' | 'checkinDate'>> | null,
  just: Pick<Checkin, 'id' | 'activityId' | 'checkinDate'>,
  plan: WeeklyPlanResponse | null,
): CheckinSummary | null {
  if (!checkins) return null;
  const all = checkins.some(c => c.id === just.id) ? checkins : [...checkins, just];
  const weekStart = weekStartOf(just.checkinDate);
  const samePlanWeek = plan !== null && plan.weekStart === weekStart && plan.activities.length > 0;
  const week = weekPractice(all, weekStart, samePlanWeek ? plan.activities.map(p => p.activity.id) : []);
  const practiced = new Set(week.practicedDays);
  return {
    sessions: week.sessions,
    plan: samePlanWeek ? { practiced: week.planPracticed, total: week.planTotal } : null,
    days: Array.from({ length: 7 }, (_, d) => {
      const date = addCalendarDays(weekStart, d);
      return { date, done: practiced.has(date), today: date === just.checkinDate };
    }),
  };
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

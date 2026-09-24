/**
 * 打卡日曆的資料整形（Keep 規格 §3.7、§8 的第 12 週格）。純函式，不碰 fetch、不碰 React。
 *
 * 資料只有三個來源，這一檔不另編任何一份：
 * - `GET /api/t2/checkins?from=&to=`：一次查一個日曆月（最多 31 天，API 上限 62 天）。
 * - `GET /api/t2/practice-prefs`：提醒的星期幾與時間。
 * - 每週活動回應的 `plan`（§4.5）：第 1 週從哪天起 → 第 12 週末那一格（再評估）。
 *
 * 【日期】一律照 `src/t2/weeks.ts`（Asia/Shanghai、一週從星期一開始），不用瀏覽器的本地時區：
 * 月曆上的「今天」要與伺服器記打卡的那一天是同一天。
 */

import { addCalendarDays } from '../../t2/weeks';
import { PLAN_TOTAL_WEEKS } from '../../t2/trainingPlan';
import { monthPracticeDays, streakDays, weekPractice, type WeekPractice } from '../../t2/practiceStats';
import type { Checkin } from '../../t2/practice';
import type { Activity, DimensionCode } from '../../t2/types';
import { findInPlan, type DateRange, type WeeklyPlanResponse } from './trainingData';

/** `YYYY-MM`。 */
export type Month = string;

/** 月曆上的一天。 */
export interface CalendarDay {
  date: string;
  /** 幾號（1–31）。 */
  day: number;
  /** 有打卡：實心。 */
  done: boolean;
  /** 今天：外框。 */
  today: boolean;
  /**
   * 設了提醒的日子：虛線。只畫**今天以後**、還沒練的（§3.7）——今天自己已經有外框，過去的提醒日
   * 沒練就只是沒練，不再畫一個「該練」的記號。
   */
  reminder: boolean;
  /** 第 12 週末：再評估（§8、v2.1 S14），與計劃頁 12 週打卡格的最後一格是同一天。 */
  reassess: boolean;
}

export interface MonthGrid {
  /** 1 號之前空幾格（星期一開頭）。 */
  leadingBlanks: number;
  days: CalendarDay[];
}

export interface DayMarkInput {
  /** 有打卡的日子。 */
  practiced: ReadonlySet<string>;
  today: string;
  /** 提醒的星期幾（0＝星期一）；沒設是空陣列。 */
  reminderDays: ReadonlyArray<number>;
  /** 第 12 週末（再評估）那一天；沒有計劃是 `null`。 */
  reassessDay: string | null;
}

/** 這一天是星期幾：0＝星期一 … 6＝星期日（與 `practice.ts` 的提醒編號一致）。 */
function weekdayOf(date: string): number {
  // 經 Date.parse 構造，與 weeks.ts 同一個寫法（`childAge.structure` 的護欄只放行由變數算出的日期）
  return (new Date(Date.parse(`${date}T00:00:00.000Z`)).getUTCDay() + 6) % 7;
}

function daysInMonth(month: Month): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 一個月的格子：前面空幾格、每一天。 */
export function monthGrid(month: Month, marks: DayMarkInput): MonthGrid {
  const first = `${month}-01`;
  const remind = new Set(marks.reminderDays);
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = addCalendarDays(first, i);
    const done = marks.practiced.has(date);
    return {
      date,
      day: i + 1,
      done,
      today: date === marks.today,
      reminder: !done && date > marks.today && remind.has(weekdayOf(date)),
      reassess: date === marks.reassessDay,
    };
  });
  return { leadingBlanks: weekdayOf(first), days };
}

// ── 切月份與要查哪一段 ─────────────────────────────────────────────────

/** 這一天在哪個月（`YYYY-MM`）。 */
export function monthOf(date: string): Month {
  return date.slice(0, 7);
}

/** 往後（負數往前）推幾個月。 */
export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * 這個月要查哪一段打卡：1 號到月底，這個月就查到今天為止。一次查一個月（最多 31 天），在 API 的
 * 上限（62 天）以內。整個月都在今天以後是 `null`：還沒到的日子不會有打卡。
 */
export function monthFetchRange(month: Month, today: string): DateRange | null {
  const from = `${month}-01`;
  if (from > today) return null;
  const last = addCalendarDays(from, daysInMonth(month) - 1);
  return { from, to: last < today ? last : today };
}

/**
 * 第 12 週末（再評估）是哪一天：第 1 週的星期一往後第 84 天，第 12 週的星期日。
 * 與計劃頁 12 週打卡格的最後一格是同一天（`planGrid`）。
 */
export function reassessDayOf(firstWeekStart: string): string {
  return addCalendarDays(firstWeekStart, PLAN_TOTAL_WEEKS * 7 - 1);
}

// ── 三個數字與最近的打卡 ───────────────────────────────────────────────

/** 一個月的打卡：讀到了、還在讀、讀不出來。 */
export type MonthLoad = Checkin[] | 'loading' | 'error';

/** 查過的月份。沒有鍵＝還沒查。 */
export type LoadedMonths = Readonly<Record<Month, MonthLoad>>;

/** 最近的打卡列幾筆（§3.7）。 */
export const RECENT_CHECKINS = 8;

/**
 * 連續天數最多往前查幾個月。一路連著練到這麼久以前，數字就停在查得到的那一天（下限），
 * 不為了一個數字把一整年的打卡一個月一個月查回來。
 */
export const STREAK_LOOKBACK_MONTHS = 12;

/** 一進日曆先查哪幾個月：這個月（本月幾天、日曆）與上個月（連續天數跨月、最近的打卡）。 */
export function initialMonths(today: string): Month[] {
  const month = monthOf(today);
  return [month, shiftMonth(month, -1)];
}

export interface CalendarSummary {
  /** 本月練了幾天。這個月還沒讀到是 `null`。 */
  monthDays: number | null;
  /** 連續天數。還不知道斷在哪一天（要再往前查、或那個月讀不出來）是 `null`。 */
  streak: number | null;
  /** 最近的打卡，新的在前，最多 `RECENT_CHECKINS` 筆。這個月還沒讀到是 `null`。 */
  recent: Checkin[] | null;
  /** 連續天數要再往前查的那個月；不必查（或已經在查、查不到）是 `null`。 */
  earlierMonth: Month | null;
}

function byNewest(a: Checkin, b: Checkin): number {
  if (a.checkinDate !== b.checkinDate) return a.checkinDate < b.checkinDate ? 1 : -1;
  return b.id - a.id;
}

/**
 * 打卡日曆上面三個數字的前兩個與「最近的打卡」（第三個 x/4 是計劃頁同一份 `data.practice`）。
 *
 * 【只看接得上今天的那幾個月】
 * 從這個月往前、一個月接一個月都讀到了的那一段才算數。家長往前翻過的月份若與今天中間隔著一個
 * 沒查的月，那一段的打卡不拿來排「最近」、不拿來數連續：隔著的那個月裡有沒有打卡不知道。
 *
 * 【連續天數不說不知道的事】
 * 從今天（今天還沒練就從昨天，`practiceStats.streakDays`）往前數，數到手上最早那一天還連著，
 * 就還不知道斷在哪裡：回 `null` 並要呼叫端再往前查一個月（`earlierMonth`）。那個月讀不出來
 * 也是 `null`——寫一個比實際少的數字，是在告訴家長他斷過。
 */
export function calendarSummary(loaded: LoadedMonths, today: string): CalendarSummary {
  const current = monthOf(today);
  const own = loaded[current];
  if (!Array.isArray(own)) return { monthDays: null, streak: null, recent: null, earlierMonth: null };

  let first = current;
  const window: Checkin[] = [...own];
  for (;;) {
    const prev = loaded[shiftMonth(first, -1)];
    if (!Array.isArray(prev)) break;
    first = shiftMonth(first, -1);
    window.push(...prev);
  }

  const days = new Set(window.map(c => c.checkinDate));
  const count = streakDays(window, today);
  const anchor = days.has(today) ? today : addCalendarDays(today, -1);
  // 數到哪一天停下來：那一天在手上的範圍裡＝真的斷了；在範圍之前＝還不知道
  const stoppedAt = addCalendarDays(anchor, -count);
  let streak: number | null = count;
  let earlierMonth: Month | null = null;
  if (stoppedAt < `${first}-01`) {
    const need = monthOf(stoppedAt);
    if (need >= shiftMonth(current, -STREAK_LOOKBACK_MONTHS)) {
      streak = null;
      if (loaded[need] === undefined) earlierMonth = need;
    }
  }

  return {
    monthDays: monthPracticeDays(own, today),
    streak,
    recent: [...window].sort(byNewest).slice(0, RECENT_CHECKINS),
    earlierMonth,
  };
}

/**
 * 本週練過的計劃活動 x/4（第三個數字）：與計劃頁底部同一個算法（`practiceStats.weekPractice`，那一週的
 * 四支才算），但打卡用日曆自己查的那幾個月——這樣「還在讀」與「讀不出來」分得開（資料層那一份兩者都是
 * `null`）。本週跨到還沒到的月份時，那個月不用查：不會有打卡。沒有每週活動是 `null`。
 */
export function planWeekPractice(
  loaded: LoadedMonths,
  plan: Pick<WeeklyPlanResponse, 'weekStart' | 'weekEnd' | 'activities'> | null,
  today: string,
): WeekPractice | 'loading' | 'error' | null {
  if (!plan) return null;
  const current = monthOf(today);
  const checkins: Checkin[] = [];
  for (const month of new Set([monthOf(plan.weekStart), monthOf(plan.weekEnd)])) {
    if (month > current) continue;
    const load = loaded[month];
    if (load === 'error') return 'error';
    if (!Array.isArray(load)) return 'loading';
    checkins.push(...load);
  }
  return weekPractice(checkins, plan.weekStart, plan.activities.map(p => p.activity.id));
}

// ── 最近的打卡那一列 ────────────────────────────────────────────────────

/** 一列要的：封面、活動名、維度。 */
export interface ActivityInfo {
  title: string;
  posterUrl: string | null;
  dimensions: DimensionCode[];
}

/**
 * 一筆打卡的活動是哪一支。打卡只記編號；名字與封面從手上已有的找：
 * 本週的四支（維度＝配對的那一個）、換著玩（維度＝它排在哪一列）、單支讀回來的
 *（`GET /api/t2/activities/:id`，片庫或上一週的計劃；維度＝活動貼的）。都找不到是 `null`。
 */
export function activityInfo(
  activityId: string,
  plan: WeeklyPlanResponse | null,
  fetched: Readonly<Record<string, Activity>>,
): ActivityInfo | null {
  const info = (a: Activity, dimensions: DimensionCode[]): ActivityInfo => ({ title: a.title, posterUrl: a.posterUrl, dimensions });
  const place = findInPlan(plan, activityId);
  if (place.pick) return info(place.pick.activity, [place.pick.dimension]);
  if (place.activity && place.swapDimension) return info(place.activity, [place.swapDimension]);
  const a = fetched[activityId];
  return a ? info(a, a.dimensions) : null;
}

/** 最近的打卡裡，手上沒有、也還沒讀過（`tried`，含讀不到的）的活動編號，一支一次。 */
export function unknownActivityIds(
  recent: ReadonlyArray<Pick<Checkin, 'activityId'>>,
  plan: WeeklyPlanResponse | null,
  tried: ReadonlySet<string>,
): string[] {
  const ids = [...new Set(recent.map(c => c.activityId))];
  return ids.filter(id => !tried.has(id) && activityInfo(id, plan, {}) === null);
}

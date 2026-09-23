/**
 * 打卡統計（Keep 規格 K10、§3.6、§3.7、§8）。純函式，沒有 I/O，伺服器與畫面共用。
 *
 * 【日期一律照 `weeks.ts`】
 * 時區 Asia/Shanghai、一週從星期一開始。打卡的 `checkinDate` 本來就是伺服器照上海時間算的日曆日；
 * 「今天」「這一週」若由呼叫端傳一個瞬間（`Date`），這裡先換成上海的日曆日再算。手機與伺服器
 * 各用自己的時區算的話，週一凌晨那幾個小時的打卡會在兩邊落在不同的一週。
 *
 * 【x/4 只算那一週的四支】
 * 換著玩、示範片庫的打卡算進本週次數，不算進「本週練過的計劃活動 x/4」。計不計由活動是否在
 * **那一週**的四支裡決定（CONTEXT.md「打卡」）—— 上一週的計劃活動這一週再練，不是這一週的計劃。
 * 所以這裡要的是「那一週的四支」的編號，由呼叫端從每週活動（`/api/t2/weekly-plan`）拿來。
 *
 * 【完成率是暫採】
 * §8：一個月（4 週）裡，每週「練過的計劃活動數」加總 ÷（每週活動數 × 4）。等客戶確認（§9 第 7 題），
 * **沒有接到配對**：配對現在不看打卡。
 */

import { addCalendarDays, calendarDateOf, isCalendarDate, weekEndOf, weekStartOf } from './weeks';
import type { Checkin } from './practice';

/** 統計只要這兩個欄位；畫面上手裡的可能是 API 回的整筆，也可能是剛打完卡自己拼的。 */
export type PracticeCheckin = Pick<Checkin, 'activityId' | 'checkinDate'>;

/** 一天：`YYYY-MM-DD`（當成上海的日曆日），或一個瞬間（先換成上海的日曆日）。 */
export type Day = Date | string;

/** 換成上海的日曆日。認不得的字串丟錯（理由同 `weeks.ts` 的 `weekStartOf`）。 */
function dayOf(day: Day): string {
  const date = typeof day === 'string' ? day : calendarDateOf(day);
  if (!isCalendarDate(date)) {
    throw new Error(`practiceStats：要是 YYYY-MM-DD 的日期，拿到 ${JSON.stringify(day)}`);
  }
  return date;
}

export interface WeekPractice {
  /** 那一週的星期一、星期日。 */
  weekStart: string;
  weekEnd: string;
  /** 本週打卡次數：每一筆都算，含換著玩與片庫的。 */
  sessions: number;
  /** 本週練過的計劃活動有幾支（x/4 的 x）：那一週的四支裡，這一週打過至少一次卡的。 */
  planPracticed: number;
  /** x/4 的分母：那一週實際排了幾支（有維度「準備中」時少於 4）。 */
  planTotal: number;
  /** 這一週有打卡的日子，由早到晚（打卡成功頁的七天格子）。 */
  practicedDays: string[];
  /** 這一週每支活動打了幾次（「本周已练 N 次」）。沒打過的不在裡面。 */
  timesByActivity: Record<string, number>;
}

/**
 * 某一天所在那一週的打卡摘要。
 * `planActivityIds` 是**那一週**的每週活動（四支）的編號。
 */
export function weekPractice(
  checkins: ReadonlyArray<PracticeCheckin>,
  weekOf: Day,
  planActivityIds: ReadonlyArray<string>,
): WeekPractice {
  const weekStart = weekStartOf(weekOf);
  const weekEnd = weekEndOf(weekStart);
  const plan = new Set(planActivityIds);

  const inWeek = checkins.filter(c => c.checkinDate >= weekStart && c.checkinDate <= weekEnd);
  const timesByActivity: Record<string, number> = {};
  for (const c of inWeek) timesByActivity[c.activityId] = (timesByActivity[c.activityId] ?? 0) + 1;

  return {
    weekStart,
    weekEnd,
    sessions: inWeek.length,
    planPracticed: [...plan].filter(id => timesByActivity[id] !== undefined).length,
    planTotal: plan.size,
    practicedDays: [...new Set(inWeek.map(c => c.checkinDate))].sort(),
    timesByActivity,
  };
}

/**
 * 連續天數（打卡日曆）：從今天往前數，連著有打卡的日子有幾天；一天打幾次都算一天。
 *
 * **今天還沒打卡不算斷**：今天還沒過完，早上打開日曆看到「连续 0 天」會以為昨天白練了。
 * 所以今天沒有就從昨天開始數；昨天也沒有才是 0。這與樣品的算法相同。
 *
 * 只數得到手上這些打卡：呼叫端查了幾天（`GET /api/t2/checkins` 一次最多 62 天），連續天數最多
 * 就是那麼多。
 */
export function streakDays(checkins: ReadonlyArray<PracticeCheckin>, today: Day): number {
  const days = new Set(checkins.map(c => c.checkinDate));
  let day = dayOf(today);
  if (!days.has(day)) day = addCalendarDays(day, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addCalendarDays(day, -1);
  }
  return streak;
}

/** 這一天所在的那個月（上海的日曆月）裡，有打卡的日子有幾天（打卡日曆「本月练了几天」）。 */
export function monthPracticeDays(checkins: ReadonlyArray<PracticeCheckin>, monthOf: Day): number {
  const month = dayOf(monthOf).slice(0, 7);
  return new Set(checkins.map(c => c.checkinDate).filter(d => d.slice(0, 7) === month)).size;
}

/** 一週的計劃：那一週的星期一與那一週的四支。 */
export interface PlanWeek {
  weekStart: string;
  planActivityIds: ReadonlyArray<string>;
}

export interface CompletionRate {
  /** 各週「練過的計劃活動數」加總。 */
  practiced: number;
  /** 各週排了幾支的加總（四週都是四支時就是 16）。 */
  planned: number;
  /** `practiced ÷ planned`，0–1；一支都沒排時是 `null`（沒有東西可以算比例，不是 0%）。 */
  rate: number | null;
}

/**
 * 完成率（§8 暫採，§9 第 7 題等客戶確認）：每週「練過的計劃活動數」加總 ÷（每週活動數 × 4）。
 * 例：四週各練過 4、3、4、2 支 → 13 ÷ 16 = 81%。
 *
 * 「一個月」是哪四週由呼叫端決定（12 週的計劃四週一段，§9 第 2 題），這裡照給的週次算。
 * 某一週配不滿四支時分母用實際支數 —— 分母寫死 4 的話，「準備中」的維度會被算成家長沒練。
 * **沒有接到配對**（檔頭）。
 */
export function completionRate(checkins: ReadonlyArray<PracticeCheckin>, weeks: ReadonlyArray<PlanWeek>): CompletionRate {
  let practiced = 0;
  let planned = 0;
  for (const week of weeks) {
    const summary = weekPractice(checkins, week.weekStart, week.planActivityIds);
    practiced += summary.planPracticed;
    planned += summary.planTotal;
  }
  return { practiced, planned, rate: planned === 0 ? null : practiced / planned };
}

/** 這支活動在手上這些打卡裡一共幾次，不分週（打卡成功頁「第 N 次」）。 */
export function timesForActivity(checkins: ReadonlyArray<PracticeCheckin>, activityId: string): number {
  return checkins.filter(c => c.activityId === activityId).length;
}

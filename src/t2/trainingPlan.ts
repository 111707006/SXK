/**
 * 家庭訓練的「第幾週」（Keep 規格 §4.5）。純函式，沒有 I/O，伺服器與畫面共用。
 *
 * 【計劃是什麼】
 * 計劃＝同一份報告快照（`t2_findings.id`）底下的每週活動。第 1 週＝`t2_weekly_plans` 裡同一個
 * `findings_id` 最早的 `week_start`；第 N 週＝這一週與第 1 週相差幾週＋1。重新生成報告是新的
 * 快照，從第 1 週重算（與 v2.1 §8「第 N 個月」同一個起點）。第 1 週從哪裡來是資料層的事
 *（`firstWeekStartOfFindings`），這裡只做減法。
 *
 * 【超過 12 週】
 * 照樣每週配活動、`weekIndex` 照算（13、14……），計劃頁據此說「已满 12 周，建议再评估一次」。
 * 不夾在 12、不繞回 1：夾住會讓第 13 週看起來像第 12 週的重複，繞回會讓家長以為計劃重來了。
 *
 * 週界（星期一、Asia/Shanghai）照 `weeks.ts`，不另算一次。
 */

import { weekStartOf } from './weeks';

/**
 * 計劃長度（週）。**暫採**（Keep 規格 §9 第 2 題）：樣品是 4 週，客戶 9/21 工作單要「三个月后重评」，
 * SMART 目標本來就是四週與十二週兩段。使用者改了只改這一個數字。
 */
export const PLAN_TOTAL_WEEKS = 12;

export interface PlanPosition {
  /** 第幾週，從 1 起；超過 `totalWeeks` 照算。 */
  weekIndex: number;
  totalWeeks: typeof PLAN_TOTAL_WEEKS;
  /** 第 1 週的星期一，`YYYY-MM-DD`。 */
  firstWeekStart: string;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * `weekStart` 是計劃的第幾週。兩個參數都吃 `YYYY-MM-DD`（週裡的任何一天都算那一週）；
 * 認不得的日期、或 `weekStart` 在第 1 週之前，丟錯 —— 第 1 週是同一份快照最早的那一週，
 * 查的這一週自己也在裡面，不會比它早；真的比它早是呼叫端傳錯了，不編一個 0 或負數給畫面。
 */
export function planPosition(weekStart: string, firstWeekStart: string): PlanPosition {
  const week = weekStartOf(weekStart);
  const first = weekStartOf(firstWeekStart);
  // 兩個都是 UTC 午夜的星期一，相減一定是整週；round 只是擋浮點
  const diff = Math.round((Date.parse(`${week}T00:00:00.000Z`) - Date.parse(`${first}T00:00:00.000Z`)) / MS_PER_WEEK);
  if (diff < 0) {
    throw new Error(`trainingPlan：這一週 ${week} 在計劃第 1 週 ${first} 之前`);
  }
  return { weekIndex: diff + 1, totalWeeks: PLAN_TOTAL_WEEKS, firstWeekStart: first };
}

/**
 * 上一週的活動與打卡（簡報 11/03 第 25 頁「上周 3 个活动」，使用者 2026-11-06：標出沒練過的；
 * 第一週沒有上一週就不顯示；換新的一期時「上一週」＝舊一期的最後一週）。
 *
 * - 活動：`GET /api/t2/weekly-plan?week=<上週一>&peek=1` —— 只讀存過的那一週，沒存過伺服器回 404，不會替那一週補一列。
 *   上一週在不在同一期都一樣讀（換期時就是舊一期的最後一週）。
 * - 打卡：那一週七天的 `GET /api/t2/checkins`（每日計劃頁那一份只涵蓋這一期，換期時不含上一週）。
 * 讀不到（沒有那一週、網路錯）一律當成沒有上一週：整組不畫，不寫錯誤。
 */
import { useEffect, useState } from 'react';
import { authFetch } from '../../utils/api';
import { addCalendarDays } from '../../t2/weeks';
import type { Checkin } from '../../t2/practice';
import type { WeeklyPick, WeeklyPlanResponse } from './trainingData';

export interface LastWeek {
  weekStart: string;
  picks: WeeklyPick[];
  /** 上一週練過的活動編號。 */
  practiced: ReadonlySet<string>;
}

export async function fetchLastWeek(thisWeekStart: string): Promise<LastWeek | null> {
  const weekStart = addCalendarDays(thisWeekStart, -7);
  const weekEnd = addCalendarDays(thisWeekStart, -1);
  const planResp = await authFetch(`/api/t2/weekly-plan?week=${weekStart}&peek=1`);
  if (!planResp.ok) return null;
  const plan = (await planResp.json()) as WeeklyPlanResponse;
  if (!Array.isArray(plan.activities) || plan.activities.length === 0) return null;
  const checkResp = await authFetch(`/api/t2/checkins?from=${weekStart}&to=${weekEnd}`);
  if (!checkResp.ok) return null;
  const body = (await checkResp.json()) as { checkins?: Checkin[] };
  if (!Array.isArray(body.checkins)) return null;
  return { weekStart, picks: plan.activities, practiced: new Set(body.checkins.map(c => c.activityId)) };
}

/** `thisWeekStart` 為 null（這一週還沒讀到）時不讀。 */
export function useLastWeek(thisWeekStart: string | null): LastWeek | null {
  const [last, setLast] = useState<LastWeek | null>(null);
  useEffect(() => {
    if (!thisWeekStart) return;
    let alive = true;
    fetchLastWeek(thisWeekStart)
      .then(v => { if (alive) setLast(v); })
      .catch(() => { if (alive) setLast(null); });
    return () => { alive = false; };
  }, [thisWeekStart]);
  return last;
}

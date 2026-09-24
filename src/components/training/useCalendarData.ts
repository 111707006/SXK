/**
 * 打卡日曆自己要讀的兩樣（Keep 規格 §3.7）：一個月一個月的打卡，與「最近的打卡」裡手上沒有的活動。
 *
 * 【為什麼不用資料層那一份打卡】
 * `useTrainingData` 手上的打卡是計劃頁要的那幾段（12 週的格子＋這一週），不一定含這個月 1 號、
 * 也不含家長往前翻的月份。日曆一次查一個日曆月（`monthFetchRange`，最多 31 天，API 上限 62 天）：
 * 一進來查這個月與上個月（`initialMonths`），翻到哪個月再查那個月，連續天數數到手上最早那一天還
 * 連著就再往前查一個月（`calendarSummary` 的 `earlierMonth`）。查過的月份留著，翻回來不再查。
 *
 * 日曆打開時頁面上面不會再疊一個能打卡的頁（最近的打卡點不進詳情），所以這一份在日曆開著的期間
 * 不會過期；每次打開日曆都是新掛上的，重新查。
 *
 * 【活動是哪一支】
 * 打卡只記活動編號。本週四支與換著玩在每週活動裡就有；其餘的（片庫、上一週的計劃）照
 * `GET /api/t2/activities/:id` 單支讀（`useActivity.ts` 的 `loadActivity`，與詳情共用快取），一支只試一次，
 * 讀不到（停用、404）也不再讀——畫面寫編號。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../../utils/api';
import type { Checkin } from '../../t2/practice';
import type { Activity } from '../../t2/types';
import {
  calendarSummary,
  initialMonths,
  monthFetchRange,
  unknownActivityIds,
  type CalendarSummary,
  type LoadedMonths,
  type Month,
  type MonthLoad,
} from './calendarData';
import type { WeeklyPlanResponse } from './trainingData';
import { loadActivity } from './useActivity';

async function fetchMonth(month: Month, today: string): Promise<Checkin[]> {
  const range = monthFetchRange(month, today);
  if (!range) return [];
  const resp = await authFetch(`/api/t2/checkins?from=${range.from}&to=${range.to}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const body = (await resp.json()) as { checkins?: Checkin[] };
  if (!Array.isArray(body.checkins)) throw new Error('bad checkins body');
  return body.checkins;
}

export interface CalendarData {
  /** 查過的月份。 */
  months: LoadedMonths;
  summary: CalendarSummary;
  /** 單支讀回來的活動（`activityInfo` 的第三個來源）。 */
  fetched: Readonly<Record<string, Activity>>;
}

/**
 * `today` 由呼叫端定一次（日曆打開那一刻，Asia/Shanghai）；`cursor` 是正在看的那個月。
 */
export function useCalendarData(today: string, cursor: Month, plan: WeeklyPlanResponse | null): CalendarData {
  const [months, setMonths] = useState<Record<Month, MonthLoad>>({});
  const [fetched, setFetched] = useState<Record<string, Activity>>({});
  const requested = useRef(new Set<Month>());
  const tried = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(
    (month: Month) => {
      if (requested.current.has(month)) return;
      requested.current.add(month);
      setMonths(prev => ({ ...prev, [month]: 'loading' }));
      fetchMonth(month, today).then(
        list => {
          if (alive.current) setMonths(prev => ({ ...prev, [month]: list }));
        },
        err => {
          if (!alive.current) return;
          console.warn('Failed to load T2 checkins for', month, err);
          setMonths(prev => ({ ...prev, [month]: 'error' }));
        },
      );
    },
    [today],
  );

  const summary = useMemo(() => calendarSummary(months, today), [months, today]);

  useEffect(() => {
    for (const m of initialMonths(today)) request(m);
  }, [request, today]);

  useEffect(() => {
    request(cursor);
  }, [request, cursor]);

  useEffect(() => {
    if (summary.earlierMonth) request(summary.earlierMonth);
  }, [request, summary.earlierMonth]);

  useEffect(() => {
    if (!summary.recent) return;
    for (const id of unknownActivityIds(summary.recent, plan, tried.current)) {
      tried.current.add(id);
      loadActivity(id).then(
        activity => {
          if (alive.current && activity) setFetched(prev => ({ ...prev, [id]: activity }));
        },
        err => console.warn('Failed to load T2 activity', id, err),
      );
    }
  }, [summary.recent, plan]);

  return { months, summary, fetched };
}

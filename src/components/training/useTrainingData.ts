/**
 * 家庭訓練的資料層：這一週的活動（`GET /api/t2/weekly-plan`）與打卡（`GET /api/t2/checkins`）。
 *
 * 【一份，給報告入口與上面每一層】
 * `TrainingSection` 呼叫一次，經 context 交給入口、計劃頁、詳情……。各頁不自己 fetch 同一份：
 * 家長在詳情頁打完卡（票 7），回到計劃頁要看到「已练 1 次」，兩頁讀的必須是同一份。
 *
 * 【重新整理】
 * `reloadCheckins()`：打卡、改心情之後呼叫（票 7）。`refresh()`：兩樣都重讀。
 * 兩者都不清掉畫面上現有的資料（不閃回「正在准备」），讀完才換。
 *
 * 【打卡讀不出來】
 * 每週活動照樣顯示；打卡相關的數字（已练 N 次、x/4、打卡格）整個不出，而不是寫 0 ——
 * 讀不到時寫「已练 0 次」是在對家長說一件不知道真假的事。`checkins === null` 就是這個狀態。
 *
 * 【401／404】
 * 與票 #60 的 `T2WeeklyPlan` 相同：還沒登入、還沒生成報告都當「這裡沒東西好顯示」（`unavailable`），
 * 這一塊本來就在報告頁裡，真的碰到只代表資料還沒同步。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../../utils/api';
import { calendarDateOf } from '../../t2/weeks';
import { weekPractice, type WeekPractice } from '../../t2/practiceStats';
import type { Checkin } from '../../t2/practice';
import { checkinRanges, planPositionOf, type WeeklyPlanResponse } from './trainingData';

export type PlanStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface TrainingData {
  status: PlanStatus;
  plan: WeeklyPlanResponse | null;
  /** 計劃頁要的那幾段打卡（`checkinRanges`）。`null`＝還沒讀到或讀不出來。 */
  checkins: Checkin[] | null;
  /** 今天（Asia/Shanghai 的日曆日），最近一次讀資料時算的。 */
  today: string;
  /** 這一週（每週活動那一週）的打卡摘要；打卡讀不出來是 `null`。 */
  practice: WeekPractice | null;
  refresh(): Promise<void>;
  reloadCheckins(): Promise<void>;
}

async function fetchPlan(): Promise<{ status: 'ready'; plan: WeeklyPlanResponse } | { status: 'unavailable' }> {
  const resp = await authFetch('/api/t2/weekly-plan');
  const ct = resp.headers.get('content-type');
  if (!ct || !ct.includes('application/json')) throw new Error('bad content type');
  if (resp.status === 401 || resp.status === 404) return { status: 'unavailable' };
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return { status: 'ready', plan: (await resp.json()) as WeeklyPlanResponse };
}

/** 計劃頁要的那幾段打卡，照 API 的上限切好再併起來。任何一段失敗整份當讀不出來。 */
async function fetchCheckins(plan: WeeklyPlanResponse, today: string): Promise<Checkin[]> {
  const ranges = checkinRanges(planPositionOf(plan).firstWeekStart, today);
  const parts = await Promise.all(
    ranges.map(async ({ from, to }) => {
      const resp = await authFetch(`/api/t2/checkins?from=${from}&to=${to}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as { checkins?: Checkin[] };
      if (!Array.isArray(body.checkins)) throw new Error('bad checkins body');
      return body.checkins;
    }),
  );
  const byId = new Map<number, Checkin>();
  for (const c of parts.flat()) byId.set(c.id, c);
  return [...byId.values()];
}

export function useTrainingData(): TrainingData {
  const [status, setStatus] = useState<PlanStatus>('loading');
  const [plan, setPlan] = useState<WeeklyPlanResponse | null>(null);
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [today, setToday] = useState(() => calendarDateOf(new Date()));
  // 只收最後一次請求的結果：打卡後連按兩次重整，先發的那一份晚回來不該蓋掉後發的。
  const planSeq = useRef(0);
  const checkinSeq = useRef(0);
  const planRef = useRef<WeeklyPlanResponse | null>(null);

  const loadCheckins = useCallback(async (forPlan: WeeklyPlanResponse) => {
    const seq = ++checkinSeq.current;
    const day = calendarDateOf(new Date());
    try {
      const list = await fetchCheckins(forPlan, day);
      if (seq !== checkinSeq.current) return;
      setToday(day);
      setCheckins(list);
    } catch (err) {
      if (seq !== checkinSeq.current) return;
      console.warn('Failed to load T2 checkins:', err);
      setCheckins(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++planSeq.current;
    try {
      const result = await fetchPlan();
      if (seq !== planSeq.current) return;
      if (result.status === 'unavailable') {
        planRef.current = null;
        setPlan(null);
        setStatus('unavailable');
        return;
      }
      planRef.current = result.plan;
      setPlan(result.plan);
      setStatus('ready');
      await loadCheckins(result.plan);
    } catch (err) {
      if (seq !== planSeq.current) return;
      console.warn('Failed to load T2 weekly plan:', err);
      // 已經有一份在畫面上時留著它（重新整理失敗不把畫面清空）
      if (!planRef.current) setStatus('error');
    }
  }, [loadCheckins]);

  const reloadCheckins = useCallback(async () => {
    if (planRef.current) await loadCheckins(planRef.current);
  }, [loadCheckins]);

  useEffect(() => {
    void refresh();
    return () => {
      // 卸載後回來的結果一律不收
      planSeq.current += 1;
      checkinSeq.current += 1;
    };
  }, [refresh]);

  const practice = useMemo(
    () =>
      plan && checkins
        ? weekPractice(checkins, plan.weekStart, plan.activities.map(p => p.activity.id))
        : null,
    [plan, checkins],
  );

  return { status, plan, checkins, today, practice, refresh, reloadCheckins };
}

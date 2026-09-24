/**
 * 詳情、播放器、打卡成功與抽屜要的「這一支活動」（票 7）。
 *
 * 【先找每週活動那一份，找不到才讀單支】
 * 本週四支與換著玩的內容，`GET /api/t2/weekly-plan` 已經帶著（每次從活動庫查，是新的）；片庫裡的一支
 * 不在那一份裡，讀 `GET /api/t2/activities/:id`（B5）。每週活動還在讀的時候先等它，不搶著讀單支。
 *
 * 【單支讀過就留著】
 * 詳情 → 動作列表 → GO → 打卡成功，四層要的是同一支；每層各讀一次，弱網下家長每推一層都要等。
 * 活動是森心康的內容（不是家長資料），模組層的快取留到整頁重新整理為止；讀失敗的不留，下次再讀。
 */
import { useEffect, useState } from 'react';
import type { Activity } from '../../t2/types';
import type { LibraryEntry } from '../../t2/libraryRoutes';
import { useTraining } from './TrainingContext';
import { fetchActivity, fetchLibrary } from './trainingApi';
import { findInPlan, type PlanPlace } from './trainingData';

export type ActivityLoad =
  | { status: 'loading' }
  | { status: 'ready'; activity: Activity; place: PlanPlace }
  | { status: 'missing' }
  | { status: 'error' };

const activityCache = new Map<string, Activity>();
const activityLoads = new Map<string, Promise<Activity | null>>();

/**
 * 讀一支活動，走上面那份快取（停用或不存在是 `null`）。打卡日曆「最近的打卡」要名字與封面時也用它
 *（票 8）：家長接著點進那一支的詳情，就不必再讀一次。
 */
export function loadActivity(id: string): Promise<Activity | null> {
  const cached = activityCache.get(id);
  if (cached) return Promise.resolve(cached);
  let load = activityLoads.get(id);
  if (!load) {
    load = fetchActivity(id)
      .then(activity => {
        if (activity) activityCache.set(id, activity);
        return activity;
      })
      .finally(() => activityLoads.delete(id));
    activityLoads.set(id, load);
  }
  return load;
}

export function useActivity(id: string): ActivityLoad {
  const { data } = useTraining();
  const place = findInPlan(data.plan, id);
  const inPlan = place.activity;
  const waitForPlan = !inPlan && data.status === 'loading';
  const [single, setSingle] = useState<ActivityLoad>(() => {
    const cached = activityCache.get(id);
    return cached ? { status: 'ready', activity: cached, place } : { status: 'loading' };
  });

  useEffect(() => {
    if (inPlan || waitForPlan) return;
    let live = true;
    loadActivity(id).then(
      activity => live && setSingle(activity ? { status: 'ready', activity, place: findInPlan(null, id) } : { status: 'missing' }),
      err => {
        console.warn('Failed to load T2 activity:', err);
        if (live) setSingle({ status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [id, inPlan, waitForPlan]);

  if (inPlan) return { status: 'ready', activity: inPlan, place };
  if (waitForPlan) return { status: 'loading' };
  return single.status === 'ready' ? { ...single, place } : single;
}

let libraryLoad: Promise<LibraryEntry[]> | null = null;
/** 讀到過的那一份：再打開片庫時直接畫，不先閃一下「正在读取」。 */
let libraryEntries: LibraryEntry[] | null = null;

export type LibraryLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: LibraryEntry[] };

/**
 * 示範片庫那一份，連同讀到哪裡了（票 8 的片庫頁要分「還在讀」「讀不出來」「讀到了但是空的」）。
 * 與 `useLibraryList` 共用同一次讀取；讀失敗的不留，下次再讀。`enabled` 為假時不讀、停在 `loading`。
 */
export function useLibraryLoad(enabled: boolean): LibraryLoad {
  const [load, setLoad] = useState<LibraryLoad>(() =>
    libraryEntries ? { status: 'ready', entries: libraryEntries } : { status: 'loading' },
  );
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    if (!libraryLoad) {
      libraryLoad = fetchLibrary().then(
        entries => {
          libraryEntries = entries;
          return entries;
        },
        err => {
          libraryLoad = null;
          throw err;
        },
      );
    }
    libraryLoad.then(
      entries => live && setLoad({ status: 'ready', entries }),
      err => {
        console.warn('Failed to load T2 library:', err);
        if (live) setLoad({ status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return load;
}

/** 示範片庫那一份（詳情從片庫點進來時的系列列）。`enabled` 為假時不讀；還在讀、讀不到都是 `null`。 */
export function useLibraryList(enabled: boolean): LibraryEntry[] | null {
  const load = useLibraryLoad(enabled);
  return enabled && load.status === 'ready' ? load.entries : null;
}

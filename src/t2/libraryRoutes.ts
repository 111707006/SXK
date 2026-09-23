/**
 * 示範片庫與單支活動（Keep 規格 K09、§5.3）。
 *
 * - `GET /api/t2/library`：有示範片（`videoUrl` 非空）的**啟用**活動，依編號排，每支只帶片庫畫面要的
 *   七個欄位（`LibraryEntry`）。片子要等票 3 上架；在那之前這裡回空陣列，那是正常的。
 * - `GET /api/t2/activities/:id`：單支活動的完整內容（手冊欄位、腳本 `guide`、步驟、示範片）。
 *   換著玩與片庫的詳情頁用它；**不看有沒有片**（大多數活動沒有）。停用與不存在同一個 404 ——
 *   停用是內容團隊收回去的活動，家長端不透露「有，但收回了」。
 *
 * 【為什麼獨立一檔】
 * `server.ts` 已經三千多行，而同一段時間有好幾張票都在往 `/api/t2` 底下加路由。處理函式放這裡，
 * `server.ts` 只留註冊的那幾行。登入檢查與讀活動庫由 `server.ts` 注入（`T2LibraryDeps`）——
 * 那兩件事的記憶體模式退路都在那裡，這一檔不 import `server.ts`（循環相依），也不直接碰資料層。
 *
 * 【閘門不在這裡】
 * 兩支都掛在 `tier2Only` 上、在 `/api/t2` 的付費閘門**之後**註冊，不在 `T2_OPEN_PATHS` 上：
 * 未付費 403 `LOCKED`；專案 B 整個前綴不存在（404）。這一檔只負責「登入了沒有」——閘門在記憶體
 * 模式與展示開關下會放行，那時仍要是一位登入的家長。
 *
 * 【活動庫讀不出來】
 * 回 500，不是空的片庫、也不是 404：每週活動那一支把讀取失敗當成空庫（「準備中」是規格寫好的出口），
 * 但在這裡，「找不到這支活動」在資料庫掛掉時是一句謊話。所以注入的 `loadLibrary` 要讓錯誤往上丟。
 */

import express from 'express';
import type { Activity } from './types';

/** 片庫的一支（§5.3）。封面、片長沒有就是 `null`，不編一個。 */
export interface LibraryEntry {
  id: string;
  title: string;
  moduleNo: Activity['moduleNo'];
  /** 手冊的適齡原文「6个月–3岁」，畫面照原文顯示。 */
  ageLabel: string;
  /** 由適齡原文解析的區間；畫面的「適合{孩子名}現在／再大一點」篩選用它。 */
  ageMonths: Activity['ageMonths'];
  posterUrl: string | null;
  videoSeconds: number | null;
}

export interface T2LibraryDeps {
  /** 未登入就回 401 並回 `null`（呼叫端直接 return）；登入了回使用者 id。 */
  requireParent: (req: express.Request, res: express.Response) => Promise<unknown | null>;
  /** 整份活動庫（含停用）。讀不出來要丟錯（檔頭「活動庫讀不出來」）。 */
  loadLibrary: () => Promise<Activity[]>;
}

function hasDemoClip(activity: Activity): boolean {
  return typeof activity.videoUrl === 'string' && activity.videoUrl.trim() !== '';
}

function byIdAsc(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 片庫：有示範片的啟用活動，依編號排。 */
export function libraryEntries(library: ReadonlyArray<Activity>): LibraryEntry[] {
  return library
    .filter(a => a.active && hasDemoClip(a))
    .sort(byIdAsc)
    .map(a => ({
      id: a.id,
      title: a.title,
      moduleNo: a.moduleNo,
      ageLabel: a.ageLabel,
      ageMonths: { min: a.ageMonths.min, max: a.ageMonths.max },
      posterUrl: a.posterUrl,
      videoSeconds: a.videoSeconds,
    }));
}

/** 單支：啟用的那一支；停用或不存在回 `null`。編號照字面比，不改大小寫。 */
export function findActiveActivity(library: ReadonlyArray<Activity>, id: string): Activity | null {
  return library.find(a => a.id === id && a.active) ?? null;
}

export function createT2LibraryRouter(deps: T2LibraryDeps): express.Router {
  const router = express.Router();

  router.get('/api/t2/library', async (req, res) => {
    try {
      if (!(await deps.requireParent(req, res))) return;
      res.json({ activities: libraryEntries(await deps.loadLibrary()) });
    } catch (err: any) {
      console.error('[T2] 示範片庫讀取失敗:', err?.message);
      res.status(500).json({ error: '暂时无法读取示范片，请稍后重试。' });
    }
  });

  router.get('/api/t2/activities/:id', async (req, res) => {
    try {
      if (!(await deps.requireParent(req, res))) return;
      const activity = findActiveActivity(await deps.loadLibrary(), req.params.id);
      if (!activity) {
        res.status(404).json({ error: '没有找到这个活动。', code: 'ACTIVITY_NOT_FOUND' });
        return;
      }
      res.json({ activity });
    } catch (err: any) {
      console.error('[T2] 活動讀取失敗:', err?.message);
      res.status(500).json({ error: '暂时无法读取这个活动，请稍后重试。' });
    }
  });

  return router;
}

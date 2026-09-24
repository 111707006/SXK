/**
 * 打卡與提醒的端點（Keep 規格 K06、K07、§5.3）。**伺服器專用**（import express），畫面不要 import 這一檔；
 * 畫面要的形狀與選項在 `practice.ts`，統計在 `practiceStats.ts`。
 *
 *   POST  /api/t2/checkins            { activityId } → 201 { id, checkinDate, timesForActivity, checkin }
 *   PATCH /api/t2/checkins/:id        { mood?, progress? } → 200 { checkin }
 *   GET   /api/t2/checkins?from=&to=  → { from, to, checkins }（頭尾含在內最多 62 天）
 *   GET   /api/t2/practice-prefs      → { reminderDays, reminderTime }（還沒設是 [] 與 null）
 *   PUT   /api/t2/practice-prefs      { reminderDays, reminderTime } → 同上
 *   GET   /api/t2/practice-prefs.ics  → text/calendar；沒設提醒 404（Bearer，或 `?t=` 帶短時效連結）
 *   POST  /api/t2/practice-prefs/ics-link → { url }：上面那一支的短時效連結（票 B7；沒設提醒 404）
 *
 * 【`.ics` 的兩種身分（票 B7）】
 * 手機要「加入日曆」得由瀏覽器自己去開網址（`location.href`），那一次請求帶不了 Bearer。所以已登入的
 * 家長先換一條短時效、不透明的連結（`icsLink.ts`），網址本身就是憑證。`.ics` 這一支的身分由
 * `requireIcsParent` 認：帶了 `?t=` 就**只看連結**（壞的就 401，不退回標頭），沒帶才看 Bearer。
 * 付費閘門在 `server.ts` 用同一個規則認人（`t2IcsRequestUserId`），所以連結上的那位家長沒買一樣 403。
 * 連結只開這一支：別的端點仍只認 Bearer。
 *
 * 【掛在哪裡】
 * `server.ts` 把這個 Router 掛在 `tier2Only` 上、T2 付費閘門之後：專案 B 整組 404（B 沒有 T2），
 * 未付費 403 `LOCKED`，未登入 401。這幾支**不在** `T2_OPEN_PATHS` 上 —— 打卡是買了之後的事。
 * 獨立一檔是為了讓 `server.ts` 只多幾行註冊：同一段時間還有別的票在改 `server.ts` 的 T2 那幾段。
 *
 * 【身分取自 token】
 * body 與 query 裡的 `userId` 一律不讀（`practice.ts` 的讀取函式只拿它認得的欄位）。
 * 打卡的日期也不收前端的：伺服器照 Asia/Shanghai 算（`weeks.ts`），家長手機的時鐘撥錯、或
 * 前端拼錯日期，都不該讓一筆打卡落到別的一天、別的一週。
 *
 * 【只能動自己的】
 * 改一筆之前先照（id, 這位家長）查；查不到回 404，不分「沒有這一筆」與「是別人的」——
 * 403 等於承認那個 id 存在（與後台詳情路由同一個理由，ADR-0006）。資料層的 UPDATE 自己也帶
 * `user_id`（`src/db/t2Checkins.ts` 檔頭）。
 *
 * 【記憶體模式】
 * 沒有資料庫（展示站）時與 `t2_weekly_plans` 同一種退路：存在這個 Router 自己的 Map 裡。
 * 活動庫在記憶體模式是空的（`server.ts` 的 `loadActivityLibrary`），所以每週活動全是「準備中」、
 * 打卡找不到活動回 404 —— 與每週活動是同一個出口，不另外編一份活動庫。提醒不靠活動庫，照常能用。
 */

import express from 'express';
import * as checkinStore from '../db/t2Checkins';
import * as prefsStore from '../db/t2PracticePrefs';
import { buildPracticeIcs } from './ics';
import { ICS_LINK_PARAM } from './icsLink';
import {
  hasReminder,
  progressFitsActivity,
  readCheckinCreate,
  readCheckinPatch,
  readCheckinRange,
  readPracticePrefs,
} from './practice';
import type { Checkin, CheckinPatch, PracticePrefs } from './practice';
import { calendarDateOf, weekStartOf } from './weeks';
import type { Activity } from './types';

/** `server.ts` 交給這個 Router 的東西 —— 都是它已經有的，這裡不另寫一份登入或快照的讀法。 */
export interface PracticeRouteDeps {
  /** 登入檢查（`requireT2Parent`）。回 `null` 代表已經回應（401），呼叫端直接 return。 */
  requireParent(req: express.Request, res: express.Response): Promise<string | null>;
  /** 有資料庫時這位家長在 `users` 表的 id；記憶體模式回 `null`（走這裡的 Map）。 */
  dbUserIdOf(userId: string): number | null;
  /** 這位家長最新的報告快照 id；還沒生成過報告回 `null`。 */
  latestFindingsId(userId: string): Promise<number | null>;
  withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>;
  /**
   * `.ics` 那一支的登入檢查：帶了連結（`?t=`）只看連結，沒帶才看 Bearer（檔頭「兩種身分」）。
   * 回 `null` 代表已經回應（401）。
   */
  requireIcsParent(req: express.Request, res: express.Response): Promise<string | null>;
  /** 替這位家長簽一條 `.ics` 的短時效連結，回的是查詢參數的值（網址安全的字元）。 */
  signIcsLink(userId: string): string;
}

/** 一位家長的打卡與提醒，資料庫或記憶體兩種實作，端點不必分。 */
interface PracticeStore {
  findActivity(activityId: string): Promise<Activity | null>;
  insertCheckin(input: checkinStore.CheckinInsert): Promise<Checkin>;
  countForActivity(activityId: string): Promise<number>;
  findCheckin(id: number): Promise<Checkin | null>;
  updateCheckin(id: number, patch: CheckinPatch): Promise<void>;
  listCheckins(from: string, to: string): Promise<Checkin[]>;
  findPrefs(): Promise<PracticePrefs | null>;
  savePrefs(prefs: PracticePrefs): Promise<void>;
}

const DB_TIMEOUT_MS = 2000;

/** `.ics` 的檔名。 */
const ICS_FILENAME = 'family-activity-reminder.ics';

export function createPracticeRouter(deps: PracticeRouteDeps): express.Router {
  const router = express.Router();

  // 記憶體模式（檔頭）。鍵是 `UserId`（token 裡的字串）。
  const offlineCheckins = new Map<string, Checkin[]>();
  const offlinePrefs = new Map<string, PracticePrefs>();
  let offlineSeq = 0;

  function storeFor(userId: string): PracticeStore {
    const dbId = deps.dbUserIdOf(userId);
    if (dbId !== null) {
      const t = <T>(p: Promise<T>) => deps.withTimeout(p, DB_TIMEOUT_MS);
      return {
        findActivity: id => t(checkinStore.findCheckinActivity(id)),
        insertCheckin: async input => {
          const id = await t(checkinStore.insertCheckin(dbId, input));
          return { id, ...input, mood: null, progress: [], createdAt: new Date().toISOString() };
        },
        countForActivity: activityId => t(checkinStore.countCheckinsForActivity(dbId, activityId)),
        findCheckin: id => t(checkinStore.findCheckin(dbId, id)),
        updateCheckin: (id, patch) => t(checkinStore.updateCheckin(dbId, id, patch)),
        listCheckins: (from, to) => t(checkinStore.listCheckins(dbId, from, to)),
        findPrefs: () => t(prefsStore.findPracticePrefs(dbId)),
        savePrefs: prefs => t(prefsStore.savePracticePrefs(dbId, prefs)),
      };
    }
    const mine = () => offlineCheckins.get(userId) ?? [];
    return {
      findActivity: async () => null,
      insertCheckin: async input => {
        offlineSeq += 1;
        const record: Checkin = { id: offlineSeq, ...input, mood: null, progress: [], createdAt: new Date().toISOString() };
        offlineCheckins.set(userId, [...mine(), record]);
        return record;
      },
      countForActivity: async activityId => mine().filter(c => c.activityId === activityId).length,
      findCheckin: async id => mine().find(c => c.id === id) ?? null,
      updateCheckin: async (id, patch) => {
        offlineCheckins.set(userId, mine().map(c => (c.id === id ? { ...c, ...patch } : c)));
      },
      listCheckins: async (from, to) =>
        mine()
          .filter(c => c.checkinDate >= from && c.checkinDate <= to)
          .sort((a, b) => (a.checkinDate === b.checkinDate ? a.id - b.id : a.checkinDate < b.checkinDate ? -1 : 1)),
      findPrefs: async () => offlinePrefs.get(userId) ?? null,
      savePrefs: async prefs => {
        offlinePrefs.set(userId, prefs);
      },
    };
  }

  router.post('/api/t2/checkins', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;

      const parsed = readCheckinCreate(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, code: parsed.code });
        return;
      }
      const { activityId } = parsed.value;
      const store = storeFor(userId);

      // 停用的活動與不存在的同一個回應：家長端看不到停用的活動，打得到卡代表畫面還開著舊的一份。
      const activity = await store.findActivity(activityId);
      if (!activity || !activity.active) {
        res.status(404).json({ error: '找不到这个活动，可能已经下架了。', code: 'ACTIVITY_NOT_FOUND' });
        return;
      }

      const checkinDate = calendarDateOf(new Date());
      const record = await store.insertCheckin({
        activityId,
        findingsId: await deps.latestFindingsId(userId),
        checkinDate,
        weekStart: weekStartOf(checkinDate),
      });
      const timesForActivity = await store.countForActivity(activityId);
      res.status(201).json({ id: record.id, checkinDate, timesForActivity, checkin: record });
    } catch (err: any) {
      console.error('[T2] checkin failed:', err.message);
      res.status(500).json({ error: '暂时无法打卡，请稍后重试。' });
    }
  });

  router.patch('/api/t2/checkins/:id', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;

      const id = /^[1-9]\d{0,15}$/.test(req.params.id) ? Number(req.params.id) : null;
      if (id === null) {
        res.status(404).json({ error: '找不到这一次打卡。', code: 'CHECKIN_NOT_FOUND' });
        return;
      }
      const parsed = readCheckinPatch(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, code: parsed.code });
        return;
      }

      const store = storeFor(userId);
      const existing = await store.findCheckin(id);
      if (!existing) {
        res.status(404).json({ error: '找不到这一次打卡。', code: 'CHECKIN_NOT_FOUND' });
        return;
      }

      // 勾的是那支活動腳本「怎么看出有进步」的第幾條，要有那一支才驗得了。活動後來停用了也照驗
      // （打卡是停用前打的）；整支不見了就當沒有腳本，只收空陣列。
      if (parsed.value.progress !== undefined) {
        const activity = await store.findActivity(existing.activityId);
        if (!progressFitsActivity(parsed.value.progress, activity)) {
          res.status(400).json({ error: '勾选的进步项目不在这个活动里。', code: 'PROGRESS_OUT_OF_RANGE' });
          return;
        }
      }

      await store.updateCheckin(id, parsed.value);
      const updated = (await store.findCheckin(id)) ?? { ...existing, ...parsed.value };
      res.json({ checkin: updated });
    } catch (err: any) {
      console.error('[T2] update checkin failed:', err.message);
      res.status(500).json({ error: '暂时无法保存，请稍后重试。' });
    }
  });

  router.get('/api/t2/checkins', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;

      const range = readCheckinRange(req.query);
      if (!range.ok) {
        res.status(400).json({ error: range.error, code: range.code });
        return;
      }
      const { from, to } = range.value;
      res.json({ from, to, checkins: await storeFor(userId).listCheckins(from, to) });
    } catch (err: any) {
      console.error('[T2] list checkins failed:', err.message);
      res.status(500).json({ error: '暂时无法读取打卡记录，请稍后重试。' });
    }
  });

  router.get('/api/t2/practice-prefs', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;
      const prefs = await storeFor(userId).findPrefs();
      res.json(prefs ?? { reminderDays: [], reminderTime: null });
    } catch (err: any) {
      console.error('[T2] read practice prefs failed:', err.message);
      res.status(500).json({ error: '暂时无法读取提醒设定，请稍后重试。' });
    }
  });

  router.put('/api/t2/practice-prefs', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;

      const parsed = readPracticePrefs(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, code: parsed.code });
        return;
      }
      await storeFor(userId).savePrefs(parsed.value);
      res.json(parsed.value);
    } catch (err: any) {
      console.error('[T2] save practice prefs failed:', err.message);
      res.status(500).json({ error: '暂时无法保存提醒设定，请稍后重试。' });
    }
  });

  router.post('/api/t2/practice-prefs/ics-link', async (req, res) => {
    try {
      const userId = await deps.requireParent(req, res);
      if (!userId) return;

      // 沒設提醒就不發連結：發了也是一條開了就 404 的網址
      if (!hasReminder(await storeFor(userId).findPrefs())) {
        res.status(404).json({ error: '还没有设提醒，先选好每周哪几天、几点。', code: 'REMINDER_NOT_SET' });
        return;
      }
      // 連結本身就是憑證：不留在任何中間層
      res.set('Cache-Control', 'no-store');
      res.json({ url: `/api/t2/practice-prefs.ics?${ICS_LINK_PARAM}=${deps.signIcsLink(userId)}` });
    } catch (err: any) {
      console.error('[T2] practice ics link failed:', err.message);
      res.status(500).json({ error: '暂时无法产生日历档，请稍后重试。' });
    }
  });

  router.get('/api/t2/practice-prefs.ics', async (req, res) => {
    try {
      const userId = await deps.requireIcsParent(req, res);
      if (!userId) return;

      const prefs = await storeFor(userId).findPrefs();
      if (!hasReminder(prefs)) {
        res.status(404).json({ error: '还没有设提醒，先选好每周哪几天、几点。', code: 'REMINDER_NOT_SET' });
        return;
      }
      // UID 每位家長固定：重新下載（改了提醒）時日曆認得是同一個事件。
      const ics = buildPracticeIcs({ prefs, uid: `t2-practice-${userId}@senxinkang`, now: new Date() });
      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ICS_FILENAME}"`,
        // 這是這位家長自己的資料，不該留在任何中間層。
        'Cache-Control': 'no-store',
      });
      res.send(ics);
    } catch (err: any) {
      console.error('[T2] practice ics failed:', err.message);
      res.status(500).json({ error: '暂时无法产生日历档，请稍后重试。' });
    }
  });

  return router;
}

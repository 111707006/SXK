/**
 * 家庭訓練畫面打的幾支 API（Keep 規格 §5.3，票 7）。全部走 `authFetch`（帶通行證、401 統一處理）。
 *
 * 每週活動與打卡清單的讀取在 `useTrainingData.ts`（一份給入口與上面每一層）；這一檔是**單次的動作**：
 * 讀一支活動、讀片庫、打卡、改心情與進步、讀寫提醒、換 `.ics` 的短時效連結。失敗一律丟
 * `TrainingApiError`，呼叫端決定畫面上怎麼說；伺服器的錯誤句子不直接顯示（那是給開發看的）。
 */
import { authFetch } from '../../utils/api';
import type { Activity } from '../../t2/types';
import type { Checkin, CheckinPatch, PracticePrefs } from '../../t2/practice';
import type { LibraryEntry } from '../../t2/libraryRoutes';

export class TrainingApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`HTTP ${status}${code ? ` ${code}` : ''}`);
  }
}

async function readJson<T>(resp: Response): Promise<T> {
  const ct = resp.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await resp.json().catch(() => null) : null;
  if (!resp.ok) throw new TrainingApiError(resp.status, typeof body?.code === 'string' ? body.code : null);
  if (body === null) throw new TrainingApiError(resp.status, 'BAD_BODY');
  return body as T;
}

function send(method: 'POST' | 'PATCH' | 'PUT', url: string, body?: unknown): Promise<Response> {
  return authFetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** 單支活動（換著玩、片庫的詳情）。停用或不存在回 `null`（伺服器兩者同一個 404）。 */
export async function fetchActivity(id: string): Promise<Activity | null> {
  const resp = await authFetch(`/api/t2/activities/${encodeURIComponent(id)}`);
  if (resp.status === 404) return null;
  return (await readJson<{ activity: Activity }>(resp)).activity;
}

/** 示範片庫（有示範片的啟用活動，依編號）。 */
export async function fetchLibrary(): Promise<LibraryEntry[]> {
  const body = await readJson<{ activities?: LibraryEntry[] }>(await authFetch('/api/t2/library'));
  if (!Array.isArray(body.activities)) throw new TrainingApiError(200, 'BAD_BODY');
  return body.activities;
}

/** `POST /api/t2/checkins` 回的：那一筆、伺服器算的日期、這一支一共第幾次（不分週）。 */
export interface CheckinCreated {
  id: number;
  checkinDate: string;
  timesForActivity: number;
  checkin: Checkin;
}

/** 做完了，打卡。日期由伺服器算，這裡只送是哪一支。 */
export async function postCheckin(activityId: string): Promise<CheckinCreated> {
  return readJson<CheckinCreated>(await send('POST', '/api/t2/checkins', { activityId }));
}

/** 改心情、勾進步（帶了才改）。回改好的那一筆。 */
export async function patchCheckin(id: number, patch: CheckinPatch): Promise<Checkin> {
  return (await readJson<{ checkin: Checkin }>(await send('PATCH', `/api/t2/checkins/${id}`, patch))).checkin;
}

/** 提醒的星期與時間；還沒設是 `{ reminderDays: [], reminderTime: null }`。 */
export async function fetchPrefs(): Promise<PracticePrefs> {
  return readJson<PracticePrefs>(await authFetch('/api/t2/practice-prefs'));
}

export async function savePrefs(prefs: PracticePrefs): Promise<PracticePrefs> {
  return readJson<PracticePrefs>(await send('PUT', '/api/t2/practice-prefs', prefs));
}

/**
 * `.ics` 的短時效連結（10 分鐘，`src/t2/icsLink.ts`）。呼叫端拿到就用 `location.href` 開：手機「加入日曆」
 * 是瀏覽器自己去開網址，那一次請求帶不了通行證，所以網址本身就是憑證。
 */
export async function fetchIcsLink(): Promise<string> {
  const body = await readJson<{ url?: string }>(await send('POST', '/api/t2/practice-prefs/ics-link'));
  // 只收站內的路徑：這串網址接下來要交給 location.href
  if (typeof body.url !== 'string' || !body.url.startsWith('/api/t2/practice-prefs.ics?')) {
    throw new TrainingApiError(200, 'BAD_BODY');
  }
  return body.url;
}

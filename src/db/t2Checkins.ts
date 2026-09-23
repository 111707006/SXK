/**
 * `t2_checkins` 的資料層（Keep 規格 K06、§4.4）。
 *
 * 【這張表的規矩】
 * **做完一次記一筆**：同一支活動一天可以打好幾次卡，所以 INSERT 沒有「有就回舊的」那一關。
 * 事後能改的只有心情與進步（`updateCheckin`），活動、日期、快照寫下後不改。
 *
 * 【只能動自己的，在 SQL 上】
 * 讀一筆、改一筆都是 `WHERE id = ? AND user_id = ?`。端點也會先查一次（要拿那一筆的活動去驗
 * `progress`），但「別人的那一筆改不到」不該只靠端點記得先查：少了 `user_id` 的那一句 UPDATE，
 * 一個帶著自己 token 的家長換個 id 就能改別人的打卡。
 *
 * 【為什麼獨立一檔】
 * 與 `t2WeeklyPlans.ts` 同一個理由：每一支替換掉資料層的 HTTP 測試都得把被替身的模組的匯出補齊。
 * 提醒（`t2_practice_prefs`）另外一檔（`t2PracticePrefs.ts`），同一個理由。
 *
 * 【打卡要查的那一支活動】
 * `findCheckinActivity` 查單一支（含停用的）：新增要驗「存在且啟用」，改進步要那一支腳本的
 * 「怎么看出有进步」有幾條。放在這一檔而不是 `t2Activities.ts`：那一檔的 `listActivityLibrary`
 * 回整份 300 支，打一次卡不必讀整份；而家長端「讀單一支活動」的端點（Keep 票 5）另外在做。
 */

import { getPool } from './mysql';
import { activityFromRow } from './activities';
import { CHECKIN_MOODS } from '../t2/practice';
import type { Checkin, CheckinMood, CheckinPatch } from '../t2/practice';
import type { Activity } from '../t2/types';

export interface CheckinInsert {
  activityId: string;
  /** 打卡當下最新的報告快照；還沒生成過報告是 `null`。 */
  findingsId: number | null;
  /** 伺服器照 Asia/Shanghai 算的日曆日（`weeks.ts`）。 */
  checkinDate: string;
  weekStart: string;
}

const COLUMNS = 'id, activity_id, findings_id, checkin_date, week_start, mood, progress, created_at';

function pool() {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  return p;
}

export async function insertCheckin(userId: number, input: CheckinInsert): Promise<number> {
  const [res] = await pool().execute(
    `INSERT INTO t2_checkins (user_id, activity_id, findings_id, checkin_date, week_start, progress)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, input.activityId, input.findingsId, input.checkinDate, input.weekStart, '[]'],
  );
  return Number((res as { insertId: number }).insertId);
}

/** 這位家長這一支活動一共打過幾次卡（打卡成功頁「第 N 次」），不分週。 */
export async function countCheckinsForActivity(userId: number, activityId: string): Promise<number> {
  const [rows] = await pool().execute(
    'SELECT COUNT(*) AS n FROM t2_checkins WHERE user_id = ? AND activity_id = ?',
    [userId, activityId],
  );
  return Number((rows as any[])[0]?.n ?? 0);
}

/** 這位家長的這一筆；不是他的或不存在都回 `null`（端點回 404，不分兩種）。 */
export async function findCheckin(userId: number, id: number): Promise<Checkin | null> {
  const [rows] = await pool().execute(
    `SELECT ${COLUMNS} FROM t2_checkins WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId],
  );
  const row = (rows as any[])[0];
  return row ? checkinFromRow(row) : null;
}

/** 改心情、進步：帶了才改。`WHERE id = ? AND user_id = ?`（檔頭）。 */
export async function updateCheckin(userId: number, id: number, patch: CheckinPatch): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.mood !== undefined) {
    sets.push('mood = ?');
    params.push(patch.mood);
  }
  if (patch.progress !== undefined) {
    sets.push('progress = ?');
    params.push(JSON.stringify(patch.progress));
  }
  if (sets.length === 0) return;
  await pool().execute(`UPDATE t2_checkins SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...params, id, userId]);
}

/** 這位家長一段日期（頭尾都含）的打卡，由早到晚。區間長度由端點擋（最多 62 天）。 */
export async function listCheckins(userId: number, from: string, to: string): Promise<Checkin[]> {
  const [rows] = await pool().execute(
    `SELECT ${COLUMNS} FROM t2_checkins
      WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ?
      ORDER BY checkin_date ASC, id ASC`,
    [userId, from, to],
  );
  return (rows as any[]).map(checkinFromRow);
}

/** 照編號查一支活動，含停用的（檔頭）。沒有回 `null`。 */
export async function findCheckinActivity(activityId: string): Promise<Activity | null> {
  const [rows] = await pool().execute('SELECT * FROM activities WHERE id = ? LIMIT 1', [activityId]);
  const row = (rows as any[])[0];
  return row ? activityFromRow(row) : null;
}

const MOOD_SET: ReadonlySet<string> = new Set<string>(CHECKIN_MOODS);

export function checkinFromRow(row: any): Checkin {
  return {
    id: Number(row.id),
    activityId: String(row.activity_id),
    findingsId: row.findings_id === null || row.findings_id === undefined ? null : Number(row.findings_id),
    checkinDate: dateOnly(row.checkin_date),
    weekStart: dateOnly(row.week_start),
    mood: typeof row.mood === 'string' && MOOD_SET.has(row.mood) ? (row.mood as CheckinMood) : null,
    progress: progressFrom(row.progress),
    createdAt: isoOf(row.created_at),
  };
}

/**
 * 勾了第幾條：非負整數的陣列。讀不成（壞 JSON、混了別的東西）整份當成沒勾 ——
 * 一筆壞資料不該讓日曆整頁讀不出來，而「看到 N 项进步」少算比算錯好。
 */
function progressFrom(raw: unknown): number[] {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed) || parsed.some(i => !Number.isInteger(i) || i < 0)) return [];
  return parsed as number[];
}

/**
 * DATE 欄位：mysql2 回本地午夜的 Date 或 `'2026-09-21'`。兩種都讀成 `YYYY-MM-DD`，
 * Date 用本地欄位取回日曆日，不經 UTC（與 `t2WeeklyPlans.ts` 的 `dateOnly` 同一個做法）。
 */
function dateOnly(raw: unknown): string {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw ?? '').slice(0, 10);
}

/** `created_at` 讀不成時間時回 `null`，不編一個日期（同 `t2WeeklyPlans.ts`）。 */
function isoOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

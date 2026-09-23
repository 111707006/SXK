/**
 * `t2_practice_prefs` 的資料層（Keep 規格 K07、§4.4）：提醒的星期幾與時間，一位家長一列。
 *
 * 提醒不是我們發的：這一列畫在打卡日曆上，並產生 `.ics` 給手機日曆去提醒（`src/t2/ics.ts`）。
 * 獨立一檔的理由同 `t2Checkins.ts`。
 *
 * 【壞資料的處置】
 * 星期只留 0–6 的整數；時間不是那四個之一、或星期一天都不剩，整份當成沒設。讀出來的東西會
 * 直接變成家長手機日曆上的一個每週重複事件，寧可「還沒設提醒」，也不排一個沒有人選過的時間。
 */

import { getPool } from './mysql';
import { REMINDER_DAY_COUNT, REMINDER_TIMES } from '../t2/practice';
import type { PracticePrefs, ReminderTime } from '../t2/practice';

function pool() {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  return p;
}

/** 這位家長的提醒；還沒存過回 `null`。 */
export async function findPracticePrefs(userId: number): Promise<PracticePrefs | null> {
  const [rows] = await pool().execute(
    'SELECT reminder_days, reminder_time FROM t2_practice_prefs WHERE user_id = ? LIMIT 1',
    [userId],
  );
  const row = (rows as any[])[0];
  return row ? prefsFromRow(row) : null;
}

/** 存（有就覆蓋）。輸入已由 `readPracticePrefs` 驗過。 */
export async function savePracticePrefs(userId: number, prefs: PracticePrefs): Promise<void> {
  await pool().execute(
    `INSERT INTO t2_practice_prefs (user_id, reminder_days, reminder_time)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE reminder_days = VALUES(reminder_days), reminder_time = VALUES(reminder_time)`,
    [userId, JSON.stringify(prefs.reminderDays), prefs.reminderTime],
  );
}

export function prefsFromRow(row: any): PracticePrefs {
  let days: unknown = row.reminder_days;
  if (typeof days === 'string') {
    try {
      days = JSON.parse(days);
    } catch {
      days = [];
    }
  }
  const reminderDays = Array.isArray(days)
    ? [...new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d < REMINDER_DAY_COUNT))].sort((a, b) => a - b)
    : [];
  const time = row.reminder_time;
  const reminderTime = typeof time === 'string' && (REMINDER_TIMES as ReadonlyArray<string>).includes(time) ? (time as ReminderTime) : null;
  // 兩樣要嘛都有、要嘛都沒有（`PracticePrefs`）：缺一樣就是還沒設，不端出半套。
  if (reminderDays.length === 0 || reminderTime === null) return { reminderDays: [], reminderTime: null };
  return { reminderDays, reminderTime };
}

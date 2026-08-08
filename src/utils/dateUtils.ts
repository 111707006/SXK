/**
 * Date and Age calculation utilities for children developmental assessments
 */

import type { Child } from '../types';

/** 沒有出生日期、或出生日期讀不出來時的退回值。 */
const FALLBACK_AGE_MONTH = 36;

/** 只認開頭的 `YYYY-MM-DD`；後面若接了時間（舊資料）一律忽略。 */
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * 把 `YYYY-MM-DD` 解成**本地時區**那一天的零時。
 *
 * 不能用 `new Date(str)`：規格規定純日期字串解為 UTC 零時，於是在 UTC 以西
 * 讀回來會退成前一天。出生日期是日曆上的日子，不是時間點，必須用本地欄位構造。
 *
 * 讀不出來（含 2 月 30 日這種不存在的日期）回 `null`，不回 Invalid Date ——
 * 讓呼叫端非處理不可，而不是把 NaN 往下傳。
 */
export function parseBirthDate(birthDateStr: string): Date | null {
  if (typeof birthDateStr !== 'string') return null;
  const m = DATE_PREFIX.exec(birthDateStr.trim());
  if (!m) return null;

  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);

  // 溢位檢查：new Date(2022, 1, 30) 會安靜地變成 3 月 2 日
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return d;
}

/**
 * 由出生日期算出**實足月齡** —— 到「今天」為止孩子幾個月大。
 *
 * `now` 預設是執行期的當下，所以同一個孩子明天打開系統會比今天大一天。
 * 要注入固定日期時傳 `Date`（與 `generateOutTradeNo` 一致）。
 */
export function calculateAgeMonth(birthDateStr: string, now: Date = new Date()): number {
  const birth = parseBirthDate(birthDateStr);
  if (!birth) return FALLBACK_AGE_MONTH;

  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  let totalMonths = years * 12 + months;

  // 還沒過這個月的生日就不算滿一個月
  if (now.getDate() < birth.getDate()) {
    totalMonths--;
  }

  return Math.max(0, totalMonths);
}

/**
 * 把孩子檔案上的實足月齡重算成「到今天為止」的值。
 *
 * 存下來的 `ageMonth` 是**寫入當下**算出來的，放著就會過期 —— 而它決定篩查
 * 用哪一段的題目。所以檔案每次從 localStorage 或雲端讀回來都要經過這裡。
 *
 * 只回新物件、絕不就地改寫：篩查紀錄裡的 `child` 帶的是**測評月齡**，是那一次
 * 篩查的事實記錄，**永不重算**。兩者可能是同一份 JSON 解出來的同一個物件。
 *
 * 沒有出生日期、或出生日期讀不出來時**沿用存下來的月齡**。這裡不能走
 * `calculateAgeMonth` 的 36 個月退回值 —— 那會把孩子換到別的年齡段去答題，
 * 而畫面上看不出任何異常。
 */
export function refreshChildAge(child: Child | null, now: Date = new Date()): Child | null {
  if (!child || !child.birthDate || !parseBirthDate(child.birthDate)) return child;
  return { ...child, ageMonth: calculateAgeMonth(child.birthDate, now) };
}

/**
 * Formats a given number of months into "X岁X月" format.
 */
export function formatAge(ageMonth: number): string {
  if (ageMonth < 0) return '0岁';
  
  const years = Math.floor(ageMonth / 12);
  const months = ageMonth % 12;
  
  if (years === 0) {
    return `${months}个月`;
  }
  if (months === 0) {
    return `${years}岁`;
  }
  return `${years}岁${months}个月`;
}

/** 某年某月有幾天。`day = 0` 取的是上個月的最後一天。 */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * 由月齡反推出生日期（`YYYY-MM-DD`），只用在沒存出生日期的舊檔案上。
 *
 * 不能用 `setMonth(月 - n)`：往回落在較短的月份時會溢位 —— 3 月 31 日減一個月
 * 成了「2 月 31 日」，JS 安靜地推成 3 月 3 日，於是反推出來的生日整整晚了三天，
 * 再算回月齡就少一個月。這裡改成把日子夾在該月的最後一天。
 */
export function getBirthDateFromAgeMonth(ageMonth: number, now: Date = new Date()): string {
  const totalMonths = now.getFullYear() * 12 + now.getMonth() - ageMonth;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths - year * 12;
  const day = Math.min(now.getDate(), daysInMonth(year, monthIndex));

  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

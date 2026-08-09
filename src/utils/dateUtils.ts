/**
 * Date and Age calculation utilities for children developmental assessments
 */

import type { Child } from '../types';

/**
 * 出生日期的唯一合法形狀：整串就是 `YYYY-MM-DD`，多一個字都不算。
 *
 * 刻意不收帶時間的值。那種字串是一個**時間點**，取它的日期部分等於取它的
 * UTC 日期，在本地會差一天 —— 正是這個模組存在的理由。系統裡沒有任何地方
 * 寫得出這種值（只有 `<input type="date">` 與 `getBirthDateFromAgeMonth`），
 * 收下它只會讓一個讀不出來的髒值偽裝成一個看起來很正常的日期。
 */
const BIRTH_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  const m = BIRTH_DATE_FORMAT.exec(birthDateStr.trim());
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
 *
 * 算不出來時回 `null`，**不回一個退回值**。舊版讀不出來一律回 36，而 36 落在
 * 表單「12–180 個月」的合法範圍內 —— 一個壞掉的出生日期於是安靜地變成「3 歲」
 * 被存起來，把孩子換到別的年齡段去答題，畫面上毫無異狀。
 */
export function calculateAgeMonth(birthDateStr: string, now: Date = new Date()): number | null {
  const birth = parseBirthDate(birthDateStr);
  if (!birth) return null;

  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  let totalMonths = years * 12 + months;

  // 還沒過這個月的生日就不算滿一個月
  if (now.getDate() < birth.getDate()) {
    totalMonths--;
  }

  // 出生日期在未來 —— 裝置時鐘被重設，或年份打錯。這不是 0 歲，是資料有問題。
  if (totalMonths < 0) return null;

  return totalMonths;
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
 * 沒有出生日期、或出生日期算不出月齡時**沿用存下來的月齡**：那是我們僅有的
 * 資訊，用一個猜的值蓋掉它，只會把孩子換到別的年齡段去答題。
 */
export function refreshChildAge(child: Child | null, now: Date = new Date()): Child | null {
  if (!child || !child.birthDate) return child;
  const ageMonth = calculateAgeMonth(child.birthDate, now);
  return ageMonth === null ? child : { ...child, ageMonth };
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

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 某年某月有幾天。
 *
 * 刻意用算的而不是 `new Date(year, monthIndex + 1, 0)`：那個寫法在年份是 0–99 時
 * 會被 `Date` 建構子映射到 1900 年代，量到的是**另一年**的二月。這個函式的呼叫端
 * 正好都在處理「往回推很多個月之後掉出四位數年份」的邊界。
 */
export function daysInMonth(year: number, monthIndex: number): number {
  return monthIndex === 1 && isLeapYear(year) ? 29 : DAYS_PER_MONTH[monthIndex];
}

/**
 * 從 `from` 往回 n 個月的**同一日**。
 *
 * 不能用 `setMonth(月 - n)`：往回落在較短的月份時會溢位 —— 3 月 31 日減一個月
 * 成了「2 月 31 日」，JS 安靜地推成 3 月 3 日，於是推出來的日子整整晚了三天，
 * 再算回月齡就少一個月。這裡改成把日子夾在該月的最後一天。
 *
 * `months` 收負數（往未來推）。年份掉出四位數時回 `null` —— 那樣的日子
 * `parseBirthDate` 讀不回來，而且 0–99 會被 `Date` 映射到 1900 年代。
 */
export function monthsBefore(from: Date, months: number): Date | null {
  const totalMonths = from.getFullYear() * 12 + from.getMonth() - months;
  const year = Math.floor(totalMonths / 12);
  if (year < 1000 || year > 9999) return null;

  const monthIndex = totalMonths - year * 12;
  return new Date(year, monthIndex, Math.min(from.getDate(), daysInMonth(year, monthIndex)));
}

/** 把一個 `Date` 寫成 `YYYY-MM-DD`，取的是它的**本地**年月日（不是 UTC 的）。 */
export function formatLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 由月齡反推出生日期（`YYYY-MM-DD`），用來給日期欄位一個起始位置。
 *
 * 月齡若不是一個合理的正整數就回**空字串** —— 它可能直接來自 localStorage 或
 * 雲端 JSON，沒有人保證它的形狀。硬算會產出 `2023-1.5-09`、`NaN-NaN-NaN` 這種
 * 自己都讀不回來的字串，一路往下傳只會讓錯誤更難找。
 */
export function getBirthDateFromAgeMonth(ageMonth: number, now: Date = new Date()): string {
  if (!Number.isInteger(ageMonth) || ageMonth < 0) return '';
  const birth = monthsBefore(now, ageMonth);
  return birth ? formatLocalDate(birth) : '';
}

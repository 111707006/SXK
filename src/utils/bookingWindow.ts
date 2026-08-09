import { formatLocalDate } from './dateUtils';

/**
 * 可預約日期的區間。
 *
 * 【為什麼不寫死】報告頁原本是 `min="2026-07-09" max="2026-07-30"`，預設值
 * `2026-07-13`。寫死的日期區間一定會過期，而過期的樣子很安靜：日曆上一個可選的
 * 日期都沒有，預設值卻仍停在 7/13，於是每一筆送出的預約都寫著四週前的時段
 * （`preferredSlot` 是 `${bookingDate} ${slot}` 直接組出來的）。專案 B 沒有付費層，
 * 預約表單就是它唯一的轉換點 —— 它壞掉不會有人回報，只會表現成「都沒有人來預約」。
 *
 * 【為什麼要有上下界】語言專項評估的會診日期原本連 `min`／`max` 都沒有，預設是
 * 空字串。家長選得到昨天，也可以完全不選就送出，那筆預約會寫成「` 09:30 - 10:20`」
 * 送進資料庫，客服拿到一筆沒有日期的預約。
 */

/** 從明天起算。專家要有時間排班，所以不開放今天。 */
const FIRST_DAY_OFFSET = 1;

/** 開放到四週之後。再遠的班表還沒排出來。 */
const LAST_DAY_OFFSET = 30;

/** `today` 之後第 n 天的 `YYYY-MM-DD`。刻意不用 `toISOString()`：那是 UTC，在東八區會差一天。 */
export function bookingDayOffset(days: number, today: Date = new Date()): string {
  return formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
}

export interface BookingWindow {
  /** 最早可預約的日期，直接餵給 `<input type="date">` 的 `min`。 */
  min: string;
  /** 最晚可預約的日期，直接餵給 `max`。 */
  max: string;
}

export function bookingWindow(today: Date = new Date()): BookingWindow {
  return {
    min: bookingDayOffset(FIRST_DAY_OFFSET, today),
    max: bookingDayOffset(LAST_DAY_OFFSET, today),
  };
}

/**
 * 送出前擋掉區間外的日期。合法時回 `null`，否則回一句給家長看的話。
 *
 * `min`／`max` 只擋日曆上的點選 —— 清空欄位、或用鍵盤打進去的值照樣過得了，
 * 所以送出前一定要再擋一次。`YYYY-MM-DD` 的字典序等於日期序，空字串比任何
 * 日期都小，所以「沒選」跟「選了過去」是同一條判斷。
 *
 * 為什麼是一個函式而不是各自寫一次 if：報告頁與語言專項評估是兩張長得不一樣的
 * 表單，而這個檢查的第一版只補了其中一張 —— 另一張照樣送得出沒有日期的預約。
 */
export function bookingDateError(bookingDate: string, window: BookingWindow): string | null {
  if (bookingDate < window.min || bookingDate > window.max) {
    return `请选择 ${window.min} 至 ${window.max} 之间的会诊日期。`;
  }
  return null;
}

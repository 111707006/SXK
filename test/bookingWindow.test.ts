import { describe, it, expect, vi, afterEach } from 'vitest';
import { bookingDayOffset, bookingWindow } from '../src/utils/bookingWindow';

/**
 * 可預約日期的區間。
 *
 * 報告頁與語言專項評估共用這一支。寫死的區間一定會過期，而過期的樣子很安靜：
 * 日曆上一個可選的日期都沒有，預設值卻仍停在四週前，於是每一筆送出的預約都寫著
 * 一個過去的時段。專案 B 沒有付費層，預約表單是它唯一的轉換點。
 */
describe('可預約日期的區間', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('從明天起算，開放到四週之後', () => {
    // 不開放今天：專家要有時間排班。
    const today = new Date(2026, 7, 9);
    expect(bookingWindow(today)).toEqual({ min: '2026-08-10', max: '2026-09-08' });
  });

  it('跨月與跨年都算得對', () => {
    expect(bookingWindow(new Date(2026, 11, 31))).toEqual({ min: '2027-01-01', max: '2027-01-30' });
    expect(bookingWindow(new Date(2028, 1, 28))).toEqual({ min: '2028-02-29', max: '2028-03-29' }); // 閏年
  });

  it('用本地時區的日子，不用 UTC', () => {
    // `toISOString()` 取的是 UTC 的日期，在東八區會把當地凌晨算成前一天，
    // 於是「明天」變成「今天」——一個專家來不及排班的日子。
    const lateNight = new Date(2026, 7, 9, 0, 30);
    expect(bookingDayOffset(0, lateNight)).toBe('2026-08-09');
  });

  it('沒傳今天時用執行期的當下 —— 區間不會過期', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9));
    expect(bookingWindow()).toEqual({ min: '2026-08-10', max: '2026-09-08' });

    vi.setSystemTime(new Date(2026, 8, 9));
    expect(bookingWindow()).toEqual({ min: '2026-09-10', max: '2026-10-09' });
  });

  it('區間的兩端拿去做字串比較是對的 —— 表單就是這樣擋的', () => {
    // `YYYY-MM-DD` 字典序等於日期序，所以送出前的檢查可以直接比字串。
    const { min, max } = bookingWindow(new Date(2026, 7, 9));
    expect('' < min).toBe(true); // 沒選日期
    expect('2026-08-09' < min).toBe(true); // 今天
    expect('2026-09-09' > max).toBe(true); // 超過四週
    expect('2026-08-20' >= min && '2026-08-20' <= max).toBe(true);
  });
});

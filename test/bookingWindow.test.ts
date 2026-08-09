import { describe, it, expect, vi, afterEach } from 'vitest';
import { bookingDateError, bookingDayOffset, bookingWindow } from '../src/utils/bookingWindow';

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

/**
 * 送出前的檢查。
 *
 * `min`／`max` 只擋日曆上的點選 —— 清空欄位、或用鍵盤打進去的值照樣過得了。
 * 少了這一條，一筆日期空白的預約會安靜地送進資料庫，客服拿到它約不到人，
 * 而家長那一頭看到的是「預約成功」。
 *
 * 檢查抽成函式而不是各自寫一次 if：報告頁與語言專項評估是兩張長得不一樣的表單，
 * 而這個 bug 的第一版就是只補了其中一張。
 */
describe('送出前擋掉區間外的預約日期', () => {
  const window = bookingWindow(new Date(2026, 7, 9)); // 2026-08-10 ~ 2026-09-08

  it('沒選日期擋下來', () => {
    expect(bookingDateError('', window)).toContain('2026-08-10');
  });

  it('今天與更早的日子擋下來', () => {
    expect(bookingDateError('2026-08-09', window)).not.toBeNull();
    expect(bookingDateError('2025-01-01', window)).not.toBeNull();
  });

  it('超出四週擋下來', () => {
    expect(bookingDateError('2026-09-09', window)).not.toBeNull();
  });

  it('區間內（含兩端）放行', () => {
    expect(bookingDateError('2026-08-10', window)).toBeNull();
    expect(bookingDateError('2026-08-20', window)).toBeNull();
    expect(bookingDateError('2026-09-08', window)).toBeNull();
  });

  it('訊息把區間寫出來，家長才知道該選哪裡', () => {
    expect(bookingDateError('', window)).toBe('请选择 2026-08-10 至 2026-09-08 之间的会诊日期。');
  });
});

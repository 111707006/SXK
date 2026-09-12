import { describe, it, expect } from 'vitest';
import { calendarDateOf, isCalendarDate, weekEndOf, weekStartOf } from '../src/t2/weeks';

/**
 * 「哪一週」（#60）。
 *
 * 【這裡在防什麼】
 * 1. **一週從星期一開始**：星期日開始是 JavaScript 的預設，不是任何人的生活。
 * 2. **時區寫死 Asia/Shanghai**：同一位家長在伺服器（UTC 的容器）與手機（+08:00）上必須
 *    拿到同一個「這一週」。台北時間週一凌晨 0:30 在 UTC 還是上週日 —— 那個小時算哪一週，
 *    決定了家長是看到新的四支還是舊的四支。
 * 3. **認不得的字串丟錯**：`week=` 是瀏覽器組出來的，安靜地當成「這一週」的話，家長看到的
 *    是一份與他選的日期無關的活動，而畫面上沒有任何地方看得出來。
 */

describe('weekStartOf', () => {
  it('一週從星期一開始：週一到週日七天都回同一個星期一', () => {
    // 2026-09-07 是星期一
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
    for (const d of days) expect(weekStartOf(d), d).toBe('2026-09-07');
  });

  it('下一個星期一是新的一週', () => {
    expect(weekStartOf('2026-09-14')).toBe('2026-09-14');
  });

  it('跨月、跨年照算', () => {
    expect(weekStartOf('2026-03-01')).toBe('2026-02-23');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });

  it('瞬間依 Asia/Shanghai 換算：週一 00:30（+08:00）已經是新的一週', () => {
    // 2026-09-14T00:30+08:00 ＝ 2026-09-13T16:30Z。用 UTC 的日曆日算會落回上一週。
    expect(weekStartOf(new Date('2026-09-13T16:30:00.000Z'))).toBe('2026-09-14');
  });

  it('瞬間依 Asia/Shanghai 換算：週日 23:30（+08:00）還是上一週', () => {
    expect(weekStartOf(new Date('2026-09-13T15:30:00.000Z'))).toBe('2026-09-07');
  });

  it.each(['2026-9-7', '2026/09/07', '20260907', 'Sep 7 2026', '', '2026-02-31', '2026-13-01'])(
    '認不得的日期 %s → 丟錯',
    value => {
      expect(() => weekStartOf(value)).toThrow(/YYYY-MM-DD/);
    },
  );
});

describe('weekEndOf', () => {
  it('同一週的星期日', () => {
    expect(weekEndOf('2026-09-07')).toBe('2026-09-13');
    expect(weekEndOf('2026-09-13')).toBe('2026-09-13');
  });

  it('跨月照算', () => {
    expect(weekEndOf('2026-02-23')).toBe('2026-03-01');
  });
});

describe('calendarDateOf', () => {
  it('UTC 的傍晚在上海已經是隔天', () => {
    expect(calendarDateOf(new Date('2026-09-12T16:00:00.000Z'))).toBe('2026-09-13');
    expect(calendarDateOf(new Date('2026-09-12T15:59:00.000Z'))).toBe('2026-09-12');
  });
});

describe('isCalendarDate', () => {
  it('只認 YYYY-MM-DD，而且要是真的日期', () => {
    expect(isCalendarDate('2026-09-07')).toBe(true);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-09-07T00:00:00Z')).toBe(false);
  });
});

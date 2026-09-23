import { describe, it, expect } from 'vitest';
import { PLAN_TOTAL_WEEKS, planPosition } from '../src/t2/trainingPlan';

/**
 * 「第幾週」（Keep 規格 §4.5）。
 *
 * 【這裡在防什麼】
 * 1. **第 1 週是計劃的第一週，不是第 0 週**：畫面寫「第 N 周 / 共 12 周」。
 * 2. **超過 12 週照樣算**：計劃頁要說「已满 12 周，建议再评估一次」，而不是停在第 12 週、
 *    或繞回第 1 週（那會讓家長以為計劃重來了）。
 * 3. **週界同 `weeks.ts`**（星期一、Asia/Shanghai）：跨月、跨年照算。
 * 4. **查的那週在第 1 週之前是錯誤**：第 1 週是同一份快照最早的那一週，這一週自己也在裡面，
 *    所以不會發生；真的發生就是呼叫端傳錯了，不編一個 0 或負數給畫面。
 */

describe('planPosition', () => {
  it('計劃長度暫採 12 週（§9 第 2 題）', () => {
    expect(PLAN_TOTAL_WEEKS).toBe(12);
  });

  it('同一週 → 第 1 週', () => {
    expect(planPosition('2026-09-07', '2026-09-07')).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
  });

  it('下一週 → 第 2 週；十一週後 → 第 12 週', () => {
    expect(planPosition('2026-09-14', '2026-09-07').weekIndex).toBe(2);
    expect(planPosition('2026-11-23', '2026-09-07').weekIndex).toBe(12);
  });

  it('超過 12 週照算：十二週後是第 13 週，不停在 12、不繞回 1', () => {
    expect(planPosition('2026-11-30', '2026-09-07')).toEqual({ weekIndex: 13, totalWeeks: 12, firstWeekStart: '2026-09-07' });
    expect(planPosition('2027-09-06', '2026-09-07').weekIndex).toBe(53);
  });

  it('跨年照算', () => {
    expect(planPosition('2027-01-04', '2026-12-28').weekIndex).toBe(2);
  });

  it('週裡的任何一天都算那一週（週界同 weeks.ts）', () => {
    expect(planPosition('2026-09-13', '2026-09-09')).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
    expect(planPosition('2026-09-14', '2026-09-13').weekIndex).toBe(2);
  });

  it('查的那週在第 1 週之前 → 丟錯', () => {
    expect(() => planPosition('2026-08-31', '2026-09-07')).toThrow();
  });

  it('認不得的日期 → 丟錯', () => {
    expect(() => planPosition('2026-9-7', '2026-09-07')).toThrow();
    expect(() => planPosition('2026-09-07', 'yesterday')).toThrow();
  });
});

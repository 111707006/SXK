import { describe, it, expect } from 'vitest';
import { completionRate, monthPracticeDays, streakDays, timesForActivity, weekPractice } from '../src/t2/practiceStats';

/**
 * 打卡統計（Keep 規格 K10、§3.6、§3.7、§8）。純函式，伺服器與畫面共用。
 *
 * 【這裡在防什麼】
 * 1. **x/4 只算那一週的四支**：換著玩、示範片庫的打卡算進本週次數，不算進 x/4
 *    （CONTEXT.md「打卡」）。計不計由活動是否在**那一週**的四支裡決定 —— 上週的計劃活動
 *    這週再練，不是這週的計劃。
 * 2. **一週從星期一開始、時區 Asia/Shanghai**（`weeks.ts`）：上海時間週日 23:59 打的卡是上一週，
 *    00:01 是新的一週。用 UTC 算的話，週一早上八點前的打卡會算回上一週。
 * 3. 連續天數：今天還沒打卡不算斷（今天還沒過完），昨天也沒有才算斷。
 * 4. 完成率照 §8 暫採：每週「練過的計劃活動數」加總 ÷ 每週活動數加總。例子取規格原文。
 */

/** 一筆打卡：只要活動編號與上海的日曆日。 */
const c = (activityId: string, checkinDate: string) => ({ activityId, checkinDate });

/** 2026-09-14 是星期一。 */
const PLAN = ['A001', 'A002', 'A003', 'A004'];

describe('weekPractice（本週次數、x/4、七天格子）', () => {
  it('本週次數含換著玩與片庫的；x/4 只數本週四支裡練過的（同一支練兩次算一支）', () => {
    const checkins = [
      c('A001', '2026-09-14'),
      c('A001', '2026-09-15'), // 同一支第二次：次數 +1，x 不變
      c('A003', '2026-09-16'),
      c('A150', '2026-09-16'), // 換著玩／片庫：算次數，不算 x
      c('A002', '2026-09-13'), // 上一週（星期日）：兩樣都不算
      c('A004', '2026-09-21'), // 下一週（星期一）：兩樣都不算
    ];
    const week = weekPractice(checkins, '2026-09-17', PLAN);
    expect(week.weekStart).toBe('2026-09-14');
    expect(week.weekEnd).toBe('2026-09-20');
    expect(week.sessions).toBe(4);
    expect(week.planPracticed).toBe(2);
    expect(week.planTotal).toBe(4);
    expect(week.practicedDays).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
    expect(week.timesByActivity).toEqual({ A001: 2, A003: 1, A150: 1 });
  });

  it('上一週的計劃活動這一週再練：算這一週的次數，不算這一週的 x（計不計看的是這一週的四支）', () => {
    const week = weekPractice([c('A009', '2026-09-15')], '2026-09-15', PLAN);
    expect(week.sessions).toBe(1);
    expect(week.planPracticed).toBe(0);
  });

  it('本週配不滿四支（有維度「準備中」）→ 分母是實際的支數；重複的編號只算一次', () => {
    const week = weekPractice([c('A001', '2026-09-14')], '2026-09-14', ['A001', 'A002', 'A001']);
    expect(week.planTotal).toBe(2);
    expect(week.planPracticed).toBe(1);
  });

  it('一筆都沒有 → 全是 0，七天格子是空的', () => {
    const week = weekPractice([], '2026-09-14', PLAN);
    expect(week).toMatchObject({ sessions: 0, planPracticed: 0, planTotal: 4, practicedDays: [], timesByActivity: {} });
  });

  it('跨月的一週照算：2026-09-28（一）到 10-04（日）', () => {
    const checkins = [c('A001', '2026-09-30'), c('A002', '2026-10-04'), c('A003', '2026-10-05')];
    const week = weekPractice(checkins, '2026-10-01', PLAN);
    expect(week.weekStart).toBe('2026-09-28');
    expect(week.weekEnd).toBe('2026-10-04');
    expect(week.sessions).toBe(2);
    expect(week.planPracticed).toBe(2);
  });

  describe('時區邊界（上海時間）', () => {
    // 上海時間 2026-09-20（日）23:59 ＝ 2026-09-20T15:59Z；2026-09-21（一）00:01 ＝ 2026-09-20T16:01Z。
    const SUNDAY_2359 = new Date('2026-09-20T15:59:00.000Z');
    const MONDAY_0001 = new Date('2026-09-20T16:01:00.000Z');
    const checkins = [c('A001', '2026-09-20'), c('A002', '2026-09-21')];

    it('週日 23:59 看「本週」→ 還是 09-14 那一週，只數到週日那一筆', () => {
      const week = weekPractice(checkins, SUNDAY_2359, PLAN);
      expect(week.weekStart).toBe('2026-09-14');
      expect(week.sessions).toBe(1);
      expect(week.planPracticed).toBe(1);
    });

    it('週一 00:01 看「本週」→ 已經是 09-21 那一週（用 UTC 算會落回上一週）', () => {
      const week = weekPractice(checkins, MONDAY_0001, PLAN);
      expect(week.weekStart).toBe('2026-09-21');
      expect(week.sessions).toBe(1);
      expect(week.timesByActivity).toEqual({ A002: 1 });
    });
  });
});

describe('streakDays（連續天數）', () => {
  it('從今天往前數連著有打卡的天數；一天打幾次都算一天', () => {
    const checkins = [
      c('A001', '2026-09-15'),
      c('A001', '2026-09-16'),
      c('A002', '2026-09-16'),
      c('A003', '2026-09-17'),
    ];
    expect(streakDays(checkins, '2026-09-17')).toBe(3);
  });

  it('今天還沒打卡不算斷（今天還沒過完）：從昨天往前數', () => {
    const checkins = [c('A001', '2026-09-15'), c('A001', '2026-09-16')];
    expect(streakDays(checkins, '2026-09-17')).toBe(2);
  });

  it('昨天也沒有 → 斷了，是 0', () => {
    const checkins = [c('A001', '2026-09-14'), c('A001', '2026-09-15')];
    expect(streakDays(checkins, '2026-09-17')).toBe(0);
  });

  it('中間斷一天：只數斷點之後的那一段', () => {
    const checkins = [c('A001', '2026-09-12'), c('A001', '2026-09-13'), c('A001', '2026-09-15'), c('A001', '2026-09-16')];
    expect(streakDays(checkins, '2026-09-16')).toBe(2);
  });

  it('跨週、跨月連著算（連續天數沒有週界）', () => {
    const checkins = [c('A001', '2026-09-29'), c('A001', '2026-09-30'), c('A001', '2026-10-01'), c('A002', '2026-10-02')];
    expect(streakDays(checkins, '2026-10-02')).toBe(4);
  });

  it('一筆都沒有 → 0', () => {
    expect(streakDays([], '2026-09-17')).toBe(0);
  });

  it('時區邊界：週日 23:59 打的卡，週一 00:01 看還連著；UTC 的「今天」會少算', () => {
    const checkins = [c('A001', '2026-09-19'), c('A001', '2026-09-20')];
    // 上海 09-21 00:01：今天（21 日）還沒打，從昨天（20 日）往前數 → 2
    expect(streakDays(checkins, new Date('2026-09-20T16:01:00.000Z'))).toBe(2);
    // 上海 09-20 23:59：今天（20 日）有打 → 2
    expect(streakDays(checkins, new Date('2026-09-20T15:59:00.000Z'))).toBe(2);
  });
});

describe('monthPracticeDays（本月練了幾天）', () => {
  it('那個月裡有打卡的日子，一天打幾次都算一天；別的月份不算', () => {
    const checkins = [
      c('A001', '2026-08-31'),
      c('A001', '2026-09-01'),
      c('A002', '2026-09-01'),
      c('A003', '2026-09-15'),
      c('A004', '2026-09-30'),
      c('A001', '2026-10-01'),
    ];
    expect(monthPracticeDays(checkins, '2026-09-17')).toBe(3);
    expect(monthPracticeDays(checkins, '2026-10-01')).toBe(1);
    expect(monthPracticeDays(checkins, '2026-08-01')).toBe(1);
  });

  it('時區邊界：9/30 23:59 還是九月、10/1 00:01 已經是十月', () => {
    const checkins = [c('A001', '2026-09-30')];
    expect(monthPracticeDays(checkins, new Date('2026-09-30T15:59:00.000Z'))).toBe(1);
    expect(monthPracticeDays(checkins, new Date('2026-09-30T16:01:00.000Z'))).toBe(0);
  });
});

describe('completionRate（完成率，§8 暫採）', () => {
  /** 四週，每週四支；編號各週不同，才看得出「那一週的四支」。 */
  const WEEKS = [
    { weekStart: '2026-09-07', planActivityIds: ['A001', 'A002', 'A003', 'A004'] },
    { weekStart: '2026-09-14', planActivityIds: ['A011', 'A012', 'A013', 'A014'] },
    { weekStart: '2026-09-21', planActivityIds: ['A021', 'A022', 'A023', 'A024'] },
    { weekStart: '2026-09-28', planActivityIds: ['A031', 'A032', 'A033', 'A034'] },
  ];

  it('規格的例子：四週各練過 4、3、4、2 支 → 13 ÷ 16', () => {
    const checkins = [
      c('A001', '2026-09-07'), c('A002', '2026-09-08'), c('A003', '2026-09-09'), c('A004', '2026-09-13'),
      c('A011', '2026-09-14'), c('A012', '2026-09-14'), c('A013', '2026-09-20'),
      c('A021', '2026-09-21'), c('A022', '2026-09-22'), c('A023', '2026-09-23'), c('A024', '2026-09-27'),
      c('A031', '2026-09-28'), c('A032', '2026-10-04'),
    ];
    expect(completionRate(checkins, WEEKS)).toEqual({ practiced: 13, planned: 16, rate: 13 / 16 });
  });

  it('同一支練很多次只算一支；別週的計劃活動、片庫的活動不算', () => {
    const checkins = [
      c('A001', '2026-09-07'), c('A001', '2026-09-08'), c('A001', '2026-09-09'),
      c('A001', '2026-09-14'), // 第一週的活動在第二週練：第二週的四支裡沒有它
      c('A150', '2026-09-15'), // 片庫
    ];
    expect(completionRate(checkins, WEEKS)).toEqual({ practiced: 1, planned: 16, rate: 1 / 16 });
  });

  it('某一週配不滿四支 → 分母是各週實際支數的加總', () => {
    const weeks = [
      { weekStart: '2026-09-07', planActivityIds: ['A001', 'A002'] },
      { weekStart: '2026-09-14', planActivityIds: ['A011', 'A012', 'A013', 'A014'] },
    ];
    const checkins = [c('A001', '2026-09-07'), c('A011', '2026-09-14')];
    expect(completionRate(checkins, weeks)).toEqual({ practiced: 2, planned: 6, rate: 2 / 6 });
  });

  it('一支計劃活動都沒有 → 比例是 null（不是 0%，也不是除以零）', () => {
    expect(completionRate([c('A001', '2026-09-07')], [])).toEqual({ practiced: 0, planned: 0, rate: null });
  });
});

describe('timesForActivity（打卡成功的「第 N 次」）', () => {
  it('這支活動在手上這些打卡裡一共幾次，不分週', () => {
    const checkins = [c('A001', '2026-09-07'), c('A002', '2026-09-08'), c('A001', '2026-09-20')];
    expect(timesForActivity(checkins, 'A001')).toBe(2);
    expect(timesForActivity(checkins, 'A999')).toBe(0);
  });
});

describe('認不得的「今天」', () => {
  it.each(['2026-9-17', '2026-02-31', ''])('%s → 丟錯，不安靜地算出一個數字', value => {
    expect(() => streakDays([], value)).toThrow(/YYYY-MM-DD/);
    expect(() => monthPracticeDays([], value)).toThrow(/YYYY-MM-DD/);
    expect(() => weekPractice([], value, PLAN)).toThrow(/YYYY-MM-DD/);
  });
});

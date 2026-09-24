import { describe, it, expect } from 'vitest';
import { checkinSummary, nextMood, toggleProgress, type WeeklyPick, type WeeklyPlanResponse } from '../src/components/training/trainingData';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Checkin } from '../src/t2/practice';
import type { Activity, DimensionCode } from '../src/t2/types';

/**
 * 打卡成功頁的數字（Keep 規格 §3.6，票 B7）：本週打卡次數、本週練過的計劃活動 x/4、本週七天的格子。
 *
 * 剛打的那一筆由 POST 回來，那時畫面手上的打卡清單還沒重讀（`reloadCheckins` 是非同步的）。
 * 數字要把它算進去、但重讀回來之後不能算兩次；打卡讀不出來時整組不出（不寫 0，B6 的規矩）。
 * 統計本身照 `practiceStats.ts`（與伺服器同一份）。
 */

function activity(id: string): Activity {
  return {
    id,
    title: `活动 ${id}`,
    moduleNo: 1,
    targetMonth: 18,
    ageMonths: { min: 12, max: 36 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
    ...NO_ACTIVITY_CONTENT,
  };
}

function pick(id: string, dimension: DimensionCode): WeeklyPick {
  return { activity: activity(id), dimension, reason: { band: 'watch', window: { lo: 12, hi: 18 }, matchedTags: [], belowWindow: false } };
}

/** 2026-09-21（一）那一週的四支。 */
const PLAN: WeeklyPlanResponse = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  createdAt: '2026-09-21T02:00:00.000Z',
  findingsId: 7,
  ageMonth: 18,
  ageKey: '12-36',
  reportAgeMonth: 18,
  activities: [pick('A001', 'MOT'), pick('A003', 'MOT'), pick('A141', 'LANG'), pick('A121', 'SOC')],
  preparing: [],
};

let seq = 0;
function checkin(activityId: string, checkinDate: string, id = ++seq): Checkin {
  return { id, activityId, findingsId: 7, checkinDate, weekStart: '2026-09-21', mood: null, progress: [], createdAt: null };
}

describe('本週打卡次數與 x/4', () => {
  it('剛打的那一筆還不在清單裡：算進去（週一 A001、週二 A141，週三又一次 A001 → 3 次、2/4）', () => {
    const earlier = [checkin('A001', '2026-09-21'), checkin('A141', '2026-09-22')];
    const just = checkin('A001', '2026-09-23', 99);
    const s = checkinSummary(earlier, just, PLAN);
    expect(s?.sessions).toBe(3);
    expect(s?.plan).toEqual({ practiced: 2, total: 4 });
  });

  it('重讀之後清單裡已經有它：不算兩次', () => {
    const just = checkin('A001', '2026-09-23', 99);
    const s = checkinSummary([checkin('A001', '2026-09-21'), just], just, PLAN);
    expect(s?.sessions).toBe(2);
    expect(s?.plan).toEqual({ practiced: 1, total: 4 });
  });

  it('上一週的打卡不算；片庫、換著玩的活動算進次數、不算進 x/4', () => {
    const earlier = [checkin('A001', '2026-09-20'), checkin('A002', '2026-09-21')];
    const just = checkin('A019', '2026-09-23', 99);
    const s = checkinSummary(earlier, just, PLAN);
    expect(s?.sessions).toBe(2);
    expect(s?.plan).toEqual({ practiced: 0, total: 4 });
  });

  it('打卡讀不出來（null）→ 整組不出，不寫 0', () => {
    expect(checkinSummary(null, checkin('A001', '2026-09-23', 99), PLAN)).toBeNull();
  });

  it('手上的每週活動不是打卡那一週（畫面開著跨過週一）→ x/4 不出，次數照算', () => {
    const just = checkin('A001', '2026-09-28', 99);
    const s = checkinSummary([], just, PLAN);
    expect(s?.sessions).toBe(1);
    expect(s?.plan).toBeNull();
  });

  it('每週活動還沒讀到 → x/4 不出', () => {
    expect(checkinSummary([], checkin('A001', '2026-09-23', 99), null)?.plan).toBeNull();
  });
});

describe('本週七天的格子', () => {
  it('星期一到星期日；練過的日子、今天（打卡那一天）標出來', () => {
    const s = checkinSummary([checkin('A003', '2026-09-21')], checkin('A001', '2026-09-23', 99), PLAN);
    expect(s?.days).toEqual([
      { date: '2026-09-21', done: true, today: false },
      { date: '2026-09-22', done: false, today: false },
      { date: '2026-09-23', done: true, today: true },
      { date: '2026-09-24', done: false, today: false },
      { date: '2026-09-25', done: false, today: false },
      { date: '2026-09-26', done: false, today: false },
      { date: '2026-09-27', done: false, today: false },
    ]);
  });

  it('週日打卡：格子是那一週（週一起），不是下一週', () => {
    const s = checkinSummary([], checkin('A001', '2026-09-27', 99), PLAN);
    expect(s?.days[0].date).toBe('2026-09-21');
    expect(s?.days[6]).toEqual({ date: '2026-09-27', done: true, today: true });
  });
});

describe('勾進步：可複選，存的是第幾條（由小到大）', () => {
  it('勾、再勾一條、取消一條', () => {
    expect(toggleProgress([], 2)).toEqual([2]);
    expect(toggleProgress([2], 0)).toEqual([0, 2]);
    expect(toggleProgress([0, 2], 2)).toEqual([0]);
  });
});

describe('心情：三選一、選填、可改', () => {
  it('點一個 → 選它；點另一個 → 換成它；再點同一個 → 取消（回到沒選）', () => {
    expect(nextMood(null, 'engaged')).toBe('engaged');
    expect(nextMood('engaged', 'ok')).toBe('ok');
    expect(nextMood('ok', 'ok')).toBeNull();
  });
});

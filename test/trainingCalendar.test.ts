import { describe, it, expect } from 'vitest';
import {
  calendarSummary,
  activityInfo,
  initialMonths,
  unknownActivityIds,
  monthFetchRange,
  monthGrid,
  monthOf,
  reassessDayOf,
  shiftMonth,
  type LoadedMonths,
} from '../src/components/training/calendarData';
import type { Checkin } from '../src/t2/practice';
import type { WeeklyPlanResponse } from '../src/components/training/trainingData';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Activity, DimensionCode } from '../src/t2/types';

function activity(id: string, over: Partial<Activity> = {}): Activity {
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
    ...over,
  };
}

function plan(): WeeklyPlanResponse {
  const pick = (id: string, dimension: DimensionCode) => ({
    activity: activity(id, { posterUrl: `/media/activities/${id}.jpg`, dimensions: ['MOT', 'COG'] }),
    dimension,
    reason: { band: 'watch' as const, window: { lo: 12, hi: 18 }, matchedTags: [], belowWindow: false },
  });
  return {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    createdAt: '2026-09-21T02:00:00.000Z',
    findingsId: 7,
    ageMonth: 18,
    ageKey: '12-36',
    reportAgeMonth: 18,
    activities: [pick('A001', 'MOT'), pick('A141', 'LANG')],
    preparing: [],
    alternates: { MOT: [activity('A002', { dimensions: ['MOT', 'SEN'] })] },
  };
}

let seq = 0;
function checkin(checkinDate: string, over: Partial<Checkin> = {}): Checkin {
  seq += 1;
  return {
    id: seq,
    activityId: 'A001',
    findingsId: 7,
    checkinDate,
    weekStart: checkinDate,
    mood: null,
    progress: [],
    createdAt: null,
    ...over,
  };
}

/**
 * 打卡日曆（Keep 規格 §3.7）的資料整形。純函式，不碰 fetch、不碰 React。
 * 日期照 `weeks.ts`（Asia/Shanghai、一週從星期一開始），不用瀏覽器的本地時區。
 */

describe('月曆格', () => {
  it('星期一開頭：2026 年 9 月 1 日是星期二，前面空一格；30 天', () => {
    const grid = monthGrid('2026-09', { practiced: new Set(), today: '2026-09-24', reminderDays: [], reassessDay: null });
    expect(grid.leadingBlanks).toBe(1);
    expect(grid.days).toHaveLength(30);
    expect(grid.days[0].date).toBe('2026-09-01');
    expect(grid.days[29].date).toBe('2026-09-30');
    expect(grid.days[23].day).toBe(24);
  });

  it('1 號是星期日空六格、是星期一不空；二月照平年算', () => {
    const none = { practiced: new Set<string>(), today: '2026-09-24', reminderDays: [], reassessDay: null };
    const feb = monthGrid('2026-02', none);
    expect(feb.leadingBlanks).toBe(6);
    expect(feb.days).toHaveLength(28);
    expect(monthGrid('2026-06', none).leadingBlanks).toBe(0);
    expect(monthGrid('2028-02', none).days).toHaveLength(29);
  });

  it('練過的日子實心、今天外框、今天以後設了提醒的星期虛線、第 12 週末是再評估', () => {
    const grid = monthGrid('2026-09', {
      practiced: new Set(['2026-09-22', '2026-09-24', '2026-09-28']),
      today: '2026-09-24',
      // 一、三、五
      reminderDays: [0, 2, 4],
      reassessDay: '2026-09-27',
    });
    const at = (date: string) => grid.days.find(d => d.date === date)!;
    expect(at('2026-09-22').done).toBe(true);
    // 今天練過了：實心，同時仍是今天
    expect(at('2026-09-24')).toMatchObject({ done: true, today: true, reminder: false });
    // 今天以前的提醒日（9/21 星期一、9/23 星期三）不畫虛線
    expect(at('2026-09-21').reminder).toBe(false);
    expect(at('2026-09-23').reminder).toBe(false);
    // 今天以後：9/25 星期五、9/30 星期三是提醒日；9/26 星期六不是
    expect(at('2026-09-25').reminder).toBe(true);
    expect(at('2026-09-30').reminder).toBe(true);
    expect(at('2026-09-26').reminder).toBe(false);
    // 練過的提醒日（9/28 星期一，資料上不會出現在未來，但規則要一致）不再畫虛線
    expect(at('2026-09-28')).toMatchObject({ done: true, reminder: false });
    expect(at('2026-09-27').reassess).toBe(true);
    expect(grid.days.filter(d => d.reassess)).toHaveLength(1);
    expect(grid.days.filter(d => d.today)).toHaveLength(1);
  });

  it('今天是提醒日、還沒練：今天外框（虛線不另外畫）', () => {
    const grid = monthGrid('2026-09', { practiced: new Set(), today: '2026-09-25', reminderDays: [4], reassessDay: null });
    expect(grid.days[24]).toMatchObject({ date: '2026-09-25', today: true, reminder: false, done: false });
  });
});

describe('切上／下個月', () => {
  it('跨年', () => {
    expect(monthOf('2026-09-24')).toBe('2026-09');
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-09', -13)).toBe('2025-08');
  });

  it('一個月查一次（最多 31 天，在 API 的 62 天以內）；今天以後的不查', () => {
    expect(monthFetchRange('2026-08', '2026-09-24')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    // 這個月查到今天為止
    expect(monthFetchRange('2026-09', '2026-09-24')).toEqual({ from: '2026-09-01', to: '2026-09-24' });
    // 整個月都在今天以後：沒有打卡可查
    expect(monthFetchRange('2026-10', '2026-09-24')).toBeNull();
  });
});

describe('第 12 週末（再評估，§8）', () => {
  it('第 1 週的星期一往後第 84 天，是第 12 週的星期日', () => {
    expect(reassessDayOf('2026-07-06')).toBe('2026-09-27');
    expect(reassessDayOf('2026-09-21')).toBe('2026-12-13');
  });
});

describe('三個數字與最近的打卡（calendarSummary）', () => {
  it('一進來查這個月與上個月', () => {
    expect(initialMonths('2026-09-24')).toEqual(['2026-09', '2026-08']);
    expect(initialMonths('2026-01-02')).toEqual(['2026-01', '2025-12']);
  });

  it('本月練了幾天（一天打幾次算一天）、連續天數跨月照數', () => {
    const loaded: LoadedMonths = {
      '2026-09': [checkin('2026-09-01'), checkin('2026-09-02'), checkin('2026-09-02')],
      '2026-08': [checkin('2026-08-30'), checkin('2026-08-31')],
    };
    const s = calendarSummary(loaded, '2026-09-03');
    expect(s.monthDays).toBe(2);
    // 今天（9/3）還沒練不算斷：從 9/2 往前數到 8/30
    expect(s.streak).toBe(4);
    expect(s.earlierMonth).toBeNull();
  });

  it('這個月還在讀或讀不出來：數字不出（null），不寫 0', () => {
    expect(calendarSummary({ '2026-09': 'loading', '2026-08': [] }, '2026-09-24')).toMatchObject({ monthDays: null, streak: null, recent: null });
    expect(calendarSummary({ '2026-09': 'error', '2026-08': [] }, '2026-09-24')).toMatchObject({ monthDays: null, streak: null, recent: null });
  });

  it('連續天數一路連到手上最早那一天：要再往前查一個月', () => {
    const aug = Array.from({ length: 31 }, (_, i) => checkin(`2026-08-${String(i + 1).padStart(2, '0')}`));
    const sep = Array.from({ length: 24 }, (_, i) => checkin(`2026-09-${String(i + 1).padStart(2, '0')}`));
    const s = calendarSummary({ '2026-09': sep, '2026-08': aug }, '2026-09-24');
    // 至少 55 天，但七月最後一天練了沒有還不知道：先不出數字，去查七月
    expect(s.streak).toBeNull();
    expect(s.earlierMonth).toBe('2026-07');
    expect(calendarSummary({ '2026-09': sep, '2026-08': aug, '2026-07': 'loading' }, '2026-09-24')).toMatchObject({
      streak: null,
      earlierMonth: null,
    });
    // 七月查回來：7/31 沒練 → 斷在那裡，不必再往前
    const done = calendarSummary({ '2026-09': sep, '2026-08': aug, '2026-07': [checkin('2026-07-30')] }, '2026-09-24');
    expect(done.streak).toBe(55);
    expect(done.earlierMonth).toBeNull();
  });

  it('上個月讀不出來、而今天是 1 號：昨天在上個月，連續天數不能說是 0', () => {
    const s = calendarSummary({ '2026-09': [], '2026-08': 'error' }, '2026-09-01');
    expect(s.streak).toBeNull();
    // 讀不出來的那個月不再自動重查
    expect(s.earlierMonth).toBeNull();
  });

  it('只看接得上今天的那幾個月：中間隔一個沒查的月份，更早的不算', () => {
    const loaded: LoadedMonths = {
      '2026-09': [checkin('2026-09-01')],
      '2026-08': [],
      // 家長往前翻到六月看過；七月沒查
      '2026-06': [checkin('2026-06-30'), checkin('2026-06-29')],
    };
    const s = calendarSummary(loaded, '2026-09-24');
    expect(s.recent!.map(c => c.checkinDate)).toEqual(['2026-09-01']);
  });

  it('最近 8 筆：新的在前，同一天後打的在前', () => {
    const sep = [
      checkin('2026-09-20', { activityId: 'A001' }),
      checkin('2026-09-22', { activityId: 'A003' }),
      checkin('2026-09-22', { activityId: 'A141' }),
      ...Array.from({ length: 8 }, (_, i) => checkin(`2026-09-0${i + 1}`)),
    ];
    const s = calendarSummary({ '2026-09': sep, '2026-08': [checkin('2026-08-31')] }, '2026-09-24');
    expect(s.recent).toHaveLength(8);
    expect(s.recent!.slice(0, 3).map(c => c.activityId)).toEqual(['A141', 'A003', 'A001']);
    expect(s.recent![7].checkinDate).toBe('2026-09-04');
  });
});

describe('最近的打卡那一列的封面、活動名、維度', () => {
  it('本週的四支：維度是配對的那一個（不是活動貼的全部）', () => {
    expect(activityInfo('A001', plan(), {})).toEqual({ title: '活动 A001', posterUrl: '/media/activities/A001.jpg', dimensions: ['MOT'] });
  });

  it('換著玩：維度是它排在哪一列', () => {
    expect(activityInfo('A002', plan(), {})).toMatchObject({ title: '活动 A002', dimensions: ['MOT'] });
  });

  it('別的（片庫、上一週的計劃）：單支讀回來的，維度是活動貼的', () => {
    const fetched = { A300: activity('A300', { title: '一起收玩具', dimensions: ['ADL', 'SOC'] }) };
    expect(activityInfo('A300', plan(), fetched)).toEqual({ title: '一起收玩具', posterUrl: null, dimensions: ['ADL', 'SOC'] });
    expect(activityInfo('A300', null, fetched)).toMatchObject({ title: '一起收玩具' });
  });

  it('哪裡都找不到：null（畫面寫編號，不編一個名字）', () => {
    expect(activityInfo('A299', plan(), {})).toBeNull();
  });

  it('要單支讀的：本週、換著玩、已經讀過（含讀不到）的都不讀，一支只讀一次', () => {
    const recent = [checkin('2026-09-22', { activityId: 'A001' }), checkin('2026-09-21', { activityId: 'A300' }), checkin('2026-09-20', { activityId: 'A002' }), checkin('2026-09-19', { activityId: 'A300' }), checkin('2026-09-18', { activityId: 'A301' })];
    expect(unknownActivityIds(recent, plan(), new Set())).toEqual(['A300', 'A301']);
    expect(unknownActivityIds(recent, plan(), new Set(['A300']))).toEqual(['A301']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  ageFit,
  clipClock,
  detailSeries,
  findInPlan,
  hasClip,
  type WeeklyPick,
  type WeeklyPlanResponse,
} from '../src/components/training/trainingData';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { LibraryEntry } from '../src/t2/libraryRoutes';
import type { Activity, DimensionCode } from '../src/t2/types';

/**
 * 活動詳情（Keep 規格 §3.3，票 B7）要的資料整形：這一支在這週的計劃裡是什麼身分、系列列列哪一組、
 * 年齡提醒要不要出、示範片的長度怎麼寫。畫面沒有 jsdom 看不到，能算的都在這裡。
 */

function activity(id: string, over: Partial<Activity> = {}): Activity {
  return {
    id,
    title: `活动 ${id}`,
    moduleNo: 1,
    targetMonth: 18,
    ageMonths: { min: 12, max: 36 },
    dimensions: ['MOT'],
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

function pick(id: string, dimension: DimensionCode, over: Partial<Activity> = {}): WeeklyPick {
  return {
    activity: activity(id, over),
    dimension,
    reason: { band: 'watch', window: { lo: 12, hi: 18 }, matchedTags: [], belowWindow: false },
  };
}

const PLAN: WeeklyPlanResponse = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  createdAt: '2026-09-21T02:00:00.000Z',
  findingsId: 7,
  ageMonth: 18,
  ageKey: '12-36',
  reportAgeMonth: 18,
  activities: [pick('A001', 'MOT', { videoUrl: '/media/activities/A001.mp4' }), pick('A003', 'MOT'), pick('A141', 'LANG')],
  preparing: ['SOC'],
  alternates: {
    MOT: [activity('A002'), activity('A004', { videoUrl: 'https://cdn.example/A004.mp4' })],
    LANG: [activity('A142')],
  },
};

describe('這一支在這週的計劃裡是什麼身分（findInPlan）', () => {
  it('本週四支之一：帶著配對的那一筆（理由、維度）', () => {
    const place = findInPlan(PLAN, 'A003');
    expect(place.pick?.activity.id).toBe('A003');
    expect(place.pick?.dimension).toBe('MOT');
    expect(place.swapDimension).toBeNull();
    expect(place.activity?.id).toBe('A003');
  });

  it('換著玩的備選：記下是哪個維度的', () => {
    const place = findInPlan(PLAN, 'A142');
    expect(place.pick).toBeNull();
    expect(place.swapDimension).toBe('LANG');
    expect(place.activity?.id).toBe('A142');
  });

  it('都不在（片庫裡的一支）：三樣都是空的，內容要另外讀', () => {
    expect(findInPlan(PLAN, 'A019')).toEqual({ pick: null, swapDimension: null, activity: null });
  });

  it('每週活動還沒讀到：一樣都是空的', () => {
    expect(findInPlan(null, 'A001')).toEqual({ pick: null, swapDimension: null, activity: null });
  });
});

describe('系列列（detailSeries）', () => {
  it('從計劃點進來：本週那幾支，照順序；這一支是第幾支', () => {
    const s = detailSeries('plan', 'A003', PLAN, null);
    expect(s?.kind).toBe('plan');
    expect(s?.items.map(i => i.id)).toEqual(['A001', 'A003', 'A141']);
    expect(s?.index).toBe(1);
    expect(s?.items.map(i => i.hasClip)).toEqual([true, false, false]);
  });

  it('從換著玩點進來：那個維度的備選是一個系列', () => {
    const s = detailSeries('swap', 'A004', PLAN, null);
    expect(s?.kind).toBe('swap');
    expect(s?.dimension).toBe('MOT');
    expect(s?.items.map(i => i.id)).toEqual(['A002', 'A004']);
    expect(s?.index).toBe(1);
    expect(s?.items[1].hasClip).toBe(true);
  });

  it('從片庫點進來：片庫那一份是一個系列（片庫裡的每一支都有片）', () => {
    const library: LibraryEntry[] = [
      { id: 'A001', title: '我们来爬行', moduleNo: 1, ageLabel: '6个月–3岁', ageMonths: { min: 6, max: 36 }, posterUrl: null, videoSeconds: 10 },
      { id: 'A019', title: '单脚站', moduleNo: 1, ageLabel: '3–6岁', ageMonths: { min: 36, max: 72 }, posterUrl: null, videoSeconds: 9 },
    ];
    const s = detailSeries('library', 'A019', PLAN, library);
    expect(s?.kind).toBe('library');
    expect(s?.items).toEqual([
      { id: 'A001', title: '我们来爬行', hasClip: true },
      { id: 'A019', title: '单脚站', hasClip: true },
    ]);
    expect(s?.index).toBe(1);
  });

  it('那一組還沒讀到、或這一支不在那一組裡：不出系列列', () => {
    expect(detailSeries('plan', 'A001', null, null)).toBeNull();
    expect(detailSeries('library', 'A019', PLAN, null)).toBeNull();
    expect(detailSeries('plan', 'A999', PLAN, null)).toBeNull();
    expect(detailSeries('swap', 'A001', PLAN, null)).toBeNull();
  });
});

describe('年齡提醒（ageFit）', () => {
  const range = { min: 24, max: 72 };

  it('區間內（頭尾都含）→ fits', () => {
    expect(ageFit(range, 24)).toBe('fits');
    expect(ageFit(range, 72)).toBe('fits');
  });

  it('比下限小 → tooYoung（出年齡提醒：先看看示範片就好）', () => {
    expect(ageFit(range, 18)).toBe('tooYoung');
  });

  it('比上限大 → tooOld（配對會往前取，這種不出提醒，見 DetailScreen）', () => {
    expect(ageFit(range, 80)).toBe('tooOld');
  });

  it('不知道孩子現在幾個月 → unknown', () => {
    expect(ageFit(range, null)).toBe('unknown');
  });
});

describe('示範片', () => {
  it('有沒有片：videoUrl 非空才算', () => {
    expect(hasClip({ videoUrl: '/media/activities/A001.mp4' })).toBe(true);
    expect(hasClip({ videoUrl: '  ' })).toBe(false);
    expect(hasClip({ videoUrl: null })).toBe(false);
  });

  it('片長「0:10」；不知道長度 → 空字串（畫面上不寫）', () => {
    expect(clipClock(10)).toBe('0:10');
    expect(clipClock(5)).toBe('0:05');
    expect(clipClock(75)).toBe('1:15');
    expect(clipClock(null)).toBe('');
    expect(clipClock(0)).toBe('');
  });
});

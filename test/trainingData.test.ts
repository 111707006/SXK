import { describe, it, expect } from 'vitest';
import {
  alternateRows,
  checkinRanges,
  dimensionShares,
  nextToStart,
  planGrid,
  planPositionOf,
  resultSummary,
  staircaseStage,
  weekDimensions,
  type WeeklyPick,
  type WeeklyPlanResponse,
} from '../src/components/training/trainingData';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Activity, DimensionCode } from '../src/t2/types';
import { t2FindingsFixture } from './helpers/t2Fixtures';

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

function pick(id: string, dimension: DimensionCode): WeeklyPick {
  return {
    activity: activity(id),
    dimension,
    reason: { band: 'watch', window: { lo: 12, hi: 18 }, matchedTags: [], belowWindow: false },
  };
}

function response(over: Partial<WeeklyPlanResponse> = {}): WeeklyPlanResponse {
  return {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    createdAt: '2026-09-21T02:00:00.000Z',
    findingsId: 7,
    ageMonth: 18,
    ageKey: '12-36',
    reportAgeMonth: 18,
    activities: [pick('A001', 'MOT'), pick('A003', 'MOT'), pick('A141', 'LANG'), pick('A121', 'SOC')],
    preparing: [],
    ...over,
  };
}

/**
 * 家庭訓練畫面的資料整形（Keep 規格 §3.1、§3.2、§4.5）。純函式，不碰 fetch、不碰 React。
 */

describe('要查哪幾段打卡（GET /api/t2/checkins 一次最多 62 天）', () => {
  it('計劃第 1 週：只查第 1 週的星期一到今天', () => {
    expect(checkinRanges('2026-09-21', '2026-09-24')).toEqual([{ from: '2026-09-21', to: '2026-09-24' }]);
  });

  it('第 12 週：從第 1 週查到今天，超過 62 天切成兩段，頭尾接得上', () => {
    // 2026-07-06 起的第 12 週是 9/21–9/27；到 9/24 共 81 天
    expect(checkinRanges('2026-07-06', '2026-09-24')).toEqual([
      { from: '2026-07-06', to: '2026-09-05' },
      { from: '2026-09-06', to: '2026-09-24' },
    ]);
  });

  it('過了 12 週：查 12 週的格子那一段，加上這一週；中間不查', () => {
    // 2026-05-04 起的 12 週到 7/26；這一週是 9/21 起
    expect(checkinRanges('2026-05-04', '2026-09-24')).toEqual([
      { from: '2026-05-04', to: '2026-07-04' },
      { from: '2026-07-05', to: '2026-07-26' },
      { from: '2026-09-21', to: '2026-09-24' },
    ]);
  });

  it('第 13 週的星期一：這一週緊接著 12 週的格子，併成一段', () => {
    // 2026-06-29 起的 12 週到 9/20；今天 9/21 是第 13 週的星期一
    expect(checkinRanges('2026-06-29', '2026-09-21')).toEqual([
      { from: '2026-06-29', to: '2026-08-29' },
      { from: '2026-08-30', to: '2026-09-21' },
    ]);
  });
});

describe('第幾週', () => {
  it('回應帶了 plan 就照它', () => {
    const plan = { weekIndex: 5, totalWeeks: 12 as const, firstWeekStart: '2026-08-24' };
    expect(planPositionOf(response({ plan }))).toEqual(plan);
  });

  it('沒帶（B5 之前的伺服器）：當成第 1 週，第 1 週就是這一週', () => {
    expect(planPositionOf(response())).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-21' });
  });
});

describe('這週練哪幾塊', () => {
  it('維度照四支出現的順序，不重複', () => {
    expect(weekDimensions(response().activities)).toEqual(['MOT', 'LANG', 'SOC']);
  });

  it('佔比：各維度幾支、百分比、活動名', () => {
    expect(dimensionShares(response().activities)).toEqual([
      { dimension: 'MOT', count: 2, percent: 50, titles: ['活动 A001', '活动 A003'] },
      { dimension: 'LANG', count: 1, percent: 25, titles: ['活动 A141'] },
      { dimension: 'SOC', count: 1, percent: 25, titles: ['活动 A121'] },
    ]);
  });
});

describe('換著玩', () => {
  it('舊週次沒有 alternates：不出換著玩', () => {
    expect(alternateRows(response())).toEqual([]);
  });

  it('本週有的維度排前面（照四支的順序），其餘照九個維度的固定順序', () => {
    const rows = alternateRows(
      response({
        alternates: { EMO: [activity('A201')], SOC: [activity('A122')], MOT: [activity('A002'), activity('A010')] },
      }),
    );
    expect(rows.map(r => [r.dimension, r.activities.map(a => a.id)])).toEqual([
      ['MOT', ['A002', 'A010']],
      ['SOC', ['A122']],
      ['EMO', ['A201']],
    ]);
  });

  it('空陣列的維度不出一列', () => {
    expect(alternateRows(response({ alternates: { MOT: [] } }))).toEqual([]);
  });
});

describe('「开始今天的活动」', () => {
  it('本週第一支還沒練過的', () => {
    expect(nextToStart(response().activities, { A001: 2 })?.activity.id).toBe('A003');
  });

  it('四支都練過了：回第一支', () => {
    expect(nextToStart(response().activities, { A001: 1, A003: 1, A141: 1, A121: 1 })?.activity.id).toBe('A001');
  });

  it('打卡讀不出來（null）：回第一支，不假裝知道哪支練過', () => {
    expect(nextToStart(response().activities, null)?.activity.id).toBe('A001');
  });

  it('一支都沒有：null', () => {
    expect(nextToStart([], {})).toBeNull();
  });
});

describe('我的评估结果（報告快照）', () => {
  const findings = t2FindingsFixture({
    MOT: { band: 'refer' },
    LANG: { band: 'watch' },
    SOC: { band: 'watch' },
    LEARN: { band: 'no_tool' },
    SEN: { band: 'not_assessed' },
    // v2.1 S08：這個月齡段不評注意力，整格不出（`gridDimensions`）
    ATT: { band: 'not_screened' },
  });

  it('三級各幾項：只數三級，沒有判定的不算進任何一級，不篩的不算', () => {
    expect(resultSummary(findings).counts).toEqual({ normal: 3, borderline: 2, delay: 1 });
  });

  it('有標記的維度：需要較多支持的在前，其餘照九個維度的順序', () => {
    expect(resultSummary(findings).flagged.map(d => d.dimensionId)).toEqual(['MOT', 'LANG', 'SOC']);
  });

  it('其他：沒被標記的幾項（不篩的不在裡面）、其中發展穩定幾項、沒有判定的是哪幾項', () => {
    const { others } = resultSummary(findings);
    expect(others.total).toBe(5);
    expect(others.stable).toBe(3);
    expect(others.unjudged.map(d => d.dimensionId)).toEqual(['SEN', 'LEARN']);
  });
});

describe('STEP 1 的階梯、STEP 4 的 12 週打卡格', () => {
  it('第 1–4 週第 1 個月、5–8 週第 2 個月、9–12 週第 3 個月、過了 12 週是再評估', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 30].map(staircaseStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('12 週 × 7 天，從第 1 週的星期一起', () => {
    const grid = planGrid('2026-09-21');
    expect(grid).toHaveLength(12);
    expect(grid.every(week => week.length === 7)).toBe(true);
    expect(grid[0][0]).toBe('2026-09-21');
    expect(grid[0][6]).toBe('2026-09-27');
    expect(grid[11][6]).toBe('2026-12-13');
  });
});

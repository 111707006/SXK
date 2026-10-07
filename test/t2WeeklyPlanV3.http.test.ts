import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { addCalendarDays } from '../src/t2/weeks';
import type { Activity, T2Findings } from '../src/t2/types';
import type { FindingsRecord } from '../src/db/t2Findings';
import type { WeeklyPlanInsert, WeeklyPlanRecord } from '../src/db/t2WeeklyPlans';
import type { TrainingPeriodInsert, TrainingPeriodRecord } from '../src/db/t2TrainingPeriods';

/**
 * `GET /api/t2/weekly-plan` 在 `TRAINING_PUSH_V3=1` 時（T2 v3 規格 §3、§6）。
 *
 * 防的是：
 * 1. 第一次查 → 開第 1 期（存一列 t2_training_periods）、這一週 3 支、每一支帶 push（期、週、做法、顏色來源）。
 * 2. 同一週再查、同一期別的週 → 不再開期；第 5 週是第 2 個月（做法「标准」）。
 * 3. 過了第 12 週、沒打卡 → 第 2 期「执行困难」，每週 2 支。
 * 4. 這一期之前、沒存過的週次 → 400。
 * 5. 開關打開前存的舊週次（4 支、沒有 push）照存的樣子回。
 * 6. 計劃頁的位置：第幾期、第幾週、第幾個月、每週幾支、能力表。
 */

const PARENT = 1;
const users: Record<number, { id: number; phone: string }> = { [PARENT]: { id: PARENT, phone: '13800000001' } };

const CHILD = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' };
const userData = {
  child: CHILD,
  // 感覺處理沒做量表（not_assessed）→ 用 T1 分數 6 推定成橙
  completedScores: [{ tierId: 'T1', dimensionId: 'sensory_processing', score: 6, maxScore: 8, status: 'borderline' }],
};

const FINDINGS: T2Findings = t2FindingsFixture(
  { LANG: { band: 'refer', tags: [] }, SEN: { band: 'not_assessed', tags: [] } },
  { child: { assessedAgeMonth: 48 } },
);

let findingsRow: FindingsRecord;
let library: Activity[] = [];
const weeklyTable: Array<{ userId: number; record: WeeklyPlanRecord }> = [];
const periods: TrainingPeriodRecord[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (id === PARENT ? { user_id: id, ...userData } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  getT2Diagnosis: async () => null,
  saveT2Diagnosis: async () => {},
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({ insertToolResult: async () => 1, listToolResults: async () => [] }));

vi.mock('../src/db/t2Findings', () => ({ insertFindings: async () => 1, latestFindings: async () => findingsRow }));

vi.mock('../src/db/t2Activities', () => ({ listActivityLibrary: async () => library }));

vi.mock('../src/db/t2Checkins', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/db/t2Checkins')>()),
  listCheckins: async () => [],
}));

vi.mock('../src/db/t2WeeklyPlans', () => ({
  insertWeeklyPlan: async (userId: number, input: WeeklyPlanInsert) => {
    const id = weeklyTable.length + 1;
    weeklyTable.push({ userId, record: { id, createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  findWeeklyPlan: async (userId: number, weekStart: string) =>
    weeklyTable.find(r => r.userId === userId && r.record.weekStart === weekStart)?.record ?? null,
  recentWeeklyPlans: async () => [],
  firstWeekStartOfFindings: async (userId: number, findingsId: number) =>
    weeklyTable
      .filter(r => r.userId === userId && r.record.findingsId === findingsId)
      .map(r => r.record.weekStart)
      .sort()[0] ?? null,
}));

vi.mock('../src/db/t2TrainingPeriods', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/db/t2TrainingPeriods')>()),
  insertTrainingPeriod: async (_userId: number, input: TrainingPeriodInsert) => {
    periods.push({ id: periods.length + 1, createdAt: null, ...input });
    return periods.length;
  },
  latestTrainingPeriod: async (_userId: number, findingsId: number) =>
    periods.filter(p => p.findingsId === findingsId).sort((a, b) => b.periodNo - a.periodNo)[0] ?? null,
  updateTrainingPeriodPlan: async (_userId: number, id: number, plan: any) => {
    periods.find(p => p.id === id)!.plan = plan;
  },
}));

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前（server.ts 載入時讀開關）
  process.env.TRAINING_PUSH_V3 = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.TRAINING_PUSH_V3 = '';
});

/** 報告 2026-09-07 生成；查的週次都在那之後。 */
const FIRST = '2026-09-14';
const weekOf = (n: number) => addCalendarDays(FIRST, (n - 1) * 7);
const get = async (week: string) => client.get(`/api/t2/weekly-plan?week=${week}`, bearer(PARENT));

beforeEach(() => {
  weeklyTable.length = 0;
  periods.length = 0;
  library = [...ACTIVITY_SEED];
  findingsRow = {
    id: 77,
    createdAt: '2026-09-07T00:00:00.000Z',
    findings: FINDINGS,
    prose: null,
    isAiGenerated: false,
    aiEngine: 'template:all_engines_failed',
  };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-30T04:00:00.000Z'));
});

describe('GET /api/t2/weekly-plan（TRAINING_PUSH_V3=1）', () => {
  it('第一次查：開第 1 期、這一週 3 支、每一支帶 push', async () => {
    const resp = await get(FIRST);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ findingsId: 77, periodNo: 1, firstWeekStart: FIRST, adjustment: 'none' });
    expect(body.activities).toHaveLength(3);
    for (const a of body.activities) {
      expect(a.push).toMatchObject({ periodNo: 1, week: 1, variant: 'easy' });
      expect(a.reason).toHaveProperty('band'); // 舊形狀照樣在
    }
    expect(weeklyTable).toHaveLength(1);
  });

  it('沒做量表的感覺處理用 T1 推定（6 分 → 橙），push 標「T1 推定」', async () => {
    const body = await (await get(FIRST)).json();
    const sen = body.plan.dimensions.find((d: any) => d.dimension === 'SEN');
    expect(sen).toMatchObject({ color: 'orange', source: 't1' });
    const lang = body.plan.dimensions.find((d: any) => d.dimension === 'LANG');
    expect(lang).toMatchObject({ color: 'red', source: 't2' });
  });

  it('計劃頁的位置：第 1 期第 1 週、第 1 個月、每週 3 支', async () => {
    const body = await (await get(FIRST)).json();
    expect(body.plan).toMatchObject({ weekIndex: 1, totalWeeks: 12, firstWeekStart: FIRST, periodNo: 1, monthIndex: 0, variant: 'easy', perWeek: 3 });
  });

  it('同一週再查、同期第 5 週：不再開期；第 5 週做法「标准」', async () => {
    await get(FIRST);
    await get(FIRST);
    const body = await (await get(weekOf(5))).json();
    expect(periods).toHaveLength(1);
    expect(body.plan).toMatchObject({ weekIndex: 5, monthIndex: 1, variant: 'standard' });
    expect(body.activities.every((a: any) => a.push.week === 5)).toBe(true);
    expect(weeklyTable).toHaveLength(2);
  });

  it('過了第 12 週、沒打卡 → 第 2 期「执行困难」，每週 2 支', async () => {
    await get(FIRST);
    const body = await (await get(weekOf(13))).json();
    expect(periods).toHaveLength(2);
    expect(periods[1]).toMatchObject({ periodNo: 2, adjustment: 'hard', completion: 0, firstWeekStart: weekOf(13) });
    expect(body.activities).toHaveLength(2);
    expect(body.plan).toMatchObject({ periodNo: 2, weekIndex: 1, perWeek: 2, variant: 'easy' });
  });

  it('這一期之前、沒存過的週次 → 400，不寫任何東西', async () => {
    await get(FIRST);
    const resp = await get('2026-09-07');
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('WEEK_OUT_OF_RANGE');
    expect(weeklyTable).toHaveLength(1);
  });

  it('開關打開前存的舊週次（4 支、沒有 push）照存的樣子回', async () => {
    weeklyTable.push({
      userId: PARENT,
      record: {
        id: 1,
        createdAt: '2026-09-14T01:00:00.000Z',
        weekStart: FIRST,
        findingsId: 77,
        activities: {
          picks: ['A121', 'A122', 'A123', 'A124'].map(id => ({
            id,
            dimension: 'LANG' as const,
            reason: { band: 'refer' as const, window: { lo: 23, hi: 35 }, matchedTags: [], belowWindow: false },
          })),
          preparing: [],
        },
      },
    });
    const body = await (await get(FIRST)).json();
    expect(body.activities).toHaveLength(4);
    expect(body.activities[0]).not.toHaveProperty('push');
    expect(body.plan).toMatchObject({ weekIndex: 1, totalWeeks: 12 });
    expect(periods).toHaveLength(0);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { ActivityTag } from '../src/t2/findingTags';
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
 * `GET /api/t2/weekly-plan` 在 `TRAINING_PUSH_V3`＋`TRAINING_PUSH_TAGS`＋`TRAINING_PUSH_CHILD_TAGS` 都開著時（ADR-0018）。
 * 快照是代填的形狀（每個維度帶治療師勾的 `tags`）：開期時記下孩子的細項、規則版是 push-child-tags、
 * 對中的影片排在前面、理由句寫對上的那一個。
 *
 * 以下是 v3 推送原本那一支（`t2WeeklyPlanV3.http.test.ts`）的說明，替身照抄：
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
  { LANG: { band: 'refer', tags: ['lang.pragmatics'] }, SEN: { band: 'not_assessed', tags: [] } },
  { child: { assessedAgeMonth: 48 } },
);

const DRAFT = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'deploy', 'activity-tags', '2026-11-16-videos.json'), 'utf8'),
) as { rows: Array<{ id: string; targetMonth: number; targets: ActivityTag[] }> } | Array<{ id: string; targetMonth: number; targets: ActivityTag[] }>;
const ROWS = Array.isArray(DRAFT) ? DRAFT : DRAFT.rows;
const DRAFT_BY_ID = new Map(ROWS.map(r => [r.id, r] as const));
const TAGGED: Activity[] = ACTIVITY_SEED.map(a => {
  const r = DRAFT_BY_ID.get(a.id);
  return r ? { ...a, videoUrl: `/media/activities/${a.id}.mp4`, targetMonth: r.targetMonth, targets: r.targets } : a;
});

let findingsRow: FindingsRecord;
let library: Activity[] = [];
/** 接下來幾次讀活動庫要失敗（審查 #1）；`libraryCalls` 數實際讀了幾次（看重試）。 */
let libraryFailures = 0;
let libraryCalls = 0;
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

vi.mock('../src/db/t2Activities', () => ({
  listActivityLibrary: async () => {
    libraryCalls += 1;
    if (libraryFailures > 0) {
      libraryFailures -= 1;
      throw new Error('timeout');
    }
    return library;
  },
}));

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
  process.env.TRAINING_PUSH_TAGS = '1';
  process.env.TRAINING_PUSH_CHILD_TAGS = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.TRAINING_PUSH_V3 = '';
  process.env.TRAINING_PUSH_TAGS = '';
  process.env.TRAINING_PUSH_CHILD_TAGS = '';
});

const FIRST = '2026-09-14';
const weekOf = (n: number) => addCalendarDays(FIRST, (n - 1) * 7);
const get = async (week: string) => client.get(`/api/t2/weekly-plan?week=${week}`, bearer(PARENT));

beforeEach(() => {
  weeklyTable.length = 0;
  periods.length = 0;
  library = TAGGED;
  libraryFailures = 0;
  libraryCalls = 0;
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

describe('孩子的細項（ADR-0018）', () => {
  it('開期記下快照裡的細項、規則版換成 push-child-tags', async () => {
    const resp = await get(FIRST);
    expect(resp.status).toBe(200);
    expect(periods).toHaveLength(1);
    expect(periods[0].rulesVersion).toBe('push-child-tags-2026-11-19');
    expect(periods[0].plan!.childTags).toEqual(['lang.pragmatics']);
  });

  it('語言那幾格對中「对话轮替」的先排；理由句帶「这次看到」', async () => {
    const langIds: string[] = [];
    let sawReason = false;
    for (let w = 1; w <= 4; w++) {
      const body = await (await get(weekOf(w))).json();
      for (const a of body.activities) {
        if (a.dimension !== 'LANG') continue;
        langIds.push(a.activity.id);
        if (a.reason.matchedTags.includes('lang.pragmatics')) sawReason = true;
      }
    }
    const byId = new Map(TAGGED.map(a => [a.id, a] as const));
    expect(langIds.length).toBeGreaterThan(0);
    expect(byId.get(langIds[0])!.targets).toContain('lang.pragmatics');
    expect(sawReason).toBe(true);
  });
});

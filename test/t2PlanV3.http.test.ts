import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { parentPlanV3, runRecommendation } from '../src/t2/recommend/parentPlan';
import type { ToolResultRecordV3 } from '../src/db/t2ToolResultsV3';

/**
 * `GET /api/t2/plan` 在 `T2_RECOMMEND_V3=1` 時回量表推薦（推薦規格 §5；客規 §13.2）。
 * 防的是：回的不是引擎的輸出、客規原句漏給家長、做過的又被推一次、T3 出現、付費前看不到（白名單照舊）。
 */

const TODAY = new Date('2026-10-07T08:00:00+08:00');
vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });

/** 2018-10-07 出生 → 96 個月。 */
const BIRTH_96M = '2018-10-07';

const PARENT = 1;
const ALL_GREEN = 2;
const NO_T1 = 3;
const LOCKED = 4;

const users: Record<number, { id: number; phone: string }> = Object.fromEntries([PARENT, ALL_GREEN, NO_T1, LOCKED].map(id => [id, { id, phone: `1380000000${id}` }]));

const t1 = (dimensionId: string, score: number) => ({
  dimensionId, dimensionName: dimensionId, tierId: 'T1', score, maxScore: 8, status: score >= 7 ? 'normal' : 'delay', completedAt: '2026-10-01T00:00:00Z', assessedAgeMonth: 96,
});
const DIMS = ['language', 'attention', 'sensory_processing', 'cognitive', 'social_emotional', 'emotion_behavior', 'gross_motor', 'self_care', 'learning_ability'];
const SCORES = DIMS.map(d => t1(d, d === 'attention' ? 2 : d === 'learning_ability' ? 4 : 8));
const GREEN = DIMS.map(d => t1(d, 8));
const CHILD = { name: '小明', birthDate: BIRTH_96M, ageMonth: 96, gender: 'boy', inSchool: true };

const userData: Record<number, { child: any; completedScores: any[] }> = {
  [PARENT]: { child: CHILD, completedScores: SCORES },
  [ALL_GREEN]: { child: CHILD, completedScores: GREEN },
  [NO_T1]: { child: CHILD, completedScores: [] },
  [LOCKED]: { child: CHILD, completedScores: SCORES },
};

let v3Rows: Record<number, ToolResultRecordV3[]> = {};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
}));

vi.mock('../src/db/t2ToolResultsV3', () => ({
  insertToolResultV3: async () => 1,
  listToolResultsV3: async (userId: number) => v3Rows[userId] ?? [],
}));

let client: TestClient;

beforeAll(async () => {
  process.env.T2_RECOMMEND_V3 = '1';
  process.env.TRAINING_PUSH_V3 = '1'; // 完整版要 v3 推送規則（server.ts 起不來的檢查）
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
  await client.close();
});

const PLAN = '/api/t2/plan';

/** 一筆做完的（只有判定會看的欄位）。 */
function done(toolId: string, daysAgo: number): ToolResultRecordV3 {
  const createdAt = new Date(TODAY.getTime() - daysAgo * 86400000).toISOString();
  return {
    id: daysAgo,
    createdAt,
    childSnapshot: null,
    result: {
      toolkitVersion: 'kit-20260923', toolId, assessedAgeMonth: 96, rater: 'mother', context: { ageM: 96 }, answers: {}, computedAt: createdAt,
      score: { code: toolId, form: 'x', facets: [], total: { value: null, band: null, bandName: null }, grade03: {}, missing: [] },
    },
  };
}

describe('GET /api/t2/plan（v3）', () => {
  it('回的就是引擎的輸出經過家長端的字；附月齡；T3 不出', async () => {
    v3Rows = {};
    const resp = await client.get(PLAN, bearer(PARENT));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    const run = runRecommendation({ child: CHILD, t1Scores: SCORES, liveAgeMonth: 96, doneCodes: [] });
    expect(body).toEqual({ ...parentPlanV3(run.rec, run.itemsMissing), ageMonth: 96, completed: [] });
    expect(body.status).toBe('RECOMMEND');
    expect(body.tools.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(body)).not.toMatch(/"t3"|红旗|落后|治疗师/);
  });

  it('近 90 天做過的不再推、列在 completed；超過 90 天的照推', async () => {
    const first = (await (await client.get(PLAN, bearer(PARENT))).json()).tools[0].code;
    v3Rows = { [PARENT]: [done(first, 10)] };
    const body = await (await client.get(PLAN, bearer(PARENT))).json();
    expect(body.tools.map((t: any) => t.code)).not.toContain(first);
    expect(body.completed).toEqual([expect.objectContaining({ code: first })]);
    v3Rows = { [PARENT]: [done(first, 120)] };
    const old = await (await client.get(PLAN, bearer(PARENT))).json();
    expect(old.tools.map((t: any) => t.code)).toContain(first);
    expect(old.completed).toEqual([]);
  });

  it('T1 全綠、沒有診斷 → NO_T2', async () => {
    v3Rows = {};
    const body = await (await client.get(PLAN, bearer(ALL_GREEN))).json();
    expect(body).toMatchObject({ status: 'NO_T2', tools: [] });
    expect(body.noT2Text).toContain('3–6 个月');
  });

  it('沒做 T1 → 404 T1_REQUIRED（照舊）；未登入 401；沒買也看得到（付費前的白名單）', async () => {
    expect((await client.get(PLAN, bearer(NO_T1))).status).toBe(404);
    expect((await client.get(PLAN)).status).toBe(401);
    expect((await client.get(PLAN, bearer(LOCKED))).status).toBe(200);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import type { FindingsRecord } from '../src/db/t2Findings';

/**
 * 審查 #20（2026-10-15）：T2 的作答與報告只掛在家長帳號上，沒有孩子這一層。家長按「清除档案」再建一個孩子，
 * T1 成績清掉了，T2 的問卷、報告卻原封不動留著 —— 新的孩子看到的是前一個孩子的 T2。
 *
 * 短期做法（使用者 2026-10-15）：伺服器在「建立新的孩子檔案」時記下建檔時間（`t2Since`，伺服器的鐘），
 * T2 的作答與報告只看這之後的。不刪資料；改名字、改生日（同一個孩子的修正）不動它；舊檔案沒有建檔時間就不篩。
 */

const PARENT = 1;
const users: Record<number, { id: number; phone: string }> = { [PARENT]: { id: PARENT, phone: '13800000001' } };

let stored: { child: any; completedScores: any[] } | null = null;
let findings: FindingsRecord[] = [];
let toolResults: Array<{ id: number; createdAt: string; childSnapshot: any; result: any }> = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (id === PARENT && stored ? { user_id: id, ...stored } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async (_id: number, _device: unknown, child: any, completedScores: any[]) => {
    stored = { child, completedScores };
  },
  getPool: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({ insertToolResult: async () => 1, listToolResults: async () => [] }));
vi.mock('../src/db/t2ToolResultsV3', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/db/t2ToolResultsV3')>()),
  listToolResultsV3: async () => toolResults,
}));
vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async () => 1,
  latestFindings: async () => findings[findings.length - 1] ?? null,
}));

let client: TestClient;

beforeAll(async () => {
  process.env.T2_RECOMMEND_V3 = '1';
  process.env.TRAINING_PUSH_V3 = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
});

const OLD = '2026-09-07T00:00:00.000Z';
const CHILD_A = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' };
const CHILD_B = { name: '小華', birthDate: '2024-03-01', ageMonth: 31, gender: 'girl' };

const save = (child: unknown) => client.postJson('/api/db/save', { child, completedScores: [], orders: [], reportHistory: [] }, bearer(PARENT));
const latest = () => client.get('/api/t2/findings/latest', bearer(PARENT));
const results = async () => (await (await client.get('/api/t2/tool-results?kit=v3', bearer(PARENT))).json()).results;

beforeEach(() => {
  // 舊檔案：孩子 A 沒有建檔時間，已經有一份 T2 作答與報告
  stored = { child: { ...CHILD_A }, completedScores: [] };
  findings = [{ id: 1, createdAt: OLD, findings: t2FindingsFixture({}), prose: null, isAiGenerated: false, aiEngine: 'x' }];
  toolResults = [{ id: 1, createdAt: OLD, childSnapshot: null, result: { toolId: 'SXK-SP' } }];
});

describe('清除檔案、換一個孩子之後，前一個孩子的 T2 不帶過來（審查 #20）', () => {
  it('舊檔案（沒有建檔時間）：照舊看得到', async () => {
    expect((await latest()).status).toBe(200);
    expect(await results()).toHaveLength(1);
  });

  it('改名字、改生日（同一個孩子）：不記建檔時間，T2 照舊看得到', async () => {
    expect((await save({ ...CHILD_A, birthDate: '2022-09-13' })).status).toBe(200);
    expect(stored!.child.t2Since).toBeUndefined();
    expect((await latest()).status).toBe(200);
  });

  it('清除檔案再建孩子 B：記下建檔時間；之前的報告與作答都看不到，資料沒有刪', async () => {
    await save(null);
    await save({ ...CHILD_B });
    expect(typeof stored!.child.t2Since).toBe('string');
    expect((await latest()).status).toBe(404);
    expect(await results()).toEqual([]);
    expect(findings).toHaveLength(1);
    expect(toolResults).toHaveLength(1);
  });

  it('孩子 B 建檔之後才交的作答與報告照常看得到；前端回存時沒帶建檔時間也不會弄丟', async () => {
    await save(null);
    await save({ ...CHILD_B });
    const since = stored!.child.t2Since as string;
    const later = new Date(Date.parse(since) + 60_000).toISOString();
    toolResults.push({ id: 2, createdAt: later, childSnapshot: null, result: { toolId: 'SXK-GM' } });
    findings.push({ id: 2, createdAt: later, findings: t2FindingsFixture({}), prose: null, isAiGenerated: false, aiEngine: 'x' });
    expect((await latest()).status).toBe(200);
    expect((await results()).map((r: any) => r.result.toolId)).toEqual(['SXK-GM']);

    // 前端本機的孩子物件沒有這個欄位，回存時不帶 —— 伺服器照舊留著
    await save({ ...CHILD_B, name: '小华' });
    expect(stored!.child.t2Since).toBe(since);
  });
});

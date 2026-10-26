import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 免費期間（`PAYWALL_FREE`）＋訓練計劃（`TRAINING_PLAN`）：使用者 2026-10-27「目前都是 demo 階段，不用實際要求價格跟兌換碼
 * 也可以進入」—— 沒買、沒兌換的家長照樣進得了居家訓練；`/api/unlocks` 回一段沒有迄日的使用權；`training_passes` 一筆都不寫。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.PAYWALL_FREE = '1';

const NOTHING_PARENT = 3;
const T2_PARENT = 2;

const users: Record<number, { id: number; phone: string }> = {
  2: { id: 2, phone: '13800000002' },
  3: { id: 3, phone: '13800000003' },
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async () => 1,
  listToolResults: async () => [],
}));

const store = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async (userId: number) => store.rows.filter(r => r.userId === userId),
  insertTrainingPass: async (userId: number, p: any) => {
    store.rows.push({ userId, ...p });
    return true;
  },
  hasScaleT2Findings: async (userId: number) => userId === T2_PARENT,
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  store.rows = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

const TRAINING_PATH = '/api/t2/library';

async function blocked(resp: Response): Promise<string | null> {
  if (resp.status !== 401 && resp.status !== 403) return null;
  return ((await resp.json().catch(() => ({}))) as any).code ?? String(resp.status);
}

describe('免費期間：居家訓練不要使用權', () => {
  it('沒買、沒兌換的家長也放行', async () => {
    expect(await blocked(await client.get(TRAINING_PATH, bearer(NOTHING_PARENT)))).toBeNull();
  });

  it('未登入照樣 401', async () => {
    expect((await client.get(TRAINING_PATH)).status).toBe(401);
  });

  it('/api/unlocks：一段有效、沒有迄日的使用權，T2 也開', async () => {
    const body = await (await client.get('/api/unlocks', bearer(NOTHING_PARENT))).json();
    expect(body.trainingPass).toEqual({ active: true, endsOn: null, lastEndsOn: null });
    expect(body.t2).toBe(true);
    expect(body.free).toBe(true);
  });

  it('不寫進 training_passes（有 T2 報告的家長也不發附送）', async () => {
    await client.get('/api/unlocks', bearer(T2_PARENT));
    await client.get(TRAINING_PATH, bearer(T2_PARENT));
    expect(store.rows).toHaveLength(0);
  });
});

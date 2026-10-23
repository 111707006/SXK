import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * `TRAINING_PLAN` 開著（#91）：線上干預那幾支只看使用權；有效的使用權也打開 T2；`/api/unlocks` 帶 `trainingPass`；
 * 有 T2 報告的家長第一次查附送一個月、只發一次。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';

const PASS_PARENT = 1;   // 有一段還沒到期的使用權（沒買 T2）
const T2_PARENT = 2;     // 買過 T2、有 T2 報告、沒有使用權
const NOTHING_PARENT = 3;
const EXPIRED_PARENT = 4;

const users: Record<number, { id: number; phone: string }> = {
  1: { id: 1, phone: '13800000001' },
  2: { id: 2, phone: '13800000002' },
  3: { id: 3, phone: '13800000003' },
  4: { id: 4, phone: '13800000004' },
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId === 2,
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
  listTrainingPasses: async (userId: number) => store.rows.filter(r => r.userId === userId).map(r => ({ startsOn: r.startsOn, endsOn: r.endsOn, months: r.months, source: r.source })),
  insertTrainingPass: async (userId: number, p: any) => {
    if (p.uniqueKey && store.rows.some(r => r.uniqueKey === p.uniqueKey)) return false;
    store.rows.push({ userId, ...p });
    return true;
  },
  hasScaleT2Findings: async (userId: number) => userId === 2,
}));

const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const shift = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  store.rows = [
    { userId: PASS_PARENT, startsOn: shift(-3), endsOn: shift(24), months: 1, source: 'code', uniqueKey: 'code:1' },
    { userId: EXPIRED_PARENT, startsOn: shift(-40), endsOn: shift(-13), months: 1, source: 'code', uniqueKey: 'code:2' },
  ];
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

/** 線上干預的一支（閘門是路徑前綴的守衛，一條就夠）；處理函式本身不在這裡驗 —— 只看是不是被閘門擋下。 */
const TRAINING_PATH = '/api/t2/library';
const T2_PATH = '/api/t2/tool-results';

async function blocked(resp: Response): Promise<string | null> {
  if (resp.status !== 401 && resp.status !== 403) return null;
  return ((await resp.json().catch(() => ({}))) as any).code ?? String(resp.status);
}

describe('線上干預只看使用權', () => {
  it('有效 → 放行', async () => {
    expect(await blocked(await client.get(TRAINING_PATH, bearer(PASS_PARENT)))).toBeNull();
  });

  it('沒有 → 403 TRAINING_PASS_REQUIRED（買過 T2 也一樣要使用權 —— 但他會先拿到附送的一個月，見下面）', async () => {
    expect(await blocked(await client.get(TRAINING_PATH, bearer(NOTHING_PARENT)))).toBe('TRAINING_PASS_REQUIRED');
  });

  it('到期 → 403', async () => {
    expect(await blocked(await client.get(TRAINING_PATH, bearer(EXPIRED_PARENT)))).toBe('TRAINING_PASS_REQUIRED');
  });

  it('未登入 → 401', async () => {
    expect((await client.get(TRAINING_PATH)).status).toBe(401);
  });
});

describe('T2 附送一個月', () => {
  it('有 T2 報告：第一次查就有一個月、只發一次', async () => {
    expect(await blocked(await client.get(TRAINING_PATH, bearer(T2_PARENT)))).toBeNull();
    await client.get('/api/unlocks', bearer(T2_PARENT));
    const bonus = store.rows.filter(r => r.userId === T2_PARENT && r.source === 't2_bonus');
    expect(bonus).toHaveLength(1);
    expect(bonus[0].startsOn).toBe(today());
    expect(bonus[0].months).toBe(1);
  });
});

describe('T2 閘門認使用權', () => {
  it('有效的使用權＝T2 已解鎖', async () => {
    expect(await blocked(await client.get(T2_PATH, bearer(PASS_PARENT)))).toBeNull();
  });

  it('沒有使用權、也沒買 T2 → LOCKED', async () => {
    expect(await blocked(await client.get(T2_PATH, bearer(NOTHING_PARENT)))).toBe('LOCKED');
  });
});

describe('/api/unlocks', () => {
  it('帶 trainingPass；有效的使用權也讓 t2 是 true', async () => {
    const body = await (await client.get('/api/unlocks', bearer(PASS_PARENT))).json();
    expect(body.trainingPass).toEqual({ active: true, endsOn: shift(24), lastEndsOn: shift(24) });
    expect(body.t2).toBe(true);
  });

  it('到期：active false、lastEndsOn 是那一天', async () => {
    const body = await (await client.get('/api/unlocks', bearer(EXPIRED_PARENT))).json();
    expect(body.trainingPass).toEqual({ active: false, endsOn: null, lastEndsOn: shift(-13) });
    expect(body.t2).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor, scoreKitV3 } from '../src/t2/kitv3/score';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import type { ChildSnapshot, ToolResultRecord } from '../src/db/t2ToolResults';
import type { ToolResultRecordV3 } from '../src/db/t2ToolResultsV3';

/**
 * `POST／GET /api/t2/tool-results` 在 `T2_RECOMMEND_V3=1` 時收完整版（題庫規格 §8 R3g）。
 * 寫法同 `t2ToolResults.http.test.ts`：真的發 HTTP，資料層替身。
 *
 * 【防什麼】
 * 1. 伺服器算：存的 `score` 是 `scoreKitV3` 對同一份答案算的，body 塞的分數沒用。
 * 2. 拒算不落表；同一支交兩次是兩筆，`?kit=v3` 回較新那筆。
 * 3. 作答情境（上學、性別）取自孩子檔案，不取 body。
 * 4. 舊題庫的交卷與清單照舊，兩套互不混。
 */

const UNLOCKED = 1;
const LOCKED = 2;
const SCHOOLLESS = 3;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
  [SCHOOLLESS]: { id: SCHOOLLESS, phone: '13800000003' },
};

const CHILD = { name: '小明', birthDate: '2023-10-01', ageMonth: 36, gender: 'boy', inSchool: true };
const userData: Record<number, { child: any; completedScores: any[] }> = {
  [UNLOCKED]: { child: CHILD, completedScores: [] },
  [LOCKED]: { child: CHILD, completedScores: [] },
  [SCHOOLLESS]: { child: { ...CHILD, gender: 'girl', inSchool: false }, completedScores: [] },
};

const oldTable: Array<{ userId: number; record: ToolResultRecord }> = [];
const v3Table: Array<{ userId: number; record: ToolResultRecordV3 }> = [];
let nextId = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
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
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async (userId: number, childSnapshot: ChildSnapshot, result: any) => {
    const id = nextId++;
    oldTable.push({ userId, record: { id, createdAt: new Date().toISOString(), childSnapshot, result } });
    return id;
  },
  listToolResults: async (userId: number) => oldTable.filter(r => r.userId === userId).map(r => r.record),
}));

vi.mock('../src/db/t2ToolResultsV3', () => ({
  insertToolResultV3: async (userId: number, childSnapshot: ChildSnapshot, result: ToolResultV3) => {
    const id = nextId++;
    v3Table.push({ userId, record: { id, createdAt: new Date().toISOString(), childSnapshot, result } });
    return id;
  },
  listToolResultsV3: async (userId: number) => v3Table.filter(r => r.userId === userId).map(r => r.record),
}));

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前（server.ts 載入時讀開關）
  process.env.T2_RECOMMEND_V3 = '1';
  process.env.TRAINING_PUSH_V3 = '1'; // 完整版要 v3 推送規則（server.ts 起不來的檢查）
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
  await client.close();
});

beforeEach(() => {
  oldTable.length = 0;
  v3Table.length = 0;
  nextId = 1;
});

const POST = '/api/t2/tool-results';

/** 每題答那一段選項組第 `pick` 個值。 */
function answersFor(toolId: string, ageM: number, pick = 0, ctx: { inSchool?: boolean } = {}): Record<string, number | null> {
  const bank = KITV3_BANKS[toolId];
  const form = formFor(bank, ageM);
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM, ...ctx })) {
    const opts = bank.options[form.sections.find(s => s.key === a.section)!.options];
    out[a.item.key] = opts[Math.min(pick, opts.length - 1)].value;
  }
  return out;
}

const body = (toolId: string, ageM: number, answers = answersFor(toolId, ageM), extra: Record<string, unknown> = {}) => ({
  toolkitVersion: 'kit-20260923',
  toolId,
  assessedAgeMonth: ageM,
  rater: 'mother',
  answers,
  ...extra,
});

describe('POST（完整版）', () => {
  it('答滿 → 201；分數是伺服器算的（與直接呼叫計分函式相同），body 塞的分數不看；表裡一筆', async () => {
    const b = { ...body('SXK-GM', 36, answersFor('SXK-GM', 36, 1)), score: { grade03: { MOT: 0 } } };
    const resp = await client.postJson(POST, b, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    const got = await resp.json();
    expect(got.result.score).toEqual(scoreKitV3(KITV3_BANKS['SXK-GM'], b.answers, { ageM: 36, inSchool: true, sex: 'male' }));
    expect(got.result).toMatchObject({ toolkitVersion: 'kit-20260923', toolId: 'SXK-GM', assessedAgeMonth: 36, rater: 'mother' });
    expect(v3Table).toHaveLength(1);
    expect(v3Table[0]).toMatchObject({ userId: UNLOCKED, record: { id: got.id, result: got.result } });
    expect(v3Table[0].record.childSnapshot).toMatchObject({ name: '小明', gender: 'boy' });
    expect(oldTable).toHaveLength(0);
  });

  it('作答情境取自孩子檔案：沒上學、女生 → QOL 少「园所与学校生活」那一段', async () => {
    const answers = answersFor('SXK-QOL', 36, 0, { inSchool: false });
    const resp = await client.postJson(POST, body('SXK-QOL', 36, answers, { inSchool: true }), bearer(SCHOOLLESS));
    expect(resp.status).toBe(201);
    expect((await resp.json()).result.context).toEqual({ ageM: 36, inSchool: false, sex: 'female' });
  });

  it('缺答 → 400 INCOMPLETE；窗口外 → 400 AGE_OUT_OF_WINDOW；表裡零筆', async () => {
    const a = answersFor('SXK-GM', 36);
    const [first] = Object.keys(a);
    delete a[first];
    const r1 = await client.postJson(POST, body('SXK-GM', 36, a), bearer(UNLOCKED));
    expect(r1.status).toBe(400);
    expect(await r1.json()).toMatchObject({ code: 'INCOMPLETE', missing: [first] });
    const r2 = await client.postJson(POST, body('SXK-SP', 60, {}), bearer(UNLOCKED));
    expect(r2.status).toBe(400);
    expect(await r2.json()).toMatchObject({ code: 'AGE_OUT_OF_WINDOW', windowMonths: { lo: 24, hi: 59 } });
    expect(v3Table).toHaveLength(0);
  });

  it('未登入 401、沒買 403（同一道 T2 閘門）', async () => {
    expect((await client.postJson(POST, body('SXK-GM', 36))).status).toBe(401);
    expect((await client.postJson(POST, body('SXK-GM', 36), bearer(LOCKED))).status).toBe(403);
  });

  it('沒帶 toolkitVersion 就是舊題庫：完整版的代碼舊路徑不認得', async () => {
    const { toolkitVersion: _, ...rest } = body('SXK-GM', 36);
    const resp = await client.postJson(POST, rest, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('TOOL_UNKNOWN');
  });
});

describe('GET ?kit=v3', () => {
  it('每支最新的一筆；不帶 kit 是舊題庫的清單（看不到完整版）', async () => {
    await client.postJson(POST, body('SXK-GM', 36), bearer(UNLOCKED));
    await client.postJson(POST, body('SXK-ADL', 36), bearer(UNLOCKED));
    const again = await (await client.postJson(POST, body('SXK-GM', 36, answersFor('SXK-GM', 36, 2)), bearer(UNLOCKED))).json();
    const v3 = await (await client.get(`${POST}?kit=v3`, bearer(UNLOCKED))).json();
    expect(v3.results.map((r: any) => [r.id, r.result.toolId])).toEqual([[2, 'SXK-ADL'], [3, 'SXK-GM']]);
    expect(v3.results[1].result).toEqual(again.result);
    const old = await (await client.get(POST, bearer(UNLOCKED))).json();
    expect(old.results).toEqual([]);
  });

  it('只看自己的', async () => {
    await client.postJson(POST, body('SXK-GM', 36), bearer(UNLOCKED));
    const other = await (await client.get(`${POST}?kit=v3`, bearer(SCHOOLLESS))).json();
    expect(other.results).toEqual([]);
  });
});

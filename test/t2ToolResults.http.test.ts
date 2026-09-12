import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import type { ToolId, ToolResult } from '../src/t2/types';
import type { ChildSnapshot, ToolResultRecord } from '../src/db/t2ToolResults';

/**
 * `POST /api/t2/tool-results` 與 `GET /api/t2/tool-results`（票 #57，規格 §9.1、§9.2）。
 *
 * 寫法比照 `t2Plan.http.test.ts`：真的對 Express 發 HTTP 請求，資料層以替身供應。
 * 兩支都在 T2 閘門後面（不在 `T2_OPEN_PATHS` 上）：未登入 401、沒買 403 `LOCKED`。
 *
 * 【這裡在防什麼】
 * 1. **伺服器算**：表裡存的 `result` 是 `scoreTool` 對同一份答案算出來的，前端送什麼分數都沒用。
 * 2. **拒算不落表**：缺答、窗口外都是 400，而且表裡零筆 —— 半套結果這種東西不存在。
 * 3. **每次交卷一筆**：同一支交兩次是兩筆；GET 回較新那筆。
 * 4. **GET 附 band**：加測提示要的資料（「星號做完且判留意或關注才顯示」），前端不自己跑規則表。
 */

const UNLOCKED = 1;
const LOCKED = 2;
const NO_CHILD = 3;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
  [NO_CHILD]: { id: NO_CHILD, phone: '13800000003' },
};

const CHILD = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' };

const userData: Record<number, { child: any; completedScores: any[] }> = {
  [UNLOCKED]: { child: CHILD, completedScores: [] },
  [LOCKED]: { child: CHILD, completedScores: [] },
};

/** 替身的 t2_tool_results：`insertToolResult` 寫進來、`listToolResults` 讀出去，只回該家長的。 */
const table: Array<{ userId: number; record: ToolResultRecord }> = [];
let nextId = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId === UNLOCKED || userId === NO_CHILD,
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
  insertToolResult: async (userId: number, childSnapshot: ChildSnapshot, result: ToolResult) => {
    const id = nextId++;
    table.push({ userId, record: { id, createdAt: new Date().toISOString(), childSnapshot, result } });
    return id;
  },
  listToolResults: async (userId: number) => table.filter(r => r.userId === userId).map(r => r.record),
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  table.length = 0;
  nextId = 1;
});

const POST = '/api/t2/tool-results';

function full(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

/** sxk-lang 48 個月 49 題滿分 98：前 27 題答「偶爾會」→ raw 71 → 72%。 */
function lang72(): Record<string, AnswerValue> {
  const answers = full('sxk-lang', 48, 2);
  for (const key of Object.keys(answers).slice(0, 27)) answers[key] = 1;
  return answers;
}

const LANG_BODY = { toolId: 'sxk-lang', assessedAgeMonth: 48, rater: 'mother', pre: {}, answers: lang72() };

/** 與伺服器同一份輸入直接算，比對時忽略 `computedAt`（伺服器用現在時間）。 */
function expected(body: typeof LANG_BODY): Omit<ToolResult, 'computedAt'> {
  const outcome = scoreTool({ toolId: body.toolId as ToolId, assessedAgeMonth: body.assessedAgeMonth, rater: body.rater as ToolResult['rater'], pre: body.pre, answers: body.answers });
  if (!outcome.ok) throw new Error(outcome.reason);
  const { computedAt: _drop, ...rest } = outcome.result;
  return rest;
}

describe('POST /api/t2/tool-results', () => {
  it('完整作答 → 201，回傳與直接呼叫計分函式的結果相同；表裡一筆，result 是伺服器算的', async () => {
    const resp = await client.postJson(POST, LANG_BODY, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    const body = await resp.json();

    const { computedAt, ...rest } = body.result;
    expect(rest).toEqual(expected(LANG_BODY));
    expect(Date.parse(computedAt)).not.toBeNaN();
    expect(body.result.overall.pct).toBe(72);
    expect(body.bands).toEqual({ LANG: 'watch' });
    expect(body.id).toBe(1);

    expect(table).toHaveLength(1);
    expect(table[0].userId).toBe(UNLOCKED);
    expect(table[0].record.result).toEqual(body.result);
    // 孩子快照：交卷當下的檔案
    expect(table[0].record.childSnapshot).toMatchObject({ name: '小明', birthDate: '2022-09-12', gender: 'boy' });
  });

  /** 前端送上來的分數一個字都不看：body 裡多塞的 `result`／`sections` 被忽略，表裡是伺服器算的。 */
  it('body 裡塞進來的分數被忽略', async () => {
    const forged = { ...LANG_BODY, result: { overall: { pct: 100 } }, sections: { RC: { pct: 100 } } };
    const resp = await client.postJson(POST, forged, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    expect((await resp.json()).result.overall.pct).toBe(72);
    expect(table[0].record.result.overall.pct).toBe(72);
  });

  it('少答一題 → 400 INCOMPLETE，訊息含缺題數，表裡零筆', async () => {
    const answers = { ...LANG_BODY.answers };
    delete answers['EX.3'];
    const resp = await client.postJson(POST, { ...LANG_BODY, answers }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.code).toBe('INCOMPLETE');
    expect(body.error).toContain('1');
    expect(body.missing).toEqual(['EX.3']);
    expect(table).toHaveLength(0);
  });

  it('少答三題 → 訊息說 3', async () => {
    const answers = { ...LANG_BODY.answers };
    delete answers['RC.1'];
    delete answers['EX.3'];
    delete answers['PR.2'];
    const resp = await client.postJson(POST, { ...LANG_BODY, answers }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toMatch(/3/);
    expect(table).toHaveLength(0);
  });

  it('測評月齡在窗口外 → 400 AGE_OUT_OF_WINDOW，零筆', async () => {
    // sxk-lang 的窗口是 12–72
    const resp = await client.postJson(POST, { ...LANG_BODY, assessedAgeMonth: 80 }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.code).toBe('AGE_OUT_OF_WINDOW');
    expect(body.windowMonths).toEqual({ lo: 12, hi: 72 });
    expect(table).toHaveLength(0);
  });

  it('答案裡有這次沒出的題 → 400 ANSWERS_UNEXPECTED，零筆', async () => {
    const resp = await client.postJson(POST, { ...LANG_BODY, answers: { ...LANG_BODY.answers, 'ZZ.9': 2 } }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('ANSWERS_UNEXPECTED');
    expect(table).toHaveLength(0);
  });

  it('值不在值域內 → 400 ANSWERS_INVALID，零筆', async () => {
    const resp = await client.postJson(POST, { ...LANG_BODY, answers: { ...LANG_BODY.answers, 'RC.1': 7 } }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('ANSWERS_INVALID');
    expect(table).toHaveLength(0);
  });

  it.each([
    ['工具不認得', { ...LANG_BODY, toolId: 'sxk-nope' }, 'TOOL_UNKNOWN'],
    ['填表人是治療師', { ...LANG_BODY, rater: 'therapist' }, 'RATER_INVALID'],
    ['月齡不是整數', { ...LANG_BODY, assessedAgeMonth: '48' }, 'AGE_INVALID'],
    ['answers 缺', { ...LANG_BODY, answers: undefined }, 'ANSWERS_INVALID'],
  ])('%s → 400 %s，零筆', async (_label, body, code) => {
    const resp = await client.postJson(POST, body, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe(code);
    expect(table).toHaveLength(0);
  });

  it('同一支交兩次 → 兩筆，都在', async () => {
    expect((await client.postJson(POST, LANG_BODY, bearer(UNLOCKED))).status).toBe(201);
    expect((await client.postJson(POST, { ...LANG_BODY, answers: full('sxk-lang', 48, 2) }, bearer(UNLOCKED))).status).toBe(201);
    expect(table).toHaveLength(2);
    expect(table.map(r => r.record.result.overall.pct)).toEqual([72, 100]);
  });

  it('沒有孩子檔案 → 404 CHILD_REQUIRED，零筆', async () => {
    const resp = await client.postJson(POST, LANG_BODY, bearer(NO_CHILD));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('CHILD_REQUIRED');
    expect(table).toHaveLength(0);
  });

  it('無 t2 權益 → 403 LOCKED，零筆', async () => {
    const resp = await client.postJson(POST, LANG_BODY, bearer(LOCKED));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
    expect(table).toHaveLength(0);
  });

  it('未登入 → 401', async () => {
    const resp = await client.postJson(POST, LANG_BODY);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/t2/tool-results', () => {
  it('什麼都沒做 → 空清單', async () => {
    const resp = await client.get(POST, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ results: [] });
  });

  it('同一支交兩次 → GET 回較新那筆，附 band', async () => {
    await client.postJson(POST, LANG_BODY, bearer(UNLOCKED));
    await client.postJson(POST, { ...LANG_BODY, answers: full('sxk-lang', 48, 2) }, bearer(UNLOCKED));
    const body = await (await client.get(POST, bearer(UNLOCKED))).json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].id).toBe(2);
    expect(body.results[0].result.toolId).toBe('sxk-lang');
    expect(body.results[0].result.overall.pct).toBe(100);
    expect(body.results[0].bands).toEqual({ LANG: 'clear' });
  });

  it('附 bands：sxk-lang 達成率 72 → LANG watch；chexi → ATT null', async () => {
    await client.postJson(POST, LANG_BODY, bearer(UNLOCKED));
    await client.postJson(POST, { toolId: 'chexi', assessedAgeMonth: 48, rater: 'father', pre: {}, answers: full('chexi', 48, 5) }, bearer(UNLOCKED));
    const body = await (await client.get(POST, bearer(UNLOCKED))).json();
    const byTool = Object.fromEntries(body.results.map((r: any) => [r.result.toolId, r]));
    expect(byTool['sxk-lang'].bands).toEqual({ LANG: 'watch' });
    expect(byTool['chexi'].bands).toEqual({ ATT: null });
    expect(byTool['chexi'].result.rater).toBe('father');
    expect(byTool['chexi'].createdAt).toBeTruthy();
  });

  it('只回這位家長的', async () => {
    await client.postJson(POST, LANG_BODY, bearer(UNLOCKED));
    const other = await (await client.get(POST, bearer(NO_CHILD))).json();
    expect(other.results).toEqual([]);
  });

  it('無 t2 權益 → 403 LOCKED', async () => {
    const resp = await client.get(POST, bearer(LOCKED));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  it('未登入 → 401', async () => {
    expect((await client.get(POST)).status).toBe(401);
  });
});

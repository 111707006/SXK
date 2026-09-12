import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { askedItems } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { buildT2Findings } from '../src/t2/findings';
import { templateProse } from '../src/t2/report';
import { ALL_ENGINES_FAILED, templateEngineLabel } from '../src/t2/report';
import type { T2ReportProse } from '../src/t2/report';
import type { ChildSnapshot, ToolResultRecord } from '../src/db/t2ToolResults';
import type { FindingsInsert, FindingsRecord } from '../src/db/t2Findings';
import type { DimensionCode, T1Flag, T2Findings, ToolResult } from '../src/t2/types';

/**
 * `POST /api/t2/findings` 與 `GET /api/t2/findings/latest`（票 #59，規格 §9.1、§9.2、§6.4）。
 *
 * 【這裡在防什麼】
 * 1. **快照＝直接彙整的結果**：伺服器存下去的 `findings` 與拿同一批作答直接跑 `buildT2Findings`
 *    一模一樣。不一樣就代表端點在彙整之外自己多做了一件事，而報告層讀的是快照。
 * 2. **模型寫壞不能端給家長**：黑名單中一個字 → 整份丟、退模板（§6.4），而且 `ai_engine`
 *    記得出是哪一台寫壞的 —— 「家長為什麼拿到模板報告」只有這一栏答得出來。
 * 3. **三段全掛不是 500**：家長按了「生成」就該拿到一份報告。模板比較平，但它是一份報告。
 * 4. **星號沒做完照樣生得出來**（§10.2 第 5 項）：那個維度是 `partial`，不是擋住不給生。
 * 5. **寫下後不改**：`GET /latest` 只把最新那一列端出來，不拿今天的規則表重跑。
 *
 * 【模型怎麼替身】
 * 只替身 `coze-coding-dev-sdk` 的 `LLMClient`（三段備援的前兩段都走它）。第三段 DashScope
 * 在測試環境沒有金鑰（`test/setup/testEnv.ts` 清空），自己就會拒絕 —— 所以「前兩段丟例外」
 * 等於「三段全掛」，不必再替身一次 axios。
 *
 * 【「合格的模型輸出」哪來】
 * 用 `templateProse` 對同一份 findings 產一份。模板的產出過同一個驗證器（#55 釘住），
 * 所以它就是一份合格的模型輸出 —— 手抄一份 60–120 字的總覽只會在字數規則改動時變成假紅燈。
 */

const UNLOCKED = 1;
const LOCKED = 2;
const NO_T1 = 3;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
  [NO_T1]: { id: NO_T1, phone: '13800000003' },
};

const CHILD = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' };

/** §4.4／§11 的固定輸入：48 個月、LANG 紅、ATT 紅、SEN 黃。 */
const T1_SCORES = [
  { dimensionId: 'language', tierId: 'T1', status: 'delay' },
  { dimensionId: 'attention', tierId: 'T1', status: 'delay' },
  { dimensionId: 'sensory_processing', tierId: 'T1', status: 'borderline' },
];

const userData: Record<number, { child: any; completedScores: any[] }> = {
  [UNLOCKED]: { child: CHILD, completedScores: T1_SCORES },
  [LOCKED]: { child: CHILD, completedScores: T1_SCORES },
  [NO_T1]: { child: CHILD, completedScores: [] },
};

/** 替身的 t2_tool_results。 */
const toolTable: Array<{ userId: number; record: ToolResultRecord }> = [];
let nextToolId = 1;

/** 替身的 t2_findings。 */
const findingsTable: Array<{ userId: number; record: FindingsRecord }> = [];
let nextFindingsId = 1;

/** 這一輪模型要做什麼：回一份東西，或整個丟例外。 */
let llmBehaviour: { mode: 'answer'; content: string } | { mode: 'throw' } = { mode: 'throw' };
let llmCalls: Array<{ model: string; system: string; user: string }> = [];

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke(messages: Array<{ role: string; content: string }>, opts: { model: string }) {
      llmCalls.push({
        model: opts.model,
        system: messages.find(m => m.role === 'system')?.content ?? '',
        user: messages.find(m => m.role === 'user')?.content ?? '',
      });
      if (llmBehaviour.mode === 'throw') throw new Error('engine down');
      return { content: llmBehaviour.content };
    }
  },
}));

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
  getPool: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async (userId: number, childSnapshot: ChildSnapshot, result: ToolResult) => {
    const id = nextToolId++;
    toolTable.push({ userId, record: { id, createdAt: new Date().toISOString(), childSnapshot, result } });
    return id;
  },
  listToolResults: async (userId: number) => toolTable.filter(r => r.userId === userId).map(r => r.record),
}));

vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async (userId: number, input: FindingsInsert) => {
    const id = nextFindingsId++;
    findingsTable.push({ userId, record: { id, createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  latestFindings: async (userId: number) => {
    const mine = findingsTable.filter(r => r.userId === userId);
    return mine.length === 0 ? null : mine[mine.length - 1].record;
  },
}));

/** 活動庫：這支測試不測配對，空庫即可（每個維度「準備中」是 §7.4 寫好的行為）。 */
vi.mock('../src/db/t2Activities', () => ({
  listActivityLibrary: async () => [],
}));

/**
 * 生成報告會讀「前四週派過的活動編號」——報告提示裡的那幾支，必須與家長在同一頁底下看到的
 * 每週活動是同一組（#60 的端點用同一份扣分規則）。這支測試沒有歷史，回空陣列即可。
 */
vi.mock('../src/db/t2WeeklyPlans', () => ({
  insertWeeklyPlan: async () => 1,
  findWeeklyPlan: async () => null,
  recentWeeklyPlans: async () => [],
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  toolTable.length = 0;
  findingsTable.length = 0;
  nextToolId = 1;
  nextFindingsId = 1;
  llmCalls = [];
  llmBehaviour = { mode: 'throw' };
});

const POST = '/api/t2/findings';
const LATEST = '/api/t2/findings/latest';
const SUBMIT = '/api/t2/tool-results';

function full(toolId: string, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId as any, ageMonth)) out[a.key] = value;
  return out;
}

/** sxk-lang 48 個月：前 27 題「偶爾會」→ 總分 72%（判 watch）。 */
function lang72(): Record<string, AnswerValue> {
  const answers = full('sxk-lang', 48, 2);
  for (const key of Object.keys(answers).slice(0, 27)) answers[key] = 1;
  return answers;
}

async function submitLang(userId = UNLOCKED) {
  const resp = await client.postJson(
    SUBMIT,
    { toolId: 'sxk-lang', assessedAgeMonth: 48, rater: 'mother', pre: {}, answers: lang72() },
    bearer(userId),
  );
  expect(resp.status).toBe(201);
}

const FLAGS: Record<DimensionCode, T1Flag> = {
  COG: 0, LANG: 2, SOC: 0, EMO: 0, ATT: 2, MOT: 0, SEN: 1, ADL: 0, LEARN: 0,
};

/** 拿表裡的作答直接跑一次彙整，與伺服器存下去的比。 */
function expectedFindings(userId = UNLOCKED): T2Findings {
  const results = toolTable.filter(r => r.userId === userId).map(r => r.record.result);
  const assessed = results.length === 0 ? 48 : results[results.length - 1].assessedAgeMonth;
  return buildT2Findings({
    results,
    t1Flags: FLAGS,
    assessedAgeMonth: assessed,
    sex: 'boy',
    diagnosisDirection: null,
  });
}

/** 一份合格的模型輸出（檔頭）。 */
function validProse(findings: T2Findings): T2ReportProse {
  return templateProse({ findings, activities: { picks: [], preparing: [] }, goals: [], childName: '小明' });
}

function ignoreTime(findings: T2Findings): Omit<T2Findings, 'computedAt'> {
  const { computedAt: _drop, ...rest } = findings;
  return rest;
}

describe('POST /api/t2/findings', () => {
  it('做完一支 → 201；快照的 findings 與直接彙整的結果相同，prose 通過驗證器', async () => {
    await submitLang();
    llmBehaviour = { mode: 'answer', content: JSON.stringify(validProse(expectedFindings())) };

    const resp = await client.postJson(POST, {}, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    const body = await resp.json();

    expect(ignoreTime(body.findings)).toEqual(ignoreTime(expectedFindings()));
    expect(body.isAiGenerated).toBe(true);
    expect(body.aiEngine).toBe('qwen-3-5-plus-260215');
    expect(body.prose.perDimension.map((d: any) => d.dimensionId)).toEqual(
      validProse(expectedFindings()).perDimension.map(d => d.dimensionId),
    );

    // 表裡一筆，版本兩件跟著走（門檻改版後舊快照不重算的依據）
    expect(findingsTable).toHaveLength(1);
    expect(findingsTable[0].record.findings.rulesVersion).toBe(body.findings.rulesVersion);
    expect(findingsTable[0].record.findings.toolkitVersion).toBe(body.findings.toolkitVersion);
  });

  it('模型只被呼叫一次，拿到的是 §6 的提示（不是舊的單維度提示）', async () => {
    await submitLang();
    llmBehaviour = { mode: 'answer', content: JSON.stringify(validProse(expectedFindings())) };
    await client.postJson(POST, {}, bearer(UNLOCKED));

    expect(llmCalls).toHaveLength(1);
    expect(llmCalls[0].system).toContain('判定已经由规则引擎算好');
    expect(llmCalls[0].user).not.toContain('穿戴');
  });

  it('模型回傳含黑名單詞 → 快照用模板、is_ai_generated=false、ai_engine 記失敗來源', async () => {
    await submitLang();
    const dirty = validProse(expectedFindings());
    llmBehaviour = { mode: 'answer', content: JSON.stringify({ ...dirty, closing: `${dirty.closing}自闭症` }) };

    const resp = await client.postJson(POST, {}, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    const body = await resp.json();

    expect(body.isAiGenerated).toBe(false);
    expect(body.aiEngine).toBe(templateEngineLabel('qwen-3-5-plus-260215'));
    expect(body.prose.closing).not.toContain('自闭症');
    expect(findingsTable[0].record.isAiGenerated).toBe(false);
  });

  it('模型三段全掛 → 模板，不回 500', async () => {
    await submitLang();
    llmBehaviour = { mode: 'throw' };

    const resp = await client.postJson(POST, {}, bearer(UNLOCKED));
    expect(resp.status).toBe(201);
    const body = await resp.json();

    expect(body.isAiGenerated).toBe(false);
    expect(body.aiEngine).toBe(ALL_ENGINES_FAILED);
    expect(body.prose).not.toBeNull();
    expect(typeof body.prose.overview).toBe('string');
  });

  it('星號沒做完 → 仍 201，該維度 partial（§10.2 第 5 項）', async () => {
    // 一支都沒做：LANG 紅、ATT 紅 → partial；SEN 黃 → not_assessed
    llmBehaviour = { mode: 'throw' };
    const resp = await client.postJson(POST, {}, bearer(UNLOCKED));
    expect(resp.status).toBe(201);

    const byId = Object.fromEntries((await resp.json()).findings.dimensions.map((d: any) => [d.dimensionId, d.band]));
    expect(byId.LANG).toBe('partial');
    expect(byId.ATT).toBe('partial');
    expect(byId.SEN).toBe('not_assessed');
    // 塌成 clear 就是「沒做完」被讀成「沒事」
    expect(byId.COG).toBe('clear');
  });

  it('同一支 30 天內重做 → 快照含「距上次 N 天」', async () => {
    await submitLang();
    // 第二筆：把第一筆的時間往前推 4 天，模擬四天前做過一次
    const first = toolTable[0].record;
    toolTable[0].record = {
      ...first,
      result: { ...first.result, computedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
    };
    await submitLang();

    llmBehaviour = { mode: 'throw' };
    const body = await (await client.postJson(POST, {}, bearer(UNLOCKED))).json();
    expect(body.findings.redos).toEqual([{ toolId: 'sxk-lang', daysSinceLast: 4 }]);
  });

  it('同一支超過 30 天才重做 → 沒有這個欄位', async () => {
    await submitLang();
    const first = toolTable[0].record;
    toolTable[0].record = {
      ...first,
      result: { ...first.result, computedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() },
    };
    await submitLang();

    llmBehaviour = { mode: 'throw' };
    const body = await (await client.postJson(POST, {}, bearer(UNLOCKED))).json();
    expect('redos' in body.findings).toBe(false);
  });

  it('還沒做過篩查 → 404 T1_REQUIRED，零筆', async () => {
    const resp = await client.postJson(POST, {}, bearer(NO_T1));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('T1_REQUIRED');
    expect(findingsTable).toHaveLength(0);
  });

  it('無 t2 權益 → 403 LOCKED，零筆', async () => {
    const resp = await client.postJson(POST, {}, bearer(LOCKED));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
    expect(findingsTable).toHaveLength(0);
  });

  it('未登入 → 401', async () => {
    const resp = await client.postJson(POST, {});
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/t2/findings/latest', () => {
  it('沒有生成過 → 404', async () => {
    const resp = await client.get(LATEST, bearer(UNLOCKED));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('T2_FINDINGS_NONE');
  });

  it('生成兩次 → 回最新那一筆；舊的那一筆還在表裡（寫下後不改）', async () => {
    await submitLang();
    llmBehaviour = { mode: 'throw' };
    await client.postJson(POST, {}, bearer(UNLOCKED));
    llmBehaviour = { mode: 'answer', content: JSON.stringify(validProse(expectedFindings())) };
    const second = await (await client.postJson(POST, {}, bearer(UNLOCKED))).json();

    const body = await (await client.get(LATEST, bearer(UNLOCKED))).json();
    expect(body.id).toBe(second.id);
    expect(body.isAiGenerated).toBe(true);
    expect(findingsTable).toHaveLength(2);
    expect(findingsTable[0].record.isAiGenerated).toBe(false);
  });

  it('無 t2 權益 → 403；未登入 → 401', async () => {
    expect((await client.get(LATEST, bearer(LOCKED))).status).toBe(403);
    expect((await client.get(LATEST)).status).toBe(401);
  });
});

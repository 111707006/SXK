import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor } from '../src/t2/kitv3/score';
import { runRecommendation } from '../src/t2/recommend/parentPlan';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import type { ChildSnapshot } from '../src/db/t2ToolResults';
import type { ToolResultRecordV3 } from '../src/db/t2ToolResultsV3';
import type { FindingsInsert, FindingsRecord } from '../src/db/t2Findings';
import { ALL_ENGINES_FAILED, templateProseV3, validateProseV3 } from '../src/t2/report';
import type { T2FindingsV3 } from '../src/t2/findingsV3';

/**
 * `POST /api/t2/findings` 在 `T2_RECOMMEND_V3=1` 時存完整版的快照（題庫規格 §5.2）。
 * 防的是：判定沒照完整版的作答、「推了哪些」沒存（或存成排除做過的那一份）。
 * 報告文字（2026-10-08 起）：模型照 T1 報告同一串引擎寫，過了驗證器才存；模型掛了或寫壞，存模板、不 500。
 * 模型只替身 `coze-coding-dev-sdk`（前兩段），第三段 DashScope 在測試環境沒有金鑰，自己會拒絕。
 */

const PARENT = 1;
const users: Record<number, { id: number; phone: string }> = { [PARENT]: { id: PARENT, phone: '13800000001' } };

const DIMS = ['language', 'attention', 'sensory_processing', 'cognitive', 'social_emotional', 'emotion_behavior', 'gross_motor', 'self_care', 'learning_ability'];
const SCORES = DIMS.map(d => ({ dimensionId: d, dimensionName: d, tierId: 'T1', score: d === 'attention' ? 2 : 8, maxScore: 8, status: d === 'attention' ? 'delay' : 'normal', completedAt: '2026-10-01T00:00:00Z', assessedAgeMonth: 96 }));
const CHILD = { name: '小明', birthDate: '2018-10-07', ageMonth: 96, gender: 'boy', inSchool: true };

const v3Table: Array<{ userId: number; record: ToolResultRecordV3 }> = [];
const findingsTable: Array<{ userId: number; record: FindingsRecord }> = [];
let nextId = 1;
const llmCalls: Array<{ system: string; user: string }> = [];
/** 模型怎麼回：丟例外，或回一段字（拿到 findings 再決定內容）。 */
let llmAnswer: ((user: string) => string) | null = null;

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke(messages: Array<{ role: string; content: string }>) {
      const user = messages.find(m => m.role === 'user')?.content ?? '';
      llmCalls.push({ system: messages.find(m => m.role === 'system')?.content ?? '', user });
      if (!llmAnswer) throw new Error('engine down');
      return { content: llmAnswer(user) };
    }
  },
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (id === PARENT ? { user_id: id, child: CHILD, completedScores: SCORES } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({ insertToolResult: async () => 1, listToolResults: async () => [] }));

vi.mock('../src/db/t2ToolResultsV3', () => ({
  insertToolResultV3: async (userId: number, childSnapshot: ChildSnapshot, result: ToolResultV3) => {
    const id = nextId++;
    v3Table.push({ userId, record: { id, createdAt: new Date().toISOString(), childSnapshot, result } });
    return id;
  },
  listToolResultsV3: async (userId: number) => v3Table.filter(r => r.userId === userId).map(r => r.record),
}));

vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async (userId: number, input: FindingsInsert) => {
    const id = nextId++;
    findingsTable.push({ userId, record: { id, createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  latestFindings: async (userId: number) => findingsTable.filter(r => r.userId === userId).at(-1)?.record ?? null,
}));

let client: TestClient;

beforeAll(async () => {
  process.env.T2_RECOMMEND_V3 = '1';
  process.env.TRAINING_PUSH_V3 = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
  await client.close();
});

beforeEach(() => {
  v3Table.length = 0;
  findingsTable.length = 0;
  llmCalls.length = 0;
  llmAnswer = null;
  nextId = 1;
});

/** 每題答那一段選項組最後一個非 null 的值（關切率族＝最重）。 */
function worst(toolId: string, ageM: number): Record<string, number | null> {
  const bank = KITV3_BANKS[toolId];
  const form = formFor(bank, ageM);
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM, inSchool: true })) {
    const opts = bank.options[form.sections.find(s => s.key === a.section)!.options].filter(o => o.value !== null);
    out[a.item.key] = a.section === 'IMP' ? 0 : opts[opts.length - 1].value;
  }
  return out;
}

describe('POST /api/t2/findings（v3）', () => {
  it('還沒交卷：存一份完整版快照，T1 紅的注意力推了沒做 → partial；推了哪些照存；模型全掛 → 存模板', async () => {
    const resp = await client.postJson('/api/t2/findings', {}, bearer(PARENT));
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body.findings).toMatchObject({ version: 4, toolkitVersion: 'kit-20260923', child: { assessedAgeMonth: 96, sex: 'boy' } });
    const run = runRecommendation({ child: CHILD, t1Scores: SCORES, liveAgeMonth: 96, doneCodes: [] });
    expect(body.findings.recommended).toEqual(run.full.tools.map(t => t.code));
    expect(body.findings.dimensions.find((d: any) => d.dimensionId === 'ATT').band).toBe('partial');
    expect(llmCalls.length).toBeGreaterThan(0);
    expect(body.isAiGenerated).toBe(false);
    expect(body.aiEngine).toBe(ALL_ENGINES_FAILED);
    expect(body.prose).toEqual(templateProseV3({ findings: body.findings, childName: '小明' }));
    expect(validateProseV3(body.prose, { findings: body.findings }).ok).toBe(true);
  });

  it('交了 AB（全「总是」）→ 注意力 refer；推了哪些仍是不排除做過的那一份（R-30）', async () => {
    const sub = await client.postJson('/api/t2/tool-results', { toolkitVersion: 'kit-20260923', toolId: 'SXK-AB', assessedAgeMonth: 96, rater: 'mother', answers: worst('SXK-AB', 96) }, bearer(PARENT));
    expect(sub.status).toBe(201);
    const body = await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json();
    expect(body.findings.dimensions.find((d: any) => d.dimensionId === 'ATT')).toMatchObject({ band: 'refer', grade03: 3, drivenBy: 'SXK-AB' });
    const run = runRecommendation({ child: CHILD, t1Scores: SCORES, liveAgeMonth: 96, doneCodes: [] });
    expect(body.findings.recommended).toEqual(run.full.tools.map(t => t.code));
    const latest = await (await client.get('/api/t2/findings/latest', bearer(PARENT))).json();
    expect(latest.findings).toEqual(body.findings);
  });
});

describe('POST /api/t2/findings（v3）的報告文字', () => {
  /** 先生成一次拿到這份 findings，再讓模型照它回答（findings 由伺服器算，同一份資料兩次一樣）。 */
  async function findingsNow(): Promise<T2FindingsV3> {
    await client.postJson('/api/t2/tool-results', { toolkitVersion: 'kit-20260923', toolId: 'SXK-AB', assessedAgeMonth: 96, rater: 'mother', answers: worst('SXK-AB', 96) }, bearer(PARENT));
    return (await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json()).findings;
  }

  it('模型寫得合格：存模型的那一份，標成 AI 生成、記下引擎；提示裡沒有量表名稱', async () => {
    const findings = await findingsNow();
    const good = { ...templateProseV3({ findings }), overview: '这次整理下来，注意力这一项最需要优先安排，其他几项可以照日常的节奏继续观察和陪伴。' };
    llmAnswer = () => JSON.stringify(good);
    llmCalls.length = 0;
    const body = await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json();
    expect(body.isAiGenerated).toBe(true);
    expect(body.aiEngine).not.toMatch(/^template/);
    expect(body.prose).toEqual(good);
    expect(llmCalls[0].user).not.toContain('注意力及行为观察量表');
    expect(llmCalls[0].user).toContain('ATT');
  });

  it('模型寫壞（寫出量表名稱裡的禁字）：整份丟、存模板，記下是哪一台寫壞的', async () => {
    const findings = await findingsNow();
    const bad = { ...templateProseV3({ findings }), overview: '这次参考了自闭行为量表与注意力问卷，注意力这一项最需要优先安排，其他几项照常观察。' };
    llmAnswer = () => JSON.stringify(bad);
    const body = await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json();
    expect(body.isAiGenerated).toBe(false);
    expect(body.aiEngine).toMatch(/^template:/);
    expect(body.aiEngine).not.toBe(ALL_ENGINES_FAILED);
    expect(body.prose).toEqual(templateProseV3({ findings: body.findings, childName: '小明' }));
  });
});

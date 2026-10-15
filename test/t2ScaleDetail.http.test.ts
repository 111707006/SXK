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
 * 量表详解（規格 `t2-v3-scale-detail-report.md` §6、票 D-6）：開了 `T2_SCALE_DETAIL`，生成完整版報告時每支量表存一份详解。
 * 以下照 `t2FindingsV3.http.test.ts` 的替身（同一套資料層）。
 *
 * 原檔的說明：`POST /api/t2/findings` 在 `T2_RECOMMEND_V3=1` 時存完整版的快照（題庫規格 §5.2）。
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
  process.env.T2_SCALE_DETAIL = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
  process.env.T2_SCALE_DETAIL = '';
  await client.close();
});

beforeEach(() => {
  v3Table.length = 0;
  findingsTable.length = 0;
  llmCalls.length = 0;
  llmAnswer = null;
  nextId = 1;
});


function answersFor(toolId: string, ageM: number, value: (vals: number[], section: string) => number): Record<string, number | null> {
  const bank = KITV3_BANKS[toolId];
  const form = formFor(bank, ageM);
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM, inSchool: true })) {
    const vals = bank.options[form.sections.find(s => s.key === a.section)!.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    out[a.item.key] = value(vals, a.section);
  }
  return out;
}

describe('POST /api/t2/findings（v3）＋ T2_SCALE_DETAIL', () => {
  it('交了 AB 兩次：快照存這一次的详解，`previous` 是上一次各面向的題數', async () => {
    const first = answersFor('SXK-AB', 96, (vals, section) => (section === 'IMP' ? 0 : Math.max(...vals)));
    const second = answersFor('SXK-AB', 96, (vals, section) => (section === 'IMP' ? 0 : section === 'SU' ? Math.max(...vals) : Math.min(...vals)));
    for (const answers of [first, second]) {
      const sub = await client.postJson('/api/t2/tool-results', { toolkitVersion: 'kit-20260923', toolId: 'SXK-AB', assessedAgeMonth: 96, rater: 'mother', answers }, bearer(PARENT));
      expect(sub.status).toBe(201);
      await new Promise(r => setTimeout(r, 5));
    }
    const body = await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json();
    const entries: NonNullable<T2FindingsV3['scaleDetails']> = body.findings.scaleDetails;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ toolId: 'SXK-AB', detail: { code: 'SXK-AB', version: 1, mode: 'frequent' } });
    expect(entries[0].detail.focus[0].key).toBe('SU');
    const prevSU = entries[0].previous!.facets.find(f => f.key === 'SU')!;
    const nowSU = entries[0].detail.facets.find(f => f.key === 'SU')!;
    expect(prevSU.counts[2]).toBe(nowSU.counts[2]);
    expect(entries[0].previous!.facets.find(f => f.key === 'DI')!.counts[2]).toBeGreaterThan(0);
    expect(entries[0].detail.facets.find(f => f.key === 'DI')!.counts[2]).toBe(0);
    // 讀回來照存的樣子
    const latest = await (await client.get('/api/t2/findings/latest', bearer(PARENT))).json();
    expect(latest.findings.scaleDetails).toEqual(entries);
  });

  it('還沒交卷：量表详解是空的陣列', async () => {
    const body = await (await client.postJson('/api/t2/findings', {}, bearer(PARENT))).json();
    expect(body.findings.scaleDetails).toEqual([]);
  });
});

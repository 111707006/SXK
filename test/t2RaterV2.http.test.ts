import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { askedItems as askedLegacy } from '../src/t2/scoring';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems as askedV3, formFor } from '../src/t2/kitv3/score';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import type { ToolResult } from '../src/t2/types';
import type { ChildSnapshot, ToolResultRecord } from '../src/db/t2ToolResults';
import type { ToolResultRecordV3 } from '../src/db/t2ToolResultsV3';
import type { FindingsInsert, FindingsRecord } from '../src/db/t2Findings';

/**
 * T2 填表人 v2（客戶 10/17 第 5 項，#70，規格 `docs/specs/client-changes-2026-10-17.md` §6）：`T2_RATER_V2=1` 時
 * `POST /api/t2/tool-results` 的兩條路（9/08 題庫與完整版）都不收新的「老师」、「其他」可帶選填說明 `raterNote`
 * （最多 10 字、去頭尾空白、空的就是沒有）；`GET /api/t2/plan` 帶 `raterV2: true` 讓畫面知道要拿掉「老师」。
 * 開關關著的那一半在 `t2ToolResults.http.test.ts`／`t2ToolResultsV3.http.test.ts`（照舊、一字不差）。
 */

const PARENT = 1;
const users: Record<number, { id: number; phone: string }> = { [PARENT]: { id: PARENT, phone: '13800000001' } };

const t1 = (dimensionId: string, score: number) => ({
  dimensionId, dimensionName: dimensionId, tierId: 'T1', score, maxScore: 8, status: score >= 7 ? 'normal' : 'delay', completedAt: '2026-10-01T00:00:00Z', assessedAgeMonth: 48,
});
const DIMS = ['language', 'attention', 'sensory_processing', 'cognitive', 'social_emotional', 'emotion_behavior', 'gross_motor', 'self_care', 'learning_ability'];
const CHILD = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy', inSchool: true };
const userData: Record<number, { child: any; completedScores: any[] }> = {
  [PARENT]: { child: CHILD, completedScores: DIMS.map(d => t1(d, d === 'language' ? 2 : 8)) },
};

const oldTable: ToolResultRecord[] = [];
const findingsTable: FindingsRecord[] = [];
const v3Table: ToolResultRecordV3[] = [];
let nextId = 1;

// 報告文字：模型掛掉 → 存模板（這裡只看快照，不看文字）
vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke() {
      throw new Error('engine down');
    }
  },
}));

vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async (_userId: number, input: FindingsInsert) => {
    const id = nextId++;
    findingsTable.push({ id, createdAt: new Date().toISOString(), ...input });
    return id;
  },
  latestFindings: async () => findingsTable.at(-1) ?? null,
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async (_userId: number, childSnapshot: ChildSnapshot, result: ToolResult) => {
    const id = nextId++;
    oldTable.push({ id, createdAt: new Date().toISOString(), childSnapshot, result });
    return id;
  },
  listToolResults: async () => [...oldTable],
}));

vi.mock('../src/db/t2ToolResultsV3', () => ({
  insertToolResultV3: async (_userId: number, childSnapshot: ChildSnapshot, result: ToolResultV3) => {
    const id = nextId++;
    v3Table.push({ id, createdAt: new Date().toISOString(), childSnapshot, result });
    return id;
  },
  listToolResultsV3: async () => [...v3Table],
}));

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前（server.ts 載入時讀開關）
  process.env.T2_RATER_V2 = '1';
  process.env.T2_RECOMMEND_V3 = '1';
  process.env.TRAINING_PUSH_V3 = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  process.env.T2_RATER_V2 = '';
  process.env.T2_RECOMMEND_V3 = '';
  process.env.TRAINING_PUSH_V3 = '';
  await client.close();
});

beforeEach(() => {
  oldTable.length = 0;
  v3Table.length = 0;
  findingsTable.length = 0;
  nextId = 1;
});

const POST = '/api/t2/tool-results';

function legacyBody(extra: Record<string, unknown> = {}) {
  const answers: Record<string, number> = {};
  for (const a of askedLegacy('sxk-lang', 48)) answers[a.key] = 2;
  return { toolId: 'sxk-lang', assessedAgeMonth: 48, rater: 'mother', pre: {}, answers, ...extra };
}

function v3Body(extra: Record<string, unknown> = {}) {
  const bank = KITV3_BANKS['SXK-GM'];
  const form = formFor(bank, 48);
  const answers: Record<string, number | null> = {};
  for (const a of askedV3(bank, { ageM: 48, inSchool: true })) {
    answers[a.item.key] = bank.options[form.sections.find(s => s.key === a.section)!.options][0].value;
  }
  return { toolkitVersion: 'kit-20260923', toolId: 'SXK-GM', assessedAgeMonth: 48, rater: 'mother', answers, ...extra };
}

const PATHS = [
  { name: '9/08 題庫', body: legacyBody, stored: () => oldTable.map(r => r.result as ToolResult & { raterNote?: string }) },
  { name: '完整版', body: v3Body, stored: () => v3Table.map(r => r.result as ToolResultV3 & { raterNote?: string }) },
] as const;

for (const path of PATHS) {
  describe(`POST /api/t2/tool-results（${path.name}，T2_RATER_V2=1）`, () => {
    it('新送的「老师」→ 400 RATER_INVALID，不落表', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'teacher' }), bearer(PARENT));
      expect(resp.status).toBe(400);
      expect((await resp.json()).code).toBe('RATER_INVALID');
      expect(path.stored()).toHaveLength(0);
    });

    it('「其他」不填說明 → 201，存的沒有說明', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'other' }), bearer(PARENT));
      expect(resp.status).toBe(201);
      expect(path.stored()).toHaveLength(1);
      expect(path.stored()[0].rater).toBe('other');
      expect(path.stored()[0].raterNote).toBeUndefined();
    });

    it('「其他」帶說明 → 去頭尾空白後存下，回應裡也有', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'other', raterNote: '  阿姨 ' }), bearer(PARENT));
      expect(resp.status).toBe(201);
      expect((await resp.json()).result.raterNote).toBe('阿姨');
      expect(path.stored()[0].raterNote).toBe('阿姨');
    });

    it('說明只有空白 ＝ 沒填', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'other', raterNote: '   ' }), bearer(PARENT));
      expect(resp.status).toBe(201);
      expect(path.stored()[0].raterNote).toBeUndefined();
    });

    it('剛好 10 字可以；11 字 → 400 RATER_NOTE_INVALID，不落表', async () => {
      expect((await client.postJson(POST, path.body({ rater: 'other', raterNote: '一二三四五六七八九十' }), bearer(PARENT))).status).toBe(201);
      const resp = await client.postJson(POST, path.body({ rater: 'other', raterNote: '一二三四五六七八九十一' }), bearer(PARENT));
      expect(resp.status).toBe(400);
      expect((await resp.json()).code).toBe('RATER_NOTE_INVALID');
      expect(path.stored()).toHaveLength(1);
    });

    it('字數照字算、不照 UTF-16 單位：10 個 emoji 可以', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'other', raterNote: '😀'.repeat(10) }), bearer(PARENT));
      expect(resp.status).toBe(201);
    });

    it('不是「其他」卻帶說明 → 400 RATER_NOTE_INVALID，不落表', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'mother', raterNote: '阿姨' }), bearer(PARENT));
      expect(resp.status).toBe(400);
      expect((await resp.json()).code).toBe('RATER_NOTE_INVALID');
      expect(path.stored()).toHaveLength(0);
    });

    it('說明不是字串 → 400 RATER_NOTE_INVALID', async () => {
      const resp = await client.postJson(POST, path.body({ rater: 'other', raterNote: 7 }), bearer(PARENT));
      expect(resp.status).toBe(400);
      expect((await resp.json()).code).toBe('RATER_NOTE_INVALID');
    });
  });
}

describe('GET（T2_RATER_V2=1）', () => {
  it('舊的「老师」紀錄照樣讀得出（兩套）', async () => {
    const legacy = legacyBody({ rater: 'teacher' });
    // 開關打開以前交的卷：直接放進表裡
    const { scoreTool } = await import('../src/t2/scoring');
    const scored = scoreTool({ ...legacy, rater: 'teacher' } as any);
    if (!scored.ok) throw new Error('fixture');
    oldTable.push({ id: 99, createdAt: new Date().toISOString(), childSnapshot: null, result: scored.result });
    const resp = await client.get(POST, bearer(PARENT));
    expect(resp.status).toBe(200);
    const got = await resp.json();
    expect(got.results.map((r: any) => r.result.rater)).toEqual(['teacher']);
  });

  it('/api/t2/plan 帶 raterV2: true（畫面據此拿掉「老师」、出說明輸入框）', async () => {
    const resp = await client.get('/api/t2/plan', bearer(PARENT));
    expect(resp.status).toBe(200);
    expect((await resp.json()).raterV2).toBe(true);
  });
});

describe('報告快照（T2_RATER_V2=1）', () => {
  it('生成的快照帶 raterV2: true，作答結果帶著說明（報告作答回顧據此寫「填表人：其他（阿姨）」）', async () => {
    expect((await client.postJson(POST, v3Body({ rater: 'other', raterNote: '阿姨' }), bearer(PARENT))).status).toBe(201);
    const resp = await client.postJson('/api/t2/findings', {}, bearer(PARENT));
    expect(resp.status).toBe(201);
    expect(findingsTable).toHaveLength(1);
    const findings = findingsTable[0].findings as any;
    expect(findings.raterV2).toBe(true);
    expect(findings.toolResults.map((r: any) => [r.rater, r.raterNote])).toEqual([['other', '阿姨']]);
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';
import { asModelOutput, t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { T1_REPORT_REAL_VERSION } from '../src/t1report/shape';

/**
 * `T1_REPORT_REAL=1`（專案 A）：`/api/report` 走新版。
 *
 * 引擎替身：SDK 的 `invoke` 回 `nextReply`（`null` ＝ 丟錯）。豆包與 Qwen SDK 同一個替身，所以第一段
 * 回什麼就是什麼；`null` 時 SDK 兩段都丟錯，DashScope 與 Gemini 沒有金鑰（`test/setup/testEnv.ts`）也丟錯
 * → 全部失敗。單獨一個檔案：`server.ts` 在 import 當下把環境變數讀成常數。
 */

let nextReply: string | null = null;
const prompts: Array<Array<{ role: string; content: string }>> = [];

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke(messages: Array<{ role: string; content: string }>) {
      prompts.push(messages);
      if (nextReply === null) throw new Error('test: LLM unavailable');
      return { content: nextReply };
    }
  },
}));

const CHILD = { name: '森森', ageMonth: 30, gender: 'boy' };
const SCORES = bandScores(30, (d, i) => (d === 'language' ? 0 : d === 'attention' && i === 0 ? 1 : 2));

let client: TestClient;

beforeAll(async () => {
  process.env.T1_REPORT_REAL = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.T1_REPORT_REAL = '';
});

beforeEach(() => {
  nextReply = null;
  prompts.length = 0;
});

describe('T1_REPORT_REAL=1（專案 A）', () => {
  it('模型回了合格的 JSON：用模型的，帶 version、沒有 criticalMetrics', async () => {
    const good = asModelOutput(templateT1Report(t1ReportInputOf(CHILD, SCORES)));
    good.summary = `森森这次做到了 31 项，语言沟通方面${'与同龄常见的发展节奏有差距'}，建议优先安排专业咨询。`;
    nextReply = JSON.stringify(good);
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.isAiGenerated).toBe(true);
    expect(data.report.version).toBe(T1_REPORT_REAL_VERSION);
    expect(data.report.summary).toBe(good.summary);
    expect(data.report).not.toHaveProperty('criticalMetrics');
    expect(data.report.perDimension.map((n: any) => n.dimensionId)).toEqual(['language', 'attention']);
  });

  it('提示帶著逐題作答，不再要指標與腦神經解析', async () => {
    await client.postJson('/api/report', { child: CHILD, scores: SCORES });
    const user = prompts[0].find(m => m.role === 'user')!.content;
    const system = prompts[0].find(m => m.role === 'system')!.content;
    expect(user).toContain('还不能');
    expect(user).toContain('作答合计：共 36 题');
    expect(system + user).not.toContain('criticalMetrics');
    expect(system).not.toContain('突触偶联');
  });

  it('模型寫了編出來的百分位：整份丟、退模板，aiEngine 記是哪一台寫壞的', async () => {
    const bad = asModelOutput(templateT1Report(t1ReportInputOf(CHILD, SCORES)));
    bad.summary = '森森整体居同龄前 30%，语言沟通方面与同龄常见的发展节奏有差距，建议优先安排专业咨询。';
    nextReply = JSON.stringify(bad);
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.isAiGenerated).toBe(false);
    expect(data.aiEngine).toMatch(/^template:/);
    expect(data.report).toEqual(templateT1Report(t1ReportInputOf(CHILD, SCORES)));
  });

  it('引擎全掛：模板，aiEngine 是 template:all_engines_failed', async () => {
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.isAiGenerated).toBe(false);
    expect(data.aiEngine).toBe('template:all_engines_failed');
    expect(data.report.version).toBe(T1_REPORT_REAL_VERSION);
    expect(data.report.summary).toContain('语言沟通');
  });

  it('壞的成績不讓端點炸掉（舊資料、缺欄位）', async () => {
    const resp = await client.postJson('/api/report', { child: { name: 1 }, scores: [null, { dimensionId: 'x' }, 'y'] });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.report.version).toBe(T1_REPORT_REAL_VERSION);
  });

  it('沒有成績陣列照舊 400', async () => {
    const resp = await client.postJson('/api/report', { child: CHILD });
    expect(resp.status).toBe(400);
  });
});

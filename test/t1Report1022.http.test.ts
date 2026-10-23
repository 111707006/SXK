import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';
import { asModelOutput, t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { T1_REPORT_REAL_VERSION } from '../src/t1report/shape';

/**
 * `T1_REPORT_REAL=1` ＋ `T1_REPORT_1022=1`（專案 A，#81）：`/api/report` 用客戶 10/22 的新寫法。
 * 引擎替身同 `t1ReportReal.http.test.ts`（`nextReply` 為 `null` ＝ 全部引擎失敗）。單獨一個檔案：開關在 import 當下讀。
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
const W = { writing: '1022' } as const;

let client: TestClient;

beforeAll(async () => {
  process.env.T1_REPORT_REAL = '1';
  process.env.T1_REPORT_1022 = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.T1_REPORT_REAL = '';
  process.env.T1_REPORT_1022 = '';
});

beforeEach(() => {
  nextReply = null;
  prompts.length = 0;
});

describe('T1_REPORT_1022=1（專案 A）', () => {
  it('引擎全掛：新寫法的模板（三句結論、「这次看到的是：」）', async () => {
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.aiEngine).toBe('template:all_engines_failed');
    expect(data.report.version).toBe(T1_REPORT_REAL_VERSION);
    expect(data.report).toEqual(templateT1Report(t1ReportInputOf(CHILD, SCORES), W));
    expect(data.report.perDimension[0].note.startsWith('这次看到的是：')).toBe(true);
    expect(data.report.summary).toContain('T2 深度评估');
  });

  it('提示是新寫法：三句、不給題數合計', async () => {
    await client.postJson('/api/report', { child: CHILD, scores: SCORES });
    const system = prompts[0].find(m => m.role === 'system')!.content;
    const user = prompts[0].find(m => m.role === 'user')!.content;
    expect(system).toContain('这次看到的是：');
    expect(user).not.toContain('作答合计');
  });

  it('模型寫了統計句：退新寫法的模板', async () => {
    const bad = asModelOutput(templateT1Report(t1ReportInputOf(CHILD, SCORES), W)) as any;
    bad.perDimension[0].note = '这次看到的是：这一项 4 题里，还不能 4 题。可以这样练：每天陪孩子面对面说话。';
    nextReply = JSON.stringify(bad);
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.isAiGenerated).toBe(false);
    expect(data.aiEngine).toMatch(/^template:/);
    expect(data.report).toEqual(templateT1Report(t1ReportInputOf(CHILD, SCORES), W));
  });

  it('模型照新寫法：用模型的', async () => {
    const good = asModelOutput(templateT1Report(t1ReportInputOf(CHILD, SCORES), W)) as any;
    good.perDimension[0].note = '这次看到的是：说话还多是单个词，家人以外的人不太听得懂。可以这样练：每天找 10 到 15 分钟面对面陪孩子说话、共读。';
    nextReply = JSON.stringify(good);
    const data = await (await client.postJson('/api/report', { child: CHILD, scores: SCORES })).json();
    expect(data.isAiGenerated).toBe(true);
    expect(data.report.perDimension[0].note).toBe(good.perDimension[0].note);
  });
});

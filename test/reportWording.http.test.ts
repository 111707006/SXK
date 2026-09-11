import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { findBannedWords } from './helpers/parentWording';

/**
 * `/api/report` 的用字（客戶 2026-09-11《家长报告用语对照表》）。
 *
 * 報告裡最顯眼的兩段字 ——「首席专家建议」與「后续发展预判」—— 不是寫在畫面上的，
 * 是模型產生的。所以結構測試（`parentWording.structure.test.ts`）讀原始碼擋得住
 * 元件，擋不住這兩段。這裡驗的是兩件事：
 *
 *   1. **送給模型的提示詞**帶著用字規範。模型被告知自己是「首席临床医学主任医生」，
 *      不加規範它就會寫「诊断／迟缓／障碍／风险」—— 那正是表上禁止的字。
 *      提示詞經由 `coze-coding-dev-sdk` 送出，以替身把它原樣記下來，
 *      「伺服器到底叫模型怎麼寫」因此成為斷言得到的事實。
 *   2. **四個引擎都失敗時的備用模板**一個禁字都沒有。備用路徑只在 AI 掛掉時才
 *      出現，是最容易漏的一處 —— 2026-09-11 之前它寫的是「发育滞后」「边缘警告」
 *      「防止迟缓转化」。
 *
 * 引擎替身：SDK 的 `invoke` 記下訊息後直接丟錯；DashScope 與 Gemini 的金鑰在
 * `test/setup/testEnv.ts` 已清空，各自在呼叫前就丟錯。四個都失敗 → 備用模板。
 */

const recordedPrompts: Array<{ role: string; content: string }[]> = [];

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke(messages: Array<{ role: string; content: string }>) {
      recordedPrompts.push(messages);
      throw new Error('test: LLM unavailable');
    }
  },
}));

let client: TestClient;

/** 一份紅、黃、綠都有的篩查結果 —— 備用模板的三個分支才會走到「有紅燈」那一條。 */
const MIXED_SCORES = [
  { dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T1', score: 3, maxScore: 8, status: 'delay', scaleName: 'T1' },
  { dimensionId: 'gross_motor', dimensionName: '动作发展', tierId: 'T1', score: 5, maxScore: 8, status: 'borderline', scaleName: 'T1' },
  { dimensionId: 'cognitive', dimensionName: '认知', tierId: 'T1', score: 8, maxScore: 8, status: 'normal', scaleName: 'T1' },
];

const CHILD = { name: '森森', ageMonth: 42, gender: 'boy' };

function textFieldsOf(report: any): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const key of ['summary', 'neuralPathwayAnalysis', 'prognosisPrediction']) {
    out.push([key, String(report[key])]);
  }
  for (const key of ['rehabSuggestions', 'homeGuidance']) {
    (report[key] as string[]).forEach((s, i) => out.push([`${key}[${i}]`, s]));
  }
  return out;
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  recordedPrompts.length = 0;
});

afterAll(async () => {
  await client.close();
});

describe('送給模型的提示詞', () => {
  it('帶著用字規範，而且不再叫模型「精确诊断」', async () => {
    const resp = await client.postJson('/api/report', { child: CHILD, scores: MIXED_SCORES });
    expect(resp.status).toBe(200);

    expect(recordedPrompts.length).toBeGreaterThan(0);
    const userPrompt = recordedPrompts[0].find(m => m.role === 'user')!.content;
    expect(userPrompt).toContain('用词规范（家长会直接阅读本报告，请严格遵守）');
    expect(userPrompt).toContain('本报告是发展筛查，不是诊断');
    expect(userPrompt).not.toContain('精确诊断');
    // JSON 欄位說明也是指令的一部分 —— 叫模型「剖析患儿」它就會寫「患儿」。
    expect(userPrompt).not.toMatch(/剖析患儿/);
  });
});

describe('備用模板（四個引擎都失敗）', () => {
  it('紅黃綠混合：每一段文字都沒有禁字，而且說得出哪個維度該優先諮詢', async () => {
    const resp = await client.postJson('/api/report', { child: CHILD, scores: MIXED_SCORES });
    const data = await resp.json();
    expect(data.isAiGenerated).toBe(false);

    for (const [field, text] of textFieldsOf(data.report)) {
      const hits = findBannedWords(text);
      expect(hits, `${field}: ${text}\n${hits.join('\n')}`).toEqual([]);
    }
    expect(data.report.summary).toContain('语言沟通');
    expect(data.report.summary).toContain('建议优先安排专业咨询');
  });

  it('只有黃燈：沒有禁字', async () => {
    const scores = MIXED_SCORES.filter(s => s.status !== 'delay');
    const data = await (await client.postJson('/api/report', { child: CHILD, scores })).json();
    expect(data.isAiGenerated).toBe(false);
    for (const [field, text] of textFieldsOf(data.report)) {
      expect(findBannedWords(text), `${field}: ${text}`).toEqual([]);
    }
    expect(data.report.summary).toContain('建议进一步了解');
  });

  it('全綠：說的是「可作为日后对照的基线记录」，不讓家長覺得白做一場', async () => {
    const scores = MIXED_SCORES.filter(s => s.status === 'normal');
    const data = await (await client.postJson('/api/report', { child: CHILD, scores })).json();
    expect(data.isAiGenerated).toBe(false);
    for (const [field, text] of textFieldsOf(data.report)) {
      expect(findBannedWords(text), `${field}: ${text}`).toEqual([]);
    }
    expect(data.report.summary).toContain('可作为日后对照的基线记录');
  });
});

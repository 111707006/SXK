import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';

/**
 * 專案 B 設了 `T1_REPORT_REAL=1`、`T1_REPORT_1022=1`：走 10/22 新寫法（使用者 2026-11-19 開給 B），
 * 但結論第三句指「约专家一对一说明」，不提 T2（B 沒有 T2）。
 */

process.env.APP_MODE = 't1only';

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke() {
      throw new Error('test: LLM unavailable');
    }
  },
}));

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
  process.env.APP_MODE = '';
});

describe('專案 B：T1_REPORT_1022 開著走新寫法、下一步是約專家', () => {
  it('新寫法的模板：「这次看到的是」、結論第三句約專家、沒有 T2', async () => {
    const scores = bandScores(30, d => (d === 'language' ? 0 : 2));
    const data = await (await client.postJson('/api/report', { child: { name: '森森', ageMonth: 30, gender: 'boy' }, scores })).json();
    expect(data.report.version).toBe('t1-real-1');
    const text = JSON.stringify(data.report);
    expect(text).toContain('这次看到的是');
    expect(data.report.summary).toContain('约专家一对一说明');
    expect(text).not.toMatch(/T2|深度评估/);
  });
});

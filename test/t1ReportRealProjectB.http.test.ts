import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';

/**
 * 專案 B 設了 `T1_REPORT_REAL=1` 也走新版報告（使用者 2026-11-19 把新版報告開給 B；
 * 2026-10-08 起原本是「B 一個字都不變」）。快照帶 `version`、沒有四個儀表數字。
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
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.T1_REPORT_REAL = '';
  process.env.APP_MODE = '';
});

describe('專案 B：T1_REPORT_REAL 開著走新版報告', () => {
  it('模型全掛 → 新版模板（有 version、沒有 criticalMetrics），不提 T2', async () => {
    const scores = bandScores(30, d => (d === 'language' ? 0 : 2));
    const data = await (await client.postJson('/api/report', { child: { name: '森森', ageMonth: 30, gender: 'boy' }, scores })).json();
    expect(data.isAiGenerated).toBe(false);
    expect(data.report.version).toBe('t1-real-1');
    expect(data.report.criticalMetrics).toBeUndefined();
    expect(JSON.stringify(data.report)).not.toMatch(/T2|深度评估/);
  });
});

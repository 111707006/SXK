import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';

/**
 * 專案 B 設了 `T1_REPORT_REAL=1` 也不生效：`/api/report` 照舊（四個儀表、沒有 version）。
 * 「B 的報告一個字都不變」是使用者 2026-10-08 的要求。
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

describe('專案 B：T1_REPORT_REAL 不生效', () => {
  it('備用模板還是舊的那一份（有 criticalMetrics、沒有 version）', async () => {
    const scores = bandScores(30, d => (d === 'language' ? 0 : 2));
    const data = await (await client.postJson('/api/report', { child: { name: '森森', ageMonth: 30, gender: 'boy' }, scores })).json();
    expect(data.isAiGenerated).toBe(false);
    expect(data.aiEngine).toBe('fallback_template');
    expect(data.report.version).toBeUndefined();
    expect(data.report.criticalMetrics).toBeTruthy();
  });
});

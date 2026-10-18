import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 報告版面的伺服器開關帶到前端（#71）：`GET /api/report-config` 回 `{noWeeklyPlan}`。
 * 開關 `T1_NO_WEEKLY_PLAN` 在模組層級就讀掉了，所以每一組先設環境變數、`resetModules` 再載一次 `server.ts`。
 * 公開、不需登入（掃碼頁與後台都要讀），A、B 都有。
 */

const ORIGINAL_MODE = process.env.APP_MODE;

afterAll(() => {
  process.env.T1_NO_WEEKLY_PLAN = '';
  if (ORIGINAL_MODE === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = ORIGINAL_MODE;
});

function withServer(env: { T1_NO_WEEKLY_PLAN?: string; APP_MODE?: string }, body: (c: () => TestClient) => void) {
  let client: TestClient;
  beforeAll(async () => {
    vi.resetModules();
    process.env.T1_NO_WEEKLY_PLAN = env.T1_NO_WEEKLY_PLAN ?? '';
    if (env.APP_MODE) process.env.APP_MODE = env.APP_MODE;
    else delete process.env.APP_MODE;
    client = await startTestApp(await loadApp());
  }, 60_000);
  afterAll(async () => { await client?.close(); });
  body(() => client);
}

describe('沒設（預設關）', () => {
  withServer({}, client => {
    it('回 noWeeklyPlan: false，不需登入', async () => {
      const res = await client().get('/api/report-config');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ noWeeklyPlan: false });
    });
  });
});

describe('T1_NO_WEEKLY_PLAN=1（專案 A）', () => {
  withServer({ T1_NO_WEEKLY_PLAN: '1' }, client => {
    it('回 noWeeklyPlan: true', async () => {
      expect(await (await client().get('/api/report-config')).json()).toEqual({ noWeeklyPlan: true });
    });
  });
});

describe('T1_NO_WEEKLY_PLAN=1（專案 B 也適用）', () => {
  withServer({ T1_NO_WEEKLY_PLAN: '1', APP_MODE: 't1only' }, client => {
    it('回 noWeeklyPlan: true', async () => {
      expect(await (await client().get('/api/report-config')).json()).toEqual({ noWeeklyPlan: true });
    });
  });
});

describe('認不得的值', () => {
  it('讓 server.ts 載入失敗（fail-closed，同其他開關）', async () => {
    vi.resetModules();
    process.env.T1_NO_WEEKLY_PLAN = 'yes';
    await expect(import('../server')).rejects.toThrow(/T1_NO_WEEKLY_PLAN is not recognised/);
  }, 60_000);
});

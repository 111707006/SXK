import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 沒有新首頁（規格 §5.1「專案 B 不動」）：設了 `HOME_V2=1` 那支端點也不存在（404），
 * 與 `/api/t2/plan` 同一招（掛在永遠不掛上去的 Router）。
 */

process.env.APP_MODE = 't1only';

let client: TestClient;

beforeAll(async () => {
  process.env.HOME_V2 = '1';
  client = await startTestApp(await loadApp());
}, 60_000);

afterAll(async () => {
  await client.close();
  process.env.HOME_V2 = '';
  process.env.APP_MODE = '';
});

describe('專案 B：HOME_V2 不生效', () => {
  it('/api/home/config 是 404', async () => {
    const resp = await client.get('/api/home/config');
    expect(resp.status).toBe(404);
  });
});

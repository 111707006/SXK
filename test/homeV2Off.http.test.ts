import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/** `HOME_V2` 沒設（預設）：專案 A 的 `/api/home/config` 回 `{enabled: false}`，前端照舊（issue #72）。 */

let client: TestClient;

beforeAll(async () => {
  process.env.HOME_V2 = '';
  client = await startTestApp(await loadApp());
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe('HOME_V2 沒設（專案 A）', () => {
  it('{enabled: false}', async () => {
    const resp = await client.get('/api/home/config');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ enabled: false });
  });
});

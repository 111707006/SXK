import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 新版首頁（客戶 10/17 第 4 項，issue #72，規格 docs/specs/client-changes-2026-10-17.md §5）。
 *
 * 前端靠 `GET /api/home/config` 知道開關 `HOME_V2` 開了沒（同 `/api/handoff/config` 的做法）；
 * 不用登入 —— 未登入的家長就是要看到新首頁。關著的那一半在 `homeV2Off.http.test.ts`，
 * 專案 B 在 `homeV2ProjectB.http.test.ts`（各自要另載一次 server.ts）。
 *
 * ⚠️ 必須在載入 `server.ts` 之前設定：開關在模組層級就讀掉了。
 */
process.env.HOME_V2 = '1';

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
}, 60_000);

afterAll(async () => {
  await client.close();
  process.env.HOME_V2 = '';
});

describe('HOME_V2=1（專案 A）', () => {
  it('未登入也讀得到：{enabled: true}', async () => {
    const resp = await client.get('/api/home/config');
    expect(resp.status).toBe(200);
    // 2026-10-23 起多帶 homeMedia（#87）與 companies（#90）。
    expect(await resp.json()).toMatchObject({ enabled: true });
  });
});

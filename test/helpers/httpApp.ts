/**
 * 讓測試對真實的 Express 應用程式發出真實的 HTTP 請求。
 *
 * 為什麼是 HTTP 而不是直接呼叫處理函式：一次驗到路由有沒有註冊、中介層有沒有
 * 跑、閘門有沒有生效三件事 —— 而這正是攻擊者實際碰得到的表面。直接呼叫處理
 * 函式的測試會在「路由根本沒掛上」時照樣通過。
 *
 * 連接埠是啟動測試用伺服器時才綁的（`listen(0)` 取隨機埠），**載入 `server.ts`
 * 本身不會綁任何埠** —— 那是 `main.ts` 的事。
 */
import type { Express } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

export interface TestClient {
  /** 相對路徑（例如 `/api/db/status`）；回傳原始 `Response`。 */
  request(path: string, init?: RequestInit): Promise<Response>;
  get(path: string, headers?: Record<string, string>): Promise<Response>;
  postJson(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>;
  close(): Promise<void>;
}

export async function startTestApp(app: Express): Promise<TestClient> {
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  const request = (path: string, init?: RequestInit) => fetch(base + path, init);

  return {
    request,
    get: (path, headers) => request(path, { headers }),
    postJson: (path, body, headers) =>
      request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify(body),
      }),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(err => (err ? reject(err) : resolve()))
      ),
  };
}

/**
 * 動態載入應用程式。
 *
 * 刻意用 `await import` 而不是靜態 import：`vi.mock` 必須在模組被載入之前生效，
 * 而靜態 import 會被提升到檔案最上方，`vi.mock` 的替身就來不及裝上去。
 */
export async function loadApp(): Promise<Express> {
  const mod = await import('../../server');
  return mod.app;
}

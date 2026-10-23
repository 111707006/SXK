import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 沒有首頁素材（#87）：設了 `HOME_MEDIA` 也一樣 —— 公開端點掛在 `tier2Only`、後台那幾支不註冊。
 * ⚠️ 必須在載入 `server.ts` 之前設定模式。
 */
process.env.APP_MODE = 't1only';
process.env.HOME_MEDIA = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-home-media-b';


vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const god = { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-god-123', 4) };
  return {
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return email === god.email ? god : null;
    },
    async findAdminUserById(id: number) {
      return id === god.id ? god : null;
    },
    async listCompanies() {
      return [];
    },
  };
});

async function godToken(client: TestClient): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('專案 B', () => {
  it('公開端點 404', async () => {
    expect((await client.get('/api/home/media')).status).toBe(404);
  });

  it('後台的首頁素材 404', async () => {
    expect((await client.get('/api/admin/home-media', { Authorization: `Bearer ${await godToken(client)}` })).status).toBe(404);
  });
});

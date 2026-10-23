import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * `HOME_MEDIA` 關著（#87）：公開端點回沒有素材、後台那幾支不註冊、首頁設定說關著 —— 首頁照舊是固定示範片。
 */
delete process.env.HOME_MEDIA;
process.env.SESSION_SECRET ||= 'test-session-secret-for-home-media-off';


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

describe('HOME_MEDIA 關著', () => {
  it('公開端點回空', async () => {
    const resp = await client.get('/api/home/media');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ splash: null, banners: [] });
  });

  it('後台的首頁素材不存在（404）', async () => {
    expect((await client.get('/api/admin/home-media', { Authorization: `Bearer ${await godToken(client)}` })).status).toBe(404);
  });

  it('首頁設定說 homeMedia: false', async () => {
    expect((await (await client.get('/api/home/config')).json()).homeMedia).toBe(false);
  });
});

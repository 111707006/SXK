import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 沒有可換的客服二維碼（B 沒有 `/media`）：公開端點與後台那幾支都 404，後台「合作公司」分頁就不畫那一塊。
 * ⚠️ 必須在載入 `server.ts` 之前設定模式。
 */
process.env.APP_MODE = 't1only';
process.env.SESSION_SECRET ||= 'test-session-secret-for-wecom-qr-b';

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

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('專案 B', () => {
  it('公開端點與後台都 404', async () => {
    expect((await client.get('/api/wecom-qr')).status).toBe(404);
    const resp = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
    const { token } = await resp.json();
    expect((await client.get('/api/admin/wecom-qr', { Authorization: `Bearer ${token}` })).status).toBe(404);
  });
});

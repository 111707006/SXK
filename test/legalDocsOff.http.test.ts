import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/** `LEGAL_DOCS` 關著（11/03 第 14 頁）：公開端點回兩份都沒存過、後台那兩支不註冊 —— 家長端照舊是內建條款。 */
delete process.env.LEGAL_DOCS;
process.env.SESSION_SECRET ||= 'test-session-secret-for-legal-docs-off';

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

vi.mock('../src/db/legalDocs', () => ({
  async loadLegalDocs() {
    throw new Error('關著不該讀資料庫');
  },
  async saveLegalDoc() {
    throw new Error('關著不該寫資料庫');
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('LEGAL_DOCS 關著', () => {
  it('公開端點回兩份都沒存過', async () => {
    const resp = await client.get('/api/legal');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ service: null, privacy: null });
  });

  it('後台的條款不存在（404）', async () => {
    const login = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
    const { token } = await login.json();
    expect((await client.get('/api/admin/legal', { Authorization: `Bearer ${token}` })).status).toBe(404);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * `A_COMPANIES` 開著（客戶 10/22，#89）：專案 A 的後台變成多合作公司 —— `/me` 帶 `shape`（畫面在執行期才知道）、
 * 公司分頁的路由註冊、公司 Logo 端點存在；B→A 交接的發出端仍然只在 B。歸屬機制本身見 `attribution.http.test.ts`。
 */
process.env.A_COMPANIES = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-a-companies';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
    { id: 10, email: 'a@yiyuan.com', role: 'company_member' as const, companyId: 7, active: true, createdAt: null, passwordHash: hash('pw-yy-123') },
  ];
  return {
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [{ id: 7, name: '乙医院', slug: 'yiyuan', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null }];
    },
  };
});

let client: TestClient;

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('A_COMPANIES 開著', () => {
  it('/me 告訴後台畫面：多合作公司、而且是 A', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const me = await (await client.get('/api/admin/me', { Authorization: `Bearer ${token}` })).json();
    expect(me.shape).toEqual({ multiCompany: true, projectA: true });
    expect(me.companies.map((c: any) => c.name)).toEqual(['乙医院']);
  });

  it('公司管理與視野切換的路由註冊了（全域管理員拿得到公司清單）', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await client.get('/api/admin/companies', { Authorization: `Bearer ${token}` })).status).toBe(200);
  });

  it('公司成員的 /me 不含別家公司', async () => {
    const token = await login('a@yiyuan.com', 'pw-yy-123');
    const me = await (await client.get('/api/admin/me', { Authorization: `Bearer ${token}` })).json();
    expect(me.companies).toEqual([]);
    expect(me.identity.role).toBe('company_member');
  });

  it('公司 Logo 與頁首徽章的端點存在；首頁設定說 companies: true', async () => {
    expect((await client.get('/api/company-brand?c=yiyuan')).status).toBe(200);
    const badge = await client.get('/api/company-badge?c=yiyuan');
    expect(badge.status).toBe(200);
    expect(await badge.json()).toEqual({ company: null }); // 測試沒有資料庫：讀不到就是不畫
    expect((await (await client.get('/api/home/config')).json()).companies).toBe(true);
  });

  it('B→A 交接的發出端仍然只在 B（404）', async () => {
    expect((await client.get('/api/handoff/config')).status).toBe(404);
  });
});

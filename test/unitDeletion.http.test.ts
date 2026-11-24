import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 合作單位停用與刪除、帳號與推薦人刪除（使用者 2026-11-23，ADR-0020 第 11 點；專案 A 開了合作單位）。
 *
 * 要抓的錯：單位管理者或推薦人打得到這幾支、沒停用就刪得掉、有訂單還刪得掉、擋下時沒說原因、
 * 單位停用了單位管理者還登得進來（或既有的工作階段還能用）。資料層是替身；SQL 本身在本機 MySQL 另外跑過。
 */
process.env.A_COMPANIES = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-unit-deletion';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { blockersOf, blocker } = await import('../src/admin/unitDeletion');
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const db = {
    admins: [] as any[],
    companies: [] as any[],
    orders: 0,
    calls: [] as string[],
  };
  const reset = () => {
    db.admins = [
      { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 10, email: 'm@jia.com', role: 'company_member', companyId: 7, active: true, createdAt: null, passwordHash: hash('pw-jia-123'), companyActive: true },
      { id: 11, email: 'r@jia.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 70, referrerActive: true, companyActive: true },
    ];
    db.companies = [{ id: 7, name: '甲机构', slug: 'jia', kind: 'institution', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null }];
    db.orders = 0;
    db.calls = [];
  };
  reset();
  const preview = (c: any) => ({
    company: { id: c.id, name: c.name, kind: c.kind, active: c.active },
    servedParents: 3, screeningParents: 2, unusedCodes: 5, usedCodes: 1, accounts: 2, referrers: 1,
    blockers: blockersOf([['active', c.active ? 1 : 0], ['orders', db.orders]]),
  });
  return {
    __db: db,
    __reset: reset,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return db.companies;
    },
    async setCompanyActive(id: number, active: boolean) {
      const c = db.companies.find(x => x.id === id);
      if (!c) return 0;
      c.active = active;
      for (const a of db.admins) if (a.companyActive !== undefined) a.companyActive = active;
      db.calls.push(`active:${id}:${active}`);
      return 1;
    },
    async companyDeletePreview(id: number) {
      const c = db.companies.find(x => x.id === id);
      return c ? preview(c) : null;
    },
    async deleteCompany(id: number, adminUserId: number) {
      const c = db.companies.find(x => x.id === id);
      if (!c) return { ok: false, reason: 'not_found' };
      const p = preview(c);
      if (p.blockers.length > 0) return { ok: false, reason: 'blocked', preview: p };
      db.companies = db.companies.filter(x => x.id !== id);
      db.calls.push(`delete:${id}:by${adminUserId}`);
      return { ok: true, preview: p };
    },
    async deleteAdminUser(id: number, selfId: number) {
      const a = db.admins.find(x => x.id === id);
      if (!a) return { ok: false, reason: 'not_found' };
      if (id === selfId) return { ok: false, reason: 'blocked', blockers: [blocker('self')] };
      if (a.active) return { ok: false, reason: 'blocked', blockers: [blocker('active')] };
      db.admins = db.admins.filter(x => x.id !== id);
      return { ok: true };
    },
    async deleteReferrer(id: number) {
      if (id !== 70) return { ok: false, reason: 'not_found' };
      return { ok: false, reason: 'blocked', blockers: [blocker('codes', 4)] };
    },
  };
});

let client: TestClient;
let store: any;
const h = (token: string) => ({ Authorization: `Bearer ${token}` });

async function login(email: string, password: string): Promise<Response> {
  return client.postJson('/api/admin/login', { email, password });
}
async function token(email: string, password: string): Promise<string> {
  const resp = await login(email, password);
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}
const del = (path: string, t: string) => client.request(`/api/admin${path}`, { method: 'DELETE', headers: h(t) });

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});
beforeEach(() => store.__reset());
afterAll(async () => {
  await client.close();
});

describe('誰打得到', () => {
  it('單位管理者 403、推薦人 403（不在白名單），什麼都沒動', async () => {
    for (const [email, pw] of [['m@jia.com', 'pw-jia-123'], ['r@jia.com', 'pw-ref-123']]) {
      const t = await token(email, pw);
      expect((await client.postJson('/api/admin/companies/7/active', { active: false }, h(t))).status, email).toBe(403);
      expect((await client.get('/api/admin/companies/7/delete-preview', h(t))).status, email).toBe(403);
      expect((await del('/companies/7', t)).status, email).toBe(403);
      expect((await del('/admin-users/10', t)).status, email).toBe(403);
      expect((await del('/referrers/70', t)).status, email).toBe(403);
    }
    expect(store.__db.calls).toEqual([]);
  });
});

describe('停用單位', () => {
  it('active 要是布林；停用之後單位管理者與推薦人登不進來、既有工作階段也失效；重新啟用又可以', async () => {
    const god = await token('god@sxk.com', 'pw-god-123');
    const member = await token('m@jia.com', 'pw-jia-123');
    expect((await client.postJson('/api/admin/companies/7/active', { active: 'no' }, h(god))).status).toBe(400);
    expect((await client.postJson('/api/admin/companies/99/active', { active: false }, h(god))).status).toBe(404);
    expect((await client.postJson('/api/admin/companies/7/active', { active: false }, h(god))).status).toBe(200);

    expect((await login('m@jia.com', 'pw-jia-123')).status).toBe(401);
    expect((await login('r@jia.com', 'pw-ref-123')).status).toBe(401);
    expect((await client.get('/api/admin/me', h(member))).status).toBe(401);

    await client.postJson('/api/admin/companies/7/active', { active: true }, h(god));
    expect((await login('m@jia.com', 'pw-jia-123')).status).toBe(200);
  });
});

describe('刪單位', () => {
  it('預覽：找不到 404；回數字與擋下的原因', async () => {
    const god = await token('god@sxk.com', 'pw-god-123');
    expect((await client.get('/api/admin/companies/99/delete-preview', h(god))).status).toBe(404);
    const { preview } = await (await client.get('/api/admin/companies/7/delete-preview', h(god))).json();
    expect(preview).toMatchObject({ servedParents: 3, unusedCodes: 5, blockers: [{ code: 'active' }] });
  });

  it('沒停用 409＋原因與預覽；有訂單 409；停用且沒有訂單才刪', async () => {
    const god = await token('god@sxk.com', 'pw-god-123');
    let resp = await del('/companies/7', god);
    expect(resp.status).toBe(409);
    let body = await resp.json();
    expect(body.code).toBe('DELETE_BLOCKED');
    expect(body.error).toContain('先停用');
    expect(body.preview.blockers.map((b: any) => b.code)).toEqual(['active']);

    await client.postJson('/api/admin/companies/7/active', { active: false }, h(god));
    store.__db.orders = 2;
    resp = await del('/companies/7', god);
    expect(resp.status).toBe(409);
    body = await resp.json();
    expect(body.error).toContain('2 笔订单');

    store.__db.orders = 0;
    resp = await del('/companies/7', god);
    expect(resp.status).toBe(200);
    expect(store.__db.calls).toContain('delete:7:by30');
    expect((await del('/companies/7', god)).status).toBe(404);
  });
});

describe('刪帳號與推薦人', () => {
  it('後台帳號：自己、啟用中的 409 並說原因；停用的刪得掉；找不到 404', async () => {
    const god = await token('god@sxk.com', 'pw-god-123');
    expect((await (await del('/admin-users/30', god)).json()).error).toContain('自己');
    const active = await del('/admin-users/10', god);
    expect(active.status).toBe(409);
    expect((await active.json()).error).toContain('先停用');
    store.__db.admins.find((a: any) => a.id === 10).active = false;
    expect((await del('/admin-users/10', god)).status).toBe(200);
    expect((await del('/admin-users/10', god)).status).toBe(404);
  });

  it('推薦人：擋下 409 並說原因；找不到 404', async () => {
    const god = await token('god@sxk.com', 'pw-god-123');
    const resp = await del('/referrers/70', god);
    expect(resp.status).toBe(409);
    expect((await resp.json()).blockers).toEqual([expect.objectContaining({ code: 'codes', count: 4 })]);
    expect((await del('/referrers/71', god)).status).toBe(404);
  });
});

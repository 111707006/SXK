import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 推薦人（客戶 10/22，#93）：全域管理員開帳號；推薦人登入同一個管理中心，只拿到綁在自己名下的家長、
 * 碰不到全域分頁與「所有帳號」都能打的那幾支（白名單）；停用了就登不進來。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-referrers';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const db = {
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
      { id: 40, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 1, referrerActive: true },
      { id: 41, email: 'off@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-off-123'), referrerId: 2, referrerActive: false },
    ] as any[],
    parents: [
      { id: 101, companyId: null, referrerId: 1, childName: '我的家长' },
      { id: 102, companyId: null, referrerId: 3, childName: '别人的家长' },
      { id: 103, companyId: null, referrerId: null, childName: '没绑定的家长' },
    ],
    referrers: [] as any[],
    listParentsCalls: [] as any[],
  };
  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },
    async listParents(condition: any) {
      db.listParentsCalls.push(condition);
      return db.parents.filter(p => matchesCompanyCondition(condition, p)).map(p => ({ id: p.id, childName: p.childName }));
    },
    async listReferrers() {
      return db.referrers;
    },
    async createReferrer(input: any) {
      const r = { id: db.referrers.length + 10, adminUserId: 99, email: input.email, name: input.name, phone: input.phone, kind: input.kind, companyId: input.companyId, companyName: null, active: true, createdAt: null };
      db.referrers.push(r);
      return r;
    },
  };
});

let client: TestClient;
let store: any;

async function login(email: string, password: string): Promise<Response> {
  return client.postJson('/api/admin/login', { email, password });
}
async function token(email: string, password: string): Promise<string> {
  const resp = await login(email, password);
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}
const h = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

afterAll(async () => {
  await client.close();
});

describe('推薦人登入', () => {
  it('/me 說是推薦人，沒有公司、沒有選擇', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    const me = await (await client.get('/api/admin/me', h(t))).json();
    expect(me.identity).toEqual({ role: 'referrer', email: 'ref@a.com', companyId: null, selection: null });
    expect(me.companies).toEqual([]);
  });

  it('只拿到綁在自己名下的家長', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    const body = await (await client.get('/api/admin/parents', h(t))).json();
    expect(body.parents.map((p: any) => p.id)).toEqual([101]);
    expect(store.__db.listParentsCalls.at(-1)).toEqual({ kind: 'referrer', referrerId: 1 });
  });

  it.each([
    ['GET', '/api/admin/referrers'],
    ['GET', '/api/admin/parent-summary'],
    ['POST', '/api/admin/parent-summary/export'],
    ['DELETE', '/api/admin/parents/101'],
    ['GET', '/api/admin/specialists'],
    ['GET', '/api/admin/activities'],
    ['GET', '/api/admin/companies'],
  ])('%s %s → 403（白名單之外）', async (method, path) => {
    const t = await token('ref@a.com', 'pw-ref-123');
    const resp = await client.request(path, { method, headers: { ...h(t), 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    expect(resp.status).toBe(403);
  });

  it('停用的推薦人登不進來', async () => {
    expect((await login('off@a.com', 'pw-off-123')).status).toBe(401);
  });
});

describe('全域管理員開推薦人', () => {
  it('建得起來、列得出來', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { email: 'new@a.com', password: 'pw-new-1234', name: '乙治疗师', phone: '13900000000', kind: 'therapist' }, h(t));
    expect(resp.status).toBe(200);
    expect((await resp.json()).referrer).toMatchObject({ name: '乙治疗师', kind: 'therapist', companyId: null });
    const list = await (await client.get('/api/admin/referrers', h(t))).json();
    expect(list.referrers.map((r: any) => r.name)).toContain('乙治疗师');
  });

  it.each([
    [{ email: 'x', password: 'pw-new-1234', name: '甲', phone: '13900000000', kind: 'channel' }, '信箱'],
    [{ email: 'a@b.c', password: 'short', name: '甲', phone: '13900000000', kind: 'channel' }, '密码'],
    [{ email: 'a@b.c', password: 'pw-new-1234', name: '', phone: '13900000000', kind: 'channel' }, '名称'],
    [{ email: 'a@b.c', password: 'pw-new-1234', name: '甲', phone: '123', kind: 'channel' }, '手机号'],
    [{ email: 'a@b.c', password: 'pw-new-1234', name: '甲', phone: '13900000000', kind: 'boss' }, '渠道商或治疗师'],
  ])('輸入不對 400（%#）', async (body, word) => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', body, h(t));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain(word);
  });
});

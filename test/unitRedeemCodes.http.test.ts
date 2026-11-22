import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';

/**
 * 單位層的兌換碼（#124，ADR-0020 第 7 點）：全域管理員替單位產碼（不指定推薦人）；單位管理者看得到本單位的碼、
 * 看不到別單位的；推薦人看不到。服務關係開關開著、兌換碼開著才註冊。直接掛 `createAdminRouter`，資料層是替身。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-unit-codes';

vi.mock('../src/admin/adminStore', async () => {
  const db = {
    admins: [
      { id: 1, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null },
      { id: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, active: true, createdAt: null },
      { id: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 70, referrerActive: true },
    ] as any[],
    companies: [
      { id: 7, name: '甲机构', kind: 'institution', active: true },
      { id: 9, name: '乙机构', kind: 'institution', active: true },
      { id: 8, name: '停用的', kind: 'institution', active: false },
    ],
    codes: [
      { id: 1, batchId: 1, referrerId: null, companyId: 7, code: 'AAAAAAAAA2', months: 1, status: 'unused', usedBy: null, usedAt: null, createdAt: null },
      { id: 2, batchId: 2, referrerId: null, companyId: 9, code: 'BBBBBBBBB2', months: 1, status: 'unused', usedBy: null, usedAt: null, createdAt: null },
      { id: 3, batchId: 3, referrerId: 70, companyId: null, code: 'CCCCCCCCC2', months: 1, status: 'unused', usedBy: null, usedAt: null, createdAt: null },
    ],
    created: [] as any[],
  };
  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async findCompanyById(id: number) {
      return db.companies.find(c => c.id === id) ?? null;
    },
    async listRedeemCodes(referrerId: number) {
      return db.codes.filter(c => c.referrerId === referrerId);
    },
    async listUnitRedeemCodes(companyId: number) {
      return db.codes.filter(c => c.companyId === companyId);
    },
    async createRedeemBatch(input: any) {
      db.created.push(input);
      return [{ id: 99, batchId: 99, referrerId: input.referrerId ?? null, companyId: input.companyId ?? null, code: input.generate(), months: input.months, status: 'unused', usedBy: null, usedAt: null, createdAt: null }];
    },
  };
});

const { createAdminRouter } = await import('../src/admin/routes');
const { signAdminToken } = await import('../src/admin/adminAuth');

function appWith(serviceRelations: boolean) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ multiCompany: true, projectA: true, ...(serviceRelations ? { serviceRelations: true } : {}) }, { redeemCodes: true }));
  return app;
}

let on: TestClient;
let off: TestClient;
let store: any;
const god = () => ({ Authorization: `Bearer ${signAdminToken({ aid: 1, email: 'god@sxk.com', role: 'global_admin', companyId: null, sel: { kind: 'company', companyId: 7 } })}` });
const mgr = () => ({ Authorization: `Bearer ${signAdminToken({ aid: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, sel: null })}` });
const zhang = () => ({ Authorization: `Bearer ${signAdminToken({ aid: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, sel: null })}` });
const codesOf = async (c: TestClient, path: string, h: Record<string, string>) => ((await (await c.get(path, h)).json()).codes as any[]).map(x => x.id);

beforeAll(async () => {
  on = await startTestApp(appWith(true));
  off = await startTestApp(appWith(false));
  store = await import('../src/admin/adminStore');
});
afterAll(async () => {
  await on.close();
  await off.close();
});
beforeEach(() => {
  store.__db.created.length = 0;
});

describe('全域管理員替單位產碼', () => {
  it('不指定推薦人：createRedeemBatch 拿到 companyId、沒有 referrerId', async () => {
    const res = await on.postJson('/api/admin/units/7/codes', { months: 1, quantity: 2 }, god());
    expect(res.status).toBe(200);
    expect(store.__db.created[0]).toMatchObject({ companyId: 7, months: 1, quantity: 2, createdBy: 1 });
    expect(store.__db.created[0].referrerId).toBeUndefined();
  });

  it('單位不存在或停用：404；月數或數量不對：400', async () => {
    expect((await on.postJson('/api/admin/units/8/codes', { months: 1, quantity: 1 }, god())).status).toBe(404);
    expect((await on.postJson('/api/admin/units/999/codes', { months: 1, quantity: 1 }, god())).status).toBe(404);
    expect((await on.postJson('/api/admin/units/7/codes', { months: 2, quantity: 1 }, god())).status).toBe(400);
    expect((await on.postJson('/api/admin/units/7/codes', { months: 1, quantity: 0 }, god())).status).toBe(400);
    expect(store.__db.created).toEqual([]);
  });

  it('全域管理員看得到任一個單位的碼', async () => {
    expect(await codesOf(on, '/api/admin/units/9/codes', god())).toEqual([2]);
  });

  it('單位管理者、推薦人不能替單位產碼、不能看指定單位的碼', async () => {
    expect((await on.postJson('/api/admin/units/7/codes', { months: 1, quantity: 1 }, mgr())).status).toBe(403);
    expect((await on.get('/api/admin/units/7/codes', mgr())).status).toBe(403);
    expect((await on.get('/api/admin/units/7/codes', zhang())).status).toBe(403);
  });
});

describe('單位管理者看本單位的碼', () => {
  it('/unit/codes 只回本單位（看不到別單位、也看不到推薦人的）', async () => {
    expect(await codesOf(on, '/api/admin/unit/codes', mgr())).toEqual([1]);
  });

  it('/unit/codes.csv 只有本單位未用的碼', async () => {
    const res = await on.get('/api/admin/unit/codes.csv', mgr());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('AAAA');
    expect(text).not.toContain('BBBB');
  });

  it('全域管理員與推薦人沒有「本單位」：403', async () => {
    expect((await on.get('/api/admin/unit/codes', god())).status).toBe(403);
    expect((await on.get('/api/admin/unit/codes', zhang())).status).toBe(403);
  });

  it('推薦人照舊只看自己的碼', async () => {
    expect(await codesOf(on, '/api/admin/referrer/codes', zhang())).toEqual([3]);
  });
});

describe('關著', () => {
  it('單位層的幾支都沒有註冊', async () => {
    expect((await off.postJson('/api/admin/units/7/codes', { months: 1, quantity: 1 }, god())).status).toBe(404);
    expect((await off.get('/api/admin/unit/codes', mgr())).status).toBe(404);
  });
});

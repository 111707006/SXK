import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';

/**
 * 後台改派（#119，ADR-0020 第 3、6 點）：`PUT /api/admin/parents/:id/service` 與 `GET …/service-changes`。
 * 服務關係開關開著（`shape.serviceRelations`）才註冊。開關要等 #115 才接進 `server.ts`，所以這裡直接掛
 * `createAdminRouter`；資料層換成記憶體替身，範圍用同一個 `matchesCompanyCondition`。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-service-relations';

vi.mock('../src/admin/adminStore', async () => {
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Rel = { companyId: number; referrerId: number | null };
  const db = {
    admins: [
      { id: 1, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null },
      { id: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, active: true, createdAt: null },
      { id: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 70, referrerActive: true },
      { id: 4, email: 'li@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 71, referrerActive: true },
    ] as any[],
    companies: [
      { id: 7, name: '甲机构', kind: 'institution', active: true },
      { id: 9, name: '乙机构', kind: 'institution', active: true },
      { id: 8, name: '停用的', kind: 'institution', active: false },
    ],
    referrers: [
      { id: 70, name: '张', companyId: 7, active: true },
      { id: 71, name: '李', companyId: 7, active: true },
      { id: 72, name: '旧', companyId: 7, active: false },
      { id: 90, name: '王', companyId: 9, active: true },
    ],
    listParentsCalls: [] as any[],
    summaryCalls: [] as any[],
    // companyId 是帳號歸屬（＝篩查渠道），不決定誰看得到。
    parents: [] as Array<{ id: number; companyId: number | null; childName: string; service: Rel | null }>,
    changes: [] as any[],
  };
  const reset = () => {
    db.parents = [
      { id: 201, companyId: null, childName: '张的家长', service: { companyId: 7, referrerId: 70 } },
      { id: 202, companyId: 7, childName: '甲还没标注', service: { companyId: 7, referrerId: null } },
      { id: 203, companyId: 9, childName: '乙的家长', service: { companyId: 9, referrerId: 90 } },
      { id: 204, companyId: null, childName: '直属', service: null },
    ];
    db.changes = [];
  };
  reset();
  const visible = (condition: any, id: number) => db.parents.find(p => p.id === id && matchesCompanyCondition(condition, p)) ?? null;
  const same = (a: Rel | null, b: Rel | null) =>
    a === null || b === null ? a === b : a.companyId === b.companyId && a.referrerId === b.referrerId;
  return {
    __db: db,
    __reset: reset,
    isAvailable: () => true,
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return db.companies;
    },
    async findCompanyById(id: number) {
      return db.companies.find(c => c.id === id) ?? null;
    },
    async findReferrer(id: number) {
      return db.referrers.find(r => r.id === id) ?? null;
    },
    async listReferrers() {
      return db.referrers;
    },
    // 匯總與導出：記下拿到的條件（範圍由 companyWhereSql 照 byService 產生，這裡只驗路由交出去的是哪一個）。
    async listSummarySources(condition: any) {
      db.summaryCalls.push(condition);
      return [];
    },
    async recordExport() {},
    // 照真的資料層：byService 才帶服務關係與篩查渠道的名字、才看 unassignedOnly。
    async listParents(condition: any, options: any) {
      db.listParentsCalls.push({ condition, options });
      const name = (id: number | null | undefined) => db.companies.find(c => c.id === id)?.name ?? null;
      return db.parents
        .filter(p => matchesCompanyCondition(condition, p))
        .filter(p => !(condition.byService && options.unassignedOnly) || (p.service !== null && p.service.referrerId === null))
        .map(p => ({
          id: p.id,
          childName: p.childName,
          companyId: p.companyId,
          handoffSource: null,
          ...(condition.byService
            ? {
                service: p.service
                  ? {
                      companyId: p.service.companyId,
                      companyName: name(p.service.companyId),
                      referrerId: p.service.referrerId,
                      referrerName: db.referrers.find(r => r.id === p.service!.referrerId)?.name ?? null,
                    }
                  : null,
                screeningCompanyName: name(p.companyId),
              }
            : {}),
        }));
    },
    async getParentDetail(condition: any, id: number) {
      const p = visible(condition, id);
      return p ? { id: p.id, childName: p.childName } : null;
    },
    async getServiceRelation(condition: any, id: number) {
      const p = visible(condition, id);
      return p ? { relation: p.service ? { ...p.service } : null } : null;
    },
    async reassignServiceRelation(condition: any, input: any) {
      const p = visible(condition, input.userId);
      if (!p) return { ok: false, reason: 'not_found' };
      if (!same(p.service, input.from)) return { ok: false, reason: 'stale' };
      if (same(p.service, input.to)) return { ok: true, changed: false, relation: p.service };
      db.changes.push({
        id: db.changes.length + 1,
        userId: p.id,
        fromCompanyId: p.service?.companyId ?? null,
        fromReferrerId: p.service?.referrerId ?? null,
        toCompanyId: input.to?.companyId ?? null,
        toReferrerId: input.to?.referrerId ?? null,
        actor: 'admin',
        reason: 'admin',
        adminUserId: input.adminUserId,
        createdAt: '2026-11-23 10:00:00',
      });
      p.service = input.to ? { ...input.to } : null;
      return { ok: true, changed: true, relation: p.service };
    },
    async listServiceRelationChanges(condition: any, id: number) {
      if (!visible(condition, id)) return null;
      return db.changes.filter(c => c.userId === id).reverse().map(({ userId: _u, ...rest }) => rest);
    },
  };
});

const { createAdminRouter } = await import('../src/admin/routes');
const { signAdminToken } = await import('../src/admin/adminAuth');

const SHAPE_ON = { multiCompany: true, projectA: true, serviceRelations: true } as const;
const SHAPE_OFF = { multiCompany: true, projectA: true } as const;

function appWith(shape: typeof SHAPE_ON | typeof SHAPE_OFF) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter(shape));
  return app;
}

let on: TestClient;
let off: TestClient;
let store: any;

const god = (sel: { kind: 'company'; companyId: number } | { kind: 'unassigned' }) =>
  signAdminToken({ aid: 1, email: 'god@sxk.com', role: 'global_admin', companyId: null, sel });
const manager = () => signAdminToken({ aid: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, sel: null });
const zhang = () => signAdminToken({ aid: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, sel: null });
const li = () => signAdminToken({ aid: 4, email: 'li@a.com', role: 'referrer', companyId: null, sel: null });
const h = (t: string) => ({ Authorization: `Bearer ${t}` });

function put(client: TestClient, id: number, body: unknown, token: string) {
  return client.request(`/api/admin/parents/${id}/service`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...h(token) },
    body: JSON.stringify(body),
  });
}
const parentIds = async (client: TestClient, token: string) =>
  ((await (await client.get('/api/admin/parents', h(token))).json()).parents as any[]).map(p => p.id);

beforeAll(async () => {
  on = await startTestApp(appWith(SHAPE_ON));
  off = await startTestApp(appWith(SHAPE_OFF));
  store = await import('../src/admin/adminStore');
});
afterAll(async () => {
  await on.close();
  await off.close();
});
beforeEach(() => {
  store.__reset();
  store.__db.listParentsCalls.length = 0;
  store.__db.summaryCalls.length = 0;
});

describe('範圍：開著看服務關係', () => {
  it('單位管理者看本單位全部（含還沒標注），不看帳號歸屬', async () => {
    expect((await parentIds(on, manager())).sort()).toEqual([201, 202]);
  });

  it('推薦人只看標注給自己的', async () => {
    expect(await parentIds(on, zhang())).toEqual([201]);
    expect(await parentIds(on, li())).toEqual([]);
  });

  it('全域管理員的直屬視野＝沒有服務關係', async () => {
    expect(await parentIds(on, god({ kind: 'unassigned' }))).toEqual([204]);
  });
});

describe('PUT /parents/:id/service', () => {
  it('單位管理者在本單位內改派：寫服務關係與一列紀錄；原推薦人看不到、新推薦人看得到', async () => {
    const resp = await put(on, 201, { to: { companyId: 7, referrerId: 71 } }, manager());
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ changed: true, relation: { companyId: 7, referrerId: 71 } });
    expect(store.__db.changes).toEqual([
      expect.objectContaining({ userId: 201, fromCompanyId: 7, fromReferrerId: 70, toCompanyId: 7, toReferrerId: 71, actor: 'admin', reason: 'admin', adminUserId: 2 }),
    ]);
    expect((await on.get('/api/admin/parents/201', h(zhang()))).status).toBe(404);
    expect(await parentIds(on, zhang())).toEqual([]);
    expect(await parentIds(on, li())).toEqual([201]);
  });

  it('單位管理者標注還沒標注的家長；也可以把推薦人拿掉（留在本單位）', async () => {
    expect((await put(on, 202, { to: { companyId: 7, referrerId: 70 } }, manager())).status).toBe(200);
    expect((await put(on, 201, { to: { companyId: 7, referrerId: null } }, manager())).status).toBe(200);
    expect(store.__db.changes).toHaveLength(2);
  });

  it('單位管理者改到別的單位、或拿掉服務關係：403，什麼都不寫', async () => {
    const a = await put(on, 201, { to: { companyId: 9, referrerId: 90 } }, manager());
    expect(a.status).toBe(403);
    expect((await a.json()).code).toBe('REASSIGN_FORBIDDEN');
    expect((await put(on, 201, { to: null }, manager())).status).toBe(403);
    expect(store.__db.changes).toEqual([]);
  });

  it('單位管理者碰別的單位的家長：404（與看不到同一句）', async () => {
    expect((await put(on, 203, { to: { companyId: 7, referrerId: null } }, manager())).status).toBe(404);
    expect((await put(on, 204, { to: { companyId: 7, referrerId: null } }, manager())).status).toBe(404);
  });

  it('推薦人：403（不能手動認領，連自己的家長也不能改）', async () => {
    expect((await put(on, 201, { to: { companyId: 7, referrerId: 71 } }, zhang())).status).toBe(403);
    expect(store.__db.changes).toEqual([]);
  });

  it('全域管理員跨單位改派：原單位與原推薦人看不到，新單位看得到', async () => {
    expect((await put(on, 203, { to: { companyId: 7, referrerId: null } }, god({ kind: 'company', companyId: 9 }))).status).toBe(200);
    expect(await parentIds(on, god({ kind: 'company', companyId: 9 }))).toEqual([]);
    expect((await parentIds(on, manager())).sort()).toEqual([201, 202, 203]);
  });

  it('全域管理員把直屬家長掛上、把家長拿掉服務關係（回直屬）', async () => {
    expect((await put(on, 204, { to: { companyId: 7, referrerId: 70 } }, god({ kind: 'unassigned' }))).status).toBe(200);
    expect(await parentIds(on, zhang())).toEqual([201, 204]);
    const resp = await put(on, 201, { to: null }, god({ kind: 'company', companyId: 7 }));
    expect(await resp.json()).toEqual({ changed: true, relation: null });
    expect(await parentIds(on, god({ kind: 'unassigned' }))).toEqual([201]);
    expect(store.__db.changes.at(-1)).toEqual(expect.objectContaining({ userId: 201, toCompanyId: null, toReferrerId: null, adminUserId: 1 }));
  });

  it('跟現在一樣：200、changed false、不寫紀錄', async () => {
    const resp = await put(on, 201, { to: { companyId: 7, referrerId: 70 } }, manager());
    expect(await resp.json()).toEqual({ changed: false, relation: { companyId: 7, referrerId: 70 } });
    expect(store.__db.changes).toEqual([]);
  });

  it.each([
    ['推薦人不屬於那個單位', { to: { companyId: 7, referrerId: 90 } }, 'REFERRER_NOT_IN_UNIT'],
    ['推薦人停用', { to: { companyId: 7, referrerId: 72 } }, 'REFERRER_NOT_IN_UNIT'],
    ['推薦人不存在', { to: { companyId: 7, referrerId: 999 } }, 'REFERRER_NOT_IN_UNIT'],
    ['單位停用', { to: { companyId: 8, referrerId: null } }, 'UNIT_NOT_FOUND'],
    ['單位不存在', { to: { companyId: 999, referrerId: null } }, 'UNIT_NOT_FOUND'],
  ])('%s：400 %s', async (_name, body, code) => {
    const resp = await put(on, 204, body, god({ kind: 'unassigned' }));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe(code);
    expect(store.__db.changes).toEqual([]);
  });

  it.each([[{}], [{ to: 7 }], [{ to: { companyId: '7', referrerId: null } }], [{ to: { companyId: 7 } }], [{ to: { companyId: 7, referrerId: 1.5 } }]])(
    '形狀不對 %j：400',
    async body => {
      expect((await put(on, 201, body, god({ kind: 'company', companyId: 7 }))).status).toBe(400);
    },
  );
});

describe('列表：推薦人、篩查渠道兩欄與「還沒標注」', () => {
  const rows = async (client: TestClient, token: string, q = '') =>
    (await (await client.get(`/api/admin/parents${q}`, h(token))).json()).parents as any[];

  it('每列帶服務的單位與推薦人、篩查渠道（帳號歸屬那家；沒有＝森心康直属）', async () => {
    const list = await rows(on, manager());
    expect(list.find(p => p.id === 201)).toEqual(expect.objectContaining({
      service: { companyId: 7, companyName: '甲机构', referrerId: 70, referrerName: '张' },
      screeningChannel: '森心康直属',
    }));
    expect(list.find(p => p.id === 202)).toEqual(expect.objectContaining({
      service: { companyId: 7, companyName: '甲机构', referrerId: null, referrerName: null },
      screeningChannel: '甲机构',
    }));
  });

  it('?assigned=unassigned：只列本單位還沒標注推薦人的', async () => {
    expect((await rows(on, manager(), '?assigned=unassigned')).map(p => p.id)).toEqual([202]);
    expect(store.__db.listParentsCalls.at(-1).options.unassignedOnly).toBe(true);
  });

  it('改派之後篩查渠道不變', async () => {
    await put(on, 203, { to: { companyId: 7, referrerId: 70 } }, god({ kind: 'company', companyId: 9 }));
    expect((await rows(on, manager())).find(p => p.id === 203)?.screeningChannel).toBe('乙机构');
  });

  it('關著：不帶這兩欄、不看 assigned', async () => {
    const list = await rows(off, manager(), '?assigned=unassigned');
    expect(list.map(p => p.id)).toEqual([202]);
    expect(list[0]).not.toHaveProperty('screeningChannel');
    expect(list[0]).not.toHaveProperty('service');
    expect(store.__db.listParentsCalls.at(-1).options.unassignedOnly).toBeUndefined();
  });
});

describe('家長匯總與導出照新範圍', () => {
  it('開著：單位管理者的匯總與導出都拿 byService 的條件；關著沒有', async () => {
    await on.get('/api/admin/parent-summary', h(manager()));
    await on.request('/api/admin/parent-summary/export', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h(manager()) }, body: '{}' });
    await off.get('/api/admin/parent-summary', h(manager()));
    expect(store.__db.summaryCalls).toEqual([
      { kind: 'company', companyId: 7, byService: true },
      { kind: 'company', companyId: 7, byService: true },
      { kind: 'company', companyId: 7 },
    ]);
  });
});

describe('GET /service-targets：改派時能選的單位與推薦人', () => {
  it('單位管理者：只有本單位與本單位啟用中的推薦人', async () => {
    const resp = await on.get('/api/admin/service-targets', h(manager()));
    expect(await resp.json()).toEqual({
      units: [{ id: 7, name: '甲机构', kind: 'institution' }],
      referrers: [{ id: 70, name: '张', companyId: 7 }, { id: 71, name: '李', companyId: 7 }],
    });
  });

  it('全域管理員：所有啟用中的單位與推薦人', async () => {
    const body = await (await on.get('/api/admin/service-targets', h(god({ kind: 'company', companyId: 7 })))).json();
    expect(body.units.map((u: any) => u.id)).toEqual([7, 9]);
    expect(body.referrers.map((r: any) => r.id)).toEqual([70, 71, 90]);
  });

  it('推薦人 403；關著 404', async () => {
    expect((await on.get('/api/admin/service-targets', h(zhang()))).status).toBe(403);
    expect((await off.get('/api/admin/service-targets', h(manager()))).status).toBe(404);
  });
});

describe('GET /parents/:id/service-changes', () => {
  it('看得到這位家長才讀得到；改派走之後原推薦人 404', async () => {
    await put(on, 201, { to: { companyId: 7, referrerId: 71 } }, manager());
    const resp = await on.get('/api/admin/parents/201/service-changes', h(manager()));
    expect(resp.status).toBe(200);
    expect((await resp.json()).changes).toEqual([
      expect.objectContaining({ fromCompanyId: 7, fromReferrerId: 70, toCompanyId: 7, toReferrerId: 71, actor: 'admin', reason: 'admin' }),
    ]);
    expect((await on.get('/api/admin/parents/201/service-changes', h(li()))).status).toBe(200);
    expect((await on.get('/api/admin/parents/201/service-changes', h(zhang()))).status).toBe(404);
    expect((await on.get('/api/admin/parents/203/service-changes', h(manager()))).status).toBe(404);
  });
});

describe('關著', () => {
  it('兩支都沒有註冊', async () => {
    expect((await put(off, 201, { to: { companyId: 7, referrerId: 71 } }, god({ kind: 'company', companyId: 7 }))).status).toBe(404);
    expect((await off.get('/api/admin/parents/201/service-changes', h(manager()))).status).toBe(404);
  });

  it('公司成員照舊看帳號歸屬，推薦人照舊看綁定（這份替身沒有綁定＝看不到）', async () => {
    expect(await parentIds(off, manager())).toEqual([202]);
    expect(await parentIds(off, zhang())).toEqual([]);
  });
});

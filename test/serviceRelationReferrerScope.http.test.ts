import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';

/**
 * #118 驗收：服務關係開關開著時，推薦人的家長列表與詳情只回服務關係標注給他的家長；關著照舊看推薦綁定。
 * 直接掛 `createAdminRouter`（shape 帶不帶 `serviceRelations`），資料層是記憶體替身、範圍走同一個 `matchesCompanyCondition`。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-referrer-scope';

vi.mock('../src/admin/adminStore', async () => {
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  // referrerId＝推薦綁定（舊的那一套）；service＝服務關係。
  const parents = [
    { id: 301, companyId: 7, referrerId: 70, service: { companyId: 7, referrerId: 70 }, childName: '两边都是张' },
    { id: 302, companyId: 7, referrerId: 70, service: { companyId: 7, referrerId: 71 }, childName: '绑定张、现在李' },
    { id: 303, companyId: 7, referrerId: null, service: { companyId: 7, referrerId: 70 }, childName: '没绑定、现在张' },
    { id: 304, companyId: 7, referrerId: null, service: { companyId: 7, referrerId: null }, childName: '单位还没标注' },
  ];
  return {
    isAvailable: () => true,
    async findAdminUserById(id: number) {
      return id === 3
        ? { id: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 70, referrerActive: true }
        : null;
    },
    async listParents(condition: any) {
      return parents.filter(p => matchesCompanyCondition(condition, p)).map(p => ({ id: p.id, childName: p.childName }));
    },
    async getParentDetail(condition: any, id: number) {
      const p = parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      return p ? { id: p.id, childName: p.childName } : null;
    },
  };
});

const { createAdminRouter } = await import('../src/admin/routes');
const { signAdminToken } = await import('../src/admin/adminAuth');

function appWith(serviceRelations: boolean) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ multiCompany: true, projectA: true, serviceRelations }));
  return app;
}

let on: TestClient;
let off: TestClient;
const auth = () => ({ Authorization: `Bearer ${signAdminToken({ aid: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, sel: null })}` });
const ids = async (c: TestClient) => ((await (await c.get('/api/admin/parents', auth())).json()).parents as any[]).map(p => p.id);

beforeAll(async () => {
  on = await startTestApp(appWith(true));
  off = await startTestApp(appWith(false));
});
afterAll(async () => {
  await on.close();
  await off.close();
});

describe('開著：看服務關係', () => {
  it('列表只回標注給他的', async () => {
    expect(await ids(on)).toEqual([301, 303]);
  });

  it('詳情：標注給別人的、單位裡還沒標注的都是 404', async () => {
    expect((await on.get('/api/admin/parents/303', auth())).status).toBe(200);
    expect((await on.get('/api/admin/parents/302', auth())).status).toBe(404);
    expect((await on.get('/api/admin/parents/304', auth())).status).toBe(404);
  });
});

describe('關著：照舊看推薦綁定', () => {
  it('列表與詳情', async () => {
    expect(await ids(off)).toEqual([301, 302]);
    expect((await off.get('/api/admin/parents/302', auth())).status).toBe(200);
    expect((await off.get('/api/admin/parents/303', auth())).status).toBe(404);
  });
});

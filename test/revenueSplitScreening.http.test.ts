import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';
import { signAdminToken } from '../src/admin/adminAuth';

/**
 * 清分改看服務關係（#122，ADR-0020 第 8 點）的後台：單位那一層多一個篩查渠道比例。
 * `server.ts` 的開關還是佔位（永遠是關），所以這裡直接掛後台路由、帶 `serviceRelations: true`，另掛一份不帶的對照。
 */
const calls = vi.hoisted(() => ({ rates: [] as any[], listOpts: [] as any[] }));

vi.mock('../src/admin/adminStore', () => ({
  isAvailable: () => true,
  findAdminUserById: async (id: number) =>
    id === 30
      ? { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true }
      : id === 10
        ? { id: 10, email: 'a@jia.com', role: 'company_member', companyId: 1, active: true }
        : null,
  listSplitRates: async (opts?: any) => {
    calls.listOpts.push(opts);
    return opts?.screening
      ? [{ scope: 'company', refId: 3, platformBp: null, companyBp: null, screeningBp: 1000 }]
      : [{ scope: 'company', refId: 3, platformBp: null, companyBp: null }];
  },
  listCompanies: async () => [{ id: 3, name: '某某康复', active: true }],
  listReferrers: async () => [{ id: 7, name: '王老师', kind: 'therapist', companyId: 3, companyName: '某某康复', active: true }],
  findCompanyById: async (id: number) => (id === 3 ? { id: 3, name: '某某康复', active: true } : null),
  findReferrer: async (id: number) => (id === 7 ? { id: 7 } : null),
  setSplitRate: async (input: any) => {
    calls.rates.push(input);
  },
}));

const { createAdminRouter } = await import('../src/admin/routes');

function appWith(serviceRelations: boolean) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ multiCompany: false }, { revenueSplit: serviceRelations ? { feeBp: 60, serviceRelations: true, planPrices: null } : { feeBp: 60 } }));
  return app;
}

const god = () => signAdminToken({ aid: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, sel: null });
const member = () => signAdminToken({ aid: 10, email: 'a@jia.com', role: 'company_member', companyId: 1, sel: null });
const json = (token: string, body: unknown) => ({ method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let on: TestClient;
let off: TestClient;

beforeAll(async () => {
  on = await startTestApp(appWith(true));
  off = await startTestApp(appWith(false));
});

afterAll(async () => {
  await Promise.all([on.close(), off.close()]);
});

beforeEach(() => {
  calls.rates.length = 0;
  calls.listOpts.length = 0;
});

describe('篩查渠道比例：只在單位那一層', () => {
  it('開著：設定裡帶 screening 與每一列的 screeningBp', async () => {
    const r = await on.request('/api/admin/revenue-split', { headers: { Authorization: `Bearer ${god()}` } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.screening).toBe(true);
    expect(body.rates).toEqual([{ scope: 'company', refId: 3, platformBp: null, companyBp: null, screeningBp: 1000 }]);
    expect(calls.listOpts).toEqual([{ screening: true }]);
  });

  it('開著：單位可以設、清掉；預設與推薦人帶了就 400、不寫', async () => {
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'company', refId: 3, platformPercent: null, companyPercent: null, screeningPercent: '12.5' }))).status).toBe(200);
    expect(calls.rates.at(-1)).toEqual({ scope: 'company', refId: 3, platformBp: null, companyBp: null, screeningBp: 1250 });
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'company', refId: 3, platformPercent: '20', companyPercent: null, screeningPercent: '' }))).status).toBe(200);
    expect(calls.rates.at(-1)).toEqual({ scope: 'company', refId: 3, platformBp: 2000, companyBp: null, screeningBp: null });
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'default', platformPercent: '20', screeningPercent: '10' }))).status).toBe(400);
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'referrer', refId: 7, companyPercent: '20', screeningPercent: '10' }))).status).toBe(400);
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'company', refId: 3, screeningPercent: '101' }))).status).toBe(400);
    expect(calls.rates).toHaveLength(2);
    expect((await on.request('/api/admin/revenue-split/rates', json(god(), { scope: 'referrer', refId: 7, companyPercent: '20' }))).status).toBe(200);
    expect(calls.rates.at(-1)).toEqual({ scope: 'referrer', refId: 7, platformBp: null, companyBp: 2000, screeningBp: null });
  });

  it('公司成員碰不到', async () => {
    expect((await on.request('/api/admin/revenue-split/rates', json(member(), { scope: 'company', refId: 3, screeningPercent: '10' }))).status).toBe(403);
    expect(calls.rates).toEqual([]);
  });

  it('關著：與 #122 之前一樣——不讀不寫篩查渠道比例，送了也不理', async () => {
    const body = await (await off.request('/api/admin/revenue-split', { headers: { Authorization: `Bearer ${god()}` } })).json();
    expect('screening' in body).toBe(false);
    expect(calls.listOpts).toEqual([undefined]);
    expect((await off.request('/api/admin/revenue-split/rates', json(god(), { scope: 'company', refId: 3, platformPercent: '20', screeningPercent: '10' }))).status).toBe(200);
    expect(calls.rates.at(-1)).toEqual({ scope: 'company', refId: 3, platformBp: 2000, companyBp: null });
  });
});

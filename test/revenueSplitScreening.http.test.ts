import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';
import ExcelJS from 'exceljs';
import { signAdminToken } from '../src/admin/adminAuth';

/**
 * 清分改看服務關係（#122，ADR-0020 第 8 點）的後台：單位那一層多一個篩查渠道比例。
 * `server.ts` 的開關還是佔位（永遠是關），所以這裡直接掛後台路由、帶 `serviceRelations: true`，另掛一份不帶的對照。
 */
const calls = vi.hoisted(() => ({ rates: [] as any[], listOpts: [] as any[], exports: [] as any[] }));
const SNAP4 = {
  v: 1,
  party: { kind: 'company_referrer', companyId: 3, companyName: '某某康复', referrerId: 7, referrerName: '王老师', referrerKind: 'therapist' },
  feeBp: 60,
  platformBp: 2000,
  companyBp: 2000,
  screening: { companyId: 5, companyName: '最早那家', bp: 1000 },
};

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
  listSplitOrders: async () => [
    { id: 1, userId: 4, outTradeNo: 'N1', transactionId: 'W1', scope: 't2', months: null, amountFen: 19900, status: 'success', paidAt: '2026-11-24T02:00:00.000Z', snapshot: SNAP4 },
  ],
  recordExport: async (entry: any) => {
    calls.exports.push(entry);
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
  calls.exports.length = 0;
});

async function sheetsOf(resp: Response): Promise<string[][][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await resp.arrayBuffer()) as any);
  return wb.worksheets.map(ws => ws.getSheetValues().filter(Boolean).map((r: any) => r.slice(1).map((v: any) => (v === undefined || v === null ? '' : String(v)))));
}
const exportFrom = (c: TestClient) =>
  c.request('/api/admin/revenue-split/export', { method: 'POST', headers: { Authorization: `Bearer ${god()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: '2026-11-01', to: '2026-11-30' }) });

describe('對帳與匯出：多一欄篩查渠道', () => {
  it('開著：.xlsx 的明細與按對方匯總都有篩查渠道與那一份金額；照舊記 admin_exports', async () => {
    const resp = await exportFrom(on);
    expect(resp.status).toBe(200);
    const [detail, byParty] = await sheetsOf(resp);
    expect(detail[0]).toEqual([
      '付款时间', '商户订单号', '微信订单号', '家长编号', '项目', '状态', '对方', '筛查渠道', '比例',
      '实付（元）', '微信手续费（元）', '可分金额（元）', '平台（元）', '合作公司（元）', '推荐人／治疗师（元）', '筛查渠道（元）',
    ]);
    expect(detail[1]).toEqual([
      '2026-11-24', 'N1', 'W1', '4', 'T2 深度评估', '已付款', '某某康复 ＋ 王老师（治疗师）', '最早那家', '平台 20% · 公司 20%／治疗师 80% · 筛查渠道 10%',
      '199.00', '1.19', '197.81', '39.57', '28.48', '113.94', '15.82',
    ]);
    expect(detail.at(-1)!.slice(-7)).toEqual(['199.00', '1.19', '197.81', '39.57', '28.48', '113.94', '15.82']);
    expect(byParty[0]).toEqual(['对方', '筛查渠道', '笔数', '合作公司（元）', '推荐人／治疗师（元）', '筛查渠道（元）', '平台（元）']);
    expect(byParty[1]).toEqual(['某某康复 ＋ 王老师（治疗师）', '最早那家', '1', '28.48', '113.94', '15.82', '39.57']);
    expect(calls.exports).toEqual([expect.objectContaining({ adminUserId: 30, condition: { kind: 'all' }, kind: 'revenue_split', rowCount: 1 })]);
  });

  it('關著：.xlsx 與 #122 之前一樣（沒有篩查渠道那兩欄）', async () => {
    const [detail, byParty] = await sheetsOf(await exportFrom(off));
    expect(detail[0]).not.toContain('筛查渠道');
    expect(detail[0]).toHaveLength(14);
    expect(byParty[0]).toEqual(['对方', '笔数', '合作公司（元）', '推荐人／治疗师（元）', '平台（元）']);
  });

  it('對帳畫面：每一列帶篩查渠道名字與金額', async () => {
    const body = await (await on.request('/api/admin/revenue-split/orders?from=2026-11-01&to=2026-11-30', { headers: { Authorization: `Bearer ${god()}` } })).json();
    expect(body.rows[0]).toMatchObject({ screeningName: '最早那家', amounts: { screeningFen: 1582 } });
    expect(body.totals.screeningFen).toBe(1582);
    expect(body.byParty[0]).toMatchObject({ screeningName: '最早那家', screeningFen: 1582 });
  });
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

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 清分（客戶 11/03〈清分〉，ADR-0016，`REVENUE_SPLIT`）：開單時把對方與比例記在那一筆訂單上；
 * 後台「清分」只有全域管理員碰得到（看比例、改比例、看對帳、匯出並記一筆 admin_exports）。資料層以替身供應。
 */
process.env.REVENUE_SPLIT = '1';
process.env.WECHAT_FEE_BP = '60';
process.env.SESSION_SECRET ||= 'test-session-secret-for-split';

const users: Record<number, { id: number; phone: string }> = {};
for (let i = 1; i <= 10; i++) users[i] = { id: i, phone: `139000000${String(i).padStart(2, '0')}` };

function t1(dimensionId: string, status: 'normal' | 'borderline' | 'delay') {
  return { dimensionId, dimensionName: dimensionId, tierId: 'T1', score: 0, maxScore: 8, status, completedAt: '2026-11-01T00:00:00Z' };
}
const SCORES = [
  t1('language', 'delay'), t1('attention', 'delay'), t1('sensory_processing', 'borderline'),
  t1('cognitive', 'normal'), t1('social_emotional', 'normal'), t1('emotion_behavior', 'normal'),
  t1('gross_motor', 'normal'), t1('self_care', 'normal'), t1('learning_ability', 'normal'),
];

const db = vi.hoisted(() => ({ payments: [] as any[], snapshots: [] as Array<{ paymentId: number; snapshot: any }>, failSnapshot: false, failRates: false }));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => null,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => ({ user_id: id, child: { name: '小明', birthDate: '2022-11-07', ageMonth: 48, gender: 'boy' }, completedScores: SCORES }),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  createPayment: async (input: any) => {
    db.payments.push(input);
    return db.payments.length;
  },
}));

vi.mock('../src/db/revenueSplit', () => ({
  loadSplitRates: async () => {
    if (db.failRates) throw new Error('db down');
    return {
      default: { platformBp: null, companyBp: null },
      company: new Map([[3, { platformBp: 1500, companyBp: null }]]),
      referrer: new Map(),
    };
  },
  loadSplitAttribution: async (userId: number) =>
    userId === 2
      ? { company: null, referrer: { id: 7, name: '王老师', kind: 'therapist', company: { id: 3, name: '某某康复' } } }
      : { company: null, referrer: null },
  saveSplitSnapshot: async (paymentId: number, snapshot: any) => {
    if (db.failSnapshot) throw new Error('db down');
    db.snapshots.push({ paymentId, snapshot });
  },
}));

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    { id: 31, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 7, referrerActive: true },
  ];
  const rates: any[] = [];
  const exports: any[] = [];
  const snapshot = { v: 1, party: { kind: 'company', companyId: 3, companyName: '某某康复' }, feeBp: 60, platformBp: 2000, companyBp: null };
  return {
    __rates: rates,
    __exports: exports,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [{ id: 3, name: '某某康复', slug: 'mm', active: true }];
    },
    async findCompanyById(id: number) {
      return id === 3 ? { id: 3, name: '某某康复', slug: 'mm', active: true } : null;
    },
    async listReferrers() {
      return [{ id: 7, name: '王老师', kind: 'therapist', companyId: 3, companyName: '某某康复', active: true }];
    },
    async findReferrer(id: number) {
      return id === 7 ? { id: 7, name: '王老师', kind: 'therapist', companyId: 3, companyName: '某某康复', active: true } : null;
    },
    async listSplitRates() {
      return rates;
    },
    async setSplitRate(input: any) {
      rates.push(input);
    },
    async listSplitOrders(from: string, to: string) {
      // 這一段假裝超過上限（資料層丟 SPLIT_TOO_MANY，不回截掉的清單）
      if (from === '2026-01-01') throw Object.assign(new Error('too many'), { code: 'SPLIT_TOO_MANY' });
      return [
        { id: 1, userId: 4, outTradeNo: 'N1', transactionId: 'W1', scope: 't2', months: null, amountFen: 1990, status: 'success', paidAt: `${from}T02:00:00.000Z`, snapshot },
        { id: 2, userId: 5, outTradeNo: 'N2', transactionId: null, scope: 'plan', months: 3, amountFen: 29900, status: 'success', paidAt: `${to}T02:00:00.000Z`, snapshot: null },
      ];
    },
    async recordExport(entry: any) {
      exports.push(entry);
    },
  };
});

let client: TestClient;
let store: any;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

afterAll(async () => {
  await client.close();
});

describe('開單時記下這一筆怎麼分', () => {
  const pay = (userId: number) => client.postJson('/api/payment/create', { scope: 't2' }, bearer(userId));

  it('公司旗下的治療師：三方、平台照公司的 15%、手續費 0.6%', async () => {
    const resp = await pay(2);
    expect(resp.status).toBe(200);
    const last = db.snapshots.at(-1)!;
    expect(last.paymentId).toBe(db.payments.length);
    expect(last.snapshot).toMatchObject({
      v: 1,
      feeBp: 60,
      platformBp: 1500,
      companyBp: 2000,
      party: { kind: 'company_referrer', companyId: 3, companyName: '某某康复', referrerId: 7, referrerName: '王老师', referrerKind: 'therapist' },
    });
  });

  it('沒有合作方：全部是平台的', async () => {
    await pay(1);
    expect(db.snapshots.at(-1)!.snapshot).toMatchObject({ party: { kind: 'none' }, platformBp: 10000 });
  });

  it('比例讀不到：500，而且連待付款的那一列都不開', async () => {
    db.failRates = true;
    const before = db.payments.length;
    try {
      expect((await pay(3)).status).toBe(500);
      expect(db.payments.length).toBe(before);
    } finally {
      db.failRates = false;
    }
  });

  it('記不下來就不往下開單（500），不出一筆沒記比例的單', async () => {
    db.failSnapshot = true;
    try {
      expect((await pay(3)).status).toBe(500);
    } finally {
      db.failSnapshot = false;
    }
  });
});

describe('後台「清分」', () => {
  async function token(email: string, pw: string) {
    return (await (await client.postJson('/api/admin/login', { email, password: pw })).json()).token as string;
  }
  const h = (t: string) => ({ Authorization: `Bearer ${t}` });
  const put = (t: string, body: unknown) =>
    client.request('/api/admin/revenue-split/rates', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...h(t) }, body: JSON.stringify(body) });

  it('推薦人帳號 403（只有全域管理員）', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    expect((await client.get('/api/admin/revenue-split', h(t))).status).toBe(403);
    expect((await put(t, { scope: 'default', platformPercent: '50' })).status).toBe(403);
    expect((await client.get('/api/admin/revenue-split/orders?from=2026-11-01&to=2026-11-07', h(t))).status).toBe(403);
    expect((await client.postJson('/api/admin/revenue-split/export', { from: '2026-11-01', to: '2026-11-07' }, h(t))).status).toBe(403);
  });

  it('看設定：手續費、程式預設、公司與推薦人', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const body = await (await client.get('/api/admin/revenue-split', h(t))).json();
    expect(body).toMatchObject({ feeBp: 60, fallback: { platformBp: 2000, companyBp: 2000 } });
    expect(body.companies).toEqual([{ id: 3, name: '某某康复', active: true }]);
    expect(body.referrers[0]).toMatchObject({ id: 7, companyId: 3 });
  });

  it('改比例：百分比換成萬分比；留空＝沿用上一層', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await put(t, { scope: 'default', platformPercent: '25', companyPercent: '' })).status).toBe(200);
    expect(store.__rates.at(-1)).toEqual({ scope: 'default', refId: 0, platformBp: 2500, companyBp: null });
    expect((await put(t, { scope: 'company', refId: 3, platformPercent: '12.5', companyPercent: null })).status).toBe(200);
    expect(store.__rates.at(-1)).toEqual({ scope: 'company', refId: 3, platformBp: 1250, companyBp: null });
    expect((await put(t, { scope: 'referrer', refId: 7, companyPercent: '10' })).status).toBe(200);
    expect(store.__rates.at(-1)).toEqual({ scope: 'referrer', refId: 7, platformBp: null, companyBp: 1000 });
  });

  it.each([
    [{ scope: 'all', platformPercent: '20' }, 400],
    [{ scope: 'company', platformPercent: '20' }, 400],
    [{ scope: 'company', refId: 3, platformPercent: '120' }, 400],
    [{ scope: 'company', refId: 3, platformPercent: 'abc' }, 400],
    [{ scope: 'company', refId: 99, platformPercent: '20' }, 404],
    [{ scope: 'referrer', refId: 99, platformPercent: '20' }, 404],
  ])('改比例：不對的輸入（%j）→ %i', async (body, status) => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await put(t, body)).status).toBe(status);
  });

  it('對帳：每一列各方金額、合計不含沒記比例的', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const body = await (await client.get('/api/admin/revenue-split/orders?from=2026-11-01&to=2026-11-07', h(t))).json();
    expect(body.rows[0]).toMatchObject({ party: '合作公司 · 某某康复', amounts: { amountFen: 1990, feeFen: 12, netFen: 1978, companyFen: 1582, platformFen: 396 } });
    expect(body.rows[1]).toMatchObject({ party: '未记录', amounts: null });
    expect(body.totals).toMatchObject({ orders: 1, unrecorded: 1, amountFen: 1990 });
  });

  it.each([
    'from=2026-11-08&to=2026-11-01',
    'from=2026-11-01',
    'from=2025-01-01&to=2026-11-07',
    'from=2026-13-01&to=2026-13-02',
  ])('對帳：日期不對 400（%s）', async q => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await client.get(`/api/admin/revenue-split/orders?${q}`, h(t))).status).toBe(400);
  });

  it('對帳與匯出：超過上限 413，不給截掉一半的合計、也不記匯出', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const before = store.__exports.length;
    const view = await client.get('/api/admin/revenue-split/orders?from=2026-01-01&to=2026-12-31', h(t));
    expect(view.status).toBe(413);
    expect((await view.json()).code).toBe('SPLIT_TOO_MANY');
    const file = await client.postJson('/api/admin/revenue-split/export', { from: '2026-01-01', to: '2026-12-31' }, h(t));
    expect(file.status).toBe(413);
    expect(store.__exports.length).toBe(before);
  });

  it('匯出：.xlsx、記一筆 admin_exports（範圍 all、日期）', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/revenue-split/export', { from: '2026-11-01', to: '2026-11-07' }, h(t));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('spreadsheetml');
    expect(resp.headers.get('content-disposition')).toContain(encodeURIComponent('清分对帐-20261101-20261107.xlsx'));
    expect(store.__exports.at(-1)).toMatchObject({ adminUserId: 30, condition: { kind: 'all' }, kind: 'revenue_split', rowCount: 2, filters: '{"from":"2026-11-01","to":"2026-11-07"}' });
  });
});

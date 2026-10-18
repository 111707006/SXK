import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 後台家長彙總與導出（#69，規格 docs/specs/client-changes-2026-10-17.md §3.1）—— 專案 B。
 *
 * 要釘住的：
 * 1. 全域管理員與公司成員都看得到、導得出；公司成員只拿得到自家（範圍走 `withScope`，不加 `requireGlobal`）。
 * 2. 沒做過 T1 的不列；一個孩子一行，是最近一次（`completed_scores` 裡每個維度最新的那一格）。
 * 3. 九維格是存下來的判定（`5/8`、紅黃綠），需关注几个方面＝紅＋黃。
 * 4. 篩查渠道（CONTEXT.md）：B 是歸屬的公司名，未歸屬寫「未归属」。
 * 5. 每次導出在 `admin_exports` 記一筆（誰、範圍、笔数）；記不下來就不給檔。
 *
 * 資料層是替身，回的是**原始資料**（孩子檔案、成績 JSON、公司名），整理成一行一行的那一段是正式程式碼。
 * 替身用正式的 `matchesCompanyCondition` 過濾，路由傳下來的是哪個條件才驗得到。
 */

process.env.APP_MODE = 't1only';

const T = (dimensionId: string, score: number, status: string, completedAt = '2026-10-10T02:00:00.000Z', extra: object = {}) => ({
  dimensionId, dimensionName: dimensionId, tierId: 'T1', score, maxScore: 8, status, completedAt, ...extra,
});

/** 九個維度，`DIMENSIONS_DATA` 的順序。 */
const DIMS = [
  'gross_motor', 'sensory_processing', 'emotion_behavior', 'language', 'social_emotional',
  'cognitive', 'attention', 'self_care', 'learning_ability',
];

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Cond = import('../src/admin/companyScope').CompanyCondition;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);

  const db = {
    companies: [
      { id: 1, name: '甲机构', slug: 'jia', wecomWebhookUrl: null, logoUrl: null, active: true, createdAt: null },
      { id: 2, name: '乙机构', slug: 'yi', wecomWebhookUrl: null, logoUrl: null, active: true, createdAt: null },
    ],
    admins: [
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
    ],
    sources: [] as any[],
    exports: [] as any[],
    failExportLog: false,
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
    async findCompanyById(id: number) {
      return db.companies.find(c => c.id === id) ?? null;
    },
    async listCompanies() {
      return db.companies;
    },
    async recordCompanySwitch() {},
    async listSummarySources(condition: Cond) {
      return db.sources.filter(s => matchesCompanyCondition(condition, s));
    },
    async recordExport(entry: any) {
      if (db.failExportLog) throw new Error('db down');
      db.exports.push(entry);
    },
  };
});

let client: TestClient;
let db: any;

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}
const h = (token: string) => ({ Authorization: `Bearer ${token}` });

async function loginGlobalOn(selection: unknown): Promise<string> {
  const token = await login('god@sxk.com', 'pw-god-123');
  const resp = await client.postJson('/api/admin/select-company', { selection }, h(token));
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function source(over: Partial<any>): any {
  return {
    userId: 0,
    phone: null,
    companyId: null,
    companyName: null,
    child: { name: '孩子' },
    scores: [],
    reportHistory: [],
    bookingCount: 0,
    handoffImports: [],
    ...over,
  };
}

const allNine = (status = 'normal', score = 7) => DIMS.map(d => T(d, score, status));

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  db = (await import('../src/admin/adminStore') as any).__db;
});

beforeEach(() => {
  db.exports = [];
  db.failExportLog = false;
  db.sources = [
    source({ userId: 101, phone: '13800000101', companyId: 1, companyName: '甲机构', child: { name: '甲家孩子' }, scores: allNine() }),
    source({ userId: 202, phone: '13800000202', companyId: 2, companyName: '乙机构', child: { name: '乙家孩子' }, scores: allNine() }),
    source({ userId: 303, phone: '13800000303', companyId: null, companyName: null, child: { name: '没有归属的孩子' }, scores: allNine() }),
  ];
});

afterAll(async () => {
  await client.close();
});

describe('彙總：誰看得到、看得到誰', () => {
  it('公司成員看得到彙總，只有自家的家長', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.get('/api/admin/parent-summary', h(token));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.rows.map((r: any) => r.childName)).toEqual(['甲家孩子']);
  });
});

describe('彙總：視野', () => {
  it('全域管理員切到哪一家就看到哪一家；切到「未归属」只看到未歸屬的', async () => {
    const onYi = await loginGlobalOn({ companyId: 2 });
    const yi = await (await client.get('/api/admin/parent-summary', h(onYi))).json();
    expect(yi.rows.map((r: any) => r.childName)).toEqual(['乙家孩子']);

    const onNone = await loginGlobalOn('unassigned');
    const none = await (await client.get('/api/admin/parent-summary', h(onNone))).json();
    expect(none.rows.map((r: any) => r.childName)).toEqual(['没有归属的孩子']);
  });

  it('全域管理員還沒選公司：409，與其他家長資料同一個回應', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.get('/api/admin/parent-summary', h(token));
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('NO_COMPANY_SELECTED');
  });

  it('未登入 401', async () => {
    expect((await client.get('/api/admin/parent-summary')).status).toBe(401);
  });
});

describe('彙總：一行的內容', () => {
  it('沒做過 T1 的不列（沒有成績、只有 T2 成績都算沒做過）', async () => {
    db.sources.push(
      source({ userId: 104, companyId: 1, companyName: '甲机构', child: { name: '还没筛查' }, scores: [] }),
      source({
        userId: 105, companyId: 1, companyName: '甲机构', child: { name: '只有深度评估' },
        scores: [{ ...T('language', 3, 'delay'), tierId: 'T2' }],
      }),
    );
    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (await client.get('/api/admin/parent-summary', h(token))).json();
    expect(body.rows.map((r: any) => r.childName)).toEqual(['甲家孩子']);
  });

  it('九維格照 DIMENSIONS_DATA 的順序、是存下來的判定；同一維度兩格取最新；需关注＝紅＋黃', async () => {
    const scores = allNine('normal', 7);
    scores[3] = T('language', 3, 'delay', '2026-10-12T02:00:00.000Z', { assessedAgeMonth: 30 });
    scores[4] = T('social_emotional', 5, 'borderline', '2026-10-12T02:00:00.000Z');
    // 上一次篩查留下的同維度舊格子（較早）：不採用。
    scores.push(T('gross_motor', 1, 'delay', '2026-09-01T02:00:00.000Z'));
    db.sources[0] = source({ userId: 101, phone: '13800000101', companyId: 1, companyName: '甲机构', child: { name: '甲家孩子' }, scores });

    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (await client.get('/api/admin/parent-summary', h(token))).json();
    expect(body.dimensions.map((d: any) => d.id)).toEqual(DIMS);
    expect(body.dimensions[0].name).toBe('动作发展');

    const [row] = body.rows;
    expect(row).toMatchObject({
      childName: '甲家孩子',
      phone: '13800000101',
      assessedAgeMonth: 30,
      ageLabel: '2岁6个月',
      screenedAt: '2026-10-12T02:00:00.000Z',
      flaggedCount: 2,
    });
    expect(row.cells[0]).toEqual({ score: 7, maxScore: 8, status: 'normal' });
    expect(row.cells[3]).toEqual({ score: 3, maxScore: 8, status: 'delay' });
    expect(row.cells[4]).toEqual({ score: 5, maxScore: 8, status: 'borderline' });
  });

  it('年齡是篩查當時的：成績沒記月齡就讀最近一份篩查報告裡的孩子，不用今天的', async () => {
    db.sources[0] = source({
      userId: 101, companyId: 1, companyName: '甲机构',
      child: { name: '甲家孩子', birthDate: '2020-01-01', ageMonth: 80 },
      scores: allNine(),
      reportHistory: [{ id: 'r1', type: 'T1_SCREENING', child: { name: '甲家孩子', ageMonth: 12 }, scores: [], createdAt: '2026-10-10T03:00:00.000Z' }],
    });
    const token = await login('a@jia.com', 'pw-jia-123');
    const [row] = (await (await client.get('/api/admin/parent-summary', h(token))).json()).rows;
    expect(row.ageLabel).toBe('1岁0个月');
  });

  it('篩查渠道（B）：歸屬的公司名；未歸屬寫「未归属」', async () => {
    const onJia = await login('a@jia.com', 'pw-jia-123');
    expect((await (await client.get('/api/admin/parent-summary', h(onJia))).json()).rows[0].channel).toBe('甲机构');
    const onNone = await loginGlobalOn('unassigned');
    expect((await (await client.get('/api/admin/parent-summary', h(onNone))).json()).rows[0].channel).toBe('未归属');
  });

  it('與家長列表同一組篩選：已預約／尚未預約、最早篩查在前', async () => {
    db.sources.push(
      source({ userId: 106, companyId: 1, child: { name: '早' }, bookingCount: 1, scores: allNine().map(s => ({ ...s, completedAt: '2026-01-01T00:00:00.000Z' })) }),
    );
    const token = await login('a@jia.com', 'pw-jia-123');
    const get = async (q: string) =>
      (await (await client.get(`/api/admin/parent-summary?${q}`, h(token))).json()).rows.map((r: any) => r.childName);
    expect(await get('sort=newest')).toEqual(['甲家孩子', '早']);
    expect(await get('sort=oldest')).toEqual(['早', '甲家孩子']);
    expect(await get('booked=booked')).toEqual(['早']);
    expect(await get('booked=not_booked')).toEqual(['甲家孩子']);
  });
});

async function readXlsx(resp: Response): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await resp.arrayBuffer());
  return wb.worksheets[0];
}

describe('導出 xlsx', () => {
  it('公司成員導得出；檔案裡只有自家；檔名 家长汇总-YYYYMMDD.xlsx', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.postJson('/api/admin/parent-summary/export', {}, h(token));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('spreadsheetml');
    const disposition = resp.headers.get('content-disposition') ?? '';
    expect(decodeURIComponent(disposition)).toMatch(/家长汇总-\d{8}\.xlsx/);

    const sheet = await readXlsx(resp);
    const names: string[] = [];
    sheet.eachRow((row, i) => {
      if (i > 1) names.push(String(row.getCell(1).value));
    });
    expect(names).toEqual(['甲家孩子']);
  });

  it('表頭、欄位與九維格的底色（紅／黃／綠照判定）', async () => {
    const scores = allNine('normal', 7);
    scores[3] = T('language', 3, 'delay', '2026-10-12T02:00:00.000Z', { assessedAgeMonth: 30 });
    scores[4] = T('social_emotional', 5, 'borderline', '2026-10-12T02:00:00.000Z');
    db.sources[0] = source({ userId: 101, phone: '13800000101', companyId: 1, companyName: '甲机构', child: { name: '甲家孩子' }, scores });

    const token = await login('a@jia.com', 'pw-jia-123');
    const sheet = await readXlsx(await client.postJson('/api/admin/parent-summary/export', {}, h(token)));
    const header = (sheet.getRow(1).values as any[]).slice(1);
    expect(header).toEqual([
      '孩子名字', '电话', '年龄', '筛查渠道', '筛查日期',
      '动作发展', '感觉处理', '情绪与行为', '语言沟通', '社交互动', '认知', '注意力与执行', '生活自理与适应', '学习能力',
      '需关注几个方面',
    ]);
    const row = sheet.getRow(2);
    expect((row.values as any[]).slice(1, 6)).toEqual(['甲家孩子', '13800000101', '2岁6个月', '甲机构', '2026-10-12']);
    expect(row.getCell(6).value).toBe('7/8');
    expect(row.getCell(9).value).toBe('3/8');
    expect(row.getCell(15).value).toBe(2);

    const fill = (col: number) => (row.getCell(col).fill as any)?.fgColor?.argb;
    const green = fill(6);
    const red = fill(9);
    const yellow = fill(10);
    expect(new Set([green, red, yellow]).size).toBe(3);
    expect([green, red, yellow].every(Boolean)).toBe(true);
    // 九格裡的每一格都上了色：綠的那七格同一個顏色。
    expect([6, 7, 8, 11, 12, 13, 14].map(fill)).toEqual(Array(7).fill(green));
  });

  it('每次導出在 admin_exports 記一筆：誰、範圍、笔数、篩選', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    await client.postJson('/api/admin/parent-summary/export', { booked: 'all', sort: 'oldest' }, h(token));
    const onYi = await loginGlobalOn({ companyId: 2 });
    await client.postJson('/api/admin/parent-summary/export', {}, h(onYi));

    expect(db.exports).toHaveLength(2);
    expect(db.exports[0]).toMatchObject({
      adminUserId: 10, condition: { kind: 'company', companyId: 1 }, kind: 'parent_summary', rowCount: 1,
    });
    expect(db.exports[0].filters).toContain('oldest');
    expect(db.exports[1]).toMatchObject({ adminUserId: 30, condition: { kind: 'company', companyId: 2 }, rowCount: 1 });
  });

  it('記不下紀錄就不給檔（500）', async () => {
    db.failExportLog = true;
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.postJson('/api/admin/parent-summary/export', {}, h(token));
    expect(resp.status).toBe(500);
    expect(resp.headers.get('content-type')).toContain('json');
  });

  it('全域管理員沒選公司：409，不記紀錄', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/parent-summary/export', {}, h(token));
    expect(resp.status).toBe(409);
    expect(db.exports).toHaveLength(0);
  });
});

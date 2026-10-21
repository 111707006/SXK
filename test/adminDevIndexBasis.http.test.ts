import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bandScores } from './helpers/t1Scores';
import { developmentIndex } from '../src/developmentIndex/developmentIndex';
import { attainmentIndex } from '../src/developmentIndex/attainment';

/**
 * 發育指數的開關（`DEV_INDEX_BASIS=attainment`，使用者 2026-10-18）：後台匯總那一欄改用達成率算，
 * 欄位與其他格子不變。資料層替身與 `adminParentSummary.http.test.ts` 同一份。
 */

process.env.APP_MODE = 't1only';
process.env.DEV_INDEX_BASIS = 'attainment';

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

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  db = (await import('../src/admin/adminStore') as any).__db;
});

beforeEach(() => {
  db.exports = [];
  db.failExportLog = false;
});

afterAll(async () => {
  await client.close();
  delete process.env.DEV_INDEX_BASIS;
});

describe('DEV_INDEX_BASIS=attainment', () => {
  it('匯總表的發育指數是達成率算的；沒有逐題作答的舊成績也有數字', async () => {
    // 語言、認知八題都還不能，其餘做得到：總分 56/72 → 78％ → 90；同齡估算給的是 100（兩套真的不一樣）
    const scores = bandScores(30, d => (d === 'language' || d === 'cognitive' ? 0 : 2));
    const old = bandScores(30, () => 2, false);
    db.sources = [
      source({ userId: 101, companyId: 1, companyName: '甲机构', child: { name: '这次' }, scores }),
      source({ userId: 102, companyId: 1, companyName: '甲机构', child: { name: '旧成绩' }, scores: old }),
    ];
    expect(attainmentIndex(scores)).toBe(90);
    expect(developmentIndex(scores, 30)).toBe(100);

    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (await client.get('/api/admin/parent-summary', h(token))).json();
    const indexOf = (name: string) => body.rows.find((r: any) => r.childName === name)?.developmentIndex;
    expect(indexOf('这次')).toBe(90);
    expect(indexOf('旧成绩')).toBe(100);
  });
});

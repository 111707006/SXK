import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 兌換碼對帳匯出（#113）：只有全域管理員；欄位與筆數對；每次都記一筆 `admin_exports`（範圍 all）；記不下就 500、不給檔。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-ledger';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    { id: 10, email: 'a@jia.com', role: 'company_member', companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123'), referrerId: null, referrerActive: false },
    { id: 40, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 7, referrerActive: true },
  ];
  const state = { records: [] as any[], failRecord: false };
  return {
    __state: state,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },
    async listRedeemLedger() {
      return [
        { referrerName: '乙治疗师', referrerKind: 'therapist', code: 'ABCD2345XY', months: 3, status: 'used', usedByPhone: '13800000001', usedAt: '2026-10-23T03:00:00.000Z', passEndsOn: '2027-01-14' },
        { referrerName: '甲渠道', referrerKind: 'channel', code: 'EFGH6789ZZ', months: 1, status: 'unused', usedByPhone: null, usedAt: null, passEndsOn: null },
      ];
    },
    async recordExport(entry: any) {
      if (state.failRecord) throw new Error('db down');
      state.records.push(entry);
    },
  };
});

let client: TestClient;
let store: any;
const tokenOf = async (email: string, pw: string) => (await (await client.postJson('/api/admin/login', { email, password: pw })).json()).token as string;
const exportAs = async (email: string, pw: string) =>
  client.request('/api/admin/redeem-codes/export', { method: 'POST', headers: { Authorization: `Bearer ${await tokenOf(email, pw)}`, 'Content-Type': 'application/json' }, body: '{}' });

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  store.__state.records = [];
  store.__state.failRecord = false;
});

afterAll(async () => {
  await client.close();
});

describe('兌換碼對帳匯出', () => {
  it.each([['a@jia.com', 'pw-jia-123'], ['ref@a.com', 'pw-ref-123']])('%s 不是全域管理員 → 403、不記', async (email, pw) => {
    expect((await exportAs(email, pw)).status).toBe(403);
    expect(store.__state.records).toEqual([]);
  });

  it('全域管理員：欄位與筆數對、記一筆範圍 all', async () => {
    const resp = await exportAs('god@sxk.com', 'pw-god-123');
    expect(resp.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await resp.arrayBuffer()) as any);
    const sheet = wb.worksheets[0];
    const rows = sheet.getSheetValues().filter(Boolean).map((r: any) => r.slice(1));
    expect(rows[0]).toEqual(['推荐人', '类型', '兑换码', '方案（月）', '状态', '使用家长手机号', '使用时间', '使用权到期日']);
    expect(rows[1]).toEqual(['乙治疗师', '治疗师', 'ABCD-2345-XY', '3', '已用', '13800000001', '2026-10-23', '2027-01-14']);
    expect(rows[2].slice(0, 5)).toEqual(['甲渠道', '渠道商', 'EFGH-6789-ZZ', '1', '未用']);
    expect(rows).toHaveLength(3);
    expect(store.__state.records).toEqual([expect.objectContaining({ adminUserId: 30, condition: { kind: 'all' }, kind: 'redeem_codes', rowCount: 2 })]);
  });

  it('紀錄記不下 → 500、不給檔', async () => {
    store.__state.failRecord = true;
    const resp = await exportAs('god@sxk.com', 'pw-god-123');
    expect(resp.status).toBe(500);
    expect(resp.headers.get('content-type')).toContain('application/json');
  });
});

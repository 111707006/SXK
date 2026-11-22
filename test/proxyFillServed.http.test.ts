import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { readFileSync } from 'node:fs';
import { startTestApp, type TestClient } from './helpers/httpApp';

/**
 * 代填照服務關係（#124）：服務關係開關開著時，單位管理者也能代填本單位的家長；推薦人與單位管理者都只能碰
 * `proxyAccess` 允許的（跨單位的家長不能代填）。直接掛 `createAdminRouter`，資料層替身記下拿到的「代填的人」。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-proxy-served';

vi.mock('../src/admin/adminStore', async () => {
  const db = {
    admins: [
      { id: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, active: true, createdAt: null },
      { id: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 70, referrerActive: true },
      { id: 4, email: 'old@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 71, referrerActive: true },
    ] as any[],
    referrers: [
      { id: 70, companyId: 7, active: true, adminUserId: 3 },
      { id: 71, companyId: null, active: true, adminUserId: 4 },
    ],
    // 13800000002 由別單位服務
    calls: [] as any[],
  };
  const other = (phone: string) => phone === '13800000002';
  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async findCompanyById(id: number) {
      return id === 7 ? { id: 7, name: '甲机构', kind: 'institution', active: true } : null;
    },
    async findReferrer(id: number) {
      return db.referrers.find(r => r.id === id) ?? null;
    },
    async proxyLookupServed(party: any, phone: string) {
      db.calls.push({ fn: 'lookupServed', party });
      return other(phone) ? { status: 'other' } : { status: 'unbound', child: null };
    },
    async proxyFillServed(party: any, adminUserId: number, input: any) {
      db.calls.push({ fn: 'fillServed', party, adminUserId });
      return other(input.phone) ? { ok: false, reason: 'other' } : { ok: true, userId: 1, consumedCodeId: 5, endsOn: null };
    },
    async proxyLookup(referrer: any) {
      db.calls.push({ fn: 'lookup', referrerId: referrer.id });
      return { status: 'new' };
    },
  };
});

const { createAdminRouter } = await import('../src/admin/routes');
const { signAdminToken } = await import('../src/admin/adminAuth');
const { DIMENSION_CODES } = await import('../src/t2/types');

function appWith(serviceRelations: boolean) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ multiCompany: true, projectA: true, ...(serviceRelations ? { serviceRelations: true } : {}) }, { redeemCodes: true }));
  return app;
}
const tok = (aid: number, email: string, role: 'company_member' | 'referrer', companyId: number | null) => ({
  Authorization: `Bearer ${signAdminToken({ aid, email, role, companyId, sel: null })}`,
});
const mgr = () => tok(2, 'mgr@a.com', 'company_member', 7);
const zhang = () => tok(3, 'zhang@a.com', 'referrer', null);
const old = () => tok(4, 'old@a.com', 'referrer', null);

const FILL = {
  phone: '13800000001',
  child: { name: '小安', birthDate: '2023-01-01', gender: 'girl' },
  months: 1,
  colors: Object.fromEntries(DIMENSION_CODES.map(d => [d, 'green'])),
  tags: [],
};

let on: TestClient;
let off: TestClient;
let store: any;
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
  store.__db.calls.length = 0;
});

describe('開著：代填的人', () => {
  it('單位管理者：本單位（單位取自工作階段）', async () => {
    expect((await on.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, mgr())).status).toBe(200);
    expect(store.__db.calls).toEqual([{ fn: 'lookupServed', party: { kind: 'unit', companyId: 7 } }]);
  });

  it('推薦人：他與他的單位', async () => {
    await on.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, zhang());
    expect(store.__db.calls).toEqual([{ fn: 'lookupServed', party: { kind: 'referrer', referrerId: 70, companyId: 7 } }]);
  });

  it('推薦人還沒有單位（遷移前）：403，不查', async () => {
    expect((await on.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, old())).status).toBe(403);
    expect(store.__db.calls).toEqual([]);
  });

  it('別單位的家長：查找與送出都 409', async () => {
    expect((await on.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000002' }, mgr())).status).toBe(409);
    const res = await on.postJson('/api/admin/referrer/proxy', { ...FILL, phone: '13800000002' }, mgr());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('OTHER_REFERRER');
  });

  it('送出：proxyFillServed 拿到代填的人與後台帳號', async () => {
    const res = await on.postJson('/api/admin/referrer/proxy', FILL, mgr());
    expect(await res.json()).toEqual({ ok: true, consumedCode: true });
    expect(store.__db.calls).toEqual([{ fn: 'fillServed', party: { kind: 'unit', companyId: 7 }, adminUserId: 2 }]);
  });
});

describe('關著：照舊只有推薦人', () => {
  it('單位管理者 403；推薦人走舊的查找', async () => {
    expect((await off.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, mgr())).status).toBe(403);
    await off.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, zhang());
    expect(store.__db.calls).toEqual([{ fn: 'lookup', referrerId: 70 }]);
  });
});

describe('資料層（開著那一支）', () => {
  const src = readFileSync('src/admin/adminStore.ts', 'utf8');
  const fill = src.slice(src.indexOf('export async function proxyFillServed'), src.indexOf('// ── 兌換碼對帳'));

  it('不能碰的：退回、一個字都不寫（在任何寫入之前）', () => {
    const guard = fill.indexOf("if (proxyAccess(party, current, nullableId(row.screening_company_id)) === 'other') {");
    expect(guard).toBeGreaterThan(-1);
    expect(fill.slice(guard, guard + 200)).toMatch(/await conn\.rollback\(\);\s*return \{ ok: false, reason: 'other' \};/);
    expect(guard).toBeLessThan(fill.indexOf('INSERT INTO users'));
  });

  it('單位層的碼寫 company_id；推薦人才寫推薦綁定', () => {
    expect(fill).toContain('INSERT INTO redeem_batches (company_id, months, quantity, created_by) VALUES (?, ?, 1, ?)');
    expect(fill).toMatch(/if \(party\.kind === 'referrer'\) \{\s*await conn\.execute\(\s*"INSERT IGNORE INTO referrer_bindings/);
  });

  it('還沒有服務關係才掛上，寫一列紀錄（後台、原因＝兌換碼）', () => {
    expect(fill).toMatch(/if \(current === null\) \{\s*const to = proxyTarget\(party\);/);
    expect(fill).toContain("VALUES (?, ?, ?, 'admin', 'code', ?)");
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行就是在 A 上跑。
 * 專案 B 沒有 T2，也就沒有 T2 優惠券：開關設了也不生效，家長與後台那幾支都是 404。
 */
process.env.APP_MODE = 't1only';
process.env.T2_COUPON = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-coupon-b';

const calls: string[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === 1 ? { id, phone: '13800000000', company_id: 1 } : null),
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/db/coupons', () => ({
  async couponOfUser() {
    calls.push('read');
    return null;
  },
  async claimCouponForUser() {
    calls.push('claim');
    return { ok: false, reason: 'invalid' };
  },
}));

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const god = { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-god-123', 4), referrerId: null, referrerActive: false };
  return {
    isAvailable: () => true,
    findAdminUserByEmail: async (email: string) => (email === god.email ? god : null),
    findAdminUserById: async (id: number) => (id === god.id ? god : null),
    listCompanies: async () => [],
    listCouponBatches: async () => {
      calls.push('admin');
      return [];
    },
  };
});

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('專案 B 沒有 T2 優惠券', () => {
  it('家長的讀與兌是 404', async () => {
    expect((await client.get('/api/coupon', bearer(1))).status).toBe(404);
    expect((await client.postJson('/api/coupon', { code: 'AAAA2222BB' }, bearer(1))).status).toBe(404);
  });

  it('後台那幾支是 404', async () => {
    const login = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
    const { token } = await login.json();
    const h = { Authorization: `Bearer ${token}` };
    expect((await client.get('/api/admin/coupons', h)).status).toBe(404);
    expect((await client.postJson('/api/admin/coupons', { quantity: 1 }, h)).status).toBe(404);
    expect((await client.postJson('/api/admin/coupon-codes/1/void', {}, h)).status).toBe(404);
  });

  it('資料層一次都沒被叫到', () => {
    expect(calls).toEqual([]);
  });
});

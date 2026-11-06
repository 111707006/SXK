import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行就是在 A 上跑。
 * 清分（ADR-0016）只在專案 A：B 設了 `REVENUE_SPLIT` 也不生效，後台那幾支是 404、資料層一次都不問。
 */
process.env.APP_MODE = 't1only';
process.env.REVENUE_SPLIT = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-split-b';

const calls: string[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async () => null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/db/revenueSplit', () => ({
  loadSplitRates: async () => {
    calls.push('rates');
    return { default: { platformBp: null, companyBp: null }, company: new Map(), referrer: new Map() };
  },
  loadSplitAttribution: async () => {
    calls.push('who');
    return { company: null, referrer: null };
  },
  saveSplitSnapshot: async () => {
    calls.push('save');
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
    listSplitRates: async () => {
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

describe('專案 B 沒有清分', () => {
  it('後台那幾支是 404', async () => {
    const { token } = await (await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' })).json();
    const h = { Authorization: `Bearer ${token}` };
    expect((await client.get('/api/admin/revenue-split', h)).status).toBe(404);
    expect((await client.get('/api/admin/revenue-split/orders?from=2026-11-01&to=2026-11-07', h)).status).toBe(404);
    expect((await client.postJson('/api/admin/revenue-split/export', { from: '2026-11-01', to: '2026-11-07' }, h)).status).toBe(404);
  });

  it('資料層一次都沒被叫到', () => {
    expect(calls).toEqual([]);
  });
});

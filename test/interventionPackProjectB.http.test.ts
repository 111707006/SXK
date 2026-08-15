import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行，整支測試會在專案 A 的
 * 伺服器上跑，而那裡這條路徑是存在的 —— 拿到的 200 會被讀成「B 也有干預包」。
 */
process.env.APP_MODE = 't1only';

/**
 * 專案 B 不受干預包影響（issue #26 的驗收條件）。
 *
 * B 沒有深度評估，也就沒有干預包。要驗的不是「B 的畫面上看不到它」——
 * 那只是 bundle 裡的一個判斷 —— 而是**這條路徑在 B 的部署裡根本不存在**。
 * 掛在 `tier2Only` 上的路由在 B 註冊到一個永遠不會被掛載的 Router，於是請求
 * 落到 404：沒有處理函式可以被繞過，而 404 也不像 403 那樣順便確認了端點存在。
 */

const PARENT_ID = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000', company_id: 1 } : null),
  listUnlockedDimensions: async () => ['language'],
  // 這一支在 B 一次都不該被呼叫到。真的被呼叫就當場炸掉，而不是靜靜回一格素材。
  findActiveMaterialByCell: async () => {
    throw new Error('專案 B 不該查詢干預素材');
  },
  listActiveSpecialists: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/admin/adminStore', () => ({
  isAvailable: () => false,
  findAdminUserByEmail: async () => null,
  findAdminUserById: async () => null,
  listCompanies: async () => [],
}));

let client: TestClient;
let auth: Record<string, string>;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  auth = bearer(PARENT_ID);
});

afterAll(async () => {
  await client.close();
});

describe('專案 B 沒有干預包', () => {
  it('干預包端點在 B 根本不存在', async () => {
    const resp = await client.get(
      '/api/intervention-pack?dimensionId=language&ageMonth=30&severity=delay',
      auth
    );
    expect(resp.status).toBe(404);
  });

  /**
   * 對照組。少了這兩條，上面那個 404 也可能是「整個伺服器沒起來」——
   * 而那會讓這支測試在 B 真的長出干預包時仍然是綠的。
   */
  it('對照：共用的端點在 B 照常運作', async () => {
    const resp = await client.get('/api/db/status');
    expect(resp.status).toBe(200);
  });

  it('對照：既有的深度評估端點在 B 一樣不存在', async () => {
    const resp = await client.postJson('/api/specialized-report', { dimensionId: 'language' }, auth);
    expect(resp.status).toBe(404);
  });
});

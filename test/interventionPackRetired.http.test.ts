import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * `/api/intervention-pack` 退場（#63，ADR-0005 的後果）。
 *
 * 要驗的是**這條路徑在專案 A 也不存在了**，不只是「回準備中」。它從前掛在 `tier2Only`
 * 上、過 `rejectIfLocked` 的閘門；退場後連處理函式都沒有，請求落到 404 —— 沒有處理函式
 * 可以被繞過，付費牆的 `tier2Only` 群組裡也就沒有它。原本的 HTTP 測試
 * （`interventionPack.http.test.ts`、`interventionPackProjectB.http.test.ts`）隨路由一起
 * 拿掉；「不退回鄰近年齡段、不退回通用方案」那幾條在 `t2ActivityMatch.test.ts`。
 *
 * 刻意用一位**已登入且已解鎖**的家長打：拿到的 404 才說得出是「路徑不存在」，
 * 而不是被身份或付費牆擋下來的另一個數字。
 */

const PARENT_ID = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000', company_id: 1 } : null),
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => ['language'],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
  listActiveSpecialists: async () => [],
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

describe('/api/intervention-pack 不再註冊', () => {
  it('已登入、已解鎖的家長打過去也是 404 —— 路徑本身不存在', async () => {
    const resp = await client.get(
      '/api/intervention-pack?dimensionId=language&ageMonth=30&severity=delay',
      auth
    );
    expect(resp.status).toBe(404);
  });

  it('沒登入也是 404，不是 401 —— 沒有處理函式可以被繞過', async () => {
    const resp = await client.get('/api/intervention-pack?dimensionId=language&ageMonth=30&severity=delay');
    expect(resp.status).toBe(404);
  });
});

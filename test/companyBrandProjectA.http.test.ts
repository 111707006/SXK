import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 A 沒有「每家公司自己的 LOGO」這回事。
 *
 * A 一家合作公司都沒有（`adminCenter.multiCompany = false`，它的家長全部是
 * 森心康直屬）。所以 `/api/company-brand` 註冊在一個**永遠不會被掛載的
 * Router** 上，請求落到 404 —— 與 tier-2/3 端點在 B 上的處置相同：
 * 沒有處理函式就沒有東西可以被繞過，而 404 也不像 403 那樣順便確認了端點存在。
 *
 * 要驗的不是「A 的畫面上不會去要 LOGO」（那只是 bundle 裡的一個判斷），
 * 而是**這條路徑在 A 的部署裡根本不存在**。
 *
 * ⚠️ 這個檔案**刻意不覆寫 `APP_MODE`**：`test/setup/testEnv.ts` 把它釘在
 * 空字串（即 `full`）。在這裡加一行 `APP_MODE = 't1only'` 會讓整支測試變成
 * 綠色的謊 —— 它會去驗 B，而 B 上這條路徑本來就在。
 */

/** 這一支在 A 一次都不該被呼叫到。真的被呼叫就當場炸掉。 */
vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findCompanyLogoBySlug: async () => {
    throw new Error('專案 A 不該查詢合作公司的 LOGO —— 它一家合作公司都沒有');
  },
  findUserById: async () => null,
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
  listActiveSpecialists: async () => [],
  listUnlockedDimensions: async () => [],
}));

vi.mock('../src/admin/adminStore', () => ({
  isAvailable: () => false,
  findAdminUserByEmail: async () => null,
  findAdminUserById: async () => null,
  listCompanies: async () => [],
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('專案 A 上的 /api/company-brand', () => {
  it.each([
    ['帶識別碼', '/api/company-brand?c=kangxing'],
    ['不帶識別碼', '/api/company-brand'],
  ])('%s 都回 404 —— 這條路徑不存在', async (_label, path) => {
    const resp = await client.get(path);
    expect(resp.status).toBe(404);
  });
});

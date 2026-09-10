import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** `/api/company-brand` 只在專案 B 註冊
 * （`multiCompanyOnly`）。少了這一行，整支測試會在專案 A 的伺服器上跑，
 * 每一條都拿到 404 —— 而 404 看起來像「功能沒做」，不像「跑錯產品」。
 */
process.env.APP_MODE = 't1only';

/**
 * 合作公司各自的 LOGO（家長端頁首與登入卡那顆方塊）。
 *
 * 這條路徑**公開、不需要登入** —— 那顆方塊在登入畫面上就要出現，
 * 那時候還沒有帳號可查，唯一的線索是進站連結上的 `?c=<識別碼>`。
 *
 * 這裡真正要抓的有兩件事：
 *
 * 1. **不夾帶公司名稱。** 家長端不顯示合作公司名稱是既有的產品決定
 *    （見 `deploy/schema.sql` 的 `companies.name` 註解）。識別碼印在傳單上，
 *    任何人都拿得到，所以這條路徑的輸出等於對外公開 —— 多回一個欄位就是
 *    悄悄把那個決定推翻掉，而畫面上完全看不出來。
 * 2. **查不到不是錯誤。** 呼叫端在任何情況下都畫得出東西（退回字標），
 *    所以永遠回 200，用 `reason` 說明為什麼沒有。回 500 會讓家長端的
 *    主控台紅一條，看起來像壞了。
 */

const WITH_LOGO = 'kangxing';
const WITHOUT_LOGO = 'mingde';
const LOGO_URL = 'https://cdn.example.com/kangxing-logo.png';

/** 被查過的識別碼，用來證明「形狀不對就不查資料庫」。 */
const queried: string[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  async findCompanyLogoBySlug(slug: string) {
    queried.push(slug);
    // 正式的那一句只 SELECT `logo_url` 一欄，所以替身也只回那一個值 ——
    // 回一整列的話，「有沒有把公司名稱送出去」這件事在這裡就驗不到了。
    return slug === WITH_LOGO ? LOGO_URL : null;
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

async function brand(query: string): Promise<{ status: number; body: any }> {
  const resp = await client.get(`/api/company-brand${query}`);
  return { status: resp.status, body: await resp.json() };
}

describe('取這家合作公司的 LOGO', () => {
  it('設定過的公司回它的 LOGO 網址，不必登入', async () => {
    const { status, body } = await brand(`?c=${WITH_LOGO}`);
    expect(status).toBe(200);
    expect(body.logoUrl).toBe(LOGO_URL);
    expect(body.reason).toBe('ok');
  });

  /**
   * 本檔的核心。這條路徑的輸出等於對外公開 —— 任何人拿到傳單上的識別碼
   * 都問得到。多回一個欄位不會有任何跡象，直到合作公司發現自己的名字
   * 出現在別人看得到的地方。
   */
  it('不夾帶公司名稱或其他任何欄位', async () => {
    const { body } = await brand(`?c=${WITH_LOGO}`);
    expect(Object.keys(body).sort()).toEqual(['logoUrl', 'reason']);
  });

  it('公司在但還沒設 LOGO：回 null，不是錯誤', async () => {
    const { status, body } = await brand(`?c=${WITHOUT_LOGO}`);
    expect(status).toBe(200);
    expect(body.logoUrl).toBeNull();
  });

  it('查無此識別碼：一樣回 200，呼叫端自己退回字標', async () => {
    const { status, body } = await brand('?c=nobody-here');
    expect(status).toBe(200);
    expect(body.logoUrl).toBeNull();
  });

  it('沒帶識別碼（書籤、搜尋、乾淨連結進來）明說 no_slug', async () => {
    const { status, body } = await brand('');
    expect(status).toBe(200);
    expect(body.logoUrl).toBeNull();
    expect(body.reason).toBe('no_slug');
  });

  /**
   * 這是一條公開路徑，每一次查詢都是別人可以免費叫我們做的工。
   * 形狀不對的一律不碰資料庫 —— 與 `/r/:token` 同一個處置。
   */
  it.each([
    ['大寫與符號', '?c=Kang%20Xing!'],
    ['開頭是連字號', '?c=-kangxing'],
    ['只有一個字元', '?c=k'],
    ['路徑穿越', '?c=..%2F..%2Fetc'],
  ])('形狀不對的識別碼（%s）不查資料庫', async (_label, query) => {
    queried.length = 0;
    const { status, body } = await brand(query);
    expect(status).toBe(200);
    expect(body.logoUrl).toBeNull();
    expect(body.reason).toBe('bad_slug');
    expect(queried).toEqual([]);
  });

  // 傳單上印的可能是大寫，家長掃碼進來時網址就是大寫。
  it('大小寫不敏感 —— 傳單上印成大寫也找得到', async () => {
    const { body } = await brand(`?c=${WITH_LOGO.toUpperCase()}`);
    expect(body.logoUrl).toBe(LOGO_URL);
  });
});

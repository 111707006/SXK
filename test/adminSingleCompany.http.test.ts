import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 這一整支測的是**專案 A** 的管理中心：
 * 沒有合作公司，家長全部未歸屬（issue #19）。`testEnv.ts` 已把它釘在 'full'，
 * 這一行是把「這支測試依賴哪一個模式」寫在檔案裡，而不是依賴另一個檔案的預設值。
 */
process.env.APP_MODE = 'full';

/**
 * 管理中心在單一機構模式下的 HTTP 測試（issue #19）。
 *
 * 姊妹檔是 `adminIsolation.http.test.ts`（專案 B，多合作公司，37 條）。
 * 兩支合起來才是這個功能的接縫：同一份路由程式碼在兩種產品模式下必須表現出
 * 兩套行為，而只測其中一邊的話，另一邊壞掉時沒有任何訊號。
 *
 * 這裡真正要抓的兩件事，錯了都很安靜：
 *
 * 1. 全域管理員登入後**直接**看得到家長列表。壞掉的樣子是後端回 409
 *    「請先選定一家合作公司」，而畫面上是一個空列表 —— 與「這個部署還沒有
 *    家長」長得一模一樣。
 * 2. 公司管理的路徑**真的不存在**（404），不是存在但被拒絕（403）。403 等於
 *    承認那條路徑在，而「專案 A 上根本建不出合作公司」這句話就不再是可證明的。
 *
 * 資料層以替身供應，過濾用的是正式程式碼裡的 `matchesCompanyCondition` ——
 * 測試自己寫一套過濾就成了驗證測試自己，而「路由把哪個條件傳了下去」正是
 * 這裡唯一要驗的東西。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Cond = import('../src/admin/companyScope').CompanyCondition;

  const db = {
    admins: [
      {
        id: 30,
        email: 'god@sxk.com',
        role: 'global_admin' as const,
        companyId: null,
        active: true,
        createdAt: null,
        passwordHash: bcrypt.hashSync('pw-god-123', 4),
      },
    ],
    // 專案 A 的家長全部未歸屬。那一位帶著 companyId 的是刻意放的：它證明
    // 「固定在未歸屬」是真的過濾，而不是「反正全部都撈出來」。
    parents: [
      {
        id: 101, email: null, phone: '13800000001', companyId: null,
        childName: '直属的孩子', childAgeMonth: 36, childGender: 'boy',
        flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: false,
      },
      {
        id: 202, email: null, phone: '13800000002', companyId: 1,
        childName: '不该出现的孩子', childAgeMonth: 30, childGender: 'girl',
        flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: false,
      },
    ],
  };

  return {
    isAvailable: () => true,

    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listAdminUsers() {
      return db.admins.map(({ passwordHash, ...rest }) => rest);
    },
    async listCompanies() {
      return [];
    },

    async listParents(condition: Cond) {
      return db.parents.filter(p => matchesCompanyCondition(condition, p));
    },
    async getParentDetail(condition: Cond, id: number) {
      const p = db.parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      return p
        ? {
            ...p, scores: [], reportHistory: [], bookings: [],
            assessedAgeMonth: null, assessedBandName: null,
          }
        : null;
    },
    async listSpecialists(condition: Cond) {
      // 專案 A 的專家寫死在報告頁（`PRODUCT.expertBooking.specialistSource`
      // 是 builtin），未歸屬底下一位都沒有。這裡照實回空陣列。
      return [] as unknown[];
    },
    async listMaterials() {
      return [];
    },
  };
});

let client: TestClient;

async function loginGlobal(): Promise<string> {
  const resp = await client.postJson('/api/admin/login', {
    email: 'god@sxk.com',
    password: 'pw-god-123',
  });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function h(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('登入後直接看得到家長，不必先選一家不存在的公司', () => {
  /**
   * 本 issue 的核心。放回 bug（讓 `resolveCompanyCondition` 忽略模式）之後
   * 這一條會拿到 409 `NO_COMPANY_SELECTED` —— 實測過。
   */
  it('全域管理員沒做任何選擇就取得到家長列表', async () => {
    const token = await loginGlobal();
    const resp = await client.get('/api/admin/parents', h(token));
    expect(resp.status).toBe(200);
    expect((await resp.json()).parents.map((p: any) => p.id)).toEqual([101]);
  });

  // 「固定在未歸屬」必須是一個真的條件，不是「全部都給」。若資料庫裡因為
  // 任何理由留著一位帶歸屬的家長（例如從專案 B 的匯入），他不屬於這個部署。
  it('視野是未歸屬，不是「全部」', async () => {
    const token = await loginGlobal();
    const parents = (await (await client.get('/api/admin/parents', h(token))).json()).parents;
    expect(parents.map((p: any) => p.childName)).not.toContain('不该出现的孩子');
  });

  it('家長詳情與匯出同樣不必先選公司', async () => {
    const token = await loginGlobal();
    expect((await client.get('/api/admin/parents/101', h(token))).status).toBe(200);

    const exported = await client.get('/api/admin/parents/101/export', h(token));
    expect(exported.status).toBe(200);
    expect(await exported.text()).toContain('直属的孩子');
  });

  // 帶歸屬的那一位在這個部署裡不存在，而「不存在」與「不屬於這個視野」
  // 必須回同一個 404 —— 分開回應等於送出一台「這個 id 存在嗎」的查詢機。
  it('帶歸屬的家長在專案 A 上就是找不到', async () => {
    const token = await loginGlobal();
    expect((await client.get('/api/admin/parents/202', h(token))).status).toBe(404);
  });

  it('身分本身仍然沒有選定任何公司 —— 固定的是條件，不是選擇', async () => {
    const token = await loginGlobal();
    const me = await (await client.get('/api/admin/me', h(token))).json();
    expect(me.identity).toMatchObject({ role: 'global_admin', selection: null });
    expect(me.companies).toEqual([]);
  });
});

describe('公司管理的路徑真的不存在', () => {
  /**
   * 404 而非 403 是這一組的重點。
   *
   * 403 是「這條路徑在，你不能用」——它承認了功能存在，只是被關掉；而且處理
   * 函式還在，任何一個繞過那句檢查的方法都會把它打開。404 是「這裡什麼都沒有」，
   * 因為那個 Router 從來沒有被掛載，沒有處理函式可以繞。
   */
  const gone: Array<[string, string]> = [
    ['GET', '/api/admin/companies'],
    ['POST', '/api/admin/companies'],
    ['GET', '/api/admin/summary'],
    ['GET', '/api/admin/company'],
    ['PUT', '/api/admin/company'],
    ['POST', '/api/admin/select-company'],
  ];

  it.each(gone)('%s %s 回 404，不是 403', async (method, path) => {
    const token = await loginGlobal();
    const resp = await client.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...h(token) },
      body: method === 'GET' ? undefined : JSON.stringify({}),
    });
    expect(resp.status).toBe(404);
  });

  // user story #38：「專案 A 上根本建不出合作公司」。這一條就是那句話的證明。
  it('建立合作公司在專案 A 上沒有入口', async () => {
    const token = await loginGlobal();
    const resp = await client.postJson(
      '/api/admin/companies',
      { name: '不该建得起来', slug: 'nope' },
      h(token)
    );
    expect(resp.status).toBe(404);
  });

  // 未登入的請求在兩種模式下都停在 401（授權中介層先跑），因此這幾條路徑
  // 存不存在不會從這裡漏出去。釘住它，免得哪天有人把 404 提前到中介層之前。
  it('未登入時仍然是 401，不從這裡洩漏路徑存不存在', async () => {
    expect((await client.get('/api/admin/companies')).status).toBe(401);
    expect((await client.get('/api/admin/parents')).status).toBe(401);
  });
});

describe('留下來的路由照常運作', () => {
  it('後台帳號與素材庫都還在 —— 收掉的只有公司那一塊', async () => {
    const token = await loginGlobal();
    expect((await client.get('/api/admin/admin-users', h(token))).status).toBe(200);
    expect((await client.get('/api/admin/materials', h(token))).status).toBe(200);
  });

  it('專家名單仍在，未歸屬底下是空的', async () => {
    const token = await loginGlobal();
    const resp = await client.get('/api/admin/specialists', h(token));
    expect(resp.status).toBe(200);
    expect((await resp.json()).specialists).toEqual([]);
  });
});

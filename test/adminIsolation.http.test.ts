import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 公司隔離是專案 B 的功能：合作公司、
 * 公司切換、跨公司彙總這些路由只在多合作公司的模式下掛載（issue #19）。
 * 少了這一行，整組測試會在專案 A 的伺服器上跑，而那裡那些路徑根本不存在 ——
 * 拿到的是 404，不是「隔離生效」。
 */
process.env.APP_MODE = 't1only';

/**
 * 公司隔離的 HTTP 測試 —— 本規格的主接縫。
 *
 * 送一個真的請求、看回應，一次驗到角色、公司範圍與路由有沒有註冊三件事。
 * 這正是攻擊者實際碰得到的表面：直接呼叫處理函式的測試會在「路由根本沒掛上」
 * 或「中介層被繞過」時照樣通過。
 *
 * 資料層以替身供應，而**替身用的是正式程式碼裡的 `matchesCompanyCondition`**：
 * 若測試自己寫一套過濾邏輯，那就是在驗證測試自己，路由把哪個條件（工作階段的、
 * 還是請求參數的）傳下來反而驗不到 —— 而那正是這裡真正要抓的錯。
 *
 * 真實 SQL 有沒有帶條件由另外兩支測試負責：
 *   - `test/companyScope.test.ts`（條件永遠產得出來）
 *   - `test/adminScope.structure.test.ts`（每一句查詢都用了它）
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Cond = import('../src/admin/companyScope').CompanyCondition;

  const hash = (pw: string) => bcrypt.hashSync(pw, 4);

  const db = {
    companies: [
      { id: 1, name: '甲机构', slug: 'jia', wecomWebhookUrl: null as string | null, logoUrl: null as string | null, active: true, createdAt: null },
      { id: 2, name: '乙机构', slug: 'yi', wecomWebhookUrl: null as string | null, logoUrl: null as string | null, active: true, createdAt: null },
    ],
    admins: [
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
      { id: 20, email: 'b@yi.com', role: 'company_member' as const, companyId: 2, active: true, createdAt: null, passwordHash: hash('pw-yi-123') },
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 40, email: 'left@jia.com', role: 'company_member' as const, companyId: 1, active: false, createdAt: null, passwordHash: hash('pw-left-123') },
    ],
    parents: [
      { id: 101, email: 'p1@x.com', phone: null, companyId: 1, childName: '甲家孩子', childAgeMonth: 36, childGender: 'boy', flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: true },
      { id: 202, email: 'p2@x.com', phone: null, companyId: 2, childName: '乙家孩子', childAgeMonth: 30, childGender: 'girl', flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: false },
      { id: 303, email: 'p3@x.com', phone: null, companyId: null, childName: '没有归属的孩子', childAgeMonth: 24, childGender: 'boy', flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: false },
      { id: 111, email: null, phone: '13800001234', companyId: 1, childName: '付过钱的孩子', childAgeMonth: 40, childGender: 'girl', flaggedDimensions: [], screenedAt: null, registeredAt: null, hasBooking: false },
    ],
    /** 有付款紀錄的家長刪不得（ADR-0006）。替身只需要知道「有沒有」。 */
    paidParentIds: [111],
    specialists: [
      { id: 1001, companyId: 1, name: '甲机构的治疗师', title: null, specialty: null, experience: null, avatarUrl: null, slots: ['周一上午'], active: true },
      { id: 2002, companyId: 2, name: '乙机构的治疗师', title: null, specialty: null, experience: null, avatarUrl: null, slots: [], active: true },
    ],
    /** 切換紀錄。測試靠它證明「每一次切換都留得下痕跡」。 */
    switches: [] as Array<{ adminUserId: number; companyId: number | null; selection: string }>,
    available: true,
  };

  const initial = JSON.parse(
    JSON.stringify({ specialists: db.specialists, companies: db.companies, parents: db.parents })
  );

  return {
    __db: db,
    __reset() {
      db.specialists = JSON.parse(JSON.stringify(initial.specialists));
      db.companies = JSON.parse(JSON.stringify(initial.companies));
      // 刪除測試會真的把家長從替身裡拿掉，不重置的話後面每一條都少一個人。
      db.parents = JSON.parse(JSON.stringify(initial.parents));
      db.switches = [];
      db.available = true;
    },

    isAvailable: () => db.available,

    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listAdminUsers() {
      return db.admins.map(({ passwordHash, ...rest }) => rest);
    },
    async createAdminUser(email: string, passwordHash: string, role: any, companyId: number | null) {
      const row = { id: db.admins.length + 100, email, role, companyId, active: true, createdAt: null, passwordHash };
      db.admins.push(row as any);
      const { passwordHash: _, ...rest } = row;
      return rest;
    },
    async setAdminUserActive(id: number, active: boolean) {
      const a = db.admins.find(x => x.id === id);
      if (!a) return 0;
      a.active = active;
      return 1;
    },

    async listCompanies() {
      return db.companies;
    },
    async findCompanyById(id: number) {
      return db.companies.find(c => c.id === id) ?? null;
    },
    async createCompany(name: string, slug: string) {
      if (db.companies.some(c => c.slug === slug)) {
        throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      }
      const row = { id: db.companies.length + 1, name, slug, wecomWebhookUrl: null, logoUrl: null, active: true, createdAt: null };
      db.companies.push(row);
      return row;
    },
    async recordCompanySwitch(adminUserId: number, companyId: number | null, selection: string) {
      db.switches.push({ adminUserId, companyId, selection });
    },

    // ── 家長資料：一律經過正式程式碼的條件判斷 ──
    async listParents(condition: Cond) {
      return db.parents.filter(p => matchesCompanyCondition(condition, p));
    },
    async getParentDetail(condition: Cond, id: number) {
      const p = db.parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      return p ? { ...p, scores: [], reportHistory: [], bookings: [] } : null;
    },
    async deleteParent(condition: Cond, id: number) {
      // 順序與正式那一支相同：先看在不在視野裡，再看有沒有付款。
      // 反過來的話，別家公司的家長會因為「有付款」而收到 409 —— 而 409 等於
      // 承認那個 id 存在。
      const p = db.parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      if (!p) return 'not_found';
      if (db.paidParentIds.includes(id)) return 'has_payments';
      db.parents = db.parents.filter(x => x.id !== id);
      return 'deleted';
    },

    async listSpecialists(condition: Cond, includeInactive: boolean) {
      return db.specialists.filter(
        s => matchesCompanyCondition(condition, s) && (includeInactive || s.active)
      );
    },
    async createSpecialist(condition: Cond, input: any) {
      if (condition.kind !== 'company') return null;
      const row = { id: db.specialists.length + 5000, companyId: condition.companyId, ...input };
      db.specialists.push(row);
      return row;
    },
    async updateSpecialist(condition: Cond, id: number, input: any) {
      const s = db.specialists.find(x => x.id === id && matchesCompanyCondition(condition, x));
      if (!s) return 0;
      Object.assign(s, input);
      return 1;
    },

    async getScopedCompany(condition: Cond) {
      if (condition.kind !== 'company') return null;
      return db.companies.find(c => c.id === condition.companyId) ?? null;
    },
    async updateScopedCompanySettings(
      condition: Cond,
      patch: { wecomWebhookUrl?: string | null; logoUrl?: string | null }
    ) {
      if (condition.kind !== 'company') return 0;
      const c = db.companies.find(x => x.id === condition.companyId);
      if (!c) return 0;
      // 與正式那一句同一個語意：**只寫進 patch 裡真的帶了的鍵**。
      // 替身若改成兩欄一起寫，「只換 LOGO 不會覆蓋 webhook」那一條就驗不到了。
      if ('wecomWebhookUrl' in patch) c.wecomWebhookUrl = patch.wecomWebhookUrl ?? null;
      if ('logoUrl' in patch) c.logoUrl = patch.logoUrl ?? null;
      return 1;
    },

    async summaryByCompany() {
      const count = (pred: (p: any) => boolean) => db.parents.filter(pred).length;
      return [
        ...db.companies.map(c => ({
          companyId: c.id,
          companyName: c.name,
          parentCount: count(p => p.companyId === c.id),
          screenedCount: 0,
          bookingCount: count(p => p.companyId === c.id && p.hasBooking),
        })),
        {
          companyId: null,
          companyName: '未归属',
          parentCount: count(p => p.companyId === null),
          screenedCount: 0,
          bookingCount: 0,
        },
      ];
    },
  };
});

let client: TestClient;
let store: any;

async function login(email: string, password: string): Promise<string | null> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  if (!resp.ok) return null;
  return (await resp.json()).token;
}

function h(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** 全域管理員登入並選定一家公司；回傳切換後的新 token。 */
async function loginGlobalOn(selection: unknown): Promise<string> {
  const token = await login('god@sxk.com', 'pw-god-123');
  const resp = await client.postJson('/api/admin/select-company', { selection }, h(token!));
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  (store as any).__reset();
});

afterAll(async () => {
  await client.close();
});

describe('後台登入與角色（#3）', () => {
  it('未登入取不到任何後台資料', async () => {
    const resp = await client.get('/api/admin/parents');
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('ADMIN_UNAUTHENTICATED');
  });

  it('登入後認得出自己是哪家公司的成員', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const me = await (await client.get('/api/admin/me', h(token!))).json();
    expect(me.identity).toMatchObject({ role: 'company_member', companyId: 1 });
  });

  it('登入後認得出自己是全域管理員，且一開始沒有選定任何公司', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const me = await (await client.get('/api/admin/me', h(token!))).json();
    expect(me.identity).toMatchObject({ role: 'global_admin', selection: null });
  });

  it('公司成員看不到公司清單 —— 不該知道還有別家公司存在', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const me = await (await client.get('/api/admin/me', h(token!))).json();
    expect(me.companies).toEqual([]);
  });

  it('密碼錯誤與帳號不存在回同一句話', async () => {
    const wrong = await client.postJson('/api/admin/login', { email: 'a@jia.com', password: 'nope' });
    const missing = await client.postJson('/api/admin/login', { email: 'nobody@x.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
  });

  it('家長端的登入完全不受影響 —— 後台那套驗證沒有蓋到它', async () => {
    // 家長端走的是手機號（#27 之後唯一的入口）。這個部署沒有資料庫，所以它會
    // 用**自己的**理由回答（手機號格式不對 → 400），而不是後台那套
    // ADMIN_UNAUTHENTICATED 401 —— 後者才代表中介層掛錯了地方。
    const resp = await client.postJson('/api/auth/sms/request', { phone: 'not-a-phone' });
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBeUndefined();
  });

  it('後台不可用時（沒有資料庫）明確回 503，而不是假裝空資料', async () => {
    (store as any).__db.available = false;
    const resp = await client.postJson('/api/admin/login', { email: 'a@jia.com', password: 'pw-jia-123' });
    expect(resp.status).toBe(503);
    expect((await resp.json()).code).toBe('ADMIN_UNAVAILABLE');
    (store as any).__db.available = true;
  });
});

describe('已停用的後台帳號', () => {
  it('停用的帳號登不進來', async () => {
    const resp = await client.postJson('/api/admin/login', { email: 'left@jia.com', password: 'pw-left-123' });
    expect(resp.status).toBe(401);
  });

  // 停用要立刻生效，不是等 token 過期 ——「對方有人離職」是這個功能存在的理由。
  it('登入後才被停用的帳號，手上的 token 立刻失效', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    expect((await client.get('/api/admin/parents', h(token!))).status).toBe(200);

    (store as any).__db.admins.find((a: any) => a.id === 10).active = false;

    const resp = await client.get('/api/admin/parents', h(token!));
    expect(resp.status).toBe(401);
    (store as any).__db.admins.find((a: any) => a.id === 10).active = true;
  });
});

describe('公司隔離（#6）', () => {
  it('公司成員的列表只有自己公司的家長', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (await client.get('/api/admin/parents', h(token!))).json();

    expect(body.parents.map((p: any) => p.id)).toEqual([101, 111]);
    // 不只是「id 對」—— 整份回應裡不得出現別家公司家長的任何痕跡。
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('乙家孩子');
    expect(raw).not.toContain('p2@x.com');
  });

  it('未歸屬的家長不出現在任何公司成員的列表裡', async () => {
    for (const [email, pw] of [['a@jia.com', 'pw-jia-123'], ['b@yi.com', 'pw-yi-123']]) {
      const token = await login(email, pw);
      const body = await (await client.get('/api/admin/parents', h(token!))).json();
      expect(body.parents.map((p: any) => p.id)).not.toContain(303);
    }
  });

  it('公司成員讀不到別家公司的家長詳情，而且看不出那個人存不存在', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const otherCompany = await client.get('/api/admin/parents/202', h(token!));
    const nonExistent = await client.get('/api/admin/parents/999999', h(token!));

    expect(otherCompany.status).toBe(404);
    // 兩者回應完全相同：不同的回應就是一台「這個 id 存在嗎」的查詢機。
    expect(otherCompany.status).toBe(nonExistent.status);
    expect(await otherCompany.json()).toEqual(await nonExistent.json());
  });

  it('公司成員無法用查詢參數把自己換到別家公司', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (
      await client.get('/api/admin/parents?companyId=2&company=2&scope=all', h(token!))
    ).json();
    expect(body.parents.map((p: any) => p.id)).toEqual([101, 111]);
  });
});

/**
 * 匯出端點在 2026-09-11 移除（ADR-0007）—— 後台的列印改走前端的
 * `/admin/parents/:id/print`，資料仍然只有 `GET /parents/:id` 這一支。
 *
 * 這一組因此換了工作：不再驗「匯出有沒有帶公司條件」，改驗**那條路真的不見了**，
 * 以及 issue #8 當初要守的東西（取家長資料只有一條路，而那條路帶著公司條件）
 * 沒有跟著一起消失。
 */
describe('伺服器端的匯出端點已不存在（ADR-0007）', () => {
  it('連自己公司的家長都匯不出來 —— 那條路整個沒了', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.get('/api/admin/parents/101/export', h(token!));
    expect(resp.status).toBe(404);
  });

  it('取資料仍然只有詳情這一支，而它帶著公司條件', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    expect((await client.get('/api/admin/parents/101', h(token!))).status).toBe(200);

    const otherCompany = await client.get('/api/admin/parents/202', h(token!));
    const nonExistent = await client.get('/api/admin/parents/999999', h(token!));
    expect(otherCompany.status).toBe(404);
    expect(await otherCompany.json()).toEqual(await nonExistent.json());
  });
});

describe('全域管理員必須明確選定公司（#12）', () => {
  it('未選定公司時取不到任何個別家長資料', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    for (const path of ['/api/admin/parents', '/api/admin/parents/101', '/api/admin/specialists']) {
      const resp = await client.get(path, h(token!));
      expect(resp.status, path).toBe(409);
      expect((await resp.json()).code).toBe('NO_COMPANY_SELECTED');
    }
  });

  it('選定一家公司後，視野與該公司的成員完全相同', async () => {
    const adminToken = await loginGlobalOn({ companyId: 2 });
    const memberToken = await login('b@yi.com', 'pw-yi-123');

    const asAdmin = await (await client.get('/api/admin/parents', h(adminToken))).json();
    const asMember = await (await client.get('/api/admin/parents', h(memberToken!))).json();
    expect(asAdmin.parents).toEqual(asMember.parents);
  });

  it('每一次切換都留下紀錄', async () => {
    await loginGlobalOn({ companyId: 1 });
    await loginGlobalOn({ companyId: 2 });
    await loginGlobalOn('unassigned');
    expect((store as any).__db.switches).toEqual([
      { adminUserId: 30, companyId: 1, selection: 'company' },
      { adminUserId: 30, companyId: 2, selection: 'company' },
      { adminUserId: 30, companyId: null, selection: 'unassigned' },
    ]);
  });

  it('未歸屬的家長只有全域管理員看得到', async () => {
    const token = await loginGlobalOn('unassigned');
    const body = await (await client.get('/api/admin/parents', h(token))).json();
    expect(body.parents.map((p: any) => p.id)).toEqual([303]);
  });

  it('切換到不存在的公司會被拒絕，視野不變', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/select-company', { selection: { companyId: 9999 } }, h(token!));
    expect(resp.status).toBe(404);
    expect((store as any).__db.switches).toEqual([]);
  });

  it('公司成員不能切換公司', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.postJson('/api/admin/select-company', { selection: { companyId: 2 } }, h(token!));
    expect(resp.status).toBe(403);
  });
});

describe('建立公司與後台帳號（#4）', () => {
  it('全域管理員建得起公司，並拿得到進站識別碼', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '丙机构', slug: 'bing' }, h(token!));
    expect(resp.status).toBe(200);
    expect((await resp.json()).company.slug).toBe('bing');
  });

  it('重複的進站識別碼會被拒絕', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '冒名', slug: 'jia' }, h(token!));
    expect(resp.status).toBe(409);
  });

  it('公司成員不能建立公司，也不能開設或停用帳號', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const create = await client.postJson('/api/admin/companies', { name: 'x', slug: 'xx' }, h(token!));
    const account = await client.postJson(
      '/api/admin/admin-users',
      { email: 'new@jia.com', password: 'password123', role: 'company_member', companyId: 1 },
      h(token!)
    );
    const disable = await client.postJson('/api/admin/admin-users/20/active', { active: false }, h(token!));
    for (const r of [create, account, disable]) {
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe('FORBIDDEN');
    }
  });

  it('全域管理員開設的帳號可以立刻登入，停用後就登不進來', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const created = await (
      await client.postJson(
        '/api/admin/admin-users',
        { email: 'new@jia.com', password: 'password123', role: 'company_member', companyId: 1 },
        h(token!)
      )
    ).json();
    expect(await login('new@jia.com', 'password123')).toBeTruthy();

    const off = await client.postJson(
      `/api/admin/admin-users/${created.adminUser.id}/active`,
      { active: false },
      h(token!)
    );
    expect(off.status).toBe(200);
    expect(await login('new@jia.com', 'password123')).toBeNull();
  });

  it('不能停用自己 —— 那會把自己鎖在門外', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/admin-users/30/active', { active: false }, h(token!));
    expect(resp.status).toBe(400);
  });
});

describe('專家名單的公司隔離（#10）', () => {
  it('公司成員只看得到自己公司的專家', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (await client.get('/api/admin/specialists', h(token!))).json();
    expect(body.specialists.map((s: any) => s.id)).toEqual([1001]);
  });

  it('改不了別家公司的專家，且回應與「不存在」相同', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.request('/api/admin/specialists/2002', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ name: '被改掉的名字', slots: [] }),
    });
    expect(resp.status).toBe(404);
    // 對方的資料一個字都不能動。
    expect((store as any).__db.specialists.find((s: any) => s.id === 2002).name).toBe('乙机构的治疗师');
  });

  it('新增的專家自動隸屬於自己的公司', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const body = await (
      await client.postJson('/api/admin/specialists', { name: '新来的治疗师', slots: ['周三下午'] }, h(token!))
    ).json();
    expect(body.specialist.companyId).toBe(1);
  });

  it('「未歸屬」視野下不能新增專家 —— 它不是一家公司', async () => {
    const token = await loginGlobalOn('unassigned');
    const resp = await client.postJson('/api/admin/specialists', { name: '无主的治疗师' }, h(token));
    expect(resp.status).toBe(400);
  });
});

describe('各公司自己的企業微信通知位置（#11）', () => {
  it('公司成員設定的是自己公司的通知位置', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ wecomWebhookUrl: 'https://qyapi.weixin.qq.com/hook?key=jia' }),
    });
    expect(resp.status).toBe(200);
    const db = (store as any).__db;
    expect(db.companies.find((c: any) => c.id === 1).wecomWebhookUrl).toContain('key=jia');
    // 動到別家公司的設定是這裡最糟的失敗，明確驗一次。
    expect(db.companies.find((c: any) => c.id === 2).wecomWebhookUrl).toBeNull();
  });

  /**
   * LOGO 走同一支路由。這裡要抓的是**只改一個欄位不會把另一個清掉** ——
   * 兩欄一起寫的話，一個只想換 LOGO 的動作會把通知位置覆蓋成當時輸入框裡的值，
   * 而那個失敗要等到下一位家長送出預約、通知沒送到才會有人發現。
   */
  it('只換 LOGO 不會把通知位置一起覆蓋掉', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const db = (store as any).__db;

    // 先把通知位置設起來（`beforeEach` 會把替身資料重置，不能靠前一條測試留下的值）。
    await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ wecomWebhookUrl: 'https://qyapi.weixin.qq.com/hook?key=jia' }),
    });
    const before = db.companies.find((c: any) => c.id === 1).wecomWebhookUrl;
    expect(before).toBeTruthy();

    const resp = await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ logoUrl: 'https://cdn.example.com/jia.png' }),
    });
    expect(resp.status).toBe(200);
    expect(db.companies.find((c: any) => c.id === 1).logoUrl).toBe('https://cdn.example.com/jia.png');
    expect(db.companies.find((c: any) => c.id === 1).wecomWebhookUrl).toBe(before);
    // 別家公司一樣不准被動到。
    expect(db.companies.find((c: any) => c.id === 2).logoUrl).toBeNull();
  });

  it.each([
    ['http（會被瀏覽器當混合內容擋掉）', 'http://cdn.example.com/logo.png'],
    ['協定相對網址（長得像站內路徑，其實是外連）', '//example.com/logo.png'],
    ['javascript:', 'javascript:alert(1)'],
  ])('LOGO 網址是 %s 時被擋下', async (_label, bad) => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ logoUrl: bad }),
    });
    expect(resp.status).toBe(400);
  });

  it('一個欄位都沒帶時明說沒東西要更新，不講成「未歸屬」', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('没有要更新的设定');
  });

  it('非 https 的 webhook 會被擋下', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.request('/api/admin/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...h(token!) },
      body: JSON.stringify({ wecomWebhookUrl: 'http://insecure.example.com/hook' }),
    });
    expect(resp.status).toBe(400);
  });
});

describe('跨公司彙總（#13）', () => {
  it('公司成員取不到跨公司彙總', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.get('/api/admin/summary', h(token!));
    expect(resp.status).toBe(403);
  });

  it('全域管理員看得到依公司分組的數字，且未歸屬有自己的一列', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const body = await (await client.get('/api/admin/summary', h(token!))).json();
    expect(body.summary.map((r: any) => r.companyId)).toEqual([1, 2, null]);
    expect(body.summary.find((r: any) => r.companyId === null).parentCount).toBe(1);
  });

  it('彙總不含任何個別家長的可識別資料', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const raw = await (await client.get('/api/admin/summary', h(token!))).text();
    for (const leak of ['甲家孩子', '乙家孩子', 'p1@x.com', 'p2@x.com', '没有归属的孩子']) {
      expect(raw).not.toContain(leak);
    }
  });

  // 彙總是唯一合法跨越公司邊界的能力，而它不需要選定公司 —— 因為它不回個別家長。
  it('全域管理員即使未選定公司也看得到彙總', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await client.get('/api/admin/summary', h(token!))).status).toBe(200);
  });
});

/**
 * 刪除家長（ADR-0006）。
 *
 * 這一組驗的是「刪除這個動作照著視野走」——與讀取同一條規則，但代價不同：讀錯
 * 是看到不該看的，刪錯是把別家公司的孩子資料永久銷毀，而且系統不留紀錄。
 */
describe('刪除家長（ADR-0006）', () => {
  const del = (path: string, token: string) =>
    client.request(path, { method: 'DELETE', headers: h(token) });

  it('公司成員刪得掉自己公司的家長', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await del('/api/admin/parents/101', token!);
    expect(resp.status).toBe(200);

    const after = await (await client.get('/api/admin/parents', h(token!))).json();
    expect(after.parents.map((p: any) => p.id)).not.toContain(101);
  });

  it('刪別家公司的家長被拒，且與不存在的回應一模一樣', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const otherCompany = await del('/api/admin/parents/202', token!);
    const nonExistent = await del('/api/admin/parents/999999', token!);
    // 403 會承認那個 id 存在 —— 這支端點就成了一台「這個 id 存在嗎」的查詢機。
    expect(otherCompany.status).toBe(404);
    expect(nonExistent.status).toBe(404);
    expect(await otherCompany.json()).toEqual(await nonExistent.json());
  });

  it('被拒的那一位真的還在', async () => {
    const attacker = await login('a@jia.com', 'pw-jia-123');
    await del('/api/admin/parents/202', attacker!);

    const victim = await login('b@yi.com', 'pw-yi-123');
    const list = await (await client.get('/api/admin/parents', h(victim!))).json();
    expect(list.parents.map((p: any) => p.id)).toContain(202);
  });

  it('有付款紀錄的家長刪不得，回 409 並說明原因', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await del('/api/admin/parents/111', token!);
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('HAS_PAYMENTS');

    const after = await (await client.get('/api/admin/parents', h(token!))).json();
    expect(after.parents.map((p: any) => p.id)).toContain(111);
  });

  it('未選定公司的全域管理員刪不掉任何人', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await del('/api/admin/parents/101', token!);
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('NO_COMPANY_SELECTED');
  });

  it('全域管理員切到未歸屬，刪得掉未歸屬的家長', async () => {
    const token = await loginGlobalOn('unassigned');
    expect((await del('/api/admin/parents/303', token)).status).toBe(200);
  });

  it('全域管理員切到甲公司時，碰不到未歸屬的家長', async () => {
    const token = await loginGlobalOn({ companyId: 1 });
    expect((await del('/api/admin/parents/303', token)).status).toBe(404);
  });

  it('沒登入就刪不了', async () => {
    const resp = await client.request('/api/admin/parents/101', { method: 'DELETE' });
    expect(resp.status).toBe(401);
  });
});

/**
 * 刪除也要清掉記憶體裡那份熱備份（ADR-0006）。
 *
 * `server.ts` 的 `offlineUserData` 是 `/api/db/save` 每一次都會寫的一份副本，
 * 裡面是孩子的姓名、生日、九維分數與整串報告歷史。`adminStore` 只碰得到資料庫，
 * 所以刪除必須經過一個回呼才清得到它 —— 少了那一步，被刪掉的孩子的資料會留在
 * 跑著的進程裡直到下一次重啟，而條款承諾的是「全部關聯資料」。
 *
 * 這一組沒有替身：`src/db/mysql` 在這支測試裡是未設定的（見 `test/setup/testEnv.ts`），
 * 所以存檔與讀取走的正是那條記憶體路徑，直接看得到它有沒有被清掉。
 */
describe('刪除會清掉記憶體裡的熱備份（ADR-0006）', () => {
  const child = { name: '要被删掉的孩子', birthDate: '2023-05-15', ageMonth: 40, gender: 'boy' };

  async function saveMemoryBackupFor(parentId: number) {
    const resp = await client.postJson(
      '/api/db/save',
      { deviceId: `dev-${parentId}`, child, completedScores: [] },
      bearer(parentId)
    );
    expect(resp.status).toBe(200);
  }

  async function loadMemoryBackupFor(parentId: number) {
    return (await client.get('/api/db/load', bearer(parentId))).json();
  }

  it('護欄本身沒有壞掉：存進去之後讀得回來', async () => {
    await saveMemoryBackupFor(101);
    const loaded = await loadMemoryBackupFor(101);
    expect(loaded.source).toBe('memory');
    expect(loaded.child.name).toBe('要被删掉的孩子');
  });

  it('刪除之後那份備份不見了', async () => {
    await saveMemoryBackupFor(101);

    const token = await login('a@jia.com', 'pw-jia-123');
    const deleted = await client.request('/api/admin/parents/101', {
      method: 'DELETE',
      headers: h(token!),
    });
    expect(deleted.status).toBe(200);

    const loaded = await loadMemoryBackupFor(101);
    expect(loaded.source).not.toBe('memory');
    expect(JSON.stringify(loaded)).not.toContain('要被删掉的孩子');
  });

  it('刪不成功就不清 —— 別家公司的家長碰不到他的備份', async () => {
    await saveMemoryBackupFor(202);

    const attacker = await login('a@jia.com', 'pw-jia-123');
    const refused = await client.request('/api/admin/parents/202', {
      method: 'DELETE',
      headers: h(attacker!),
    });
    expect(refused.status).toBe(404);

    const loaded = await loadMemoryBackupFor(202);
    expect(loaded.child.name).toBe('要被删掉的孩子');
  });
});

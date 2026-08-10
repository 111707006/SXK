import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

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
      { id: 1, name: '甲机构', slug: 'jia', wecomWebhookUrl: null as string | null, active: true, createdAt: null },
      { id: 2, name: '乙机构', slug: 'yi', wecomWebhookUrl: null as string | null, active: true, createdAt: null },
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
    ],
    specialists: [
      { id: 1001, companyId: 1, name: '甲机构的治疗师', title: null, specialty: null, experience: null, avatarUrl: null, slots: ['周一上午'], active: true },
      { id: 2002, companyId: 2, name: '乙机构的治疗师', title: null, specialty: null, experience: null, avatarUrl: null, slots: [], active: true },
    ],
    /** 切換紀錄。測試靠它證明「每一次切換都留得下痕跡」。 */
    switches: [] as Array<{ adminUserId: number; companyId: number | null; selection: string }>,
    available: true,
  };

  const initial = JSON.parse(JSON.stringify({ specialists: db.specialists, companies: db.companies }));

  return {
    __db: db,
    __reset() {
      db.specialists = JSON.parse(JSON.stringify(initial.specialists));
      db.companies = JSON.parse(JSON.stringify(initial.companies));
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
      const row = { id: db.companies.length + 1, name, slug, wecomWebhookUrl: null, active: true, createdAt: null };
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
    async updateScopedCompanyWebhook(condition: Cond, url: string | null) {
      if (condition.kind !== 'company') return 0;
      const c = db.companies.find(x => x.id === condition.companyId);
      if (!c) return 0;
      c.wecomWebhookUrl = url;
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

    expect(body.parents.map((p: any) => p.id)).toEqual([101]);
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
    expect(body.parents.map((p: any) => p.id)).toEqual([101]);
  });
});

describe('匯出不得成為第二條路（#8）', () => {
  it('匯出自己公司的家長拿得到內容', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const resp = await client.get('/api/admin/parents/101/export', h(token!));
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain('甲家孩子');
  });

  it('匯出別家公司的家長被拒，且與不存在的回應相同', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const otherCompany = await client.get('/api/admin/parents/202/export', h(token!));
    const nonExistent = await client.get('/api/admin/parents/999999/export', h(token!));
    expect(otherCompany.status).toBe(404);
    expect(await otherCompany.json()).toEqual(await nonExistent.json());
  });

  it('未選定公司的全域管理員同樣匯不出東西', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.get('/api/admin/parents/101/export', h(token!));
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('NO_COMPANY_SELECTED');
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

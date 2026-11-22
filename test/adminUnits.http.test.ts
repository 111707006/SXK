import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 合作單位（#117，ADR-0020；專案 A、`A_COMPANIES` 開著）：
 * - 建單位要選類型（機構／個人治療師）；個人治療師一次建好單位與那個帳號（單位管理者＋推薦人）。
 * - 建推薦人要選單位（只能選機構）、要有代號（單位內唯一，格式同進站代號）。
 * - 個人治療師的帳號登入後 `/me` 說他也是推薦人，「我的兑换码」打得到。
 */
process.env.A_COMPANIES = '1';
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-units';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const dup = (key: string) => Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY', dupKey: key });
  const db = {
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    ] as any[],
    companies: [
      { id: 7, name: '乙医院', slug: 'yiyuan', kind: 'institution', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null },
      { id: 8, name: '王治疗师', slug: 'wang', kind: 'therapist', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null },
    ] as any[],
    referrers: [] as any[],
  };
  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return db.companies;
    },
    async findCompanyById(id: number) {
      return db.companies.find(c => c.id === id) ?? null;
    },
    async createCompany(name: string, slug: string, kind = 'institution') {
      if (db.companies.some(c => c.slug === slug)) throw dup('slug');
      const row = { id: db.companies.length + 100, name, slug, kind, active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null };
      db.companies.push(row);
      return row;
    },
    async createTherapistUnit(input: any) {
      if (db.companies.some(c => c.slug === input.slug)) throw dup('slug');
      if (db.admins.some(a => a.email === input.email)) throw dup('email');
      const company = { id: db.companies.length + 100, name: input.name, slug: input.slug, kind: 'therapist', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null };
      db.companies.push(company);
      const adminId = db.admins.length + 500;
      const referrerId = db.referrers.length + 900;
      db.admins.push({ id: adminId, email: input.email, role: 'company_member', companyId: company.id, active: true, createdAt: null, passwordHash: input.passwordHash, referrerId, referrerActive: true });
      const referrer = { id: referrerId, adminUserId: adminId, email: input.email, name: input.name, phone: input.phone, kind: 'therapist', companyId: company.id, companyName: input.name, companySlug: input.slug, companyKind: 'therapist', code: null, active: true, createdAt: null };
      db.referrers.push(referrer);
      return { company, referrer };
    },
    async listReferrers() {
      return db.referrers;
    },
    async createReferrer(input: any) {
      if (db.referrers.some(r => r.companyId === input.companyId && r.code === input.code)) throw dup('code');
      const company = db.companies.find(c => c.id === input.companyId);
      const r = { id: db.referrers.length + 900, adminUserId: 99, email: input.email, name: input.name, phone: input.phone, kind: input.kind, companyId: input.companyId, companyName: company?.name ?? null, companySlug: company?.slug ?? null, companyKind: company?.kind ?? null, code: input.code, active: true, createdAt: null };
      db.referrers.push(r);
      return r;
    },
    async listRedeemCodes(referrerId: number) {
      return [{ id: 1, batchId: 1, referrerId, code: 'ABCDEFGHJK', months: 1, status: 'unused', usedBy: null, usedAt: null, createdAt: null }];
    },
  };
});

let client: TestClient;
let store: any;

async function token(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}
const h = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

afterAll(async () => {
  await client.close();
});

describe('建合作單位', () => {
  it('列表帶類型', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const body = await (await client.get('/api/admin/companies', h(t))).json();
    expect(body.companies.map((c: any) => c.kind)).toEqual(['institution', 'therapist']);
  });

  it('沒選類型 400', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '丙机构', slug: 'bing' }, h(t));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('类型');
  });

  it('機構：只建單位', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '丙机构', slug: 'bing', kind: 'institution' }, h(t));
    expect(resp.status).toBe(200);
    expect((await resp.json()).company).toMatchObject({ slug: 'bing', kind: 'institution' });
  });

  it('個人治療師：一次建好單位與帳號，帳號登入後同時是單位管理者與推薦人', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson(
      '/api/admin/companies',
      { name: '李治疗师', slug: 'li', kind: 'therapist', email: 'li@x.com', password: 'pw-li-12345', phone: '13900000001' },
      h(t)
    );
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.company).toMatchObject({ slug: 'li', kind: 'therapist' });
    expect(body.referrer).toMatchObject({ name: '李治疗师', phone: '13900000001', companyId: body.company.id });

    const lt = await token('li@x.com', 'pw-li-12345');
    const me = await (await client.get('/api/admin/me', h(lt))).json();
    expect(me.identity).toEqual({ role: 'company_member', email: 'li@x.com', companyId: body.company.id, selection: null, referrer: true });
    const codes = await client.get('/api/admin/referrer/codes', h(lt));
    expect(codes.status).toBe(200);
    expect((await codes.json()).codes[0].referrerId).toBe(body.referrer.id);
  });

  it.each([
    [{ email: 'x', password: 'pw-12345678', phone: '13900000001' }, '信箱'],
    [{ email: 'a@b.c', password: 'short', phone: '13900000001' }, '密码'],
    [{ email: 'a@b.c', password: 'pw-12345678', phone: '123' }, '手机号'],
  ])('個人治療師的帳號欄位不對 400（%#）', async (account, word) => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '赵治疗师', slug: 'zhao', kind: 'therapist', ...account }, h(t));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain(word);
  });

  it('個人治療師：信箱撞到 409，說是信箱', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson(
      '/api/admin/companies',
      { name: '钱治疗师', slug: 'qian', kind: 'therapist', email: 'god@sxk.com', password: 'pw-12345678', phone: '13900000002' },
      h(t)
    );
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('信箱');
  });

  it('識別碼撞到 409，說是識別碼', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/companies', { name: '冒名', slug: 'yiyuan', kind: 'institution' }, h(t));
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('识别码');
  });
});

describe('建推薦人', () => {
  const base = { email: 'r1@x.com', password: 'pw-r1-12345', name: '甲治疗师', phone: '13900000003' };

  it('沒選單位 400', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { ...base, code: 'jia' }, h(t));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('单位');
  });

  it('個人治療師單位不能再加推薦人 400', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { ...base, companyId: 8, code: 'jia' }, h(t));
    expect(resp.status).toBe(400);
  });

  it.each([undefined, 'A', 'Jia', '-jia', 'j'])('代號格式不對 400（%s）', async code => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { ...base, companyId: 7, code }, h(t));
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('代号');
  });

  it('建得起來（類型沒給就是治療師），帶單位與代號', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { ...base, companyId: 7, code: 'jia' }, h(t));
    expect(resp.status).toBe(200);
    expect((await resp.json()).referrer).toMatchObject({ companyId: 7, code: 'jia', kind: 'therapist' });
    expect(store.__db.referrers.at(-1)).toMatchObject({ companyId: 7, code: 'jia' });
  });

  it('同一單位代號重複 409', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/referrers', { ...base, email: 'r2@x.com', companyId: 7, code: 'jia' }, h(t));
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('代号');
  });
});

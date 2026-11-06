import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * T2 優惠券（客戶 11/03，`T2_COUPON`）：家長兌一張（要登入、已用／作廢／不存在／過期同一句、每人一次）、
 * 讀回用了哪一張、T2 的訂單照折後價開；後台只有全域管理員碰得到。資料層以替身供應（`src/db/coupons.ts` 的規則照抄一份）。
 */
process.env.T2_COUPON = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-coupon';

const TODAY = new Date('2026-11-07T08:00:00+08:00');
vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });

const users: Record<number, { id: number; phone: string }> = {};
for (let i = 1; i <= 40; i++) users[i] = { id: i, phone: `139000000${String(i).padStart(2, '0')}` };

function t1(dimensionId: string, status: 'normal' | 'borderline' | 'delay') {
  return { dimensionId, dimensionName: dimensionId, tierId: 'T1', score: 0, maxScore: 8, status, completedAt: '2026-11-01T00:00:00Z' };
}
/** 48 個月、三個方面被標記 → 3 項 → ¥19.9。 */
const SCORES = [
  t1('language', 'delay'), t1('attention', 'delay'), t1('sensory_processing', 'borderline'),
  t1('cognitive', 'normal'), t1('social_emotional', 'normal'), t1('emotion_behavior', 'normal'),
  t1('gross_motor', 'normal'), t1('self_care', 'normal'), t1('learning_ability', 'normal'),
];

const db = vi.hoisted(() => ({
  codes: [] as { id: number; code: string; status: string; usedBy: number | null; expiresOn: string | null; discount: { kind: 'percent' | 'amount'; value: number } }[],
  payments: [] as any[],
  claimDays: [] as string[],
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => ({ user_id: id, child: { name: '小明', birthDate: '2022-11-07', ageMonth: 48, gender: 'boy' }, completedScores: SCORES }),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  createPayment: async (input: any) => {
    db.payments.push(input);
    return db.payments.length;
  },
}));

vi.mock('../src/db/coupons', () => {
  const mine = (userId: number) => db.codes.find(c => c.usedBy === userId && c.status === 'used') ?? null;
  const view = (c: (typeof db.codes)[number]) => ({ id: c.id, code: c.code, discount: c.discount });
  return {
    async couponOfUser(userId: number) {
      const c = mine(userId);
      return c ? view(c) : null;
    },
    async claimCouponForUser(userId: number, code: string, today: string) {
      db.claimDays.push(today);
      await new Promise(r => setTimeout(r, 5)); // 讓兩個請求交錯
      if (mine(userId)) return { ok: false, reason: 'already_claimed' };
      const c = db.codes.find(x => x.code === code);
      if (!c || c.status !== 'unused' || (c.expiresOn !== null && c.expiresOn < today)) return { ok: false, reason: 'invalid' };
      if (mine(userId)) return { ok: false, reason: 'already_claimed' };
      c.status = 'used';
      c.usedBy = userId;
      return { ok: true, coupon: view(c) };
    },
  };
});

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    { id: 31, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 7, referrerActive: true },
  ];
  const created: any[] = [];
  const patched: any[] = [];
  return {
    __created: created,
    __patched: patched,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },
    async listCouponBatches() {
      return [{ id: 1, note: null, discount: { kind: 'percent', value: 50 }, quantity: 2, expiresOn: null, createdAt: null, unused: 1, used: 1, void: 0 }];
    },
    async createCouponBatch(input: any) {
      created.push({ ...input, sample: input.generate() });
      return 9;
    },
    async listCouponCodes(batchId: number) {
      return [
        { id: 1, batchId, code: 'ABCD2345XY', status: 'unused', usedBy: null, usedAt: null },
        { id: 2, batchId, code: 'ABCD2345XZ', status: 'used', usedBy: 3, usedAt: '2026-11-07T00:00:00.000Z' },
      ];
    },
    async updateCouponBatch(id: number, patch: any) {
      patched.push({ id, patch });
      return id === 1 ? 1 : 0;
    },
    async voidCouponCode(id: number) {
      return id === 1 ? 1 : 0;
    },
  };
});

let client: TestClient;
let store: any;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  db.codes = [
    { id: 1, code: 'AAAA2222BB', status: 'unused', usedBy: null, expiresOn: null, discount: { kind: 'percent', value: 50 } },
    { id: 2, code: 'CCCC3333DD', status: 'used', usedBy: 9, expiresOn: null, discount: { kind: 'percent', value: 50 } },
    { id: 3, code: 'EEEE4444FF', status: 'void', usedBy: null, expiresOn: null, discount: { kind: 'percent', value: 50 } },
    { id: 4, code: 'GGGG5555HH', status: 'unused', usedBy: null, expiresOn: '2026-11-06', discount: { kind: 'percent', value: 50 } },
    { id: 5, code: 'JJJJ6666KK', status: 'unused', usedBy: null, expiresOn: '2026-11-07', discount: { kind: 'amount', value: 1000 } },
    { id: 6, code: 'MMMM7777NN', status: 'unused', usedBy: null, expiresOn: null, discount: { kind: 'percent', value: 50 } },
    { id: 7, code: 'PPPP8888QQ', status: 'unused', usedBy: null, expiresOn: null, discount: { kind: 'percent', value: 50 } },
  ];
  db.payments = [];
  db.claimDays = [];
});

afterAll(async () => {
  await client.close();
});

const claim = (userId: number | null, code: string) => client.postJson('/api/coupon', { code }, userId === null ? {} : bearer(userId));

describe('家長兌優惠券', () => {
  it('未登入 401（讀與兌都是）', async () => {
    expect((await claim(null, 'AAAA2222BB')).status).toBe(401);
    expect((await client.get('/api/coupon')).status).toBe(401);
  });

  it('還沒用：讀回 null；兌到之後讀回那一張（大小寫與分隔符不拘）', async () => {
    expect(await (await client.get('/api/coupon', bearer(1))).json()).toEqual({ coupon: null });
    const resp = await claim(1, 'aaaa-2222-bb');
    expect(resp.status).toBe(200);
    const want = { coupon: { code: 'AAAA-2222-BB', discount: { kind: 'percent', value: 50 }, label: '5 折' } };
    expect(await resp.json()).toEqual(want);
    expect(await (await client.get('/api/coupon', bearer(1))).json()).toEqual(want);
  });

  it('日期照 Asia/Shanghai 由伺服器給', async () => {
    await claim(2, 'AAAA2222BB');
    expect(db.claimDays).toEqual(['2026-11-07']);
  });

  it.each([
    ['用過', 'CCCC-3333-DD'],
    ['作廢', 'EEEE-4444-FF'],
    ['過期（昨天到期）', 'GGGG-5555-HH'],
    ['不存在', 'ZZZZ-9999-ZZ'],
    ['形狀不對', 'not-a-code'],
  ])('%s → 同一句 400', async (_why, code) => {
    const resp = await claim(3, code);
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: '优惠码不正确、已使用或已过期', code: 'COUPON_INVALID' });
  });

  it('今天到期的還兌得到', async () => {
    const resp = await claim(4, 'JJJJ6666KK');
    expect(resp.status).toBe(200);
    expect((await resp.json()).coupon.label).toBe('减 ¥10');
  });

  it('每人一次：用過一張再兌別張 409，那一張還是未用', async () => {
    expect((await claim(5, 'MMMM7777NN')).status).toBe(200);
    const resp = await claim(5, 'PPPP8888QQ');
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('COUPON_ALREADY_CLAIMED');
    expect(db.codes.find(c => c.code === 'PPPP8888QQ')!.status).toBe('unused');
  });

  it('兩人同時兌同一張：只有一人成功', async () => {
    const [a, b] = await Promise.all([claim(6, 'AAAA2222BB'), claim(7, 'AAAA2222BB')]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('同一位家長每小時 10 次之後 429', async () => {
    for (let i = 0; i < 10; i++) await claim(20, 'ZZZZ9999ZZ');
    expect((await claim(20, 'AAAA2222BB')).status).toBe(429);
  });
});

describe('T2 訂單照折後價', () => {
  const pay = (userId: number) => client.postJson('/api/payment/create', { scope: 't2' }, bearer(userId));

  it('沒用券：原價 ¥19.9，訂單不帶券', async () => {
    const body = await (await pay(10)).json();
    expect(body.amountFen).toBe(1990);
    expect(db.payments.at(-1).coupon).toBeUndefined();
  });

  it('用了五折券：¥9.95，訂單記下哪一張與折前', async () => {
    await claim(11, 'AAAA2222BB');
    const body = await (await pay(11)).json();
    expect(body.amountFen).toBe(995);
    expect(db.payments.at(-1)).toMatchObject({ amountFen: 995, scope: 't2', coupon: { codeId: 1, listAmountFen: 1990 } });
  });

  it('減 ¥10 的券：¥9.9', async () => {
    await claim(12, 'JJJJ6666KK');
    expect((await (await pay(12)).json()).amountFen).toBe(990);
  });

  it('T3 不吃券', async () => {
    await claim(13, 'MMMM7777NN');
    const body = await (await client.postJson('/api/payment/create', { scope: 't3', dimensionId: 'language' }, bearer(13))).json();
    expect(db.payments.at(-1).coupon).toBeUndefined();
    expect(body.amountFen).not.toBe(995);
  });
});

describe('後台「优惠券」', () => {
  async function token(email: string, pw: string) {
    return (await (await client.postJson('/api/admin/login', { email, password: pw })).json()).token as string;
  }
  const h = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('推薦人帳號 403（只有全域管理員）', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    expect((await client.get('/api/admin/coupons', h(t))).status).toBe(403);
    expect((await client.postJson('/api/admin/coupons', { quantity: 5 }, h(t))).status).toBe(403);
  });

  it('看批次與每一張', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const batches = await (await client.get('/api/admin/coupons', h(t))).json();
    expect(batches.batches[0]).toMatchObject({ unused: 1, used: 1 });
    const codes = await (await client.get('/api/admin/coupons/1/codes', h(t))).json();
    expect(codes.codes).toHaveLength(2);
    const csv = await (await client.get('/api/admin/coupons/1/codes.csv', h(t))).text();
    expect(csv).toContain('ABCD-2345-XY');
    expect(csv).not.toContain('ABCD-2345-XZ');
  });

  it('產一批：不帶折扣＝預設半價；碼是 10 碼', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/coupons', { quantity: 3 }, h(t));
    expect(resp.status).toBe(200);
    const last = store.__created.at(-1);
    expect(last).toMatchObject({ quantity: 3, discount: { kind: 'percent', value: 50 }, expiresOn: null, createdBy: 30 });
    expect(last.sample).toMatch(/^[23456789A-HJ-NP-Z]{10}$/);
  });

  it('產一批：減固定金額、到期日', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/coupons', { quantity: 2, discountKind: 'amount', discountValue: 500, expiresOn: '2026-12-31', note: '门诊' }, h(t));
    expect(resp.status).toBe(200);
    expect(store.__created.at(-1)).toMatchObject({ discount: { kind: 'amount', value: 500 }, expiresOn: '2026-12-31', note: '门诊' });
  });

  it.each([
    [{ quantity: 0 }],
    [{ quantity: 501 }],
    [{ quantity: 2, discountKind: 'percent', discountValue: 100 }],
    [{ quantity: 2, discountKind: 'amount', discountValue: 0 }],
    [{ quantity: 2, expiresOn: '2026-13-01' }],
  ])('產一批：不對的輸入 400（%j）', async body => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await client.postJson('/api/admin/coupons', body, h(t))).status).toBe(400);
  });

  it('改折扣與到期日；找不到 404；沒東西可改 400', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    const patch = (id: number, body: unknown) => client.request(`/api/admin/coupons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h(t) }, body: JSON.stringify(body) });
    expect((await patch(1, { discountKind: 'percent', discountValue: 70, expiresOn: null })).status).toBe(200);
    expect(store.__patched.at(-1)).toEqual({ id: 1, patch: { discount: { kind: 'percent', value: 70 }, expiresOn: null } });
    expect((await patch(2, { discountKind: 'percent', discountValue: 70 })).status).toBe(404);
    expect((await patch(1, {})).status).toBe(400);
    expect((await patch(1, { discountKind: 'percent', discountValue: 0 })).status).toBe(400);
  });

  it('作廢：未用的可以，其他 409', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await client.postJson('/api/admin/coupon-codes/1/void', {}, h(t))).status).toBe(200);
    expect((await client.postJson('/api/admin/coupon-codes/2/void', {}, h(t))).status).toBe(409);
  });
});

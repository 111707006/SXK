import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 家長兌換（#110，`TRAINING_PLAN`）：要登入、失敗一律同一句、成功回到哪天、兩人同時兌只有一人成功、限流；
 * 推薦人只看得到自己的碼。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-redeem';

const users: Record<number, { id: number; phone: string }> = {};
for (let i = 1; i <= 40; i++) users[i] = { id: i, phone: `138000000${String(i).padStart(2, '0')}` };

const db = vi.hoisted(() => ({
  codes: new Map<string, { id: number; status: string; months: number; usedBy: number | null }>(),
  passes: [] as any[],
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  saveUserData: async () => {},
}));

vi.mock('../src/db/redeemCodes', async () => {
  const { nextPassRange } = await import('../src/t2/trainingPass');
  return {
    async redeemCodeForUser(userId: number, code: string, today: string) {
      await new Promise(r => setTimeout(r, 5)); // 讓兩個請求交錯
      const row = db.codes.get(code);
      if (!row || row.status !== 'unused') return { ok: false };
      row.status = 'used';
      row.usedBy = userId;
      const mine = db.passes.filter(p => p.userId === userId);
      const range = nextPassRange(mine, today, row.months as 1 | 3 | 6);
      db.passes.push({ userId, ...range, months: row.months, source: 'code' });
      return { ok: true, months: row.months, ...range, boundReferrerId: 1 };
    },
  };
});

vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async (userId: number) => db.passes.filter(p => p.userId === userId),
  insertTrainingPass: async () => true,
  hasScaleT2Findings: async () => false,
}));

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    { id: 40, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 7, referrerActive: true },
  ];
  const calls: number[] = [];
  return {
    __calls: calls,
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
    async listRedeemCodes(referrerId: number) {
      calls.push(referrerId);
      return [{ id: 1, batchId: 1, referrerId, code: 'ABCD2345XY', months: 1, status: 'unused', usedBy: null, usedAt: null, createdAt: null }];
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
  db.codes = new Map([
    ['AAAA2222BB', { id: 1, status: 'unused', months: 3, usedBy: null }],
    ['CCCC3333DD', { id: 2, status: 'used', months: 1, usedBy: 9 }],
    ['EEEE4444FF', { id: 3, status: 'void', months: 1, usedBy: null }],
    ['GGGG5555HH', { id: 4, status: 'unused', months: 1, usedBy: null }],
  ]);
  db.passes = [];
});

afterAll(async () => {
  await client.close();
});

const redeem = (userId: number | null, code: string) =>
  client.postJson('/api/training/redeem', { code }, userId === null ? {} : bearer(userId));

describe('家長兌換', () => {
  it('未登入 401', async () => {
    expect((await redeem(null, 'AAAA2222BB')).status).toBe(401);
  });

  it('成功：大小寫與分隔符不拘，回月數與到哪天', async () => {
    const resp = await redeem(1, 'aaaa-2222-bb');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.months).toBe(3);
    expect(body.endsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(['CCCC-3333-DD', 'EEEE-4444-FF', 'ZZZZ-9999-ZZ', 'not-a-code'])('已用／作廢／不存在／形狀不對 → 同一句（%s）', async code => {
    const resp = await redeem(2, code);
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: '兑换码不正确或已使用', code: 'REDEEM_INVALID' });
  });

  it('兩人同時兌同一組：只有一人成功', async () => {
    const [a, b] = await Promise.all([redeem(3, 'GGGG5555HH'), redeem(4, 'GGGG5555HH')]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('同一位家長每小時 10 次之後 429', async () => {
    for (let i = 0; i < 10; i++) await redeem(20, 'ZZZZ9999ZZ');
    expect((await redeem(20, 'AAAA2222BB')).status).toBe(429);
  });
});

describe('推薦人看自己的碼', () => {
  async function token(email: string, pw: string) {
    return (await (await client.postJson('/api/admin/login', { email, password: pw })).json()).token as string;
  }

  it('推薦人：/referrer/codes 用的是工作階段裡的推薦人編號', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    const resp = await client.get('/api/admin/referrer/codes?referrerId=99', { Authorization: `Bearer ${t}` });
    expect(resp.status).toBe(200);
    expect(store.__calls.at(-1)).toBe(7);
  });

  it('推薦人打不到別人的碼（全域那幾支）', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    expect((await client.get('/api/admin/referrers/8/codes', { Authorization: `Bearer ${t}` })).status).toBe(403);
    expect((await client.postJson('/api/admin/referrers/7/codes', { months: 1, quantity: 5 }, { Authorization: `Bearer ${t}` })).status).toBe(403);
  });

  it('全域管理員打「我的兑换码」→ 403（那是推薦人的）', async () => {
    const t = await token('god@sxk.com', 'pw-god-123');
    expect((await client.get('/api/admin/referrer/codes', { Authorization: `Bearer ${t}` })).status).toBe(403);
  });

  it('未用碼的 CSV：帶 BOM、格式化過的碼', async () => {
    const t = await token('ref@a.com', 'pw-ref-123');
    const resp = await client.get('/api/admin/referrer/codes.csv', { Authorization: `Bearer ${t}` });
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain('ABCD-2345-XY,1');
  });
});

describe('方案', () => {
  it('公開讀得到三種方案；付款沒開', async () => {
    const body = await (await client.get('/api/training/plans')).json();
    expect(body.plans.map((p: any) => p.months)).toEqual([1, 3, 6]);
    expect(body.payAvailable).toBe(false);
  });
});

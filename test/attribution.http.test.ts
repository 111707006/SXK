import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 歸屬（#5）與家長端專家名單（#9）的 HTTP 測試。
 *
 * 這裡釘住的核心是一句否定：**識別碼無效時不得退回任何預設公司。**
 * 那不是一個「差一點」的錯誤 —— 歸屬註冊時綁定、此後不再改變，落錯一家就是把
 * 一位家長的孩子的健康資料永久送給錯的機構。
 */

const VALID_SLUG = 'jia';
const COMPANY_ID = 7;

const created: Array<{ email: string; companyId: number | null }> = [];
const users = new Map<string, any>();

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserByEmail: async (email: string) => users.get(email) ?? null,
  createUser: async (email: string, password: string, companyId: number | null = null) => {
    created.push({ email, companyId });
    users.set(email, { id: users.size + 1, email, password, company_id: companyId });
  },
  findCompanyBySlug: async (slug: string) =>
    slug === VALID_SLUG
      ? { id: COMPANY_ID, name: '甲机构', slug, wecomWebhookUrl: null, active: true }
      : null,
  findCompanyByUserId: async () => null,
  listActiveSpecialists: async (companyId: number) =>
    companyId === COMPANY_ID
      ? [{ id: 1, name: '甲机构的治疗师', title: null, specialty: null, experience: null, avatarUrl: null, slots: ['周一上午'] }]
      : [],
  updateUserPassword: async () => {},
  getUserData: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  listUnlockedDimensions: async () => [],
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  parseUserDataRow: () => null,
}));

function signToken(email: string): string {
  const b64url = (buf: Buffer | string) =>
    Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = b64url(JSON.stringify({ email, exp: Date.now() + 60_000 }));
  const sig = b64url(crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest());
  return `${payload}.${sig}`;
}

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  created.length = 0;
  users.clear();
});

afterAll(async () => {
  await client.close();
});

describe('歸屬在註冊時綁定（#5）', () => {
  it('帶有效識別碼註冊，歸屬寫進帳號', async () => {
    const resp = await client.postJson('/api/auth/register', {
      email: 'p1@x.com', password: 'pw', companySlug: VALID_SLUG,
    });
    expect(resp.status).toBe(200);
    expect(created).toEqual([{ email: 'p1@x.com', companyId: COMPANY_ID }]);
  });

  it('識別碼大小寫不敏感 —— 連結被轉成大寫仍然找得到公司', async () => {
    await client.postJson('/api/auth/register', {
      email: 'p2@x.com', password: 'pw', companySlug: 'JIA',
    });
    expect(created[0].companyId).toBe(COMPANY_ID);
  });

  // ── 這一條是整支測試的重點 ──
  it.each([
    ['識別碼查無此公司', 'not-a-real-company'],
    ['識別碼是空字串', ''],
    ['完全沒帶識別碼', undefined],
    ['識別碼型別不對', 12345],
  ])('%s 時歸屬留空，流程照常，且不落入任何一家公司', async (_label, slug) => {
    const resp = await client.postJson('/api/auth/register', {
      email: 'p3@x.com', password: 'pw', ...(slug === undefined ? {} : { companySlug: slug }),
    });
    expect(resp.status).toBe(200);
    expect((await resp.json()).success).toBe(true);
    expect(created).toEqual([{ email: 'p3@x.com', companyId: null }]);
  });

  it('已註冊的家長再從別家公司的連結進站，歸屬不改變', async () => {
    await client.postJson('/api/auth/register', {
      email: 'p4@x.com', password: 'pw', companySlug: VALID_SLUG,
    });
    expect(users.get('p4@x.com').company_id).toBe(COMPANY_ID);

    // 帶著另一家公司的識別碼再註冊一次 → 被擋在「已被注册」，帳號一個字都沒動。
    const again = await client.postJson('/api/auth/register', {
      email: 'p4@x.com', password: 'pw', companySlug: 'another-company',
    });
    expect(again.status).toBe(400);
    expect(users.get('p4@x.com').company_id).toBe(COMPANY_ID);

    // 登入那條路也不碰歸屬。
    await client.postJson('/api/auth/login', { email: 'p4@x.com', password: 'pw' });
    expect(users.get('p4@x.com').company_id).toBe(COMPANY_ID);
    expect(created).toHaveLength(1);
  });
});

describe('家長端只看得到自己歸屬公司的專家（#9）', () => {
  it('有歸屬的家長看到自己公司的專家', async () => {
    await client.postJson('/api/auth/register', {
      email: 'p5@x.com', password: 'pw', companySlug: VALID_SLUG,
    });
    const body = await (
      await client.get('/api/specialists', { Authorization: `Bearer ${signToken('p5@x.com')}` })
    ).json();
    expect(body.reason).toBe('ok');
    expect(body.specialists.map((s: any) => s.name)).toEqual(['甲机构的治疗师']);
  });

  it('未歸屬的家長看不到任何一家公司的專家，且理由是明確的', async () => {
    await client.postJson('/api/auth/register', { email: 'p6@x.com', password: 'pw' });
    const body = await (
      await client.get('/api/specialists', { Authorization: `Bearer ${signToken('p6@x.com')}` })
    ).json();
    expect(body.specialists).toEqual([]);
    // 空陣列不夠 —— 前端要能分辨「沒有歸屬」與「公司還沒設定專家」，
    // 否則兩種情況會長成同一塊空白的預約區塊。
    expect(body.reason).toBe('unassigned');
  });

  it('未登入的家長同樣看不到任何專家', async () => {
    const body = await (await client.get('/api/specialists')).json();
    expect(body.specialists).toEqual([]);
    expect(body.reason).toBe('unassigned');
  });
});

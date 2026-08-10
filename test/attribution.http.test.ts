import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 歸屬（#5）與家長端專家名單（#9）的 HTTP 測試。
 *
 * 這裡釘住的核心是一句否定：**識別碼無效時不得退回任何預設公司。**
 * 那不是一個「差一點」的錯誤 —— 歸屬在建立帳號時綁定、此後不再改變，落錯一家
 * 就是把一位家長的孩子的健康資料永久送給錯的機構。
 *
 * 走的是**手機號驗證碼**那條路（#27 之後唯一的入口）。規格沒有改：歸屬只在
 * 帳號被建立的那一刻寫入，第二次登入一個字都不動。改的只是「哪一個動作會建
 * 帳號」—— 從電子郵件註冊，換成第一次驗證碼核對成功。
 */

const VALID_SLUG = 'jia';
const COMPANY_ID = 7;

/** 建過的帳號，依序記下。歸屬有沒有落錯就看這一份。 */
const created: Array<{ phone: string; companyId: number | null }> = [];
/** 登入那條路的索引：（歸屬，手機號）→ 帳號。 */
const users: Array<{ id: number; phone: string; company_id: number | null }> = [];
/** 通行證那條路的索引：使用者 id → 帳號。登入之後的每一次查詢都走這一條。 */
const usersById = new Map<number, any>();

/** 未歸屬併為單一值 —— 與資料庫的 `company_key` 生成欄位是同一個約定。 */
const companyKey = (companyId: number | null) => companyId ?? 0;

/** 驗證碼替身：只記手機號與雜湊，行為與真的那張表一致。 */
let smsCodes: Array<{
  id: number; phone: string; code_hash: string; expires_at: Date;
  attempts: number; consumed_at: Date | null; created_at: Date;
}> = [];
let nextCodeId = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => usersById.get(id) ?? null,
  findUserByPhone: async (companyId: number | null, phone: string) =>
    users.find(u => u.phone === phone && companyKey(u.company_id) === companyKey(companyId)) ?? null,
  createPhoneUser: async (phone: string, companyId: number | null = null) => {
    created.push({ phone, companyId });
    const row = { id: users.length + 1, phone, company_id: companyId };
    users.push(row);
    usersById.set(row.id, row);
    return row.id;
  },
  createSmsCode: async (input: any) => {
    const row = {
      id: nextCodeId++, phone: input.phone, code_hash: input.codeHash,
      expires_at: input.expiresAt, attempts: 0, consumed_at: null, created_at: new Date(),
    };
    smsCodes.push(row);
    return row.id;
  },
  deleteSmsCode: async (id: number) => { smsCodes = smsCodes.filter(c => c.id !== id); },
  findLatestSmsCode: async (phone: string) =>
    [...smsCodes].reverse().find(c => c.phone === phone) ?? null,
  countSmsCodesSince: async () => 0,
  incrementSmsCodeAttempts: async () => {},
  consumeSmsCode: async (id: number) => {
    const row = smsCodes.find(c => c.id === id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = new Date();
    return true;
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
  getUserDataByUserId: async () => null,
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

/** 送出去的簡訊，看得到內容 —— 測試靠它拿到那組六位數字。 */
const sent: Array<{ phone: string; code: string }> = [];

vi.mock('../src/sms', () => ({
  sendVerificationCode: async (phone: string, code: string) => {
    sent.push({ phone, code });
    return { ok: true, provider: 'aliyun', detail: 'sent' };
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  created.length = 0;
  users.length = 0;
  usersById.clear();
  smsCodes = [];
  sent.length = 0;
  nextCodeId = 1;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

/**
 * 走完一次完整的登入：索取驗證碼 → 核對。第一次成功會建帳號。
 *
 * 冷卻期以最近一筆的 `created_at` 為準，所以同一支手機號連續登入兩次時，
 * 先把上一筆推到過去，否則第二次索取會被 429 擋下 —— 那是防刷在做它的事，
 * 不是這支測試要驗的東西。
 */
async function signIn(phone: string, companySlug?: string): Promise<Response> {
  for (const row of smsCodes) row.created_at = new Date(Date.now() - 10 * 60 * 1000);
  const requested = await client.postJson('/api/auth/sms/request', { phone, companySlug });
  expect(requested.status).toBe(200);
  const code = sent[sent.length - 1].code;
  return client.postJson('/api/auth/sms/verify', {
    phone, code, ...(companySlug === undefined ? {} : { companySlug }),
  });
}

/** 那位家長登入之後拿到的通行證 —— 帶的是使用者 id。 */
const asParent = (phone: string) => bearer(users.find(u => u.phone === phone)!.id);

describe('歸屬在建立帳號的那一刻綁定（#5）', () => {
  it('帶有效識別碼登入，歸屬寫進新帳號', async () => {
    const resp = await signIn('13800138001', VALID_SLUG);
    expect(resp.status).toBe(200);
    expect(created).toEqual([{ phone: '13800138001', companyId: COMPANY_ID }]);
  });

  it('識別碼大小寫不敏感 —— 連結被轉成大寫仍然找得到公司', async () => {
    await signIn('13800138002', 'JIA');
    expect(created[0].companyId).toBe(COMPANY_ID);
  });

  // ── 這一條是整支測試的重點 ──
  it.each([
    ['識別碼查無此公司', 'not-a-real-company'],
    ['識別碼是空字串', ''],
    ['完全沒帶識別碼', undefined],
  ])('%s 時歸屬留空，流程照常，且不落入任何一家公司', async (_label, slug) => {
    const resp = await signIn('13800138003', slug);
    expect(resp.status).toBe(200);
    expect((await resp.json()).success).toBe(true);
    expect(created).toEqual([{ phone: '13800138003', companyId: null }]);
  });

  it('已有帳號的家長再從別家公司的連結進站，歸屬不改變', async () => {
    await signIn('13800138004', VALID_SLUG);
    expect(users[0].company_id).toBe(COMPANY_ID);

    // 帶著另一家公司的識別碼再登入一次。那個識別碼查無公司 → 未歸屬範圍，
    // 於是找不到既有帳號、建出第二個 —— 同一支手機號在兩個範圍是兩位家長
    // （ADR-0002），而甲公司那一個一個字都沒動。
    const again = await signIn('13800138004', 'another-company');
    expect(again.status).toBe(200);
    expect(users.find(u => u.company_id === COMPANY_ID)!.company_id).toBe(COMPANY_ID);
    expect(created.map(c => c.companyId)).toEqual([COMPANY_ID, null]);

    // 回到甲公司的連結登入，走的是既有帳號那條路，不再建一個。
    const back = await signIn('13800138004', VALID_SLUG);
    expect(back.status).toBe(200);
    expect(created).toHaveLength(2);
  });
});

describe('家長端只看得到自己歸屬公司的專家（#9）', () => {
  it('有歸屬的家長看到自己公司的專家', async () => {
    await signIn('13800138005', VALID_SLUG);
    const body = await (
      await client.get('/api/specialists', asParent('13800138005'))
    ).json();
    expect(body.reason).toBe('ok');
    expect(body.specialists.map((s: any) => s.name)).toEqual(['甲机构的治疗师']);
  });

  it('未歸屬的家長看不到任何一家公司的專家，且理由是明確的', async () => {
    await signIn('13800138006');
    const body = await (
      await client.get('/api/specialists', asParent('13800138006'))
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

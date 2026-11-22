import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * Review（Standards）：#116 加了 A 的手機號唯一鍵（uk_a_active_phone）之後，身分開關（A_PHONE_IDENTITY）**關著**時，
 * 家長從別的單位的 `?c=` 進來，照（歸屬，手機號）找不到 → 建帳號撞唯一鍵 → 以前回 500。
 * 唯一鍵在 A 的意思就是「一支手機一個啟用中的帳號」，所以撞到時以手機號重查、登入那一個。
 */
process.env.A_COMPANIES = '1';
delete process.env.A_PHONE_IDENTITY;
delete process.env.SERVICE_RELATIONS;

const PHONE = '13800138000';
let codeHash = '';
vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === 40 ? { id: 40, phone: PHONE, company_id: 7 } : null),
  // （歸屬，手機號）：這支手機只在單位 7 有帳號
  findUserByPhone: async (companyId: number | null) => (companyId === 7 ? { id: 40, phone: PHONE, company_id: 7 } : null),
  listUsersByPhone: async () => [{ id: 40, phone: PHONE, company_id: 7, has_reports: 1, has_orders: 0 }],
  createPhoneUser: async () => {
    throw Object.assign(new Error("Duplicate entry for key 'uk_a_active_phone'"), { code: 'ER_DUP_ENTRY', errno: 1062 });
  },
  findLatestSmsCode: async (phone: string) => ({ id: 1, phone, code_hash: codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999 }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async (slug: string) => (slug === 'yi' ? { id: 8, name: 'yi', slug, wecomWebhookUrl: null, active: true } : null),
  getUserDataByUserId: async () => null,
}));

let client: TestClient;
beforeAll(async () => {
  codeHash = (await import('bcryptjs')).default.hashSync('123456', 4);
  client = await startTestApp(await loadApp());
});
afterAll(async () => {
  await client.close();
  delete process.env.A_COMPANIES;
});

describe('身分開關關著、A 的手機號唯一鍵已加上', () => {
  it('從別的單位的連結登入：撞唯一鍵 → 以手機號重查，登入既有帳號（不是 500）', async () => {
    const res = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456', companySlug: 'yi' });
    expect(res.status).toBe(200);
    const uid = JSON.parse(Buffer.from((await res.json()).token.split('.')[0], 'base64url').toString()).uid;
    expect(Number(uid)).toBe(40);
  });
});

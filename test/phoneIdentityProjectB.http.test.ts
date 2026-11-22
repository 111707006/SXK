import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 設了身分開關（`A_PHONE_IDENTITY`）也不生效：B 的家長身分照舊是（歸屬，手機號）（ADR-0002），
 * 同一支手機從兩家合作公司進來是兩位家長；而且根本不去問「這支手機底下的全部帳號」。
 * （啟動時那一行「設了但不生效」印在 `app.listen` 裡，測試不起監聽，不驗。）
 * ⚠️ 必須在載入 `server.ts` 之前設定。
 */
process.env.APP_MODE = 't1only';
process.env.A_PHONE_IDENTITY = '1';

const PHONE = '13800138000';
const COMPANIES: Record<string, number> = { jia: 7, yi: 8 };
const users: Array<{ id: number; phone: string; company_id: number | null }> = [];
let codeHash = '';

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async (companyId: number | null, phone: string) =>
    users.find(u => u.phone === phone && (u.company_id ?? 0) === (companyId ?? 0)) ?? null,
  listUsersByPhone: async () => {
    throw new Error('B 不該只看手機號找帳號');
  },
  createPhoneUser: async (phone: string, companyId: number | null) => {
    users.push({ id: users.length + 1, phone, company_id: companyId });
    return users.length;
  },
  findLatestSmsCode: async (phone: string) => ({
    id: 1, phone, code_hash: codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999,
  }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async (slug: string) =>
    COMPANIES[slug] ? { id: COMPANIES[slug], name: slug, slug, wecomWebhookUrl: null, active: true } : null,
  findCompanyByUserId: async () => null,
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  saveUserData: async () => {},
  listUnlockedDimensions: async () => [],
}));

let client: TestClient;

beforeAll(async () => {
  codeHash = (await import('bcryptjs')).default.hashSync('123456', 4);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  delete process.env.A_PHONE_IDENTITY;
});

const uidOf = (token: string) => Number(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).uid);

async function login(companySlug: string): Promise<number> {
  const res = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456', companySlug });
  expect(res.status).toBe(200);
  return uidOf((await res.json()).token);
}

describe('專案 B 設了 A_PHONE_IDENTITY', () => {
  it('同一支手機從兩家合作公司進來仍是兩位家長', async () => {
    const a = await login('jia');
    const b = await login('yi');
    expect(a).not.toBe(b);
    expect(users.map(u => u.company_id)).toEqual([7, 8]);
    expect(await login('jia')).toBe(a);
  });
});

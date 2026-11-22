import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/** #118：服務關係開關關著，登入帶推薦人代號也一行不動——不查推薦人、不讀不寫服務關係。 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';
delete process.env.SERVICE_RELATIONS;

let codeHash = '';
const never = (name: string) => async () => {
  throw new Error(`${name}：SERVICE_RELATIONS 關著時不該被呼叫`);
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  listUsersByPhone: async () => [],
  createPhoneUser: async () => 1,
  findLatestSmsCode: async (phone: string) => ({ id: 1, phone, code_hash: codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999 }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async () => ({ id: 7, name: 'jia', slug: 'jia', wecomWebhookUrl: null, active: true }),
  findLinkReferrer: never('findLinkReferrer'),
  getServiceRelationByUserId: never('getServiceRelationByUserId'),
  attachServiceRelation: never('attachServiceRelation'),
  getUserDataByUserId: async () => null,
}));

let client: TestClient;
const warn = vi.spyOn(console, 'warn');
beforeAll(async () => {
  codeHash = (await import('bcryptjs')).default.hashSync('123456', 4);
  client = await startTestApp(await loadApp());
});
afterAll(async () => {
  await client.close();
  delete process.env.A_COMPANIES;
  delete process.env.A_PHONE_IDENTITY;
});

describe('SERVICE_RELATIONS 關著', () => {
  it('帶 ?c=&t= 登入：200，服務關係那幾支一次都沒叫', async () => {
    const res = await client.postJson('/api/auth/sms/verify', { phone: '13800138000', code: '123456', companySlug: 'jia', referrerCode: 'zhang' });
    expect(res.status).toBe(200);
    expect(warn.mock.calls.flat().join('\n')).not.toMatch(/SERVICE_RELATIONS 關著時不該被呼叫/);
  });
});

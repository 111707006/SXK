import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * `A_COMPANIES` 關著（客戶 10/22，#89）：專案 A 照舊沒有合作公司 —— 登入時帶了進站代號也被忽略（連公司名冊都不查），
 * 家長全部未歸屬（＝森心康直屬）；公司 Logo 端點不存在。開著的情況見 `aCompaniesOn.http.test.ts` 與
 * `attribution.http.test.ts`（那一支開著跑歸屬機制本身）。
 */
delete process.env.A_COMPANIES;

const created: Array<{ phone: string; companyId: number | null }> = [];
const users: Array<{ id: number; phone: string; company_id: number | null }> = [];
let smsCodes: any[] = [];
const findCompanyBySlug = vi.fn(async (slug: string) => (slug === 'jia' ? { id: 7, name: '甲机构', slug, wecomWebhookUrl: null, active: true } : null));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async (companyId: number | null, phone: string) => users.find(u => u.phone === phone && (u.company_id ?? 0) === (companyId ?? 0)) ?? null,
  createPhoneUser: async (phone: string, companyId: number | null = null) => {
    created.push({ phone, companyId });
    users.push({ id: users.length + 1, phone, company_id: companyId });
    return users.length;
  },
  createSmsCode: async (input: any) => {
    smsCodes.push({ id: smsCodes.length + 1, phone: input.phone, code_hash: input.codeHash, expires_at: new Date(Date.now() + 600000), attempts: 0, consumed_at: null, created_at: new Date(Date.now() - 600000) });
    return smsCodes.length;
  },
  deleteSmsCode: async () => {},
  findLatestSmsCode: async (phone: string) => {
    const row = [...smsCodes].reverse().find(c => c.phone === phone);
    return row ? { ...row, age_sec: 600, is_expired: 0 } : null;
  },
  countRecentSmsCodesByPhone: async () => 0,
  countRecentSmsCodesByIp: async () => 0,
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async (id: number) => {
    const row = smsCodes.find(c => c.id === id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = new Date();
    return true;
  },
  findCompanyBySlug: (slug: string) => findCompanyBySlug(slug),
  findCompanyByUserId: async () => null,
  findCompanyLogoBySlug: async () => '/logo.png',
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
}));

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
  smsCodes = [];
  sent.length = 0;
  findCompanyBySlug.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

describe('A_COMPANIES 關著', () => {
  it('帶了有效的進站代號也不歸屬：未歸屬、連名冊都不查', async () => {
    expect((await client.postJson('/api/auth/sms/request', { phone: '13800138001', companySlug: 'jia' })).status).toBe(200);
    const resp = await client.postJson('/api/auth/sms/verify', { phone: '13800138001', code: sent[0].code, companySlug: 'jia' });
    expect(resp.status).toBe(200);
    expect(created).toEqual([{ phone: '13800138001', companyId: null }]);
    expect(findCompanyBySlug).not.toHaveBeenCalled();
  });

  it('公司 Logo 端點不存在（404）', async () => {
    expect((await client.get('/api/company-brand?c=jia')).status).toBe(404);
  });
});

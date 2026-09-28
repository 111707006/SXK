import { describe, it, expect, beforeAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { resolveDemoLoginCode } from '../src/demoLogin';

/**
 * 展示環境的固定驗證碼（`src/demoLogin.ts`，Render 的 `sxk-demo`）。
 *
 * 要釘住的兩件事：
 * 1. **它只能出現在資料庫跑在本機的那一台。** 固定驗證碼＝任何人登入任何手機號；正式站連的是遠端 RDS，
 *    同時設了就起不來，不是悄悄忽略。
 * 2. **設了之後只少了「送簡訊」與防刷**：驗證碼照樣存雜湊、照樣一次性、第一次照樣建帳號 —— 走的是正式那一條。
 */

const DEMO_CODE = '246810';
const PHONE = '13800138000';

// 在載入 server.ts 之前設：它在模組層級就讀掉了。
process.env.DEMO_LOGIN_CODE = DEMO_CODE;
process.env.MYSQL_HOST = '127.0.0.1';

interface CodeRow { id: number; phone: string; code_hash: string; attempts: number; consumed_at: Date | null; expires_at: Date }
let codes: CodeRow[] = [];
let users: Array<{ id: number; phone: string; email: null; company_id: null }> = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async (_companyId: number | null, phone: string) => users.find(u => u.phone === phone) ?? null,
  createPhoneUser: async (phone: string) => {
    const row = { id: users.length + 1, phone, email: null, company_id: null };
    users.push(row);
    return row.id;
  },
  createSmsCode: async (input: any) => {
    const row: CodeRow = {
      id: codes.length + 1,
      phone: input.phone,
      code_hash: input.codeHash,
      attempts: 0,
      consumed_at: null,
      expires_at: new Date(Date.now() + input.ttlSec * 1000),
    };
    codes.push(row);
    return row.id;
  },
  findLatestSmsCode: async (phone: string) => {
    const row = [...codes].reverse().find(c => c.phone === phone);
    return row ? { ...row, age_sec: 0, is_expired: row.expires_at.getTime() <= Date.now() ? 1 : 0 } : null;
  },
  // 防刷的三支若被呼叫就是 bug：展示碼那一條不該走到它們。
  countRecentSmsCodesByPhone: async () => { throw new Error('demo path must not rate-limit'); },
  countRecentSmsCodesByIp: async () => { throw new Error('demo path must not rate-limit'); },
  deleteSmsCode: async () => {},
  incrementSmsCodeAttempts: async (id: number) => {
    const row = codes.find(c => c.id === id);
    if (row) row.attempts += 1;
  },
  consumeSmsCode: async (id: number) => {
    const row = codes.find(c => c.id === id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = new Date();
    return true;
  },
  findCompanyBySlug: async () => null,
  findCompanyByUserId: async () => null,
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
}));

const sent: string[] = [];
vi.mock('../src/sms', () => ({
  sendVerificationCode: async (phone: string) => {
    sent.push(phone);
    return { ok: true, provider: 'aliyun', detail: 'sent' };
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

describe('設了 DEMO_LOGIN_CODE（資料庫在本機）', () => {
  it('索取驗證碼：成功、不送簡訊、回應裡沒有驗證碼', async () => {
    const res = await client.postJson('/api/auth/sms/request', { phone: PHONE });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(JSON.stringify(body)).not.toContain(DEMO_CODE);
    expect(sent).toEqual([]);
    // 照樣只存雜湊。
    expect(codes.at(-1)!.code_hash).not.toBe(DEMO_CODE);
  });

  it('連著索取也不擋（沒有簡訊費，也沒有真人會被轟炸）', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await client.postJson('/api/auth/sms/request', { phone: PHONE })).status).toBe(200);
    }
  });

  it('用展示碼登入：第一次即建帳號、發 token', async () => {
    await client.postJson('/api/auth/sms/request', { phone: PHONE });
    const res = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: DEMO_CODE });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(users.map(u => u.phone)).toEqual([PHONE]);
  });

  it('錯的碼照樣不給進；同一組照樣只能用一次', async () => {
    await client.postJson('/api/auth/sms/request', { phone: PHONE });
    expect((await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '000001' })).status).not.toBe(200);
    expect((await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: DEMO_CODE })).status).toBe(200);
    expect((await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: DEMO_CODE })).status).not.toBe(200);
  });
});

describe('resolveDemoLoginCode：什麼時候收', () => {
  it('沒設＝沒有展示碼', () => {
    expect(resolveDemoLoginCode(undefined, '127.0.0.1')).toBeNull();
    expect(resolveDemoLoginCode('  ', 'rm-xxx.mysql.rds.aliyuncs.com')).toBeNull();
  });

  it('資料庫在本機才收', () => {
    expect(resolveDemoLoginCode('246810', '127.0.0.1')).toBe('246810');
    expect(resolveDemoLoginCode('246810', 'localhost')).toBe('246810');
  });

  // 正式站 A、B 與舊的 Render 服務連的都是遠端 RDS：同時設了，寧可起不來。
  it.each([
    ['正式站的 RDS', 'rm-uf6xxxx.mysql.rds.aliyuncs.com'],
    ['沒設 MYSQL_HOST', undefined],
    ['空字串', ''],
    ['長得像本機的遠端主機', '127.0.0.1.example.com'],
  ])('%s：丟錯讓程序起不來', (_label, host) => {
    expect(() => resolveDemoLoginCode('246810', host)).toThrow(/DEMO_LOGIN_CODE/);
  });

  it('不是 6 位數字：丟錯', () => {
    expect(() => resolveDemoLoginCode('1234', '127.0.0.1')).toThrow(/6/);
    expect(() => resolveDemoLoginCode('abcdef', '127.0.0.1')).toThrow(/6/);
  });
});

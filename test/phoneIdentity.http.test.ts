import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 身分開關（`A_PHONE_IDENTITY`，#115，ADR-0020 第 1 點，止血）：專案 A 的家長身分只看手機號。
 *
 * 開著時要釘住的：
 * 1. 這支手機已經有帳號就登入那個，不管連結帶的是哪個單位；歸屬（篩查渠道）不變、不多開帳號。
 * 2. 沒有帳號才照連結（`?c=`）建，建立時寫下的歸屬就是那個單位。
 * 3. 資料庫裡同一支手機已有兩個帳號（重複尚未合併）：登入有報告／訂單的那一個，與資料庫回來的順序無關。
 * 4. B→A 交接照同一條規則：已經有帳號（不管歸屬）就轉進那一個，不另建未歸屬帳號。
 *
 * 關著時的行為（ADR-0002：歸屬＋手機號）見 `smsLogin.http.test.ts`、`handoffTarget.http.test.ts`，一行不動。
 * ⚠️ 開關必須在載入 `server.ts` 之前設定。
 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';

const SECRET = 'p'.repeat(40);
const PHONE = '13800138000';
const HANDOFF_CODE = 'H'.repeat(32);
const COMPANIES: Record<string, number> = { jia: 7, yi: 8 };

interface Row { id: number; phone: string; company_id: number | null }
let users: Row[] = [];
/** 每個帳號的資料（`user_data` 那一列）。 */
let data: Record<number, { child: any; completedScores: any[]; orders: any[]; reportHistory: any[] }> = {};
/** 付款成功的訂單所屬帳號。 */
let paidUserIds: number[] = [];
let nextUserId = 1;
let codeHash = '';

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  // 開關開著時伺服器不該再問（歸屬，手機號）這一組。
  findUserByPhone: async () => {
    throw new Error('A_PHONE_IDENTITY 開著時不該以（歸屬，手機號）找帳號');
  },
  // 資料庫回來的順序刻意反過來（id 大的先），驗伺服器不靠順序挑。
  listUsersByPhone: async (phone: string) =>
    users
      .filter(u => u.phone === phone)
      .sort((a, b) => b.id - a.id)
      .map(u => ({
        ...u,
        has_reports: (data[u.id]?.reportHistory.length ?? 0) > 0 ? 1 : 0,
        has_orders: paidUserIds.includes(u.id) || (data[u.id]?.orders.length ?? 0) > 0 ? 1 : 0,
      })),
  createPhoneUser: async (phone: string, companyId: number | null) => {
    const row = { id: nextUserId++, phone, company_id: companyId };
    users.push(row);
    return row.id;
  },
  findLatestSmsCode: async (phone: string) => ({
    id: 1, phone, code_hash: codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999,
  }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async (slug: string) =>
    COMPANIES[slug] ? { id: COMPANIES[slug], name: slug, slug, wecomWebhookUrl: null, active: true } : null,
  findCompanyByUserId: async () => null,
  getUserDataByUserId: async (id: number) => (data[id] ? { user_id: id } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => data[row.user_id],
  saveUserData: async (id: number, _d: unknown, child: any, completedScores: any[], orders: any[], reportHistory: any[]) => {
    data[id] = { child, completedScores, orders, reportHistory };
  },
  listUnlockedDimensions: async () => [],
}));

vi.mock('../src/db/handoffs', () => ({
  createHandoffCode: async () => { throw new Error('A 不發碼'); },
  consumeHandoffCode: async () => { throw new Error('A 不兌換'); },
  recordHandoffImport: async () => {},
}));

const t1 = [
  { dimensionId: 'gross_motor', dimensionName: '动作发展', tierId: 'T1', score: 4, maxScore: 8, status: 'delay', completedAt: '2026-09-28T01:00:00.000Z' },
];
const fakeB = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const send = (status: number, json: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json));
    if (req.headers.authorization !== `Bearer ${SECRET}` || JSON.parse(body || '{}').code !== HANDOFF_CODE) return send(404, {});
    send(200, {
      phone: PHONE,
      sourceUserId: 70,
      source: { companyId: 2, slug: 'fudan', name: '复旦合作' },
      child: { name: '小安', gender: 'girl', ageMonth: 30 },
      completedScores: t1,
      t1Report: { id: 'rec_b', type: 'T1_SCREENING', child: { name: '小安' }, scores: t1, aiReport: { summary: 's' }, createdAt: '2026-09-28T02:00:00.000Z' },
      kind: 'button',
      consentVersion: 'test-v1',
    });
  });
});

let client: TestClient;

beforeAll(async () => {
  const bcrypt = (await import('bcryptjs')).default;
  codeHash = bcrypt.hashSync('123456', 4);
  await new Promise<void>(resolve => fakeB.listen(0, '127.0.0.1', resolve));
  process.env.HANDOFF_SECRET = SECRET;
  process.env.HANDOFF_SOURCE_ORIGIN = `http://127.0.0.1:${(fakeB.address() as AddressInfo).port}`;
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  await new Promise<void>(resolve => fakeB.close(() => resolve()));
  delete process.env.A_PHONE_IDENTITY;
});

beforeEach(() => {
  users = [];
  data = {};
  paidUserIds = [];
  nextUserId = 1;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const uidOf = (token: string) => Number(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).uid);

async function login(companySlug?: string): Promise<number> {
  const res = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456', companySlug });
  expect(res.status).toBe(200);
  return uidOf((await res.json()).token);
}

describe('A_PHONE_IDENTITY 開著：登入只看手機號', () => {
  it('先從無代號、再從 ?c=某單位 登入：同一個帳號，歸屬不變', async () => {
    const first = await login();
    const second = await login('jia');
    expect(second).toBe(first);
    expect(users).toEqual([{ id: first, phone: PHONE, company_id: null }]);
  });

  it('先從 ?c=甲 註冊、再從 ?c=乙 登入：仍是甲那個帳號', async () => {
    const first = await login('jia');
    expect(await login('yi')).toBe(first);
    expect(users).toHaveLength(1);
    expect(users[0].company_id).toBe(7);
  });

  it('沒有帳號的手機號從 ?c=某單位 進來：建帳號、歸屬寫那個單位', async () => {
    const id = await login('yi');
    expect(users).toEqual([{ id, phone: PHONE, company_id: 8 }]);
  });

  it('代號認不得：照舊建未歸屬帳號', async () => {
    const id = await login('nope');
    expect(users).toEqual([{ id, phone: PHONE, company_id: null }]);
  });

  describe('同一支手機號已有兩個帳號（重複尚未合併）', () => {
    beforeEach(() => {
      users = [
        { id: 9, phone: PHONE, company_id: null },
        { id: 13, phone: PHONE, company_id: 7 },
      ];
      nextUserId = 100;
    });

    it('登入有報告的那一個，不管從哪個連結進來；不再多開', async () => {
      data[13] = { child: { name: '小安' }, completedScores: [], orders: [], reportHistory: [{ id: 'r1' }] };
      for (const slug of [undefined, 'jia', 'yi']) expect(await login(slug)).toBe(13);
      expect(users).toHaveLength(2);
    });

    it('登入有訂單（付款成功）的那一個', async () => {
      paidUserIds = [9];
      expect(await login('jia')).toBe(9);
    });

    it('都沒有資料：固定登入最早建的那一個（id 最小）', async () => {
      expect(await login('jia')).toBe(9);
      expect(await login()).toBe(9);
    });
  });
});

describe('A_PHONE_IDENTITY 開著：B→A 交接照同一條規則', () => {
  it('這支手機已經有帳號（歸屬某單位）：轉進那一個，不另建未歸屬帳號', async () => {
    users = [{ id: 13, phone: PHONE, company_id: 7 }];
    nextUserId = 100;
    const res = await client.postJson('/api/handoff/redeem', { code: HANDOFF_CODE });
    expect(res.status).toBe(200);
    expect(uidOf((await res.json()).token)).toBe(13);
    expect(users).toEqual([{ id: 13, phone: PHONE, company_id: 7 }]);
  });

  it('沒有帳號：照舊建未歸屬帳號', async () => {
    const res = await client.postJson('/api/handoff/redeem', { code: HANDOFF_CODE });
    expect(res.status).toBe(200);
    const id = uidOf((await res.json()).token);
    expect(users).toEqual([{ id, phone: PHONE, company_id: null }]);
  });
});

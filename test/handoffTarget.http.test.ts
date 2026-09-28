import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * B→A 交接的接收端（專案 A；ADR-0009、docs/specs/b-to-a-handoff.md §4）。
 * 「發出端」是一台本機的假 B：真的走一趟 HTTP，驗 A 送了密鑰、讀得懂回應、處理得了 B 的各種失敗。
 *
 * 要釘住的：
 * 1. 第一次來的手機號：以（未歸屬，手機號）建帳號、帶入孩子／T1 成績／那一份 T1 報告、記一筆轉入、直接登入
 *    （回應形狀與簡訊登入相同，token 真的能用）。
 * 2. A 已經有篩查的家長：不覆蓋，只記來源（imported=0），回的是 A 自己的資料。
 * 3. B 說無效 → 410；B 壞了或回的東西不對 → 502；碼的形狀不對 → 410 而且根本不去問 B。
 * 4. B 的那幾支（start、內部兌換）在 A 不存在。
 */

const SECRET = 't'.repeat(40);
const NEW_PHONE = '13800138000';
const EXISTING_PHONE = '13900139000';
const GOOD = 'G'.repeat(43);
const EXISTING = 'E'.repeat(43);
const MALFORMED = 'M'.repeat(43);
const BROKEN = 'X'.repeat(43);

const t1 = [
  { dimensionId: 'gross_motor', dimensionName: '动作发展', tierId: 'T1', score: 4, maxScore: 8, status: 'delay', completedAt: '2026-09-28T01:00:00.000Z' },
];
const t1Report = { id: 'rec_b', type: 'T1_SCREENING', child: { name: '小安' }, scores: t1, aiReport: { summary: 's' }, createdAt: '2026-09-28T02:00:00.000Z' };
const payloadFor = (phone: string) => ({
  phone,
  sourceUserId: 70,
  source: { companyId: 2, slug: 'fudan', name: '复旦合作' },
  child: { name: '小安', gender: 'girl', ageMonth: 30 },
  completedScores: t1,
  t1Report,
  kind: 'button',
  consentVersion: 'test-v1',
});

/** 假 B 收到的每一次兌換：驗密鑰有送、送的碼對。 */
const asked: Array<{ auth: string | undefined; code: string }> = [];
const fakeB = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const code = JSON.parse(body || '{}').code;
    asked.push({ auth: req.headers.authorization, code });
    const send = (status: number, json: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json));
    if (req.url !== '/internal/handoff/redeem' || req.headers.authorization !== `Bearer ${SECRET}`) return send(404, { error: 'not found' });
    if (code === GOOD) return send(200, payloadFor(NEW_PHONE));
    if (code === EXISTING) return send(200, payloadFor(EXISTING_PHONE));
    if (code === MALFORMED) return send(200, { phone: 'nope' });
    if (code === BROKEN) return send(500, { error: 'boom' });
    return send(404, { error: 'not found' });
  });
});

// ── A 的資料庫替身 ──
interface Row { id: number; phone: string; company_id: number | null }
let users: Row[] = [];
let data: Record<number, any> = {};
let imports: any[] = [];
let saves = 0;
const EXISTING_A_DATA = {
  child: { name: 'A 的孩子' },
  completedScores: [{ ...t1[0], score: 8, status: 'normal', completedAt: '2026-09-01T00:00:00.000Z' }],
  orders: [],
  reportHistory: [],
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async (companyId: number | null, phone: string) =>
    users.find(u => u.phone === phone && u.company_id === companyId) ?? null,
  createPhoneUser: async (phone: string, companyId: number | null) => {
    const row = { id: users.length + 100, phone, company_id: companyId };
    users.push(row);
    return row.id;
  },
  getUserDataByUserId: async (id: number) => (data[id] ? { user_id: id } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => data[row.user_id],
  saveUserData: async (id: number, _device: unknown, child: any, completedScores: any[], orders: any[], reportHistory: any[]) => {
    saves += 1;
    data[id] = { child, completedScores, orders, reportHistory };
  },
  findCompanyBySlug: async () => null,
  findCompanyByUserId: async () => null,
  listUnlockedDimensions: async () => [],
}));

vi.mock('../src/db/handoffs', () => ({
  createHandoffCode: async () => { throw new Error('A 不發碼'); },
  consumeHandoffCode: async () => { throw new Error('A 不兌換'); },
  recordHandoffImport: async (input: any) => { imports.push(input); },
}));

let client: TestClient;

beforeAll(async () => {
  await new Promise<void>(resolve => fakeB.listen(0, '127.0.0.1', resolve));
  process.env.HANDOFF_SECRET = SECRET;
  process.env.HANDOFF_SOURCE_ORIGIN = `http://127.0.0.1:${(fakeB.address() as AddressInfo).port}`;
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  await new Promise<void>(resolve => fakeB.close(() => resolve()));
});

beforeEach(() => {
  users = [{ id: 1, phone: EXISTING_PHONE, company_id: null }];
  data = { 1: EXISTING_A_DATA };
  imports = [];
  asked.length = 0;
  saves = 0;
});

const redeem = (code: unknown) => client.postJson('/api/handoff/redeem', { code });

describe('第一次來的手機號', () => {
  it('建（未歸屬，手機號）帳號、帶入孩子／T1／那一份報告、記轉入、回與簡訊登入同形狀的結果', async () => {
    const res = await redeem(GOOD);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ['child', 'completedScores', 'handoff', 'orders', 'phone', 'reportHistory', 'success', 'token'].sort(),
    );
    expect(body).toMatchObject({
      success: true,
      phone: NEW_PHONE,
      child: payloadFor(NEW_PHONE).child,
      completedScores: t1,
      reportHistory: [t1Report],
      handoff: { imported: true, sourceName: '复旦合作' },
    });
    const created = users.find(u => u.phone === NEW_PHONE)!;
    expect(created.company_id).toBeNull();
    expect(data[created.id].reportHistory).toEqual([t1Report]);
    expect(imports).toEqual([{
      userId: created.id, sourceUserId: 70, source: { companyId: 2, slug: 'fudan', name: '复旦合作' },
      kind: 'button', consentVersion: 'test-v1', imported: true,
    }]);
    // 送給 B 的是密鑰與那一組碼
    expect(asked).toEqual([{ auth: `Bearer ${SECRET}`, code: GOOD }]);
  });

  it('發下來的 token 真的是那位家長的登入狀態', async () => {
    const { token } = await (await redeem(GOOD)).json();
    const res = await client.get('/api/db/load', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const loaded = await res.json();
    expect(JSON.stringify(loaded)).toContain('小安');
  });
});

describe('A 已經有篩查的家長', () => {
  it('不覆蓋，只記來源；回的是 A 自己的資料', async () => {
    const res = await redeem(EXISTING);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.handoff).toEqual({ imported: false, sourceName: '复旦合作' });
    expect(body.child).toEqual(EXISTING_A_DATA.child);
    expect(data[1]).toEqual(EXISTING_A_DATA);
    expect(saves).toBe(0);
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({ userId: 1, imported: false });
  });
});

describe('B 說不行、B 壞了', () => {
  it('B 說無效（用過、過期、不存在）：410', async () => {
    const res = await redeem('Z'.repeat(43));
    expect(res.status).toBe(410);
    expect((await res.json()).code).toBe('HANDOFF_INVALID');
    expect(imports).toHaveLength(0);
  });

  it('碼的形狀不對：410，而且根本不去問 B', async () => {
    expect((await redeem('short')).status).toBe(410);
    expect((await redeem(undefined)).status).toBe(410);
    expect(asked).toHaveLength(0);
  });

  it('B 回 500、回的東西形狀不對：502，不建帳號、不寫資料', async () => {
    for (const code of [BROKEN, MALFORMED]) {
      const res = await redeem(code);
      expect(res.status).toBe(502);
      expect((await res.json()).code).toBe('HANDOFF_SOURCE_UNREACHABLE');
    }
    expect(users).toHaveLength(1);
    expect(saves).toBe(0);
    expect(imports).toHaveLength(0);
  });
});

describe('專案 A 沒有 B 的那幾支', () => {
  it('start 與內部兌換都不存在', async () => {
    expect((await client.postJson('/api/handoff/start', { consent: true })).status).toBe(404);
    expect((await client.postJson('/internal/handoff/redeem', { code: GOOD }, { Authorization: `Bearer ${SECRET}` })).status).toBe(404);
  });
});

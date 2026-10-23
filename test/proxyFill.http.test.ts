import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DIMENSION_CODES } from '../src/t2/types';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 代填的兩支端點（#112）：只有推薦人；推薦人與合作公司取自工作階段與資料庫；別人名下的 409；輸入不對 400。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-proxy';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123'), referrerId: null, referrerActive: false },
    { id: 40, email: 'ref@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, passwordHash: hash('pw-ref-123'), referrerId: 7, referrerActive: true },
  ];
  const calls: any[] = [];
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
    async findReferrer(id: number) {
      return id === 7 ? { id: 7, adminUserId: 40, email: 'ref@a.com', name: '乙', phone: '13911112222', kind: 'therapist', companyId: 5, companyName: '乙医院', active: true, createdAt: null } : null;
    },
    async proxyLookup(referrer: any, phone: string) {
      calls.push(['lookup', referrer, phone]);
      return phone === '13900000009' ? { status: 'other' } : { status: 'new' };
    },
    async proxyFill(referrer: any, input: any) {
      calls.push(['fill', referrer, input]);
      return input.phone === '13900000009' ? { ok: false, reason: 'other' } : { ok: true, userId: 1, consumedCodeId: 3, endsOn: null };
    },
  };
});

let client: TestClient;
let store: any;
const tokenOf = async (email: string, pw: string) => (await (await client.postJson('/api/admin/login', { email, password: pw })).json()).token as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}` });
const colors = Object.fromEntries(DIMENSION_CODES.map(d => [d, 'green']));
const body = { phone: '13900000001', child: { name: '小树', birthDate: '2022-10-01', gender: 'girl' }, colors, tags: [], months: 3, referrerId: 99 };

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

afterAll(async () => {
  await client.close();
});

describe('代填', () => {
  it('推薦人送出：推薦人與合作公司取自工作階段（body 的 referrerId 不算）、快照是代填的', async () => {
    const t = await tokenOf('ref@a.com', 'pw-ref-123');
    const resp = await client.postJson('/api/admin/referrer/proxy', body, h(t));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ ok: true, consumedCode: true });
    const [, referrer, input] = store.__calls.at(-1);
    expect(referrer).toEqual({ id: 7, companyId: 5, adminUserId: 40 });
    expect(input.findings.toolkitVersion).toBe('proxy-20261023');
    expect(input.child).toMatchObject({ name: '小树', gender: 'girl' });
  });

  it('別人名下的家長 409「这位家长已由其他推荐人服务」', async () => {
    const t = await tokenOf('ref@a.com', 'pw-ref-123');
    const lookup = await client.postJson('/api/admin/referrer/proxy/lookup', { phone: '13900000009' }, h(t));
    expect(lookup.status).toBe(409);
    expect((await lookup.json()).error).toBe('这位家长已由其他推荐人服务');
    expect((await client.postJson('/api/admin/referrer/proxy', { ...body, phone: '13900000009' }, h(t))).status).toBe(409);
  });

  it('輸入不對 400、不叫資料層', async () => {
    const t = await tokenOf('ref@a.com', 'pw-ref-123');
    const before = store.__calls.length;
    expect((await client.postJson('/api/admin/referrer/proxy', { ...body, months: 2 }, h(t))).status).toBe(400);
    expect(store.__calls.length).toBe(before);
  });

  it('全域管理員不能代填（那是推薦人的）', async () => {
    const t = await tokenOf('god@sxk.com', 'pw-god-123');
    expect((await client.postJson('/api/admin/referrer/proxy', body, h(t))).status).toBe(403);
  });
});

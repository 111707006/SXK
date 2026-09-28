import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { hashHandoffCode } from '../src/handoff/core';
import { createHandoffSourceRouter } from '../src/handoff/routes';

/**
 * B→A 交接的發出端（專案 B；ADR-0009、docs/specs/b-to-a-handoff.md §4）。
 *
 * 要釘住的：
 * 1. 發碼要登入、要同意、要有 T1 成績；連結指向 A、碼在網址片段、2 分鐘。
 * 2. 內部兌換要密鑰、一次性、會過期；**任何一種不成立都是同一個 404**（不當查詢機）。
 * 3. 交出去的只有規格 §1 那一包：T1 成績、對得上的那一份 T1 報告、來源公司 —— 沒有預約與聯絡人。
 * 4. A 的那一支（`/api/handoff/redeem`）在 B 不存在。
 */

process.env.APP_MODE = 't1only';
const SECRET = 's'.repeat(40);
process.env.HANDOFF_SECRET = SECRET;
process.env.HANDOFF_TARGET_ORIGIN = 'https://sxkscreen.com';
process.env.HANDOFF_CONSENT_VERSION = 'test-v1';

const PARENT = 7;
const NO_SCREENING = 8;
const PHONE = '13800138000';
const t1 = [
  { dimensionId: 'gross_motor', dimensionName: '动作发展', tierId: 'T1', score: 4, maxScore: 8, status: 'delay', completedAt: '2026-09-28T01:00:00.000Z' },
];
const t1Report = { id: 'rec_1', type: 'T1_SCREENING', child: { name: '小安' }, scores: t1, aiReport: { summary: 's' }, createdAt: '2026-09-28T02:00:00.000Z' };

const users: Record<number, any> = {
  [PARENT]: { id: PARENT, phone: PHONE, company_id: 2 },
  [NO_SCREENING]: { id: NO_SCREENING, phone: '13900000001', company_id: 2 },
};
const userData: Record<number, any> = {
  [PARENT]: {
    child: { name: '小安', gender: 'girl', ageMonth: 30 },
    completedScores: t1,
    orders: [],
    reportHistory: [t1Report],
  },
  [NO_SCREENING]: { child: { name: '小明' }, completedScores: [], orders: [], reportHistory: [] },
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id } : null),
  parseUserDataRow: (row: any) => userData[row.user_id],
  findCompanyByUserId: async (id: number) => (users[id]?.company_id === 2 ? { id: 2, slug: 'fudan', name: '复旦合作' } : null),
  findCompanyBySlug: async () => null,
}));

interface CodeRow { hash: string; userId: number; kind: string; consentVersion: string | null; expiresAt: number; redeemed: boolean }
const codes: CodeRow[] = [];

vi.mock('../src/db/handoffs', () => ({
  createHandoffCode: async (input: any) => {
    codes.push({ hash: input.codeHash, userId: input.userId, kind: input.kind, consentVersion: input.consentVersion, expiresAt: Date.now() + input.ttlSec * 1000, redeemed: false });
    return codes.length;
  },
  consumeHandoffCode: async (hash: string) => {
    const row = codes.find(c => c.hash === hash && !c.redeemed && c.expiresAt > Date.now());
    if (!row) return null;
    row.redeemed = true;
    return { userId: row.userId, kind: row.kind, consentVersion: row.consentVersion };
  },
  recordHandoffImport: async () => {},
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  codes.length = 0;
});

const internal = (code: unknown, secret = SECRET) =>
  client.postJson('/internal/handoff/redeem', { code }, { Authorization: `Bearer ${secret}` });

async function start(userId = PARENT): Promise<string> {
  const res = await client.postJson('/api/handoff/start', { consent: true }, bearer(userId));
  expect(res.status).toBe(200);
  const { url } = await res.json();
  return url.split('#code=')[1];
}

describe('GET /api/handoff/config', () => {
  it('設了密鑰與 A 的網址、有資料庫：enabled', async () => {
    expect(await (await client.get('/api/handoff/config')).json()).toEqual({ enabled: true });
  });
});

describe('POST /api/handoff/start', () => {
  it('沒登入：401', async () => {
    expect((await client.postJson('/api/handoff/start', { consent: true })).status).toBe(401);
  });

  it('沒按同意：400，不發碼', async () => {
    const res = await client.postJson('/api/handoff/start', {}, bearer(PARENT));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('CONSENT_REQUIRED');
    expect(codes).toHaveLength(0);
  });

  it('還沒做篩查：409', async () => {
    const res = await client.postJson('/api/handoff/start', { consent: true }, bearer(NO_SCREENING));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('SCREENING_REQUIRED');
  });

  it('成功：連結指向 A、碼在網址片段；只存雜湊、2 分鐘、記同意版本；不快取', async () => {
    const res = await client.postJson('/api/handoff/start', { consent: true }, bearer(PARENT));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { url, expiresInSec } = await res.json();
    expect(url).toMatch(/^https:\/\/sxkscreen\.com\/handoff#code=[A-Za-z0-9_-]{43}$/);
    expect(expiresInSec).toBe(120);
    const code = url.split('#code=')[1];
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatchObject({ hash: hashHandoffCode(code), userId: PARENT, kind: 'button', consentVersion: 'test-v1' });
    expect(JSON.stringify(codes)).not.toContain(code);
  });
});

describe('POST /internal/handoff/redeem', () => {
  it('交出規格 §1 那一包：手機、來源公司、孩子、T1 成績、對得上的報告', async () => {
    const res = await internal(await start());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      phone: PHONE,
      sourceUserId: PARENT,
      source: { companyId: 2, slug: 'fudan', name: '复旦合作' },
      child: userData[PARENT].child,
      completedScores: t1,
      t1Report,
      kind: 'button',
      consentVersion: 'test-v1',
    });
  });

  it('一次性：第二次 404', async () => {
    const code = await start();
    expect((await internal(code)).status).toBe(200);
    expect((await internal(code)).status).toBe(404);
  });

  it('過期：404', async () => {
    const code = await start();
    codes[0].expiresAt = Date.now() - 1;
    expect((await internal(code)).status).toBe(404);
  });

  it('密鑰錯、格式錯、不存在：都是同一個 404，而且密鑰錯時碼沒有被用掉', async () => {
    const code = await start();
    const wrong = await internal(code, 'w'.repeat(40));
    const malformed = await internal('nope');
    const unknown = await internal('A'.repeat(43));
    for (const r of [wrong, malformed, unknown]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: 'not found' });
    }
    expect(codes[0].redeemed).toBe(false);
    expect((await internal(code)).status).toBe(200);
  });

  it('沒帶密鑰：404', async () => {
    const code = await start();
    expect((await client.postJson('/internal/handoff/redeem', { code })).status).toBe(404);
  });
});

describe('專案 B 沒有 A 的那一支', () => {
  it('POST /api/handoff/redeem 不存在', async () => {
    const res = await client.postJson('/api/handoff/redeem', { code: 'A'.repeat(43) });
    expect(res.status).toBe(404);
  });
});

describe('沒設密鑰（功能關閉）', () => {
  it('config 是 enabled:false、start 與內部兌換都 404', async () => {
    const app = express();
    app.use(express.json());
    app.use(createHandoffSourceRouter({
      config: null,
      dbReady: () => true,
      requireParent: async () => PARENT,
      loadParent: async () => null,
      loadCompany: async () => null,
      createCode: async () => { throw new Error('should not be called'); },
      consumeCode: async () => { throw new Error('should not be called'); },
    }));
    const off = await startTestApp(app);
    try {
      expect(await (await off.get('/api/handoff/config')).json()).toEqual({ enabled: false });
      expect((await off.postJson('/api/handoff/start', { consent: true })).status).toBe(404);
      expect((await off.postJson('/internal/handoff/redeem', { code: 'A'.repeat(43) }, { Authorization: `Bearer ${SECRET}` })).status).toBe(404);
    } finally {
      await off.close();
    }
  });
});

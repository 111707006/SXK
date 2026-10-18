import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/** 專案 A：只有 A 有 T2。B 那一半在 `adminIsolation.http.test.ts`（詳情裡沒有這一欄、資料層一次都不問）。 */
process.env.APP_MODE = 'full';

/**
 * 後台家長詳情帶出最新的 T2 報告快照（#67，規格 client-changes-2026-10-17 §2.2 第 5 點）。
 *
 * 要抓的：
 * 1. 詳情多回 `t2Report`：有的照存的樣子回（id、時間、findings、prose），沒有的是 `null`。
 * 2. 讀快照時傳下去的公司條件是**工作階段**那一份（A 固定未歸屬），不是請求帶來的。
 * 3. 視野外的家長照舊 404，T2 那一句連問都不問。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Cond = import('../src/admin/companyScope').CompanyCondition;

  const parent = (id: number, companyId: number | null, childName: string) => ({
    id, email: null, phone: `1380000${String(id).padStart(4, '0')}`, companyId, childName, childAgeMonth: 36, childGender: 'boy',
    flaggedDimensions: [], screeningTotal: null, screenedAt: null, registeredAt: null, hasBooking: false,
    lastInvitedAt: null, handoffUsedAt: null, handoffSource: null,
  });

  const db = {
    admins: [
      {
        id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null,
        passwordHash: bcrypt.hashSync('pw-god-123', 4),
      },
    ],
    parents: [parent(101, null, '做过深度评估的孩子'), parent(102, null, '只做过筛查的孩子'), parent(202, 1, '别家的孩子')],
    t2: {
      101: {
        id: 7,
        createdAt: '2026-10-01T02:00:00.000Z',
        findings: { rulesVersion: 'r', toolkitVersion: 'kit-20260923', computedAt: '2026-10-01T02:00:00.000Z' },
        prose: { overview: '总览', perDimension: [], closing: '结尾' },
        isAiGenerated: true,
        aiEngine: 'qwen',
      },
      202: { id: 9, createdAt: '2026-10-02T02:00:00.000Z', findings: {}, prose: null, isAiGenerated: false, aiEngine: null },
    } as Record<number, unknown>,
    t2Calls: [] as Array<{ condition: Cond; id: number }>,
  };

  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async getParentDetail(condition: Cond, id: number) {
      const p = db.parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      return p ? { ...p, scores: [], reportHistory: [], bookings: [], assessedAgeMonth: null, assessedBandName: null } : null;
    },
    async latestT2Findings(condition: Cond, id: number) {
      db.t2Calls.push({ condition, id });
      const p = db.parents.find(x => x.id === id && matchesCompanyCondition(condition, x));
      return p ? db.t2[id] ?? null : null;
    },
  };
});

let client: TestClient;
let db: any;

async function login(): Promise<Record<string, string>> {
  const resp = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
  expect(resp.status).toBe(200);
  return { Authorization: `Bearer ${(await resp.json()).token}` };
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  db = ((await import('../src/admin/adminStore')) as any).__db;
});

beforeEach(() => {
  db.t2Calls = [];
});

afterAll(async () => {
  await client.close();
});

describe('後台家長詳情帶出最新的 T2 報告快照（專案 A）', () => {
  it('有 T2 報告的家長：照存的樣子回', async () => {
    const resp = await client.get('/api/admin/parents/101', await login());
    expect(resp.status).toBe(200);
    const { parent } = await resp.json();
    expect(parent.t2Report).toEqual({
      id: 7,
      createdAt: '2026-10-01T02:00:00.000Z',
      findings: { rulesVersion: 'r', toolkitVersion: 'kit-20260923', computedAt: '2026-10-01T02:00:00.000Z' },
      prose: { overview: '总览', perDimension: [], closing: '结尾' },
      isAiGenerated: true,
      aiEngine: 'qwen',
    });
  });

  it('沒有 T2 報告的家長：是 null，不是少一欄', async () => {
    const { parent } = await (await client.get('/api/admin/parents/102', await login())).json();
    expect(parent).toHaveProperty('t2Report', null);
  });

  it('讀快照用的是工作階段的視野（A 固定未歸屬），不是請求帶來的', async () => {
    await client.get('/api/admin/parents/101?companyId=1', await login());
    expect(db.t2Calls).toEqual([{ condition: { kind: 'unassigned' }, id: 101 }]);
  });

  it('視野外的家長照舊 404，T2 快照連問都不問', async () => {
    const resp = await client.get('/api/admin/parents/202', await login());
    expect(resp.status).toBe(404);
    expect(JSON.stringify(await resp.json())).not.toContain('kit');
    expect(db.t2Calls).toEqual([]);
  });
});

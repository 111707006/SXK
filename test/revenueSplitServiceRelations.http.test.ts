import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 清分改看服務關係（#122，ADR-0020 第 3、8 點）的整條路：四個開關都開著（A_COMPANIES、A_PHONE_IDENTITY、
 * SERVICE_RELATIONS、REVENUE_SPLIT），開單時資料層被要求讀服務關係與篩查渠道比例，快照記下篩查渠道。
 * 關著的那一條見 `revenueSplit.http.test.ts`（快照沒有 `screening` 這一欄）。資料層以替身供應。
 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';
process.env.SERVICE_RELATIONS = '1';
process.env.REVENUE_SPLIT = '1';
process.env.WECHAT_FEE_BP = '60';
process.env.SESSION_SECRET ||= 'test-session-secret-for-split-service';

const users: Record<number, { id: number; phone: string }> = {};
for (let i = 1; i <= 5; i++) users[i] = { id: i, phone: `139000001${String(i).padStart(2, '0')}` };

function t1(dimensionId: string, status: 'normal' | 'borderline' | 'delay') {
  return { dimensionId, dimensionName: dimensionId, tierId: 'T1', score: 0, maxScore: 8, status, completedAt: '2026-11-01T00:00:00Z' };
}
const SCORES = [
  t1('language', 'delay'), t1('attention', 'delay'), t1('sensory_processing', 'borderline'),
  t1('cognitive', 'normal'), t1('social_emotional', 'normal'), t1('emotion_behavior', 'normal'),
  t1('gross_motor', 'normal'), t1('self_care', 'normal'), t1('learning_ability', 'normal'),
];

const db = vi.hoisted(() => ({
  payments: [] as any[],
  snapshots: [] as Array<{ paymentId: number; snapshot: any }>,
  rateOpts: [] as any[],
  attributionOpts: [] as any[],
}));

vi.mock('../src/db/mysql', async importOriginal => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return {
    ...real,
    isConfigured: () => true,
    getPool: () => null,
    findUserById: async (id: number) => users[id] ?? null,
    hasT2Unlock: async () => false,
    listUnlockedDimensions: async () => [],
    getUserDataByUserId: async (id: number) => ({ user_id: id, child: { name: '小明', birthDate: '2022-11-07', ageMonth: 48, gender: 'boy' }, completedScores: SCORES }),
    getUserDataByDevice: async () => null,
    parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
    saveUserData: async () => {},
    createPayment: async (input: any) => {
      db.payments.push(input);
      return db.payments.length;
    },
  };
});

vi.mock('../src/db/revenueSplit', () => ({
  loadSplitRates: async (opts: any) => {
    db.rateOpts.push(opts);
    return {
      default: { platformBp: null, companyBp: null },
      company: new Map([[9, { platformBp: null, companyBp: null, screeningBp: 1000 }]]),
      referrer: new Map(),
    };
  },
  // 家長 2：現在由單位 3 的王老师服務，最早從單位 9 進來（篩查渠道）。家長 3：篩查渠道就是服務單位。
  loadSplitAttribution: async (userId: number, opts: any) => {
    db.attributionOpts.push(opts);
    const ref = { id: 7, name: '王老师', kind: 'therapist' as const, company: { id: 3, name: '某某康复' } };
    if (userId === 2) return { company: null, referrer: ref, screening: { id: 9, name: '最早那家' } };
    if (userId === 3) return { company: null, referrer: ref, screening: { id: 3, name: '某某康复' } };
    return { company: null, referrer: null, screening: null };
  },
  saveSplitSnapshot: async (paymentId: number, snapshot: any) => {
    db.snapshots.push({ paymentId, snapshot });
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('服務關係開著：開單的清分快照', () => {
  const pay = (userId: number) => client.postJson('/api/payment/create', { scope: 't2' }, bearer(userId));

  it('資料層被要求讀服務關係與篩查渠道比例', async () => {
    expect((await pay(2)).status).toBe(200);
    expect(db.attributionOpts.at(-1)).toEqual({ serviceRelations: true });
    expect(db.rateOpts.at(-1)).toEqual({ screening: true });
  });

  it('篩查渠道與服務單位不同、設了比例：快照記下第四方', async () => {
    await pay(2);
    expect(db.snapshots.at(-1)!.snapshot).toMatchObject({
      party: { kind: 'company_referrer', companyId: 3, referrerId: 7 },
      screening: { companyId: 9, companyName: '最早那家', bp: 1000 },
    });
  });

  it('篩查渠道就是服務單位：不出現第四方', async () => {
    await pay(3);
    expect(db.snapshots.at(-1)!.snapshot.screening).toBeNull();
  });

  it('沒有服務關係：全歸平台、沒有篩查渠道', async () => {
    await pay(1);
    expect(db.snapshots.at(-1)!.snapshot).toMatchObject({ party: { kind: 'none' }, platformBp: 10000, screening: null });
  });
});

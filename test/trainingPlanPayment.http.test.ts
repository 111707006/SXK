import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { generateOutTradeNo } from '../src/utils/outTradeNo';

/**
 * 訓練計劃付款（#111，`TRAINING_PLAN`＋`TRAINING_PLAN_PRICES_FEN`）：下單金額照伺服器設定、不收前端的；
 * 結算發一段 `payment` 使用權，回調重送只發一次；不發 `unlocks` 的權益。走查單補償那條（同 `t2Entitlement.http.test.ts`）。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.TRAINING_PLAN_PRICES_FEN = '1:2990,3:7990,6:13990';

const PARENT_ID = 1;
const PLAN_ORDER = generateOutTradeNo();

const db = vi.hoisted(() => ({
  created: [] as any[],
  grants: [] as any[],
  passes: [] as any[],
  settled: new Set<string>(),
  payments: {} as Record<string, any>,
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === 1 ? { id, phone: '13800000000' } : null),
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  findPaymentByOutTradeNo: async (o: string) => db.payments[o] ?? null,
  markPaymentSuccess: async (o: string) => {
    if (db.settled.has(o)) return false;
    db.settled.add(o);
    return true;
  },
  grantUnlock: async (input: any) => { db.grants.push(input); },
  createPayment: async (input: any) => { db.created.push(input); return 99; },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async (userId: number) => db.passes.filter(p => p.userId === userId),
  insertTrainingPass: async (userId: number, p: any) => {
    if (p.uniqueKey && db.passes.some(x => x.uniqueKey === p.uniqueKey)) return false;
    db.passes.push({ userId, ...p });
    return true;
  },
  hasScaleT2Findings: async () => false,
}));

vi.mock('../src/wechatPay', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/wechatPay')>();
  return {
    ...actual,
    loadConfig: () => ({ config: { appId: 'x', mchid: 'y', platformKeyId: '', platformPublicKey: '', apiV3Key: '' }, missing: [] }),
    queryOrderByOutTradeNo: async () => ({ tradeState: 'SUCCESS', transactionId: 'wx-tx-plan' }),
    placeOrder: async () => ({ h5Url: 'https://wx.example/h5' }),
  };
});

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  db.payments = { [PLAN_ORDER]: { id: 21, user_id: PARENT_ID, status: 'pending', scope: 'plan', dimension_id: null, months: 3 } };
  db.created = [];
  db.grants = [];
});

describe('下單', () => {
  it('金額照設定的價錢（前端送的不算），回 H5 網址', async () => {
    const resp = await client.postJson('/api/payment/create', { scope: 'plan', months: 3, amountFen: 1 }, bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toMatchObject({ scope: 'plan', months: 3, amountFen: 7990, h5Url: 'https://wx.example/h5' });
    expect(db.created[0]).toMatchObject({ scope: 'plan', months: 3, amountFen: 7990, dimensionId: null });
  });

  it('月數不對 400', async () => {
    expect((await client.postJson('/api/payment/create', { scope: 'plan', months: 2 }, bearer(PARENT_ID))).status).toBe(400);
  });

  it('方案頁說可以付款、價錢照設定', async () => {
    const body = await (await client.get('/api/training/plans')).json();
    expect(body.payAvailable).toBe(true);
    expect(body.plans.map((p: any) => p.priceFen)).toEqual([2990, 7990, 13990]);
  });
});

describe('結算', () => {
  it('發一段 payment 使用權（3 個月＝84 天）；不發 unlocks 的權益', async () => {
    const resp = await client.get(`/api/payment/status?outTradeNo=${PLAN_ORDER}`, bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    const mine = db.passes.filter(p => p.userId === PARENT_ID && p.source === 'payment');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ months: 3, refId: 21, uniqueKey: 'payment:21' });
    const days = (Date.parse(mine[0].endsOn) - Date.parse(mine[0].startsOn)) / 86_400_000 + 1;
    expect(days).toBe(84);
    expect(db.grants).toEqual([]);
  });

  it('回調重送：只發一次', async () => {
    await client.get(`/api/payment/status?outTradeNo=${PLAN_ORDER}`, bearer(PARENT_ID));
    expect(db.passes.filter(p => p.uniqueKey === 'payment:21')).toHaveLength(1);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { generateOutTradeNo } from '../src/utils/outTradeNo';

/**
 * 付款結算出來的是哪一種權益（票 #45）。
 *
 * 兩件事要釘住：
 * 1. T2 的付款結算成 `scope: 't2'`、`dimensionId: null` —— 不是一個假維度。
 * 2. **同一筆結算跑第二次不會再發一次權益。** 微信的回調會重送最多 15 次，
 *    回跳頁再查一次單，好幾條路會同時搶著結同一張訂單。擋住它的是
 *    `markPaymentSuccess` 那句帶 `WHERE status = 'pending'` 的 UPDATE：
 *    只有真的把那一列從 pending 移走的那一次算數。
 *
 * 走 `/api/payment/status`（查單補償）而不是回調端點，因為回調要先過驗簽，
 * 那是另一件事的測試。兩條路結算時呼叫的是同一個 `settlePayment`。
 */

const PARENT_ID = 1;
const T2_ORDER = generateOutTradeNo();
const T3_ORDER = generateOutTradeNo();

/** 每一次 `grantUnlock` 的參數。發了幾次、發了什麼，都在這裡看。 */
const grants: any[] = [];
/** 已經被移出 pending 的訂單 —— 模擬那句條件式 UPDATE。 */
const settled = new Set<string>();

const payments: Record<string, any> = {
  [T2_ORDER]: { id: 11, user_id: PARENT_ID, status: 'pending', scope: 't2', dimension_id: null },
  [T3_ORDER]: { id: 12, user_id: PARENT_ID, status: 'pending', scope: 't3', dimension_id: 'language' },
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000' } : null),
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  /**
   * 刻意**永遠回 pending**。真實世界裡第二次送達可能在那一列被改寫之前就到了，
   * 而這支測試要驗的正是「那種時候會發生什麼」。回 success 的話端點會提早返回，
   * 這條路根本走不到。
   */
  findPaymentByOutTradeNo: async (outTradeNo: string) => payments[outTradeNo] ?? null,
  markPaymentSuccess: async (outTradeNo: string) => {
    if (settled.has(outTradeNo)) return false;
    settled.add(outTradeNo);
    return true;
  },
  grantUnlock: async (input: any) => { grants.push(input); },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  createPayment: async () => 1,
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/wechatPay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/wechatPay')>();
  return {
    ...actual,
    // 憑證齊全，查單模式才走得到 settlePayment。
    loadConfig: () => ({ config: { appId: 'x', mchid: 'y', platformKeyId: '', platformPublicKey: '', apiV3Key: '' }, missing: [] }),
    queryOrderByOutTradeNo: async () => ({ tradeState: 'SUCCESS', transactionId: 'wx-tx-1' }),
  };
});

let client: TestClient;
let auth: Record<string, string>;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  auth = bearer(PARENT_ID);
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  grants.length = 0;
});

describe('T2 的付款結算成整份權益', () => {
  it('發出的是 scope t2、沒有維度的權益', async () => {
    const resp = await client.get(`/api/payment/status?outTradeNo=${T2_ORDER}`, auth);

    expect(resp.status).toBe(200);
    expect((await resp.json()).status).toBe('success');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      userId: PARENT_ID,
      scope: 't2',
      dimensionId: null,
      source: 'payment',
      paymentId: 11,
    });
  });

  it('同一筆再結算一次，不再發第二份權益', async () => {
    const resp = await client.get(`/api/payment/status?outTradeNo=${T2_ORDER}`, auth);

    expect(resp.status).toBe(200);
    // 回應仍是成功（家長本來就付成功了），但沒有任何新的權益被建立。
    expect((await resp.json()).status).toBe('success');
    expect(grants).toHaveLength(0);
  });
});

describe('舊的維度付款沒有被改掉', () => {
  it('t3 的付款照樣結算成那一個維度的權益', async () => {
    const resp = await client.get(`/api/payment/status?outTradeNo=${T3_ORDER}`, auth);

    expect(resp.status).toBe(200);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ scope: 't3', dimensionId: 'language' });
  });
});

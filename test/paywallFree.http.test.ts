import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * `PAYWALL_FREE=1` —— 微信支付還沒開通的免費期間（使用者 2026-10-06）。
 *
 * 與 `PAYWALL_DEMO_OPEN` 一樣讓後端閘門放行，差別在 `/api/unlocks`：登入的家長拿到 `t2: true`、
 * `available: true`，前端當成已經買了，付費牆不畫 —— 展示開關那顆「展示用」的略過鍵不會出現在真的家長面前。
 *
 * 單獨一個檔案，因為 `server.ts` 在 import 當下就把環境變數讀成常數。反方向（沒開 → 照舊收費）由
 * `paywallGate.http.test.ts`、`t2Gate.http.test.ts` 顧。
 */

const PARENT_ID = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000' } : null),
  // 免費期間權益表一次都不該查。真的被呼叫就當場炸掉。
  hasT2Unlock: async () => {
    throw new Error('免費期間不該查詢 T2 權益');
  },
  listUnlockedDimensions: async () => {
    throw new Error('免費期間不該查詢 T3 權益');
  },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  parseUserDataRow: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async () => 1,
  listToolResults: async () => [],
}));

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前。兩個開關都開，驗的是「以免費為準」。
  process.env.PAYWALL_FREE = '1';
  process.env.PAYWALL_DEMO_OPEN = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.PAYWALL_FREE = '';
  process.env.PAYWALL_DEMO_OPEN = '';
});

describe('PAYWALL_FREE=1', () => {
  it('登入的家長：/api/unlocks 回 t2: true、available: true —— 前端直接進、不畫付費牆', async () => {
    const resp = await client.get('/api/unlocks', bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.t2).toBe(true);
    expect(body.available).toBe(true);
    expect(body.free).toBe(true);
  });

  it('未登入：/api/unlocks 照舊 401，前端導去登入，而不是付費牆的略過鍵', async () => {
    const resp = await client.get('/api/unlocks');
    expect(resp.status).toBe(401);
  });

  it('T2 閘門放行：沒買也拿得到（200），權益一次都沒查', async () => {
    const resp = await client.get('/api/t2/tool-results', bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ results: [] });
  });
});

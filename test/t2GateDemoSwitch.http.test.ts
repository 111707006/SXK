import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * `PAYWALL_DEMO_OPEN=1` 對 **T2 閘門**同樣生效（票 #45）。
 *
 * 單獨一個檔案，因為 `server.ts` 在 import 當下就把這個環境變數讀成常數 ——
 * 同一支測試檔裡切不掉。反方向由 `t2Gate.http.test.ts` 顧（它跑在預設的關閉狀態）。
 *
 * 這一條擋的是很具體的一種壞法：示範站的略過入口把家長直接送進 T2，
 * 而閘門若排在開關前面，那一步會回 403 —— 畫面上是「已解鎖」，
 * 點下去卻打不開，正是這個開關存在的理由。
 */

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async () => null,
  // 開關開著時這一支一次都不該被呼叫到。真的被呼叫就當場炸掉。
  hasT2Unlock: async () => {
    throw new Error('示範開關開著時不該查詢 T2 權益');
  },
  listUnlockedDimensions: async () => [],
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

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前。
  process.env.PAYWALL_DEMO_OPEN = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.PAYWALL_DEMO_OPEN = '';
});

describe('PAYWALL_DEMO_OPEN=1 時的 T2 閘門', () => {
  it('未登入也放行 —— 不是 401 也不是 403', async () => {
    const resp = await client.get('/api/t2/tool-results');
    expect([401, 403]).not.toContain(resp.status);
    const body = await resp.json().catch(() => ({}));
    expect(['UNAUTHENTICATED', 'LOCKED']).not.toContain((body as any).code);
  });

  it('/api/unlocks 回 t2: false 與 available: false', async () => {
    const resp = await client.get('/api/unlocks');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.available).toBe(false);
    expect(body.t2).toBe(false);
  });
});

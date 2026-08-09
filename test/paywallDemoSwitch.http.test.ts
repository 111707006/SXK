import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * `PAYWALL_DEMO_OPEN=1` —— 展示用的付費牆開關。
 *
 * 開著的時候後端閘門整個不執行，所以這支測試釘的是**它到底有沒有生效**，
 * 以及**畫面拿到的訊號對不對**：前端要看到 `available: false` 才會把付費牆
 * 畫成「可略過」（見 `src/utils/access.ts` 的 `demo`）。少了這一半，
 * 家長會停在「请先登录」而不是略過入口 —— 正是這個開關要解決的症狀。
 *
 * 反方向由 `paywallGate.http.test.ts` 顧：那支跑在開關關閉的預設下，
 * 若哪天預設值被改成打開，它的 401/403 會當場變 200。兩支合起來才是完整的。
 *
 * 資料層一樣以替身供應（`isConfigured: () => true`）—— 沒有持久層的話閘門
 * 本來就不執行，那樣測不出開關有沒有作用。
 */

const OWNED_DIMENSION = 'language';
const UNOWNED_DIMENSION = 'cognitive';
const UNOWNED_NAME = '认知';

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserByEmail: async () => null,
  findUserById: async () => null,
  listUnlockedDimensions: async () => [OWNED_DIMENSION],
  createUser: async () => 1,
  updateUserPassword: async () => {},
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

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke(messages: Array<{ role: string; content: string }>) {
      const userPrompt = messages.find(m => m.role === 'user')?.content ?? '';
      return { content: JSON.stringify({ summary: userPrompt }) };
    }
  },
}));

let client: TestClient;

beforeAll(async () => {
  // 必須在 loadApp() 之前 —— server.ts 在 import 當下就把這個值讀成常數。
  process.env.PAYWALL_DEMO_OPEN = '1';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  process.env.PAYWALL_DEMO_OPEN = '';
});

describe('PAYWALL_DEMO_OPEN=1', () => {
  it('未登入也拿得到深度評估，且端出來的是點名的那個維度', async () => {
    const resp = await client.postJson('/api/specialized-report', {
      child: { name: '小明', ageMonth: 36, gender: 'boy' },
      dimensionId: UNOWNED_DIMENSION,
      t2Percent: 50,
      t3Percent: 50,
      status: 'delay',
    });

    expect(resp.status).toBe(200);
    // 閘門關掉不代表報告可以端錯維度 —— 內容仍由伺服器從 id 查名稱。
    expect((await resp.json()).report?.summary ?? '').toContain(UNOWNED_NAME);
  });

  it('/api/unlocks 回 available:false，前端才會把付費牆畫成可略過', async () => {
    const resp = await client.get('/api/unlocks');

    expect(resp.status).toBe(200);
    const body = await resp.json();
    // 401 在這裡是失敗模式而不只是「另一種回應」：客戶端問不到，
    // 就會照 access.ts 的規則當作付費牆會執行，然後停在登入畫面。
    expect(body.available).toBe(false);
    expect(body.dimensionIds).toEqual([]);
  });
});

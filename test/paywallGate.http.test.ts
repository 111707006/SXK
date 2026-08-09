import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 付費閘門的 HTTP 回歸測試 —— 本專案第一條看得到伺服器的測試。
 *
 * 釘住的是 2026-07-31 修掉的授權繞過：閘門檢查 `dimensionId`，但報告是用另一個
 * body 欄位 `dimensionName` 生成的。**送出自己擁有的維度、點名另一個維度的內容**，
 * 一筆 ¥19.9 就打開全部九個維度。當時 101 個測試一條都沒攔住，因為沒有任何一條
 * 看得到伺服器 —— 純函式測試永遠證明不了「路由把哪個值餵給了哪一段」。
 *
 * 資料層以替身供應（`vi.mock`），因為閘門只在有持久層時才執行：
 * 記憶體模式下 `denyIfLocked` 一律放行（沒有持久層就沒有購買存在的可能）。
 */

const OWNED_DIMENSION = 'language';       // 攻擊者真的買了的維度
const OWNED_NAME = '语言沟通';
const TARGET_DIMENSION = 'cognitive';     // 攻擊者想白拿的維度
const TARGET_NAME = '认知';

const ATTACKER_ID = 1;

// 只提供 server.ts 真的會呼叫到的那些；多的不補，少的會在測試裡當場炸掉。
vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) =>
    id === ATTACKER_ID ? { id, email: 'attacker@test.com', password: 'x' } : null,
  findUserByEmail: async () => null,
  listUnlockedDimensions: async (userId: number) => (userId === ATTACKER_ID ? [OWNED_DIMENSION] : []),
  createUser: async () => ATTACKER_ID,
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

/**
 * LLM 替身：把收到的提示詞原封不動塞回 `summary`。
 *
 * 這樣「伺服器到底端出了哪一個維度的內容」就成為**回應主體上看得到的事實**，
 * 不必去偷看內部呼叫。真正的引擎在測試環境沒有金鑰，放它去跑只會拿到 500，
 * 而 500 沒辦法區分「擋下來了」與「壞掉了」。
 */
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
let auth: Record<string, string>;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  auth = bearer(ATTACKER_ID);
});

afterAll(async () => {
  await client.close();
});

describe('伺服器接縫本身', () => {
  it('載入應用程式不會綁定連接埠，但路由確實掛上了', async () => {
    const resp = await client.get('/api/db/status');
    expect(resp.status).toBe(200);
  });

  it('/api 底下沒註冊的路徑回 JSON 404，不是 SPA 的 HTML', async () => {
    const resp = await client.get('/api/definitely-not-a-route');
    expect(resp.status).toBe(404);
    expect(resp.headers.get('content-type')).toContain('application/json');
  });
});

describe('深度評估的付費閘門', () => {
  it('未登入者拿不到深度評估', async () => {
    const resp = await client.postJson('/api/specialized-report', {
      child: { name: '小明', ageMonth: 36, gender: 'boy' },
      dimensionId: OWNED_DIMENSION,
    });
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  it('直接點名沒買的維度會被擋下', async () => {
    const resp = await client.postJson(
      '/api/specialized-report',
      { child: { name: '小明', ageMonth: 36, gender: 'boy' }, dimensionId: TARGET_DIMENSION },
      auth
    );
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  // ── 這一條就是那個 bug 的形狀 ──
  it('送出自己擁有的維度、卻點名另一個維度的內容時，拿不到後者', async () => {
    const resp = await client.postJson(
      '/api/specialized-report',
      {
        child: { name: '小明', ageMonth: 36, gender: 'boy' },
        // 閘門看得到的：買過的維度
        dimensionId: OWNED_DIMENSION,
        // 舊版拿去生成報告的欄位：想白拿的維度。今天必須完全不被採信。
        dimensionName: TARGET_NAME,
        dimensionId2: TARGET_DIMENSION,
        t2Percent: 50,
        t3Percent: 50,
        status: 'delay',
      },
      auth
    );

    expect(resp.status).toBe(200);
    const served = (await resp.json()).report?.summary ?? '';
    // 端出來的必須是他真的買了的那一個維度……
    expect(served).toContain(OWNED_NAME);
    // ……而不是他點名的那一個。
    expect(served).not.toContain(TARGET_NAME);
  });
});

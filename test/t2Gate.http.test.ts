import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * T2 的付費閘門（票 #45）—— **T2 整份買一次**。
 *
 * 寫法比照 `paywallGate.http.test.ts`：真的對 Express 發 HTTP 請求，資料層以
 * 替身供應（閘門只在有持久層時執行）。那一支釘的是舊的「每個維度各買一次」，
 * 這一支釘的是新的這一種，兩支並存 —— 伺服器上兩道閘門今天同時活著。
 *
 * 【為什麼打的是一條還沒有處理函式的路徑】
 * `/api/t2/*` 底下的端點是票 #56／#57 的事。閘門本身是**路徑前綴的守衛**，
 * 不是每支端點自己呼叫一次 —— 這正是 2026-07-31 那個漏洞的教訓：
 * 一道要靠每個作者記得呼叫的檢查，遲早有人不呼叫。守衛掛在前綴上，
 * 之後新增的 T2 端點**預設就是關著的**，要開得特地寫進白名單。
 *
 * 所以「放行」在今天的表現是「落到 /api 的 JSON 404」（沒有處理函式）。
 * 測試只斷言**它不是一次拒絕** —— 這樣 #57 把處理函式補上之後，
 * 同一條斷言的意思不變，不必回來改。
 */

const T2_PARENT = 1;        // 買了整份 T2
const T3_ONLY_PARENT = 2;   // 只買了一個維度的 T3（舊的九張卡片那種）
const NO_UNLOCK_PARENT = 3; // 什麼都沒買

const users: Record<number, { id: number; phone: string }> = {
  [T2_PARENT]: { id: T2_PARENT, phone: '13800000001' },
  [T3_ONLY_PARENT]: { id: T3_ONLY_PARENT, phone: '13800000002' },
  [NO_UNLOCK_PARENT]: { id: NO_UNLOCK_PARENT, phone: '13800000003' },
};

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId === T2_PARENT,
  // 只有那位 t3 家長有維度權益。閘門若誤用了這一支，測試會當場變色。
  listUnlockedDimensions: async (userId: number) => (userId === T3_ONLY_PARENT ? ['language'] : []),
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

/** 閘門後面還沒有端點，所以一條 T2 路徑就夠 —— 處理函式是 #57 的事。 */
const T2_PATH = '/api/t2/tool-results';

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

/** 「閘門放行了」——不是 401 也不是 403，回應裡也沒有拒絕碼。 */
async function expectPassed(resp: Response) {
  expect([401, 403]).not.toContain(resp.status);
  const body = await resp.json().catch(() => ({}));
  expect(['UNAUTHENTICATED', 'LOCKED']).not.toContain((body as any).code);
}

describe('T2 閘門', () => {
  it('未登入 → 401', async () => {
    const resp = await client.get(T2_PATH);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  it('登入了但什麼都沒買 → 403 LOCKED', async () => {
    const resp = await client.get(T2_PATH, bearer(NO_UNLOCK_PARENT));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  /**
   * ── 這一條是這張票的形狀 ──
   * 買了一個維度的 T3 **不等於**買了整份 T2。兩種權益同一張表，
   * 少了 scope 這一欄，舊的九筆權益會在新閘門下全部變成免費的 T2。
   */
  it('只有 t3 維度權益的家長，打不開 T2', async () => {
    const resp = await client.get(T2_PATH, bearer(T3_ONLY_PARENT));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  it('有 t2 權益 → 放行', async () => {
    await expectPassed(await client.get(T2_PATH, bearer(T2_PARENT)));
  });

  /**
   * 付費牆要在**付費前**就告訴家長「要答幾題」（規格 §9.2），
   * 所以題量預估這一支不能鎖 —— 鎖了的話畫面上只剩一個價格。
   * 白名單是守衛裡唯一的例外，寫死在那裡、看得見。
   */
  it('題量預估（/api/t2/plan）不在閘門後面', async () => {
    await expectPassed(await client.get('/api/t2/plan', bearer(NO_UNLOCK_PARENT)));
  });
});

describe('舊的維度閘門沒有被這道新閘門取代', () => {
  /**
   * 對照組。兩道閘門今天同時活著：`/api/specialized-report` 仍然驗維度，
   * 所以買了整份 T2 的家長在那裡照樣是 403 —— 那條路要不要改，
   * 票 #45 明寫是另一張票的事。少了這一條，「舊驗法不改」沒有人看著。
   */
  it('有 t2 權益的家長，在舊的維度端點上仍然被維度擋住', async () => {
    const resp = await client.postJson(
      '/api/specialized-report',
      { child: { name: '小明', ageMonth: 36, gender: 'boy' }, dimensionId: 'language' },
      bearer(T2_PARENT)
    );
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });
});

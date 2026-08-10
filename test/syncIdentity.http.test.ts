import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer, signSessionToken } from './helpers/session';

/**
 * 同步端點的身分（#15）。
 *
 * 這條路徑是孩子檔案與篩查分數**唯一**的保存路徑，而它原本以電子郵件當識別鍵：
 * 識別鍵由**客戶端送上來**，伺服器再拿它跟 token 裡的電子郵件比對。電子郵件下線
 * 之後那個比對沒有東西可比，這條路徑會直接壞掉 —— 家長做完一次篩查，什麼都沒存到。
 *
 * 這裡釘住的是改用使用者 id 之後的形狀：**識別鍵只從 token 來**，body 或 query
 * 裡的任何識別欄位都不被採信。資料層以替身供應，因為要驗的正是「路由把哪個值
 * 餵給了資料層」—— 那件事只有在看得到資料層收到什麼時才證明得了。
 */

const PARENT_ID = 42;
const OTHER_ID = 43;

/** 資料層收到的呼叫。識別鍵長什麼樣子，看這裡就知道。 */
const saved: Array<{ userId: unknown; deviceId: unknown; child: unknown }> = [];
const loadedByUserId: unknown[] = [];
const loadedByDevice: unknown[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) =>
    id === PARENT_ID || id === OTHER_ID ? { id, email: `u${id}@x.com`, company_id: null } : null,
  getUserDataByUserId: async (userId: number) => {
    loadedByUserId.push(userId);
    return userId === PARENT_ID ? { child: JSON.stringify({ name: '小明' }) } : null;
  },
  getUserDataByDevice: async (deviceId: string) => {
    loadedByDevice.push(deviceId);
    return { child: JSON.stringify({ name: '裝置上的孩子' }) };
  },
  saveUserData: async (userId: number, deviceId: string | null, child: any) => {
    saved.push({ userId, deviceId, child });
  },
  listUnlockedDimensions: async () => [],
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  findCompanyByUserId: async () => null,
  listActiveSpecialists: async () => [],
  parseUserDataRow: (row: any) => ({
    child: typeof row.child === 'string' ? JSON.parse(row.child) : row.child,
    completedScores: [], orders: [], reportHistory: [],
  }),
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  saved.length = 0;
  loadedByUserId.length = 0;
  loadedByDevice.length = 0;
});

afterAll(async () => {
  await client.close();
});

describe('保存以使用者 id 為鍵（#15）', () => {
  it('資料層收到的是使用者 id，不是電子郵件', async () => {
    const resp = await client.postJson(
      '/api/db/save',
      { deviceId: 'dev-1', child: { name: '小明' }, completedScores: [] },
      bearer(PARENT_ID)
    );
    expect(resp.status).toBe(200);
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe(PARENT_ID);
  });

  // ── 這一條是這次改動的重點 ──
  it('body 裡的電子郵件完全不被採信，寫入的仍是 token 的那一位家長', async () => {
    await client.postJson(
      '/api/db/save',
      { deviceId: 'dev-1', email: 'victim@x.com', userId: OTHER_ID, child: { name: '小明' } },
      bearer(PARENT_ID)
    );
    expect(saved[0].userId).toBe(PARENT_ID);
  });

  it('token 無效時拒絕寫入', async () => {
    const resp = await client.postJson(
      '/api/db/save',
      { deviceId: 'dev-1', child: { name: '小明' } },
      { Authorization: 'Bearer not-a-real-token' }
    );
    expect(resp.status).toBe(401);
    expect(saved).toHaveLength(0);
  });

  it('未登入帶著裝置識別碼保存，維持原本的「只存在本機」行為', async () => {
    const resp = await client.postJson('/api/db/save', { deviceId: 'dev-1', child: { name: '小明' } });
    expect(resp.status).toBe(200);
    expect((await resp.json()).localSaved).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('既沒有登入也沒有裝置識別碼時，說不出要寫給誰', async () => {
    const resp = await client.postJson('/api/db/save', { child: { name: '小明' } });
    expect(resp.status).toBe(400);
  });
});

describe('讀取以使用者 id 為鍵（#15）', () => {
  it('帶 token 讀到的是那位家長自己的紀錄', async () => {
    const resp = await client.get('/api/db/load', bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    expect((await resp.json()).child).toEqual({ name: '小明' });
    expect(loadedByUserId).toEqual([PARENT_ID]);
    expect(loadedByDevice).toHaveLength(0);
  });

  it('query 裡的電子郵件不構成身分 —— 讀的仍是 token 的那一位家長', async () => {
    await client.get('/api/db/load?email=victim%40x.com', bearer(OTHER_ID));
    expect(loadedByUserId).toEqual([OTHER_ID]);
  });

  it('帶 token 時不會退回裝置紀錄，即使 query 帶了裝置識別碼', async () => {
    await client.get('/api/db/load?deviceId=dev-1', bearer(PARENT_ID));
    expect(loadedByUserId).toEqual([PARENT_ID]);
    expect(loadedByDevice).toHaveLength(0);
  });

  it('未登入時以裝置識別碼讀取，裝置模式的行為不變', async () => {
    const resp = await client.get('/api/db/load?deviceId=dev-1');
    expect(resp.status).toBe(200);
    expect((await resp.json()).child).toEqual({ name: '裝置上的孩子' });
    expect(loadedByDevice).toEqual(['dev-1']);
    expect(loadedByUserId).toHaveLength(0);
  });

  it('token 無效時拒絕讀取，不悄悄退回裝置紀錄', async () => {
    const resp = await client.get('/api/db/load?deviceId=dev-1', { Authorization: 'Bearer tampered' });
    expect(resp.status).toBe(401);
    expect(loadedByDevice).toHaveLength(0);
  });

  it('既沒有登入也沒有裝置識別碼時退回 400', async () => {
    const resp = await client.get('/api/db/load');
    expect(resp.status).toBe(400);
  });
});

describe('通行證被動過手腳時（#15）', () => {
  it('簽章對不上就不是身分，即使 payload 裡寫著一個真的存在的使用者 id', async () => {
    const forged = signSessionToken(PARENT_ID).split('.')[0] + '.deadbeef';
    const resp = await client.get('/api/db/load', { Authorization: `Bearer ${forged}` });
    expect(resp.status).toBe(401);
    expect(loadedByUserId).toHaveLength(0);
  });
});

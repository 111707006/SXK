import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行，整支測試會在專案 A 的伺服器上跑，
 * 而那裡這幾條路徑是存在的 —— 拿到的 200 會被讀成「B 也有打卡」。
 */
process.env.APP_MODE = 't1only';

/**
 * 專案 B 沒有 T2，所以也沒有打卡與提醒（Keep 規格 K06、K07）。
 *
 * 寫法比照 `t2PlanProjectB.http.test.ts`：驗的是這幾條路徑**在 B 的部署裡根本不存在**（404），
 * 不是「B 的畫面上看不到」。Router 掛在 `tier2Only` 上，在 B 註冊到一個永遠不會被掛載的 Router。
 * 另開一檔而不是加進那一支：同一段時間還有別的票在往那一支加路徑。
 */

const PARENT_ID = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000', company_id: 1 } : null),
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
  listActiveSpecialists: async () => [],
}));

// 在 B 一次都不該被呼叫到。真的被呼叫就當場炸掉，而不是靜靜寫一筆。
vi.mock('../src/db/t2Checkins', () => ({
  insertCheckin: async () => { throw new Error('專案 B 不該寫打卡'); },
  countCheckinsForActivity: async () => { throw new Error('專案 B 不該讀打卡'); },
  findCheckin: async () => { throw new Error('專案 B 不該讀打卡'); },
  updateCheckin: async () => { throw new Error('專案 B 不該改打卡'); },
  listCheckins: async () => { throw new Error('專案 B 不該讀打卡'); },
  findCheckinActivity: async () => { throw new Error('專案 B 不該讀活動庫'); },
}));

vi.mock('../src/db/t2PracticePrefs', () => ({
  findPracticePrefs: async () => { throw new Error('專案 B 不該讀提醒'); },
  savePracticePrefs: async () => { throw new Error('專案 B 不該寫提醒'); },
}));

vi.mock('../src/admin/adminStore', () => ({
  isAvailable: () => false,
  findAdminUserByEmail: async () => null,
  findAdminUserById: async () => null,
  listCompanies: async () => [],
}));

let client: TestClient;
let auth: Record<string, string>;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  auth = bearer(PARENT_ID);
});

afterAll(async () => {
  await client.close();
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify(body),
});

describe('專案 B 沒有打卡與提醒', () => {
  it('POST /api/t2/checkins', async () => {
    expect((await client.postJson('/api/t2/checkins', { activityId: 'A001' }, auth)).status).toBe(404);
  });

  it('PATCH /api/t2/checkins/:id', async () => {
    expect((await client.request('/api/t2/checkins/1', json('PATCH', { mood: 'ok' }))).status).toBe(404);
  });

  it('GET /api/t2/checkins', async () => {
    expect((await client.get('/api/t2/checkins?from=2026-09-01&to=2026-09-30', auth)).status).toBe(404);
  });

  it('GET／PUT /api/t2/practice-prefs 與 .ics', async () => {
    expect((await client.get('/api/t2/practice-prefs', auth)).status).toBe(404);
    expect((await client.request('/api/t2/practice-prefs', json('PUT', { reminderDays: [1], reminderTime: '08:30' }))).status).toBe(404);
    expect((await client.get('/api/t2/practice-prefs.ics', auth)).status).toBe(404);
  });

  /** 對照組：少了這一條，上面的 404 也可能是整個伺服器沒起來。 */
  it('對照：共用的端點在 B 照常運作', async () => {
    expect((await client.get('/api/db/status')).status).toBe(200);
  });
});

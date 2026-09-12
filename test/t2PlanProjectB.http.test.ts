import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行，整支測試會在專案 A 的伺服器上跑，
 * 而那裡這條路徑是存在的 —— 拿到的 200 會被讀成「B 也有 T2」。
 */
process.env.APP_MODE = 't1only';

/**
 * 專案 B 沒有 T2（票 #56、#57 的驗收「B 模式 404」）。
 *
 * 要驗的不是「B 的畫面上看不到入口」—— 那只是 bundle 裡的一個判斷 —— 而是**這兩條路徑
 * 在 B 的部署裡根本不存在**。`/api/t2` 前綴掛在 `tier2Only` 上，在 B 註冊到一個永遠不會
 * 被掛載的 Router，請求落到 404：沒有處理函式可以被繞過，而 404 也不像 403 那樣順便確認了
 * 端點存在。白名單（plan、diagnosis 不驗權益）在 B 也一樣不存在。
 */

const PARENT_ID = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000', company_id: 1 } : null),
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  // 這三支在 B 一次都不該被呼叫到。真的被呼叫就當場炸掉，而不是靜靜回一份 plan。
  getT2Diagnosis: async () => { throw new Error('專案 B 不該讀 T2 診斷方向'); },
  saveT2Diagnosis: async () => { throw new Error('專案 B 不該寫 T2 診斷方向'); },
  getUserDataByUserId: async () => { throw new Error('專案 B 的 T2 不該讀家長資料'); },
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
  listActiveSpecialists: async () => [],
}));

// #57 的兩支同樣不該在 B 被碰到。
vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async () => { throw new Error('專案 B 不該寫 T2 交卷'); },
  listToolResults: async () => { throw new Error('專案 B 不該讀 T2 交卷'); },
}));

// #59 的報告快照與活動庫也一樣。
vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async () => { throw new Error('專案 B 不該寫 T2 報告快照'); },
  latestFindings: async () => { throw new Error('專案 B 不該讀 T2 報告快照'); },
}));

vi.mock('../src/db/t2Activities', () => ({
  listActivityLibrary: async () => { throw new Error('專案 B 不該讀活動庫'); },
}));

// #60 的每週活動。
vi.mock('../src/db/t2WeeklyPlans', () => ({
  insertWeeklyPlan: async () => { throw new Error('專案 B 不該寫每週活動'); },
  findWeeklyPlan: async () => { throw new Error('專案 B 不該讀每週活動'); },
  recentWeeklyPlans: async () => { throw new Error('專案 B 不該讀每週活動'); },
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

describe('專案 B 沒有 T2 入口', () => {
  it('GET /api/t2/plan 在 B 根本不存在', async () => {
    expect((await client.get('/api/t2/plan', auth)).status).toBe(404);
  });

  it('PUT /api/t2/diagnosis 在 B 根本不存在', async () => {
    const resp = await client.request('/api/t2/diagnosis', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ diagnosis: 'asd' }),
    });
    expect(resp.status).toBe(404);
  });

  it('POST /api/t2/tool-results 在 B 根本不存在（#57）', async () => {
    const resp = await client.postJson('/api/t2/tool-results', { toolId: 'sxk-lang', assessedAgeMonth: 48, rater: 'mother', answers: {} }, auth);
    expect(resp.status).toBe(404);
  });

  it('GET /api/t2/tool-results 在 B 根本不存在（#57）', async () => {
    expect((await client.get('/api/t2/tool-results', auth)).status).toBe(404);
  });

  it('POST /api/t2/findings 在 B 根本不存在（#59）', async () => {
    expect((await client.postJson('/api/t2/findings', {}, auth)).status).toBe(404);
  });

  it('GET /api/t2/findings/latest 在 B 根本不存在（#59）', async () => {
    expect((await client.get('/api/t2/findings/latest', auth)).status).toBe(404);
  });

  it('GET /api/t2/weekly-plan 在 B 根本不存在（#60）', async () => {
    expect((await client.get('/api/t2/weekly-plan', auth)).status).toBe(404);
  });

  /** 對照組：少了這一條，上面的 404 也可能是整個伺服器沒起來。 */
  it('對照：共用的端點在 B 照常運作', async () => {
    expect((await client.get('/api/db/status')).status).toBe(200);
  });
});

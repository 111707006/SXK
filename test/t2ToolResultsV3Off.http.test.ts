import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * `T2_RECOMMEND_V3` 關著（預設）：交卷與清單一行不動 —— 帶了完整版的版本號也照舊題庫讀（工具不認得 → 400），
 * `?kit=v3` 被忽略、回舊題庫的清單。施工規則第 3 條：新行為先關著。
 */

const insertV3 = vi.fn();

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => ({ id, phone: '13800000001' }),
  hasT2Unlock: async () => true,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => ({ user_id: id, child: { name: '小明', birthDate: '2023-10-01', gender: 'boy' }, completedScores: [] }),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async () => 1,
  listToolResults: async () => [],
}));

vi.mock('../src/db/t2ToolResultsV3', () => ({
  insertToolResultV3: insertV3,
  listToolResultsV3: async () => {
    throw new Error('開關關著不該讀完整版');
  },
}));

let client: TestClient;

beforeAll(async () => {
  process.env.T2_RECOMMEND_V3 = '';
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('T2_RECOMMEND_V3 關著', () => {
  it('帶完整版版本號的交卷 → 舊路徑 400 TOOL_UNKNOWN，不寫完整版', async () => {
    const resp = await client.postJson('/api/t2/tool-results', { toolkitVersion: 'kit-20260923', toolId: 'SXK-GM', assessedAgeMonth: 36, rater: 'mother', answers: {} }, bearer(1));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('TOOL_UNKNOWN');
    expect(insertV3).not.toHaveBeenCalled();
  });

  it('?kit=v3 被忽略：回舊題庫的清單', async () => {
    const resp = await client.get('/api/t2/tool-results?kit=v3', bearer(1));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ results: [] });
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 記憶體模式（沒有資料庫）下的家庭訓練端點（Keep 規格 K08、K09、§5.1）。
 *
 * 沒有替身資料層 —— 測試環境清空 `MYSQL_*`，走的就是展示站那條路：每週活動存在
 * `offlineT2WeeklyPlans`、活動庫是空的。要驗的是這幾支在那條路上**走得完**：
 * 第幾週照樣算（第 1 週來自記憶體那張表）、換著玩是空的、片庫空陣列、單支 404。
 *
 * 只替身模型（`coze-coding-dev-sdk`）：生成報告要一份快照，而測試不該對外送請求。
 * 模型丟例外 → 報告退模板，快照照樣存下來。
 */

vi.mock('coze-coding-dev-sdk', () => ({
  Config: class {},
  LLMClient: class {
    async invoke() {
      throw new Error('測試不呼叫模型');
    }
  },
}));

const PARENT = 41;

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('記憶體模式：每週活動的 plan 與 alternates', () => {
  it('生成報告後查兩週：第 1 週、第 2 週；換著玩是空物件（活動庫是空的）', async () => {
    const save = await client.postJson('/api/db/save', {
      deviceId: 'dev-training-mem',
      child: { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' },
      completedScores: [{ tierId: 'T1', dimensionId: 'language', status: 'delay' }],
    }, bearer(PARENT));
    expect(save.status).toBe(200);
    expect((await client.postJson('/api/t2/findings', {}, bearer(PARENT))).status).toBe(201);

    const first = await (await client.get('/api/t2/weekly-plan?week=2026-09-09', bearer(PARENT))).json();
    expect(first.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
    expect(first.alternates).toEqual({});

    const second = await (await client.get('/api/t2/weekly-plan?week=2026-09-16', bearer(PARENT))).json();
    expect(second.plan).toEqual({ weekIndex: 2, totalWeeks: 12, firstWeekStart: '2026-09-07' });
  });
});

describe('記憶體模式：片庫與單支', () => {
  it('片庫 → 200、空陣列', async () => {
    const resp = await client.get('/api/t2/library', bearer(PARENT));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ activities: [] });
  });

  it('單支 → 404（活動庫是空的）', async () => {
    const resp = await client.get('/api/t2/activities/A001', bearer(PARENT));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('ACTIVITY_NOT_FOUND');
  });

  it('閘門在記憶體模式放行，但仍要登入 → 401', async () => {
    expect((await client.get('/api/t2/library')).status).toBe(401);
    expect((await client.get('/api/t2/activities/A001')).status).toBe(401);
  });
});

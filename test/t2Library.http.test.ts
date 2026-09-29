import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import { ACTIVITY_CONTENT } from '../src/t2/activityContent';
import type { Activity, ModuleNo } from '../src/t2/types';

/**
 * 示範片庫與單支活動（Keep 規格 K09、§5.3）。
 *
 * 【這裡在防什麼】
 * 1. **只回啟用的**：停用是內容團隊收回去的活動（內容錯了、片子有問題），家長端不該再看到它 ——
 *    片庫不列、單支 404，與不存在的編號同一個回應（不透露「有，但收回了」）。
 * 2. **片庫只列有示範片的**（`videoUrl` 非空）。今天活動庫一支片子都還沒有（票 3），片庫是空陣列，
 *    那是正常的，不是 500。
 * 3. **單支不看有沒有片**：換著玩的詳情也走它，而大多數活動沒有片。
 * 4. 在 T2 付費閘門後面（不在 `T2_OPEN_PATHS` 上）：未登入 401、沒買 403 `LOCKED`。
 * 5. 活動庫讀不出來 → 500，不是空的片庫或 404：「找不到這支活動」在資料庫掛掉時是一句謊話。
 */

const UNLOCKED = 1;
const LOCKED = 2;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
};

/** 一支活動；沒指定的欄位是種子的形狀（沒有內容、沒有片）。 */
function act(id: string, moduleNo: ModuleNo, over: Partial<Activity> = {}): Activity {
  return {
    id,
    title: `活動 ${id}`,
    moduleNo,
    targetMonth: null,
    ageMonths: { min: 6, max: 36 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
    ...NO_ACTIVITY_CONTENT,
    ...over,
  };
}

/** A001 帶客戶手冊與腳本的真內容（`activityContent.ts`），加一支示範片。 */
function a001(): Activity {
  const c = ACTIVITY_CONTENT.find(x => x.id === 'A001')!;
  return act('A001', 1, {
    title: c.title,
    ageLabel: c.ageLabel,
    people: c.people,
    need: c.need,
    trains: c.trains,
    steps: c.steps.map(instruction => ({ imageUrl: null, instruction })),
    easier: c.easier,
    harder: c.harder,
    tip: c.tip,
    deeper: c.deeper,
    guide: c.guide,
    videoUrl: '/media/activities/A001.mp4',
    posterUrl: '/media/activities/A001.jpg',
    videoSeconds: 10,
  });
}

let library: Activity[] = [];
let libraryFails = false;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  saveUserData: async () => {},
  getT2Diagnosis: async () => null,
  saveT2Diagnosis: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2Activities', () => ({
  listActivityLibrary: async () => {
    if (libraryFails) throw new Error('connect ETIMEDOUT');
    return library;
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  libraryFails = false;
  library = [
    a001(),
    act('A002', 1, { videoUrl: '/media/activities/A002.mp4', active: false }), // 停用
    act('A003', 1),                                                            // 沒有片
    act('A004', 1, { videoUrl: '' }),                                          // 空字串也是沒有片
    act('A021', 2, { videoUrl: 'https://cdn.example.com/A021.mp4', ageLabel: '1–3岁', ageMonths: { min: 12, max: 36 } }),
  ];
});

describe('GET /api/t2/library', () => {
  const URL = '/api/t2/library';

  it('只列有示範片的啟用活動，依編號排；每支只帶片庫要的七個欄位', async () => {
    const resp = await client.get(URL, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.activities.map((a: any) => a.id)).toEqual(['A001', 'A021']);
    expect(body.activities[0]).toEqual({
      id: 'A001',
      title: library[0].title,
      moduleNo: 1,
      ageLabel: library[0].ageLabel,
      ageMonths: { min: 6, max: 36 },
      posterUrl: '/media/activities/A001.jpg',
      videoSeconds: 10,
    });
    // 沒有封面、沒有片長的照實回 null，不編一個
    expect(body.activities[1]).toEqual({
      id: 'A021', title: '活動 A021', moduleNo: 2, ageLabel: '1–3岁', ageMonths: { min: 12, max: 36 }, posterUrl: null, videoSeconds: null,
    });
  });

  it('活動庫的順序不影響：照編號排', async () => {
    library.reverse();
    const body = await (await client.get(URL, bearer(UNLOCKED))).json();
    expect(body.activities.map((a: any) => a.id)).toEqual(['A001', 'A021']);
  });

  it('還沒有任何片子（今天的狀態）→ 200、空陣列', async () => {
    library = library.map(a => ({ ...a, videoUrl: null }));
    const resp = await client.get(URL, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ activities: [] });
  });

  it('活動庫讀不出來 → 500，不是空的片庫', async () => {
    libraryFails = true;
    expect((await client.get(URL, bearer(UNLOCKED))).status).toBe(500);
  });

  it('沒買 T2 也看得到（線上干預 2026-09-29 起是自己一站、現在免費）', async () => {
    const resp = await client.get(URL, bearer(LOCKED));
    expect(resp.status).toBe(200);
  });

  it('未登入 → 401', async () => {
    const resp = await client.get(URL);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/t2/activities/:id', () => {
  const URL = '/api/t2/activities';

  it('啟用的 → 200，完整內容：手冊欄位、腳本、步驟、示範片', async () => {
    const resp = await client.get(`${URL}/A001`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.activity).toEqual(library[0]);
    expect(body.activity.guide).not.toBeNull();
    expect(body.activity.trains).not.toBe('');
  });

  it('沒有示範片的啟用活動也回（換著玩的詳情走這一支）', async () => {
    const body = await (await client.get(`${URL}/A003`, bearer(UNLOCKED))).json();
    expect(body.activity.id).toBe('A003');
    expect(body.activity.videoUrl).toBeNull();
  });

  it('活動內容每次從活動庫查：後台改了小提醒，下一次讀就是新的', async () => {
    library = library.map(a => (a.id === 'A003' ? { ...a, tip: '后台刚改的小提醒' } : a));
    const body = await (await client.get(`${URL}/A003`, bearer(UNLOCKED))).json();
    expect(body.activity.tip).toBe('后台刚改的小提醒');
  });

  it.each([
    ['停用的', 'A002'],
    ['不存在的', 'A999'],
    ['認不得的編號', 'not-an-id'],
    ['大小寫不同', 'a001'],
  ])('%s → 404 ACTIVITY_NOT_FOUND', async (_label, id) => {
    const resp = await client.get(`${URL}/${encodeURIComponent(id)}`, bearer(UNLOCKED));
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.code).toBe('ACTIVITY_NOT_FOUND');
    expect(body).not.toHaveProperty('activity');
  });

  it('活動庫讀不出來 → 500，不是 404', async () => {
    libraryFails = true;
    expect((await client.get(`${URL}/A001`, bearer(UNLOCKED))).status).toBe(500);
  });

  it('沒買 T2 也看得到（線上干預 2026-09-29 起是自己一站、現在免費）', async () => {
    const resp = await client.get(`${URL}/A001`, bearer(LOCKED));
    expect(resp.status).toBe(200);
  });

  it('未登入 → 401', async () => {
    const resp = await client.get(`${URL}/A001`);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { DIM_MOD } from '../src/t2/activityMatch';
import { weekStartOf } from '../src/t2/weeks';
import type { Activity, DimensionCode, ModuleNo, T2Findings } from '../src/t2/types';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { FindingsRecord } from '../src/db/t2Findings';
import type { WeeklyPlanInsert, WeeklyPlanRecord } from '../src/db/t2WeeklyPlans';

/**
 * `GET /api/t2/weekly-plan?week=`（票 #60，規格 §9.1、§9.2、§7.3）。
 *
 * 【這裡在防什麼】
 * 1. **一週一筆**：同一週查兩次回同一份，表裡仍是一筆。配對對「前四週派過的」會扣分，
 *    每次重算就可能換掉一支 —— 昨天記下「這週要練 A017」的家長今天會找不到它。
 * 2. **下一週是新的一筆**，而且前一週的編號進了「派過」（扣分）。
 * 3. **活動內容每次從活動庫查**：存的是編號。內容團隊今天補完步驟，家長這一週就看得到。
 * 4. **`targetMonth` 全 null 的活動庫（今天的狀態）**：每個維度都「準備中」，不報錯。
 * 5. 沒有快照 404、無權益 403、B 404。
 *
 * 【月齡】
 * 孩子 2022-09-12 生，查 2026-09-07 那一週 → 那一週的星期一是 2026-09-07，實足 47 個月
 *（9/12 才滿 48）。整週用同一個數字：一週裡過生日的孩子，同一份已經存下來的活動不該在
 * 生日那天突然變成「為另一個年齡段配的」。
 */

const UNLOCKED = 1;
const LOCKED = 2;
const NO_SNAPSHOT = 3;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
  [NO_SNAPSHOT]: { id: NO_SNAPSHOT, phone: '13800000003' },
};

const CHILD = { name: '小明', birthDate: '2022-09-12', ageMonth: 48, gender: 'boy' };

const userData: Record<number, { child: any; completedScores: any[] }> = {
  [UNLOCKED]: { child: CHILD, completedScores: [] },
  [LOCKED]: { child: CHILD, completedScores: [] },
  [NO_SNAPSHOT]: { child: CHILD, completedScores: [] },
};

/** LANG refer、ATT watch，其餘 clear。47 個月：refer 窗口 [23, 35]、watch 窗口 [35, 41]。 */
const FINDINGS: T2Findings = t2FindingsFixture({
  LANG: { band: 'refer', tags: ['lang.expression'] },
  ATT: { band: 'watch', tags: ['att.inattention'] },
}, { child: { assessedAgeMonth: 48 } });

/** 一支活動；沒指定的欄位是種子的形狀。 */
function act(id: string, moduleNo: ModuleNo, targetMonth: number | null, over: Partial<Activity> = {}): Activity {
  return {
    id,
    title: `活動 ${id}`,
    moduleNo,
    targetMonth,
    ageMonths: { min: 0, max: 180 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 15,
    equipment: ['软垫'],
    steps: [{ imageUrl: '/act/1.png', instruction: '先坐下来' }],
    videoUrl: null,
    active: true,
    ...NO_ACTIVITY_CONTENT,
    ...over,
  };
}

/**
 * 兩個**不重疊**的模組：模組 7 同時在語言與注意力的模組群裡，拿它當「語言的模組」會讓
 * 「把注意力的活動全拿掉」連語言的一起拿掉。8 只在語言、13 不在語言。
 */
const LANG_MODULE = 8 as ModuleNo;
const ATT_MODULE = 13 as ModuleNo;

/** 語言兩支（窗口 [23,35]）、注意力兩支（窗口 [35,41]）。 */
let library: Activity[] = [];

/** 替身的三張表。 */
let findingsRow: FindingsRecord | null = null;
const weeklyTable: Array<{ userId: number; record: WeeklyPlanRecord }> = [];
let nextWeeklyId = 1;
/** 「第 1 週」那一支查詢丟錯（逾時、資料庫錯）。 */
let firstWeekFails = false;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  getT2Diagnosis: async () => null,
  saveT2Diagnosis: async () => {},
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2ToolResults', () => ({
  insertToolResult: async () => 1,
  listToolResults: async () => [],
}));

vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async () => 1,
  latestFindings: async (userId: number) => (userId === NO_SNAPSHOT ? null : findingsRow),
}));

vi.mock('../src/db/t2Activities', () => ({
  listActivityLibrary: async () => library,
}));

vi.mock('../src/db/t2WeeklyPlans', () => ({
  insertWeeklyPlan: async (userId: number, input: WeeklyPlanInsert) => {
    const id = nextWeeklyId++;
    weeklyTable.push({ userId, record: { id, createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  findWeeklyPlan: async (userId: number, weekStart: string) =>
    weeklyTable.find(r => r.userId === userId && r.record.weekStart === weekStart)?.record ?? null,
  recentWeeklyPlans: async (userId: number, weekStart: string, limit: number) =>
    weeklyTable
      .filter(r => r.userId === userId && r.record.weekStart < weekStart)
      .map(r => r.record)
      .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
      .slice(0, limit),
  firstWeekStartOfFindings: async (userId: number, findingsId: number) => {
    if (firstWeekFails) throw new Error('connect ETIMEDOUT');
    return weeklyTable
      .filter(r => r.userId === userId && r.record.findingsId === findingsId)
      .map(r => r.record.weekStart)
      .sort()[0] ?? null;
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
  weeklyTable.length = 0;
  nextWeeklyId = 1;
  firstWeekFails = false;
  findingsRow = {
    id: 77,
    createdAt: '2026-09-07T00:00:00.000Z',
    findings: FINDINGS,
    prose: null,
    isAiGenerated: false,
    aiEngine: 'template:all_engines_failed',
  };
  library = [
    act('A001', LANG_MODULE, 30),
    act('A002', LANG_MODULE, 28),
    act('A003', ATT_MODULE, 38),
    act('A004', ATT_MODULE, 40),
  ];
});

const URL = '/api/t2/weekly-plan';
const WEEK = '2026-09-09'; // 星期三；那一週的星期一是 2026-09-07
const NEXT_WEEK = '2026-09-16';

describe('GET /api/t2/weekly-plan', () => {
  it('第一次查本週 → 算一份存表回傳；月齡是那一週星期一算的', async () => {
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.weekStart).toBe('2026-09-07');
    expect(body.weekEnd).toBe('2026-09-13');
    expect(body.ageMonth).toBe(47);
    expect(body.ageKey).toBe('36-72');
    expect(body.reportAgeMonth).toBe(48);
    expect(body.findingsId).toBe(77);

    // LANG refer 拿兩個名額、ATT watch 一個，第四個名額輪回去給 LANG（已滿 2）→ ATT 的第二支
    expect(body.activities).toHaveLength(4);
    expect(body.activities.map((a: any) => a.activity.id).sort()).toEqual(['A001', 'A002', 'A003', 'A004']);
    expect(body.preparing).toEqual([]);
    expect(weeklyTable).toHaveLength(1);
  });

  it('每一支都帶 dimension 與 reason（畫面上那句「因為……所以練……」）', async () => {
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    const lang = body.activities.find((a: any) => a.activity.id === 'A001');
    expect(lang.dimension).toBe('LANG');
    expect(lang.reason.band).toBe('refer');
    expect(lang.reason.window).toEqual({ lo: 23, hi: 35 });
    expect(lang.reason).toHaveProperty('matchedTags');
    expect(lang.reason).toHaveProperty('belowWindow');
  });

  it('第二次查同一週 → 同一份，表仍一筆', async () => {
    const first = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    const second = await (await client.get(`${URL}?week=2026-09-13`, bearer(UNLOCKED))).json();

    expect(second.weekStart).toBe(first.weekStart);
    expect(second.findingsId).toBe(first.findingsId);
    expect(second.activities.map((a: any) => a.activity.id)).toEqual(first.activities.map((a: any) => a.activity.id));
    // 第二次是從表裡讀回來的那一列，不是重算的
    expect(second.createdAt).toBe(weeklyTable[0].record.createdAt);
    expect(weeklyTable).toHaveLength(1);
  });

  it('查下一週 → 新的一筆，前一週的編號進「派過」（扣分後排在後面）', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    // 語言多兩支沒派過的：這一週應該優先拿它們，而不是重複上一週的
    library.push(act('A005', LANG_MODULE, 31), act('A006', LANG_MODULE, 29));

    const body = await (await client.get(`${URL}?week=${NEXT_WEEK}`, bearer(UNLOCKED))).json();
    expect(body.weekStart).toBe('2026-09-14');
    expect(weeklyTable).toHaveLength(2);

    const langIds = body.activities.filter((a: any) => a.dimension === 'LANG').map((a: any) => a.activity.id);
    expect(langIds.sort()).toEqual(['A005', 'A006']);
  });

  // Keep 規格 K17 的驗收「改一支的『小提醒』家長端立刻看到」：內容欄位同樣每次從活動庫查。
  it('活動內容每次從活動庫查：庫裡改了標題與小提醒，同一週的同一支跟著改', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    library = library.map(a =>
      a.id === 'A001'
        ? { ...a, title: '换过的名字', durationMin: 20, tip: '后台刚改的小提醒', steps: [{ imageUrl: null, instruction: '只有文字的一步' }] }
        : a,
    );

    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    const a001 = body.activities.find((a: any) => a.activity.id === 'A001');
    expect(a001.activity.title).toBe('换过的名字');
    expect(a001.activity.durationMin).toBe(20);
    expect(a001.activity.tip).toBe('后台刚改的小提醒');
    expect(a001.activity.steps).toEqual([{ imageUrl: null, instruction: '只有文字的一步' }]);
    expect(weeklyTable).toHaveLength(1);
  });

  it('編號在庫裡查不到 → 略過那一支，其餘照回', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    library = library.filter(a => a.id !== 'A001');

    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.activities).toHaveLength(3);
    expect(body.activities.map((a: any) => a.activity.id)).not.toContain('A001');
  });

  it('targetMonth 全 null 的活動庫（今天的狀態）→ 每個維度都「準備中」，不報錯', async () => {
    library = library.map(a => ({ ...a, targetMonth: null }));
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.activities).toEqual([]);
    expect(body.preparing.sort()).toEqual(['ATT', 'LANG']);
    expect(weeklyTable).toHaveLength(1);
  });

  it('空的活動庫 → 一樣是「準備中」，不是 500', async () => {
    library = [];
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.activities).toEqual([]);
    expect(body.preparing.sort()).toEqual(['ATT', 'LANG']);
  });

  it('沒帶 week → 今天所在的那一週', async () => {
    const body = await (await client.get(URL, bearer(UNLOCKED))).json();
    expect(body.weekStart).toBe(weekStartOf(new Date()));
  });

  it.each(['2026-9-7', '2026/09/07', 'yesterday', ''])('week=%s 認不得 → 400 WEEK_INVALID，零筆', async value => {
    const resp = await client.get(`${URL}?week=${encodeURIComponent(value)}`, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('WEEK_INVALID');
    expect(weeklyTable).toHaveLength(0);
  });

  it('查太遠的未來 → 400 WEEK_OUT_OF_RANGE，零筆', async () => {
    const far = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resp = await client.get(`${URL}?week=${far}`, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('WEEK_OUT_OF_RANGE');
    expect(weeklyTable).toHaveLength(0);
  });

  it('下一週還查得到（裝置時鐘比伺服器快幾分鐘時的餘裕）', async () => {
    const next = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect((await client.get(`${URL}?week=${next}`, bearer(UNLOCKED))).status).toBe(200);
  });

  it('那一週在孩子出生之前 → 400 WEEK_OUT_OF_RANGE，零筆（不是照測評月齡編一個數字）', async () => {
    const resp = await client.get(`${URL}?week=2019-01-07`, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('WEEK_OUT_OF_RANGE');
    expect(weeklyTable).toHaveLength(0);
  });

  it('沒有快照 → 404 帶說明，零筆', async () => {
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(NO_SNAPSHOT));
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.code).toBe('T2_FINDINGS_REQUIRED');
    expect(body.error).toContain('报告');
    expect(weeklyTable).toHaveLength(0);
  });

  it('無 t2 權益 → 403 LOCKED，零筆', async () => {
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(LOCKED));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
    expect(weeklyTable).toHaveLength(0);
  });

  it('未登入 → 401', async () => {
    const resp = await client.get(`${URL}?week=${WEEK}`);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  it('讀不到別人的那一週', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(weeklyTable[0].userId).toBe(UNLOCKED);
  });
});

/**
 * 換著玩（Keep 規格 K08、§5.1、§5.2）。
 *
 * 【這裡在防什麼】
 * 1. **備選與四支存在同一筆**：同一週查兩次要一樣，理由與四支相同 —— 備選也吃「四週內派過 −2」，
 *    每次重算就可能換掉。
 * 2. **舊的週次（K08 之前存的）沒有這一欄 → 回應不出 `alternates`**，畫面就不出換著玩；
 *    讀舊資料不能炸，也不回頭重配（一週一筆，那一列不改）。
 * 3. 內容照樣每次從活動庫查；庫裡查不到的略過，略過後空了的維度不出現。
 *
 * 預設活動庫之外再各加一支窗口內的：語言 A005（33，離中點 29 最遠）、注意力 A006（41）。
 * 主配對照舊拿 A001–A004，備選各一支。
 */
describe('換著玩（alternates）', () => {
  beforeEach(() => {
    library.push(act('A005', LANG_MODULE, 33), act('A006', ATT_MODULE, 41));
  });

  it('備選存進同一筆、回應帶完整的活動內容，不含本週四支', async () => {
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();

    expect(body.activities.map((a: any) => a.activity.id).sort()).toEqual(['A001', 'A002', 'A003', 'A004']);
    expect(weeklyTable).toHaveLength(1);
    expect(weeklyTable[0].record.activities.alternates).toEqual({ LANG: ['A005'], ATT: ['A006'] });

    expect(Object.keys(body.alternates).sort()).toEqual(['ATT', 'LANG']);
    expect(body.alternates.LANG).toEqual([library.find(a => a.id === 'A005')]);
    expect(body.alternates.ATT.map((a: Activity) => a.id)).toEqual(['A006']);
  });

  it('同一週查兩次一樣：第二次讀回存下的那一份，庫裡多了更合適的也不重配', async () => {
    const first = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    // 正中點（29）的一支：重配的話它會進本週四支、把別的擠進備選
    library.push(act('A008', LANG_MODULE, 29));

    const second = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(second.alternates).toEqual(first.alternates);
    expect(second.activities.map((a: any) => a.activity.id)).toEqual(first.activities.map((a: any) => a.activity.id));
    expect(weeklyTable).toHaveLength(1);
  });

  it('舊的週次（沒有 alternates 這一欄）→ 200、回應不出 alternates，四支照回，不回頭重配', async () => {
    weeklyTable.push({
      userId: UNLOCKED,
      record: {
        id: nextWeeklyId++,
        createdAt: '2026-09-07T01:00:00.000Z',
        weekStart: '2026-09-07',
        findingsId: 77,
        activities: {
          picks: [{ id: 'A001', dimension: 'LANG', reason: { band: 'refer', window: { lo: 23, hi: 35 }, matchedTags: [], belowWindow: false } }],
          preparing: [],
        },
      },
    });

    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).not.toHaveProperty('alternates');
    expect(body.activities.map((a: any) => a.activity.id)).toEqual(['A001']);
    expect(weeklyTable).toHaveLength(1);
    expect(weeklyTable[0].record.activities).not.toHaveProperty('alternates');
  });

  it('新週次、每個維度都沒有可換的 → alternates 是空物件（與舊週次分得開）', async () => {
    library = library.filter(a => a.id !== 'A005' && a.id !== 'A006');
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.alternates).toEqual({});
  });

  it('備選的編號在庫裡查不到 → 略過那一支；略過後空了的維度不出現', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    library = library.filter(a => a.id !== 'A006');

    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(Object.keys(body.alternates)).toEqual(['LANG']);
  });

  it('備選的內容每次從活動庫查：庫裡改了小提醒，同一週的備選跟著改', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    library = library.map(a => (a.id === 'A005' ? { ...a, tip: '后台刚改的小提醒' } : a));

    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.alternates.LANG[0].tip).toBe('后台刚改的小提醒');
  });
});

/**
 * 「第幾週」（Keep 規格 §4.5、§5.1）：第 1 週＝同一份報告快照在表裡最早的那一週；
 * 重新生成報告是新的快照，從第 1 週重算。計劃 12 週（暫採），超過照算。
 */
describe('plan（第幾週）', () => {
  it('第一次查 → 第 1 週，共 12 週，第 1 週就是這一週', async () => {
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
  });

  it('下一週 → 第 2 週；回頭查第一週仍是第 1 週', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    const next = await (await client.get(`${URL}?week=${NEXT_WEEK}`, bearer(UNLOCKED))).json();
    expect(next.plan).toEqual({ weekIndex: 2, totalWeeks: 12, firstWeekStart: '2026-09-07' });

    const again = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(again.plan.weekIndex).toBe(1);
  });

  it('重新生成報告（新快照）→ 從第 1 週重算；已存的舊週次仍照它自己那份快照算', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    findingsRow = { ...findingsRow!, id: 78, createdAt: '2026-09-12T00:00:00.000Z' };

    const next = await (await client.get(`${URL}?week=${NEXT_WEEK}`, bearer(UNLOCKED))).json();
    expect(next.findingsId).toBe(78);
    expect(next.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-14' });

    const weekAfter = await (await client.get(`${URL}?week=2026-09-21`, bearer(UNLOCKED))).json();
    expect(weekAfter.plan).toEqual({ weekIndex: 2, totalWeeks: 12, firstWeekStart: '2026-09-14' });

    // 9/07 那一週是照 77 配的，不回頭改；它的第幾週照 77 的計劃算
    const old = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(old.findingsId).toBe(77);
    expect(old.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
  });

  it('超過 12 週照算：報告是 14 週前生成的、那一週開過 → 第 15 週', async () => {
    findingsRow = { ...findingsRow!, createdAt: '2026-06-02T02:00:00.000Z' };
    await client.get(`${URL}?week=2026-06-03`, bearer(UNLOCKED));
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.plan).toEqual({ weekIndex: 15, totalWeeks: 12, firstWeekStart: '2026-06-01' });
  });

  /**
   * 第 1 週是「最早的 week_start」，所以**不能替報告生成之前的週次補一列**：家長往回翻到三個月前，
   * 那一列會帶著這份快照的編號存下來，這一週就從第 1 週跳成第 15 週、計劃頁說「已满 12 周」。
   * 那一列本身也不對 —— 報告還不存在的那一週，沒有「照這份報告配的活動」。已經存過的舊週次照讀。
   */
  it('報告生成之前、沒存過的那一週 → 400 WEEK_OUT_OF_RANGE、零筆；往回翻不改這一週是第幾週', async () => {
    const current = await (await client.get(`${URL}?week=${NEXT_WEEK}`, bearer(UNLOCKED))).json();
    expect(current.plan.weekIndex).toBe(1);

    // 快照是 2026-09-07（星期一）生成的；8/31 那一週在它之前
    const resp = await client.get(`${URL}?week=2026-08-31`, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('WEEK_OUT_OF_RANGE');
    expect(weeklyTable).toHaveLength(1);

    const again = await (await client.get(`${URL}?week=${NEXT_WEEK}`, bearer(UNLOCKED))).json();
    expect(again.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-14' });
  });

  it('報告生成的那一週本身可以查（週中生成的，那一週一樣排活動）', async () => {
    findingsRow = { ...findingsRow!, createdAt: '2026-09-12T14:00:00.000Z' }; // 9/12 星期六晚上（+08:00）
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect((await resp.json()).plan.weekIndex).toBe(1);
  });

  it('已經存過的舊週次照讀，即使在最新那份報告生成之前', async () => {
    await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    findingsRow = { ...findingsRow!, id: 78, createdAt: '2026-09-20T00:00:00.000Z' };
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect((await resp.json()).findingsId).toBe(77);
  });

  it('第 1 週讀不出來（逾時、資料庫錯）→ 以這一週為第 1 週，四支照回，不是 500', async () => {
    firstWeekFails = true;
    const resp = await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.activities).toHaveLength(4);
    expect(body.plan).toEqual({ weekIndex: 1, totalWeeks: 12, firstWeekStart: '2026-09-07' });
  });

  it('別的家長同一個快照編號的週次不算進來', async () => {
    weeklyTable.push({
      userId: LOCKED,
      record: { id: nextWeeklyId++, createdAt: null, weekStart: '2026-06-01', findingsId: 77, activities: { picks: [], preparing: [] } },
    });
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();
    expect(body.plan.firstWeekStart).toBe('2026-09-07');
  });
});

describe('準備中的維度', () => {
  it('語言配得到、注意力配不到 → 只有注意力在 preparing', async () => {
    library = library.filter(a => a.moduleNo !== ATT_MODULE);
    const body = await (await client.get(`${URL}?week=${WEEK}`, bearer(UNLOCKED))).json();

    expect(body.activities.map((a: any) => a.dimension)).toEqual(['LANG', 'LANG']);
    expect(body.preparing).toEqual<DimensionCode[]>(['ATT']);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Activity, ActivityGuide } from '../src/t2/types';
import type { Checkin, CheckinPatch, PracticePrefs } from '../src/t2/practice';
import type { CheckinInsert } from '../src/db/t2Checkins';

/**
 * 打卡與提醒的端點（Keep 規格 K06、K07、§5.3）。
 *
 * 【這裡在防什麼】
 * 1. **只能動自己的**：身分取自 token；別人的打卡 PATCH 回 404（不回 403 —— 403 等於承認那個 id
 *    存在），而且那一筆沒被改到。body 裡的 `userId` 不採信。
 * 2. **日期是伺服器算的**：body 帶了日期也不讀；時區 Asia/Shanghai，上海週日 23:59 與週一 00:01
 *    落在不同的一週。
 * 3. **活動要存在且啟用**；`progress` 每一條都要小於那支活動腳本「怎么看出有进步」的條數，
 *    沒有腳本的活動只收空陣列。
 * 4. **查一段日期最多 62 天**。
 * 5. **付費閘門**：未付費 403 `LOCKED`、未登入 401，一筆都不寫（這幾支都不在 `T2_OPEN_PATHS` 上）。
 * 6. 提醒：星期 0–6、時間四選一；`.ics` 沒設提醒 404，設了回每週重複的日曆檔。
 * 7. 記憶體模式（沒有資料庫）：與 `t2_weekly_plans` 同一種離線退路；活動庫是空的，所以打不了卡。
 */

const PARENT = 1;
const OTHER = 2;
const LOCKED = 3;
const NO_REPORT = 4;

const users: Record<number, { id: number; phone: string }> = {
  [PARENT]: { id: PARENT, phone: '13800000001' },
  [OTHER]: { id: OTHER, phone: '13800000002' },
  [LOCKED]: { id: LOCKED, phone: '13800000003' },
  [NO_REPORT]: { id: NO_REPORT, phone: '13800000004' },
};

/** 替身的資料庫開關：`false` 就是記憶體模式（展示站）。 */
let dbConfigured = true;

const GUIDE: ActivityGuide = {
  length: '2–3 分钟',
  intro: '今天我们一起爬。',
  principles: ['爬行练的是手脚配合'],
  prep: { 场地: '客厅' },
  shots: [{ name: '开场', say: '我们来爬' }],
  reactions: [{ if: '不肯爬', then: '先陪他趴着' }],
  mistakes: ['催得太急'],
  down: '先趴着玩',
  up: '爬过枕头',
  progress: ['愿意趴着', '能往前爬一步', '能爬到终点'],
  outro: '今天就到这里。',
};

function act(id: string, over: Partial<Activity> = {}): Activity {
  return {
    id,
    title: `活動 ${id}`,
    moduleNo: 1,
    targetMonth: 30,
    ageMonths: { min: 0, max: 180 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 15,
    equipment: [],
    steps: [{ imageUrl: null, instruction: '先坐下来' }],
    videoUrl: null,
    active: true,
    ...NO_ACTIVITY_CONTENT,
    ...over,
  };
}

/** A001 有腳本（三條進步）、A002 沒有腳本、A003 停用。 */
const LIBRARY: Record<string, Activity> = {
  A001: act('A001', { guide: GUIDE }),
  A002: act('A002'),
  A003: act('A003', { active: false }),
};

/** 替身的兩張表。 */
const checkinTable: Array<{ userId: number; record: Checkin }> = [];
let nextCheckinId = 1;
const prefsTable = new Map<number, PracticePrefs>();

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => dbConfigured,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
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

/** 每位家長最新的報告快照 id；NO_REPORT 還沒生成過報告。 */
vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async () => 1,
  latestFindings: async (userId: number) =>
    userId === NO_REPORT ? null : { id: 100 + userId, createdAt: '', findings: {}, prose: null, isAiGenerated: false, aiEngine: null },
}));

vi.mock('../src/db/t2Checkins', () => ({
  insertCheckin: async (userId: number, input: CheckinInsert) => {
    const id = nextCheckinId++;
    checkinTable.push({ userId, record: { id, mood: null, progress: [], createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  countCheckinsForActivity: async (userId: number, activityId: string) =>
    checkinTable.filter(r => r.userId === userId && r.record.activityId === activityId).length,
  findCheckin: async (userId: number, id: number) =>
    checkinTable.find(r => r.userId === userId && r.record.id === id)?.record ?? null,
  updateCheckin: async (userId: number, id: number, patch: CheckinPatch) => {
    const row = checkinTable.find(r => r.userId === userId && r.record.id === id);
    if (!row) return;
    if (patch.mood !== undefined) row.record.mood = patch.mood;
    if (patch.progress !== undefined) row.record.progress = patch.progress;
  },
  listCheckins: async (userId: number, from: string, to: string) =>
    checkinTable
      .filter(r => r.userId === userId && r.record.checkinDate >= from && r.record.checkinDate <= to)
      .map(r => r.record)
      .sort((a, b) => (a.checkinDate === b.checkinDate ? a.id - b.id : a.checkinDate < b.checkinDate ? -1 : 1)),
  findCheckinActivity: async (id: string) => LIBRARY[id] ?? null,
}));

vi.mock('../src/db/t2PracticePrefs', () => ({
  findPracticePrefs: async (userId: number) => prefsTable.get(userId) ?? null,
  savePracticePrefs: async (userId: number, prefs: PracticePrefs) => {
    prefsTable.set(userId, prefs);
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
  dbConfigured = true;
  checkinTable.length = 0;
  nextCheckinId = 1;
  prefsTable.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** 把伺服器的時鐘撥到某個瞬間（只換 Date，計時器照舊）。 */
function clockAt(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

function send(method: 'PATCH' | 'PUT', path: string, body: unknown, headers: Record<string, string> = {}) {
  return client.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const checkin = (activityId: string, userId = PARENT, extra: Record<string, unknown> = {}) =>
  client.postJson('/api/t2/checkins', { activityId, ...extra }, bearer(userId));

/** 上海 2026-09-23（三）20:00 ＝ 12:00Z。 */
const WED_EVENING = '2026-09-23T12:00:00.000Z';

describe('POST /api/t2/checkins', () => {
  it('打一次卡 → 201：伺服器算的日期、這一支第幾次；記下最新的報告快照與那一週的星期一', async () => {
    clockAt(WED_EVENING);
    const resp = await checkin('A001');
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body).toMatchObject({ id: 1, checkinDate: '2026-09-23', timesForActivity: 1 });
    expect(body.checkin).toMatchObject({ id: 1, activityId: 'A001', checkinDate: '2026-09-23', weekStart: '2026-09-21', mood: null, progress: [] });

    expect(checkinTable).toHaveLength(1);
    expect(checkinTable[0]).toMatchObject({
      userId: PARENT,
      record: { activityId: 'A001', findingsId: 100 + PARENT, checkinDate: '2026-09-23', weekStart: '2026-09-21' },
    });
  });

  it('同一支一天可以打好幾次，每次一筆；「第 N 次」只數自己的', async () => {
    clockAt(WED_EVENING);
    await checkin('A001', OTHER);
    await checkin('A001');
    const second = await (await checkin('A001')).json();
    expect(second.timesForActivity).toBe(2);
    expect(checkinTable.filter(r => r.userId === PARENT)).toHaveLength(2);
  });

  it('body 帶了日期與 userId 也不讀：日期是伺服器的今天，身分取自 token', async () => {
    clockAt(WED_EVENING);
    const resp = await checkin('A001', PARENT, { checkinDate: '2020-01-01', date: '2020-01-01', weekStart: '2020-01-06', userId: OTHER });
    expect(resp.status).toBe(201);
    expect((await resp.json()).checkinDate).toBe('2026-09-23');
    expect(checkinTable[0].userId).toBe(PARENT);
    expect(checkinTable[0].record.checkinDate).toBe('2026-09-23');
  });

  describe('時區邊界（Asia/Shanghai）', () => {
    it('上海週日 23:59 → 那個週日、上一週', async () => {
      clockAt('2026-09-20T15:59:00.000Z');
      const body = await (await checkin('A001')).json();
      expect(body.checkinDate).toBe('2026-09-20');
      expect(body.checkin.weekStart).toBe('2026-09-14');
    });

    it('上海週一 00:01 → 那個週一、新的一週（照 UTC 算會落回週日）', async () => {
      clockAt('2026-09-20T16:01:00.000Z');
      const body = await (await checkin('A001')).json();
      expect(body.checkinDate).toBe('2026-09-21');
      expect(body.checkin.weekStart).toBe('2026-09-21');
    });
  });

  it('還沒生成過報告 → findings_id 記 null，照樣打得了卡（片庫的活動也能練）', async () => {
    const resp = await checkin('A002', NO_REPORT);
    expect(resp.status).toBe(201);
    expect(checkinTable[0].record.findingsId).toBeNull();
  });

  it.each([
    ['活動庫沒有這一支', 'A999'],
    ['停用的活動', 'A003'],
  ])('%s → 404 ACTIVITY_NOT_FOUND，零筆', async (_label, id) => {
    const resp = await checkin(id);
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('ACTIVITY_NOT_FOUND');
    expect(checkinTable).toHaveLength(0);
  });

  it.each([
    ['沒帶', {}],
    ['不是字串', { activityId: 1 }],
    ['怪字元', { activityId: "A001' OR 1=1" }],
  ])('activityId %s → 400，零筆', async (_label, body) => {
    const resp = await client.postJson('/api/t2/checkins', body, bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('ACTIVITY_ID_INVALID');
    expect(checkinTable).toHaveLength(0);
  });
});

describe('PATCH /api/t2/checkins/:id', () => {
  async function created(activityId = 'A001', userId = PARENT): Promise<number> {
    return (await (await checkin(activityId, userId)).json()).id;
  }

  it('改心情、勾進步 → 200 回改好的那一筆；progress 由小到大存', async () => {
    const id = await created();
    const resp = await send('PATCH', `/api/t2/checkins/${id}`, { mood: 'engaged', progress: [2, 0] }, bearer(PARENT));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.checkin).toMatchObject({ id, mood: 'engaged', progress: [0, 2] });
    expect(checkinTable[0].record).toMatchObject({ mood: 'engaged', progress: [0, 2] });
  });

  it('心情可以再改、可以清掉；只帶一樣就只改那一樣', async () => {
    const id = await created();
    await send('PATCH', `/api/t2/checkins/${id}`, { mood: 'ok', progress: [1] }, bearer(PARENT));
    await send('PATCH', `/api/t2/checkins/${id}`, { mood: null }, bearer(PARENT));
    expect(checkinTable[0].record).toMatchObject({ mood: null, progress: [1] });
  });

  it('progress 越界（腳本只有三條，勾了第 4 條）→ 400 PROGRESS_OUT_OF_RANGE，沒改', async () => {
    const id = await created();
    const resp = await send('PATCH', `/api/t2/checkins/${id}`, { progress: [0, 3] }, bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('PROGRESS_OUT_OF_RANGE');
    expect(checkinTable[0].record.progress).toEqual([]);
  });

  it('沒有腳本的活動：progress 只收空陣列', async () => {
    const id = await created('A002');
    const bad = await send('PATCH', `/api/t2/checkins/${id}`, { progress: [0] }, bearer(PARENT));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('PROGRESS_OUT_OF_RANGE');
    const ok = await send('PATCH', `/api/t2/checkins/${id}`, { progress: [], mood: 'reluctant' }, bearer(PARENT));
    expect(ok.status).toBe(200);
  });

  it.each([
    ['負數', { progress: [-1] }],
    ['不是整數', { progress: [0.5] }],
    ['重複', { progress: [1, 1] }],
    ['不是陣列', { progress: '0' }],
  ])('progress %s → 400 PROGRESS_INVALID', async (_label, body) => {
    const id = await created();
    const resp = await send('PATCH', `/api/t2/checkins/${id}`, body, bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('PROGRESS_INVALID');
  });

  it('心情不是三選一 → 400 MOOD_INVALID；什麼都沒帶 → 400 CHECKIN_PATCH_EMPTY', async () => {
    const id = await created();
    const bad = await send('PATCH', `/api/t2/checkins/${id}`, { mood: 'happy' }, bearer(PARENT));
    expect((await bad.json()).code).toBe('MOOD_INVALID');
    const empty = await send('PATCH', `/api/t2/checkins/${id}`, {}, bearer(PARENT));
    expect(empty.status).toBe(400);
    expect((await empty.json()).code).toBe('CHECKIN_PATCH_EMPTY');
  });

  it('別人的打卡 → 404（不承認那個 id 存在），那一筆沒被改到', async () => {
    const id = await created('A001', OTHER);
    const resp = await send('PATCH', `/api/t2/checkins/${id}`, { mood: 'reluctant', userId: OTHER }, bearer(PARENT));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('CHECKIN_NOT_FOUND');
    expect(checkinTable[0].record.mood).toBeNull();
  });

  it.each(['abc', '0', '-1', '1.5'])('id=%s → 404', async id => {
    const resp = await send('PATCH', `/api/t2/checkins/${id}`, { mood: 'ok' }, bearer(PARENT));
    expect(resp.status).toBe(404);
  });
});

describe('GET /api/t2/checkins?from=&to=', () => {
  async function checkinOn(iso: string, activityId: string, userId = PARENT) {
    clockAt(iso);
    await checkin(activityId, userId);
    vi.useRealTimers();
  }

  it('頭尾都含、由早到晚、只回自己的', async () => {
    await checkinOn('2026-09-01T02:00:00.000Z', 'A001'); // 上海 09-01
    await checkinOn('2026-09-15T02:00:00.000Z', 'A002');
    await checkinOn('2026-09-15T03:00:00.000Z', 'A001', OTHER);
    await checkinOn('2026-09-30T15:00:00.000Z', 'A001'); // 上海 09-30 23:00
    await checkinOn('2026-09-30T16:30:00.000Z', 'A002'); // 上海 10-01 00:30

    const resp = await client.get('/api/t2/checkins?from=2026-09-01&to=2026-09-30', bearer(PARENT));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.from).toBe('2026-09-01');
    expect(body.to).toBe('2026-09-30');
    expect(body.checkins.map((c: Checkin) => [c.checkinDate, c.activityId])).toEqual([
      ['2026-09-01', 'A001'],
      ['2026-09-15', 'A002'],
      ['2026-09-30', 'A001'],
    ]);
  });

  it('頭尾含在內 62 天可以；63 天 → 400 RANGE_TOO_LONG', async () => {
    expect((await client.get('/api/t2/checkins?from=2026-08-01&to=2026-10-01', bearer(PARENT))).status).toBe(200);
    const resp = await client.get('/api/t2/checkins?from=2026-08-01&to=2026-10-02', bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('RANGE_TOO_LONG');
  });

  it.each([
    ['沒帶', ''],
    ['只帶一頭', '?from=2026-09-01'],
    ['格式不對', '?from=2026-9-1&to=2026-09-30'],
    ['不存在的日期', '?from=2026-02-30&to=2026-03-01'],
    ['顛倒', '?from=2026-09-30&to=2026-09-01'],
  ])('%s → 400 RANGE_INVALID', async (_label, query) => {
    const resp = await client.get(`/api/t2/checkins${query}`, bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('RANGE_INVALID');
  });
});

describe('提醒：/api/t2/practice-prefs', () => {
  it('還沒設 → 200 空的一份', async () => {
    const resp = await client.get('/api/t2/practice-prefs', bearer(PARENT));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ reminderDays: [], reminderTime: null });
  });

  it('存了讀得回來；星期由小到大、重複的只留一個；存在 token 的那位家長底下', async () => {
    const put = await send('PUT', '/api/t2/practice-prefs', { reminderDays: [4, 0, 2, 2], reminderTime: '19:30', userId: OTHER }, bearer(PARENT));
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ reminderDays: [0, 2, 4], reminderTime: '19:30' });
    expect(prefsTable.get(PARENT)).toEqual({ reminderDays: [0, 2, 4], reminderTime: '19:30' });
    expect(prefsTable.has(OTHER)).toBe(false);
    expect(await (await client.get('/api/t2/practice-prefs', bearer(PARENT))).json()).toEqual({ reminderDays: [0, 2, 4], reminderTime: '19:30' });
  });

  it('清掉（[] 與 null）可以', async () => {
    await send('PUT', '/api/t2/practice-prefs', { reminderDays: [1], reminderTime: '08:30' }, bearer(PARENT));
    const resp = await send('PUT', '/api/t2/practice-prefs', { reminderDays: [], reminderTime: null }, bearer(PARENT));
    expect(resp.status).toBe(200);
    expect(prefsTable.get(PARENT)).toEqual({ reminderDays: [], reminderTime: null });
  });

  it.each([
    ['時間不在四個裡', { reminderDays: [1], reminderTime: '21:00' }, 'PREFS_INVALID'],
    ['星期 7', { reminderDays: [7], reminderTime: '19:30' }, 'PREFS_INVALID'],
    ['星期不是整數', { reminderDays: ['1'], reminderTime: '19:30' }, 'PREFS_INVALID'],
    ['沒帶星期', { reminderTime: '19:30' }, 'PREFS_INVALID'],
    ['有星期沒時間', { reminderDays: [1], reminderTime: null }, 'PREFS_INCOMPLETE'],
    ['有時間沒星期', { reminderDays: [], reminderTime: '19:30' }, 'PREFS_INCOMPLETE'],
  ])('%s → 400 %s，沒存', async (_label, body, code) => {
    const resp = await send('PUT', '/api/t2/practice-prefs', body, bearer(PARENT));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe(code);
    expect(prefsTable.size).toBe(0);
  });
});

describe('GET /api/t2/practice-prefs.ics', () => {
  it('沒設提醒 → 404 REMINDER_NOT_SET', async () => {
    const resp = await client.get('/api/t2/practice-prefs.ics', bearer(PARENT));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('REMINDER_NOT_SET');
  });

  it('設了 → text/calendar 的每週重複事件，CRLF 換行，不讓中間層快取', async () => {
    clockAt(WED_EVENING);
    await send('PUT', '/api/t2/practice-prefs', { reminderDays: [0, 2, 4], reminderTime: '19:30' }, bearer(PARENT));
    const resp = await client.get('/api/t2/practice-prefs.ics', bearer(PARENT));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toMatch(/^text\/calendar; charset=utf-8/i);
    expect(resp.headers.get('content-disposition')).toMatch(/attachment; filename="[\w.-]+\.ics"/);
    expect(resp.headers.get('cache-control')).toMatch(/no-store/);
    const text = await resp.text();
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    const lines = text.replace(/\r\n /g, '').split('\r\n');
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260923T193000');
    expect(lines).toContain('SUMMARY:陪孩子做家庭活动');
  });

  it('UID 每位家長固定、兩位家長不同（重新下載是同一個事件，不會撞到別人的）', async () => {
    const uidOf = async (userId: number) => {
      await send('PUT', '/api/t2/practice-prefs', { reminderDays: [1], reminderTime: '08:30' }, bearer(userId));
      const text = await (await client.get('/api/t2/practice-prefs.ics', bearer(userId))).text();
      return /\r\nUID:([^\r]+)\r\n/.exec(text)?.[1];
    };
    const first = await uidOf(PARENT);
    expect(first).toBeTruthy();
    expect(await uidOf(PARENT)).toBe(first);
    expect(await uidOf(OTHER)).not.toBe(first);
  });
});

describe('付費閘門與登入', () => {
  const cases: Array<[string, (h?: Record<string, string>) => Promise<Response>]> = [
    ['POST /api/t2/checkins', h => client.postJson('/api/t2/checkins', { activityId: 'A001' }, h)],
    ['PATCH /api/t2/checkins/1', h => send('PATCH', '/api/t2/checkins/1', { mood: 'ok' }, h)],
    ['GET /api/t2/checkins', h => client.get('/api/t2/checkins?from=2026-09-01&to=2026-09-30', h)],
    ['GET /api/t2/practice-prefs', h => client.get('/api/t2/practice-prefs', h)],
    ['PUT /api/t2/practice-prefs', h => send('PUT', '/api/t2/practice-prefs', { reminderDays: [1], reminderTime: '08:30' }, h)],
    ['GET /api/t2/practice-prefs.ics', h => client.get('/api/t2/practice-prefs.ics', h)],
  ];

  it.each(cases)('%s：未付費 → 403 LOCKED，一筆都沒寫', async (_label, call) => {
    const resp = await call(bearer(LOCKED));
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
    expect(checkinTable).toHaveLength(0);
    expect(prefsTable.size).toBe(0);
  });

  it.each(cases)('%s：未登入 → 401', async (_label, call) => {
    const resp = await call();
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });
});

describe('記憶體模式（沒有資料庫）', () => {
  beforeEach(() => {
    dbConfigured = false;
  });

  it('活動庫是空的 → 打不了卡（404），替身的表一筆都沒碰到', async () => {
    const resp = await checkin('A001');
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('ACTIVITY_NOT_FOUND');
    expect(checkinTable).toHaveLength(0);
  });

  it('查打卡 → 空的清單', async () => {
    const body = await (await client.get('/api/t2/checkins?from=2026-09-01&to=2026-09-30', bearer(PARENT))).json();
    expect(body.checkins).toEqual([]);
  });

  it('提醒存在記憶體裡：讀得回來、.ics 產得出來、替身的表沒被碰到；兩位家長分開', async () => {
    await send('PUT', '/api/t2/practice-prefs', { reminderDays: [6], reminderTime: '20:30' }, bearer(PARENT));
    expect(await (await client.get('/api/t2/practice-prefs', bearer(PARENT))).json()).toEqual({ reminderDays: [6], reminderTime: '20:30' });
    expect(await (await client.get('/api/t2/practice-prefs', bearer(OTHER))).json()).toEqual({ reminderDays: [], reminderTime: null });
    expect((await client.get('/api/t2/practice-prefs.ics', bearer(PARENT))).status).toBe(200);
    expect(prefsTable.size).toBe(0);
  });
});

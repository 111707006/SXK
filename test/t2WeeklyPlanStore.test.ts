import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { StoredWeeklyActivities } from '../src/db/t2WeeklyPlans';

/**
 * `t2_weekly_plans` 的資料層（#60）。
 *
 * 寫法比照 `t2FindingsStore.test.ts`：假的連線池，驗的是「送出去的 SQL 長什麼樣、回來的列
 * 怎麼變成紀錄」，不是 MySQL。
 *
 * 【這裡在防什麼】
 * 1. 三支語句都帶 `user_id`；「前幾週」是**嚴格小於**這一週（這一週自己不算「派過」）。
 * 2. **壞掉的 `activities` 回空的一份，不是 null**：`null` 會讓端點以為「這一週還沒算」而
 *    重算一份寫進去，而唯一索引擋下那次寫入 —— 家長於是每次重整都拿到 500。
 * 2b. **`reason` 驗到底**：畫面上那句「因為……所以練……」是它的四個欄位直接展開的，少一個
 *    欄位會在渲染時丟 TypeError，而 React 渲染丟出例外是整頁空白，不是少一支活動。
 * 3. `week_start` 是 DATE：mysql2 回 Date 或字串，兩種都要讀成 `YYYY-MM-DD`，而且不能經過
 *    UTC 轉換（本地午夜的 Date 轉 UTC 會退一天）。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];
let insertId = 300;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^INSERT/i.test(sql)) return [{ insertId: insertId++ }];
      return [rows];
    },
  }),
}));

let store: typeof import('../src/db/t2WeeklyPlans');

beforeAll(async () => {
  store = await import('../src/db/t2WeeklyPlans');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

const ACTIVITIES: StoredWeeklyActivities = {
  picks: [
    {
      id: 'A017',
      dimension: 'LANG',
      reason: { band: 'refer', window: { lo: 24, hi: 36 }, matchedTags: ['lang.expression'], belowWindow: false },
    },
  ],
  preparing: ['SEN'],
};

function row(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    findings_id: 77,
    week_start: '2026-09-07',
    activities: JSON.stringify(ACTIVITIES),
    created_at: '2026-09-07 09:00:00',
    ...over,
  };
}

describe('insertWeeklyPlan', () => {
  it('INSERT 帶 user_id 與 findings_id，activities 序列化後送', async () => {
    const id = await store.insertWeeklyPlan(7, { weekStart: '2026-09-07', findingsId: 77, activities: ACTIVITIES });
    expect(id).toBe(300);
    const { sql, params } = executed[0];
    expect(sql).toMatch(/^INSERT INTO t2_weekly_plans \(user_id, findings_id, week_start, activities\) VALUES \(\?, \?, \?, \?\)$/);
    expect(params.slice(0, 3)).toEqual([7, 77, '2026-09-07']);
    expect(JSON.parse(params[3] as string)).toEqual(ACTIVITIES);
  });
});

describe('findWeeklyPlan', () => {
  it('WHERE 是 user_id ＋ week_start', async () => {
    rows = [row()];
    const record = await store.findWeeklyPlan(7, '2026-09-07');
    expect(executed[0].sql).toMatch(/WHERE user_id = \? AND week_start = \? LIMIT 1$/);
    expect(executed[0].params).toEqual([7, '2026-09-07']);
    expect(record).toEqual({
      id: 5,
      weekStart: '2026-09-07',
      findingsId: 77,
      activities: ACTIVITIES,
      createdAt: new Date('2026-09-07 09:00:00').toISOString(),
    });
  });

  it('那一週沒有 → null', async () => {
    rows = [];
    expect(await store.findWeeklyPlan(7, '2026-09-07')).toBeNull();
  });

  it('week_start 是本地午夜的 Date 也讀成同一天（不經 UTC 退一天）', async () => {
    rows = [row({ week_start: new Date(2026, 8, 7) })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.weekStart).toBe('2026-09-07');
  });

  it('created_at 讀不成時間 → null（不編一個日期）', async () => {
    rows = [row({ created_at: '不是時間' })];
    const record = await store.findWeeklyPlan(7, '2026-09-07');
    expect(record!.createdAt).toBeNull();
    // 這一欄讀不出來不影響這一週的活動
    expect(record!.activities).toEqual(ACTIVITIES);
  });

  it('mysql2 已經解析成物件時照收', async () => {
    rows = [row({ activities: ACTIVITIES })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities).toEqual(ACTIVITIES);
  });

  it.each([
    ['不是 JSON', '{not json'],
    ['是別的東西', JSON.stringify({ hello: 'world' })],
    ['picks 不是陣列', JSON.stringify({ picks: 'A017', preparing: [] })],
  ])('activities %s → 空的一份，不是 null', async (_label, activities) => {
    rows = [row({ activities })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities).toEqual({ picks: [], preparing: [] });
  });

  it('壞掉的那一支丟掉、其餘照讀；認不得的維度碼也丟掉', async () => {
    const good = { ...ACTIVITIES.picks[0], id: 'A020', dimension: 'ATT' };
    rows = [row({
      activities: JSON.stringify({
        picks: [
          ACTIVITIES.picks[0],
          { id: 'A018' },                                   // 少 dimension 與 reason
          { id: 'A019', dimension: 'NOPE', reason: ACTIVITIES.picks[0].reason }, // 維度認不得
          good,
        ],
        preparing: ['SEN', 'NOPE'],
      }),
    })];
    const record = await store.findWeeklyPlan(7, '2026-09-07');
    expect(record!.activities.picks.map(p => p.id)).toEqual(['A017', 'A020']);
    expect(record!.activities.preparing).toEqual(['SEN']);
  });

  /**
   * `reason` 少一個欄位的那一支要**丟掉**，不是留著讓畫面在渲染時丟 TypeError。
   * `src/t2/weeklyCopy.ts` 的 `reasonSentence` 直接讀 `band` 與 `matchedTags[0]`。
   */
  it.each([
    ['reason 是空物件', {}],
    ['少 band', { window: { lo: 24, hi: 36 }, matchedTags: [], belowWindow: false }],
    ['band 認不得', { band: 'nope', window: { lo: 24, hi: 36 }, matchedTags: [], belowWindow: false }],
    ['少 matchedTags', { band: 'watch', window: { lo: 24, hi: 36 }, belowWindow: false }],
    ['matchedTags 不是字串陣列', { band: 'watch', window: { lo: 24, hi: 36 }, matchedTags: [7], belowWindow: false }],
    ['window 缺一邊', { band: 'watch', window: { lo: 24 }, matchedTags: [], belowWindow: false }],
    ['belowWindow 不是布林', { band: 'watch', window: { lo: 24, hi: 36 }, matchedTags: [], belowWindow: 'no' }],
  ])('%s → 那一支丟掉', async (_label, reason) => {
    rows = [row({
      activities: JSON.stringify({ picks: [ACTIVITIES.picks[0], { id: 'A099', dimension: 'ATT', reason }], preparing: [] }),
    })];
    const record = await store.findWeeklyPlan(7, '2026-09-07');
    expect(record!.activities.picks.map(p => p.id)).toEqual(['A017']);
  });
});

/**
 * 換著玩（Keep 規格 K08）與四支存在同一筆 JSON。**舊的週次沒有這一欄**（K08 之前存的）——
 * 讀回來就是沒有 `alternates`，端點據此不出「換著玩」；不能當成壞資料把整份清空，也不能補一個空物件
 *（那會讓舊週次與「新週次、沒有可換的」分不開，而舊週次是不回頭重配的）。
 */
describe('alternates（換著玩）', () => {
  const WITH_ALTERNATES: StoredWeeklyActivities = { ...ACTIVITIES, alternates: { LANG: ['A018', 'A019'], ATT: ['A121'] } };

  it('存進去的原樣讀回來', async () => {
    rows = [row({ activities: JSON.stringify(WITH_ALTERNATES) })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities).toEqual(WITH_ALTERNATES);
  });

  it('舊的週次沒有這一欄 → 讀回來也沒有（不是空物件），四支照讀', async () => {
    rows = [row()];
    const activities = (await store.findWeeklyPlan(7, '2026-09-07'))!.activities;
    expect(activities).not.toHaveProperty('alternates');
    expect(activities.picks.map(p => p.id)).toEqual(['A017']);
  });

  it.each([
    ['是陣列', ['A018']],
    ['是字串', 'A018'],
    ['是 null', null],
  ])('alternates %s → 當成沒有這一欄，四支照讀', async (_label, alternates) => {
    rows = [row({ activities: JSON.stringify({ ...ACTIVITIES, alternates }) })];
    const activities = (await store.findWeeklyPlan(7, '2026-09-07'))!.activities;
    expect(activities).not.toHaveProperty('alternates');
    expect(activities.picks.map(p => p.id)).toEqual(['A017']);
  });

  it('認不得的維度碼、不是字串的編號丟掉；丟完是空的那個維度整個不留', async () => {
    rows = [row({
      activities: JSON.stringify({
        ...ACTIVITIES,
        alternates: { LANG: ['A018', 7, '', 'A019'], NOPE: ['A020'], ATT: [null], SOC: 'A230', SEN: [] },
      }),
    })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities.alternates).toEqual({ LANG: ['A018', 'A019'] });
  });

  it('每一個維度都沒有可換的 → 空物件（新週次），與舊週次的「沒有這一欄」分得開', async () => {
    rows = [row({ activities: JSON.stringify({ ...ACTIVITIES, alternates: {} }) })];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities.alternates).toEqual({});
  });
});

/**
 * 計劃的第 1 週（Keep 規格 §4.5）：同一份報告快照在這張表裡最早的 `week_start`。
 * 帶 `user_id`：`findings_id` 本來就只屬於一位家長，但每一支語句都帶 `user_id` 是這張表的規矩。
 */
describe('firstWeekStartOfFindings', () => {
  it('MIN(week_start)，WHERE 是 user_id ＋ findings_id', async () => {
    rows = [{ first_week: '2026-08-31' }];
    expect(await store.firstWeekStartOfFindings(7, 77)).toBe('2026-08-31');
    expect(executed[0].sql).toMatch(/^SELECT MIN\(week_start\) AS first_week FROM t2_weekly_plans WHERE user_id = \? AND findings_id = \?$/);
    expect(executed[0].params).toEqual([7, 77]);
  });

  it('本地午夜的 Date 也讀成同一天（不經 UTC 退一天）', async () => {
    rows = [{ first_week: new Date(2026, 7, 31) }];
    expect(await store.firstWeekStartOfFindings(7, 77)).toBe('2026-08-31');
  });

  it('這份快照一週都還沒有 → null', async () => {
    rows = [{ first_week: null }];
    expect(await store.firstWeekStartOfFindings(7, 77)).toBeNull();
    rows = [];
    expect(await store.firstWeekStartOfFindings(7, 77)).toBeNull();
  });
});

describe('recentWeeklyPlans', () => {
  it('嚴格小於這一週，新的在前，取 N 筆', async () => {
    rows = [row({ id: 4, week_start: '2026-08-31' }), row({ id: 3, week_start: '2026-08-24' })];
    const list = await store.recentWeeklyPlans(7, '2026-09-07', 4);
    expect(executed[0].sql).toMatch(/WHERE user_id = \? AND week_start < \? ORDER BY week_start DESC LIMIT 4$/);
    expect(executed[0].params).toEqual([7, '2026-09-07']);
    expect(list.map(p => p.weekStart)).toEqual(['2026-08-31', '2026-08-24']);
  });

  it('limit 是整數內插的，擋掉不是數字的東西', async () => {
    await store.recentWeeklyPlans(7, '2026-09-07', 2.9);
    expect(executed[0].sql).toMatch(/LIMIT 2$/);
    executed.length = 0;
    await store.recentWeeklyPlans(7, '2026-09-07', -1);
    expect(executed[0].sql).toMatch(/LIMIT 0$/);
  });
});

describe('push（v3 推送規則多記的那一塊）', () => {
  const PUSH = { periodNo: 1, week: 3, color: 'red', source: 't1', module: 8, window: [24, 28], variant: 'easy', relaxed: false };

  it('存什麼讀什麼；舊週次沒有就沒有', async () => {
    rows = [row({ activities: JSON.stringify({ ...ACTIVITIES, picks: [{ ...ACTIVITIES.picks[0], push: PUSH }] }) })];
    const got = await store.findWeeklyPlan(7, '2026-09-07');
    expect(got!.activities.picks[0].push).toEqual(PUSH);
    rows = [row()];
    expect((await store.findWeeklyPlan(7, '2026-09-07'))!.activities.picks[0]).not.toHaveProperty('push');
  });

  it('push 壞了只丟那一塊，那一支照舊形狀留著', async () => {
    rows = [row({ activities: JSON.stringify({ ...ACTIVITIES, picks: [{ ...ACTIVITIES.picks[0], push: { ...PUSH, color: 'blue' } }] }) })];
    const got = await store.findWeeklyPlan(7, '2026-09-07');
    expect(got!.activities.picks).toHaveLength(1);
    expect(got!.activities.picks[0]).not.toHaveProperty('push');
  });
});

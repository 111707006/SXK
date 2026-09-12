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

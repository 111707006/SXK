import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * `t2_checkins`、`t2_practice_prefs` 的資料層（Keep 規格 K06、K07）。
 *
 * 寫法比照 `t2WeeklyPlanStore.test.ts`：假的連線池，驗的是「送出去的 SQL 長什麼樣、回來的列
 * 怎麼變成紀錄」，不是 MySQL。
 *
 * 【這裡在防什麼】
 * 1. **每一句都帶 `user_id`**，而且讀、改都是 `id = ? AND user_id = ?` —— 「只能動自己的」
 *    最後一道在 SQL 上，不靠端點記得先查一次。
 * 2. `checkin_date`、`week_start` 是 DATE：mysql2 回本地午夜的 Date 或字串，兩種都讀成
 *    `YYYY-MM-DD`，不經 UTC（本地午夜轉 UTC 會退一天，打卡就落到前一天）。
 * 3. 壞掉的 `progress`、認不得的 `mood` 讀成「沒有」，不讓一筆壞資料弄壞整個日曆。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];
let insertId = 900;
let affectedRows = 1;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: insertId++, affectedRows: 1 }];
      if (/^\s*UPDATE/i.test(sql)) return [{ affectedRows }];
      return [rows];
    },
  }),
}));

let checkins: typeof import('../src/db/t2Checkins');
let prefs: typeof import('../src/db/t2PracticePrefs');

beforeAll(async () => {
  checkins = await import('../src/db/t2Checkins');
  prefs = await import('../src/db/t2PracticePrefs');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
  affectedRows = 1;
});

function row(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    user_id: 7,
    activity_id: 'A001',
    findings_id: 77,
    checkin_date: '2026-09-21',
    week_start: '2026-09-21',
    mood: 'ok',
    progress: '[0,2]',
    created_at: '2026-09-21 20:00:00',
    ...over,
  };
}

describe('insertCheckin', () => {
  it('INSERT 帶 user_id、活動、快照、伺服器算的日期；progress 從空陣列開始、心情留空', async () => {
    const id = await checkins.insertCheckin(7, {
      activityId: 'A001',
      findingsId: 77,
      checkinDate: '2026-09-21',
      weekStart: '2026-09-21',
    });
    expect(id).toBe(900);
    const { sql, params } = executed[0];
    expect(sql).toBe(
      'INSERT INTO t2_checkins (user_id, activity_id, findings_id, checkin_date, week_start, progress) VALUES (?, ?, ?, ?, ?, ?)',
    );
    expect(params).toEqual([7, 'A001', 77, '2026-09-21', '2026-09-21', '[]']);
  });

  it('還沒生成過報告 → findings_id 是 NULL', async () => {
    await checkins.insertCheckin(7, { activityId: 'A001', findingsId: null, checkinDate: '2026-09-21', weekStart: '2026-09-21' });
    expect(executed[0].params[2]).toBeNull();
  });
});

describe('countCheckinsForActivity', () => {
  it('只數這位家長、這一支', async () => {
    rows = [{ n: 3 }];
    expect(await checkins.countCheckinsForActivity(7, 'A001')).toBe(3);
    expect(executed[0].sql).toBe('SELECT COUNT(*) AS n FROM t2_checkins WHERE user_id = ? AND activity_id = ?');
    expect(executed[0].params).toEqual([7, 'A001']);
  });
});

describe('findCheckin', () => {
  it('WHERE 是 id ＋ user_id：別人的那一筆查不到', async () => {
    rows = [row()];
    const record = await checkins.findCheckin(7, 12);
    expect(executed[0].sql).toMatch(/FROM t2_checkins WHERE id = \? AND user_id = \? LIMIT 1$/);
    expect(executed[0].params).toEqual([12, 7]);
    expect(record).toEqual({
      id: 12,
      activityId: 'A001',
      findingsId: 77,
      checkinDate: '2026-09-21',
      weekStart: '2026-09-21',
      mood: 'ok',
      progress: [0, 2],
      createdAt: new Date('2026-09-21 20:00:00').toISOString(),
    });
  });

  it('沒有 → null', async () => {
    expect(await checkins.findCheckin(7, 12)).toBeNull();
  });

  it('DATE 欄位是本地午夜的 Date 也讀成同一天（不經 UTC 退一天）', async () => {
    rows = [row({ checkin_date: new Date(2026, 8, 21), week_start: new Date(2026, 8, 21) })];
    const record = await checkins.findCheckin(7, 12);
    expect(record!.checkinDate).toBe('2026-09-21');
    expect(record!.weekStart).toBe('2026-09-21');
  });

  it('mysql2 已經把 progress 解析成陣列時照收', async () => {
    rows = [row({ progress: [1] })];
    expect((await checkins.findCheckin(7, 12))!.progress).toEqual([1]);
  });

  it.each([
    ['不是 JSON', '{nope'],
    ['不是陣列', '{"a":1}'],
    ['混了不是整數的東西', '[0,"1"]'],
    ['負數', '[-1]'],
  ])('progress %s → 空陣列', async (_label, progress) => {
    rows = [row({ progress })];
    expect((await checkins.findCheckin(7, 12))!.progress).toEqual([]);
  });

  it('認不得的心情、NULL 的心情、NULL 的快照 → null', async () => {
    rows = [row({ mood: 'happy', findings_id: null })];
    const record = await checkins.findCheckin(7, 12);
    expect(record!.mood).toBeNull();
    expect(record!.findingsId).toBeNull();
    rows = [row({ mood: null })];
    expect((await checkins.findCheckin(7, 12))!.mood).toBeNull();
  });
});

describe('updateCheckin', () => {
  it('只帶心情 → 只改心情；WHERE 是 id ＋ user_id', async () => {
    await checkins.updateCheckin(7, 12, { mood: 'engaged' });
    expect(executed[0].sql).toBe('UPDATE t2_checkins SET mood = ? WHERE id = ? AND user_id = ?');
    expect(executed[0].params).toEqual(['engaged', 12, 7]);
  });

  it('兩樣都帶 → 兩樣都改；progress 序列化後送', async () => {
    await checkins.updateCheckin(7, 12, { mood: null, progress: [0, 1] });
    expect(executed[0].sql).toBe('UPDATE t2_checkins SET mood = ?, progress = ? WHERE id = ? AND user_id = ?');
    expect(executed[0].params).toEqual([null, '[0,1]', 12, 7]);
  });

  it('沒有要改的 → 不送 SQL', async () => {
    await checkins.updateCheckin(7, 12, {});
    expect(executed).toHaveLength(0);
  });
});

describe('listCheckins', () => {
  it('這位家長、頭尾都含的日期區間，由早到晚', async () => {
    rows = [row({ id: 1, checkin_date: '2026-09-20' }), row({ id: 2 })];
    const list = await checkins.listCheckins(7, '2026-09-01', '2026-09-30');
    expect(executed[0].sql).toMatch(
      /FROM t2_checkins WHERE user_id = \? AND checkin_date >= \? AND checkin_date <= \? ORDER BY checkin_date ASC, id ASC$/,
    );
    expect(executed[0].params).toEqual([7, '2026-09-01', '2026-09-30']);
    expect(list.map(c => c.id)).toEqual([1, 2]);
  });
});

describe('findCheckinActivity', () => {
  it('照編號查一支（含停用的，停不停用由端點判斷），讀成 Activity', async () => {
    rows = [{ id: 'A001', title: '爬行', module_no: 1, age_min_month: 6, age_max_month: 36, active: 0, guide: null }];
    const activity = await checkins.findCheckinActivity('A001');
    expect(executed[0].sql).toBe('SELECT * FROM activities WHERE id = ? LIMIT 1');
    expect(executed[0].params).toEqual(['A001']);
    expect(activity).toMatchObject({ id: 'A001', title: '爬行', active: false, guide: null });
  });

  it('沒有這一支 → null', async () => {
    expect(await checkins.findCheckinActivity('A999')).toBeNull();
  });
});

describe('practice prefs', () => {
  it('讀：WHERE user_id；星期由小到大、認不得的丟掉；時間認不得就是整份沒設', async () => {
    rows = [{ reminder_days: '[4,0,2,9,"x"]', reminder_time: '19:30' }];
    expect(await prefs.findPracticePrefs(7)).toEqual({ reminderDays: [0, 2, 4], reminderTime: '19:30' });
    expect(executed[0].sql).toBe('SELECT reminder_days, reminder_time FROM t2_practice_prefs WHERE user_id = ? LIMIT 1');
    expect(executed[0].params).toEqual([7]);

    // 兩樣要嘛都有、要嘛都沒有：缺一樣就是還沒設，不端出半套
    rows = [{ reminder_days: [1], reminder_time: '21:00' }];
    expect(await prefs.findPracticePrefs(7)).toEqual({ reminderDays: [], reminderTime: null });
    rows = [{ reminder_days: '[9]', reminder_time: '19:30' }];
    expect(await prefs.findPracticePrefs(7)).toEqual({ reminderDays: [], reminderTime: null });
  });

  it('沒有那一列 → null', async () => {
    expect(await prefs.findPracticePrefs(7)).toBeNull();
  });

  it('存：一位家長一列，有就覆蓋', async () => {
    await prefs.savePracticePrefs(7, { reminderDays: [0, 2, 4], reminderTime: '19:30' });
    expect(executed[0].sql).toBe(
      'INSERT INTO t2_practice_prefs (user_id, reminder_days, reminder_time) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE reminder_days = VALUES(reminder_days), reminder_time = VALUES(reminder_time)',
    );
    expect(executed[0].params).toEqual([7, '[0,2,4]', '19:30']);
  });
});

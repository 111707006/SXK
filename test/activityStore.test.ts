import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { activityFromRow } from '../src/db/activities';

/**
 * 活動庫的資料層（#44）：列 → 活動的轉換，與後台的兩支讀取。
 *
 * 【為什麼需要這些】
 * `activities` 有六個 JSON 欄位。壞掉一個不該讓整份活動庫讀不出來（與素材庫同一條
 * 規則），但也不能把壞掉的東西原樣端出去：`targets` 裡混進一個不在受控詞彙裡的字，
 * 配對會拿它去對孩子的標籤，永遠對不上，而畫面上沒有任何一處看得出來。
 *
 * 讀取那兩支用假的連線池：這裡要驗的是「送出去的 SQL 長什麼樣、回來的列怎麼變成
 * 活動」，不是 MySQL。
 */

const ROW = {
  id: 'A017',
  title: '跟着音乐动',
  module_no: 1,
  target_month: null,
  age_min_month: 12,
  age_max_month: 96,
  dimensions: '["MOT"]',
  targets: '[]',
  avoid_if: '[]',
  duration_min: 0,
  equipment: '[]',
  steps: '[]',
  video_url: null,
  active: 1,
};

describe('activityFromRow', () => {
  it('種子那一列讀成 §7.1 的形狀', () => {
    expect(activityFromRow(ROW)).toEqual({
      id: 'A017',
      title: '跟着音乐动',
      moduleNo: 1,
      targetMonth: null,
      ageMonths: { min: 12, max: 96 },
      dimensions: ['MOT'],
      targets: [],
      avoidIf: [],
      durationMin: 0,
      equipment: [],
      steps: [],
      videoUrl: null,
      active: true,
    });
  });

  it('內容團隊填過的一列：targetMonth 是數字、標籤與步驟都讀得回來', () => {
    const a = activityFromRow({
      ...ROW,
      target_month: 30,
      targets: '["lang.expression","lang.vocabulary_size"]',
      avoid_if: '["sen.threshold_low"]',
      duration_min: 10,
      equipment: '["积木","小球"]',
      steps: '[{"imageUrl":"/steps/a17-1.png","instruction":"放一首歌。"}]',
      video_url: 'https://example.com/a17',
      active: 0,
    });
    expect(a.targetMonth).toBe(30);
    expect(a.targets).toEqual(['lang.expression', 'lang.vocabulary_size']);
    expect(a.avoidIf).toEqual(['sen.threshold_low']);
    expect(a.durationMin).toBe(10);
    expect(a.equipment).toEqual(['积木', '小球']);
    expect(a.steps).toEqual([{ imageUrl: '/steps/a17-1.png', instruction: '放一首歌。' }]);
    expect(a.videoUrl).toBe('https://example.com/a17');
    expect(a.active).toBe(false);
  });

  it('mysql2 已經把 JSON 欄位解析成陣列時，照樣讀得出來', () => {
    const a = activityFromRow({
      ...ROW,
      dimensions: ['MOT', 'ADL'],
      targets: ['mot.balance'],
      steps: [{ imageUrl: '/x.png', instruction: '站好。' }],
    });
    expect(a.dimensions).toEqual(['MOT', 'ADL']);
    expect(a.targets).toEqual(['mot.balance']);
    expect(a.steps).toHaveLength(1);
  });

  it('壞掉的 JSON 退回空陣列，不拋例外 —— 一支存壞不該讓整個活動庫讀不出來', () => {
    const a = activityFromRow({ ...ROW, dimensions: '{not json', targets: 'null', steps: '"x"' });
    expect(a.dimensions).toEqual([]);
    expect(a.targets).toEqual([]);
    expect(a.steps).toEqual([]);
  });

  it('targets 只留 ★ 標籤：只進報告的標籤與不認得的字都被丟掉', () => {
    // emo.slow_to_warm 是只進報告的（§5.5），不能拿來配活動
    const a = activityFromRow({
      ...ROW,
      targets: '["lang.expression","emo.slow_to_warm","lang.expresion","lang.expression"]',
    });
    expect(a.targets).toEqual(['lang.expression']);
  });

  it('avoidIf 認全部的發現標籤（含只進報告的），不認得的字丟掉', () => {
    const a = activityFromRow({ ...ROW, avoid_if: '["emo.slow_to_warm","emo.regulation","nope"]' });
    expect(a.avoidIf).toEqual(['emo.slow_to_warm', 'emo.regulation']);
  });

  it('dimensions 只留九碼', () => {
    const a = activityFromRow({ ...ROW, dimensions: '["MOT","gross_motor","XYZ","SEN"]' });
    expect(a.dimensions).toEqual(['MOT', 'SEN']);
  });

  it('步驟全有或全無：混進一則讀不成步驟的，整份退成空', () => {
    const a = activityFromRow({
      ...ROW,
      steps: '[{"imageUrl":"/1.png","instruction":"一"},{"imageUrl":"","instruction":"二"}]',
    });
    expect(a.steps).toEqual([]);
  });
});

// ── 後台的兩支讀取 ──

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [rows];
    },
  }),
}));

let store: typeof import('../src/admin/adminStore');

beforeAll(async () => {
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

describe('adminStore.listActivities', () => {
  it('讀整張表、依編號排序、含已停用的，每一列都經過 activityFromRow', async () => {
    rows = [{ ...ROW }, { ...ROW, id: 'A018', title: '爬楼梯练腿', active: 0 }];
    const list = await store.listActivities();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toBe('SELECT * FROM activities ORDER BY id ASC');
    expect(executed[0].sql).not.toMatch(/WHERE/i); // 已停用的也要
    expect(list.map(a => a.id)).toEqual(['A017', 'A018']);
    expect(list[1].active).toBe(false);
    expect(list[0]).toEqual(activityFromRow(ROW));
  });

  it('空表回空陣列，不是 null', async () => {
    expect(await store.listActivities()).toEqual([]);
  });
});

describe('adminStore.findActivityById', () => {
  it('用 id 找一支，參數化不拼字串', async () => {
    rows = [{ ...ROW }];
    const a = await store.findActivityById('A017');
    expect(executed[0].sql).toBe('SELECT * FROM activities WHERE id = ? LIMIT 1');
    expect(executed[0].params).toEqual(['A017']);
    expect(a?.title).toBe('跟着音乐动');
  });

  it('找不到回 null', async () => {
    expect(await store.findActivityById('A999')).toBeNull();
  });
});

describe('adminStore.updateActivity（#62）', () => {
  it('只改帶進來的欄位：一句 UPDATE 只 SET 那幾欄，JSON 欄位序列化，再讀回整支', async () => {
    rows = [{ ...ROW, target_month: 30, targets: '["lang.expression"]' }];
    const a = await store.updateActivity('A017', { targetMonth: 30, targets: ['lang.expression'] });
    expect(executed).toHaveLength(2);
    expect(executed[0].sql).toBe('UPDATE activities SET target_month = ?, targets = ? WHERE id = ?');
    expect(executed[0].params).toEqual([30, '["lang.expression"]', 'A017']);
    expect(executed[1].sql).toBe('SELECT * FROM activities WHERE id = ? LIMIT 1');
    expect(a?.targetMonth).toBe(30);
    expect(a?.targets).toEqual(['lang.expression']);
  });

  it('每個可填的欄位都對得到一個欄位名；布林存成 0/1、null 存成 NULL', async () => {
    rows = [{ ...ROW }];
    await store.updateActivity('A017', {
      title: '新标题',
      targetMonth: null,
      dimensions: ['MOT', 'ADL'],
      targets: [],
      avoidIf: ['sen.threshold_low'],
      durationMin: 10,
      equipment: ['积木'],
      steps: [{ imageUrl: '/1.png', instruction: '一' }],
      videoUrl: 'https://v.example.com/x',
      active: false,
    });
    expect(executed[0].sql).toBe(
      'UPDATE activities SET title = ?, target_month = ?, dimensions = ?, targets = ?, avoid_if = ?, '
        + 'duration_min = ?, equipment = ?, steps = ?, video_url = ?, active = ? WHERE id = ?'
    );
    expect(executed[0].params).toEqual([
      '新标题', null, '["MOT","ADL"]', '[]', '["sen.threshold_low"]', 10, '["积木"]',
      '[{"imageUrl":"/1.png","instruction":"一"}]', 'https://v.example.com/x', 0, 'A017',
    ]);
  });

  it('找不到這支回 null；不存在的 id 一列都改不到，無害', async () => {
    rows = [];
    expect(await store.updateActivity('A999', { active: false })).toBeNull();
  });

  // 空 patch 不該走到這裡（路由層先擋），真的來了也不下一句壞掉的 SQL。
  it('空 patch 不下 UPDATE，只讀回現況', async () => {
    rows = [{ ...ROW }];
    const a = await store.updateActivity('A017', {});
    expect(executed.map(e => e.sql.split(' ')[0])).toEqual(['SELECT']);
    expect(a?.id).toBe('A017');
  });

  it('活動庫的 SQL 一句都不帶公司條件 —— 活動是森心康的內容，不屬於任何一家合作公司', async () => {
    rows = [{ ...ROW }];
    await store.listActivities();
    await store.updateActivity('A017', { active: true });
    for (const { sql } of executed) expect(sql).not.toMatch(/company/i);
  });
});

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

/** 2026-09-23 的遷移填進去之後的那幾欄（Keep 規格 §4.1）。 */
const GUIDE = {
  length: '2–3 分钟',
  intro: '今天这个活动叫「跟着音乐动」。',
  principles: ['一', '二'],
  prep: { 器材: '手机放一首有节奏的歌', 场地: '客厅' },
  shots: [{ name: '放音乐', say: '我们来跳舞！' }],
  reactions: [{ if: '孩子不想动', then: '大人先跳。' }],
  mistakes: ['音乐太大声'],
  down: '只拍手',
  up: '加上停格',
  progress: ['能跟上节拍'],
  outro: '每天动一动。',
};

const CONTENT_ROW = {
  ...ROW,
  age_label: '1–8岁',
  people: '亲子或全家',
  need: '手机放一首有节奏的歌',
  trains: '跟着节奏动，练协调。',
  steps: '[{"imageUrl":null,"instruction":"放一首歌。"},{"imageUrl":"/s/a17-2.png","instruction":"一起动。"}]',
  easier: '只拍手',
  harder: '音乐停就定住',
  tip: '选孩子喜欢的歌。',
  deeper: '物理治疗册 模组九（跑步与变向）',
  guide: JSON.stringify(GUIDE),
  poster_url: '/media/activities/A017.jpg',
  video_seconds: 10,
};

describe('activityFromRow', () => {
  it('種子那一列讀成 §7.1 的形狀；還沒有內容欄位的列（遷移前）讀成「沒有」，不是 undefined', () => {
    expect(activityFromRow(ROW)).toEqual({
      id: 'A017',
      title: '跟着音乐动',
      moduleNo: 1,
      targetMonth: null,
      ageMonths: { min: 12, max: 96 },
      ageLabel: '',
      people: '',
      dimensions: ['MOT'],
      targets: [],
      avoidIf: [],
      durationMin: 0,
      equipment: [],
      need: '',
      trains: '',
      steps: [],
      easier: '',
      harder: '',
      tip: '',
      deeper: '',
      guide: null,
      videoUrl: null,
      posterUrl: null,
      videoSeconds: null,
      active: true,
    });
  });

  it('遷移填過內容的一列：手冊原文、腳本、封面與片長都讀得回來', () => {
    const a = activityFromRow(CONTENT_ROW);
    expect(a).toMatchObject({
      ageLabel: '1–8岁',
      people: '亲子或全家',
      need: '手机放一首有节奏的歌',
      trains: '跟着节奏动，练协调。',
      easier: '只拍手',
      harder: '音乐停就定住',
      tip: '选孩子喜欢的歌。',
      deeper: '物理治疗册 模组九（跑步与变向）',
      posterUrl: '/media/activities/A017.jpg',
      videoSeconds: 10,
    });
    expect(a.steps).toEqual([
      { imageUrl: null, instruction: '放一首歌。' },
      { imageUrl: '/s/a17-2.png', instruction: '一起动。' },
    ]);
    expect(a.guide?.shots).toEqual([{ name: '放音乐', say: '我们来跳舞！' }]);
  });

  it('資料庫的 NULL 與後台清掉的空字串，讀出來都是空字串', () => {
    const a = activityFromRow({ ...CONTENT_ROW, tip: null, easier: '', people: undefined });
    expect(a.tip).toBe('');
    expect(a.easier).toBe('');
    expect(a.people).toBe('');
  });

  // MySQL 的 JSON 物件不保留鍵的順序：存進去的「场地、器材……」讀回來是依鍵排序的。
  it('腳本的「準備」照 场地／器材／安全检查／大人位置 的順序讀回來，不照資料庫給的順序', () => {
    const a = activityFromRow(CONTENT_ROW);
    expect(Object.keys(a.guide!.prep)).toEqual(['场地', '器材']);
  });

  it('mysql2 已經把 guide 解析成物件時照樣讀得出來；壞掉的腳本退成 null，不拋例外', () => {
    expect(activityFromRow({ ...CONTENT_ROW, guide: GUIDE }).guide?.length).toBe('2–3 分钟');
    expect(activityFromRow({ ...CONTENT_ROW, guide: '{not json' }).guide).toBeNull();
    expect(activityFromRow({ ...CONTENT_ROW, guide: JSON.stringify({ ...GUIDE, principles: '一' }) }).guide).toBeNull();
    expect(activityFromRow({ ...CONTENT_ROW, guide: JSON.stringify({ ...GUIDE, shots: [{ name: '缺旁白' }] }) }).guide).toBeNull();
  });

  it('片長不是數字就當沒有', () => {
    expect(activityFromRow({ ...CONTENT_ROW, video_seconds: null }).videoSeconds).toBeNull();
    expect(activityFromRow({ ...CONTENT_ROW, video_seconds: 'abc' }).videoSeconds).toBeNull();
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

  it('後台清掉的示範片與封面（空字串）讀回來是沒有（null）：家長端、片庫、配對看到的與從沒設過一樣', () => {
    const a = activityFromRow({ ...CONTENT_ROW, video_url: '', poster_url: '  ', video_seconds: null });
    expect(a.videoUrl).toBeNull();
    expect(a.posterUrl).toBeNull();
    expect(a.videoSeconds).toBeNull();
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

  it('步驟全有或全無：混進一則讀不成步驟的（沒有指令、圖不是字串），整份退成空', () => {
    for (const bad of [
      '[{"imageUrl":"/1.png","instruction":"一"},{"imageUrl":"/2.png","instruction":""}]',
      '[{"imageUrl":"/1.png","instruction":"一"},{"imageUrl":5,"instruction":"二"}]',
      '[{"imageUrl":"/1.png","instruction":"一"},"二"]',
    ]) {
      expect(activityFromRow({ ...ROW, steps: bad }).steps, bad).toEqual([]);
    }
  });

  // ADR-0008：圖選填。沒有圖（沒這個鍵、null、空字串）是一則正常的步驟，讀成 imageUrl: null。
  it('沒有圖的步驟是正常的步驟，讀成 imageUrl: null', () => {
    const a = activityFromRow({
      ...ROW,
      steps: '[{"imageUrl":"/1.png","instruction":"一"},{"imageUrl":"","instruction":"二"},{"instruction":"三"},{"imageUrl":null,"instruction":"四"}]',
    });
    expect(a.steps).toEqual([
      { imageUrl: '/1.png', instruction: '一' },
      { imageUrl: null, instruction: '二' },
      { imageUrl: null, instruction: '三' },
      { imageUrl: null, instruction: '四' },
    ]);
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

  it('內容欄位（Keep 規格 K17）：每一個都對得到欄位名；適齡連帶寫硬閘兩欄；腳本序列化；清掉的文字存空字串不是 NULL', async () => {
    rows = [{ ...ROW }];
    await store.updateActivity('A017', {
      ageLabel: '3–6岁',
      ageMonths: { min: 36, max: 72 },
      people: '亲子',
      need: '手机',
      trains: '练协调',
      easier: '',
      harder: '音乐停就定住',
      tip: '选孩子喜欢的歌。',
      deeper: '物理治疗册 模组九',
      guide: GUIDE,
      posterUrl: '/media/activities/A017.jpg',
      videoSeconds: 10,
    });
    expect(executed[0].sql).toBe(
      'UPDATE activities SET age_label = ?, age_min_month = ?, age_max_month = ?, people = ?, need = ?, trains = ?, '
        + 'easier = ?, harder = ?, tip = ?, deeper = ?, guide = ?, poster_url = ?, video_seconds = ? WHERE id = ?'
    );
    expect(executed[0].params).toEqual([
      '3–6岁', 36, 72, '亲子', '手机', '练协调', '', '音乐停就定住', '选孩子喜欢的歌。', '物理治疗册 模组九',
      JSON.stringify(GUIDE), '/media/activities/A017.jpg', 10, 'A017',
    ]);
  });

  // 示範片（Keep 規格 K05）：與手冊文字同一套 ——「清掉」存空字串，NULL 留給「從沒設過」。
  // 示範片的遷移只填 NULL（deploy/migrations/2026-09-24-activity-media.sql），清掉的不會在下一次部署被填回來。
  it('清掉示範片與封面（patch 帶 null）存成空字串，不是 NULL；片長清掉照舊存 NULL', async () => {
    rows = [{ ...ROW }];
    await store.updateActivity('A017', { videoUrl: null, posterUrl: null, videoSeconds: null });
    expect(executed[0].sql).toBe('UPDATE activities SET video_url = ?, poster_url = ?, video_seconds = ? WHERE id = ?');
    expect(executed[0].params).toEqual(['', '', null, 'A017']);
  });

  it('只帶 ageMonths 不帶適齡，一樣寫兩欄（它只由路由從適齡解析，這裡不擋）', async () => {
    rows = [{ ...ROW }];
    await store.updateActivity('A017', { ageMonths: { min: 12, max: 60 } });
    expect(executed[0].sql).toBe('UPDATE activities SET age_min_month = ?, age_max_month = ? WHERE id = ?');
    expect(executed[0].params).toEqual([12, 60, 'A017']);
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

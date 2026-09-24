import { describe, it, expect } from 'vitest';
import {
  activityCoverage,
  filterActivities,
  readActivityPatch,
  MAX_TARGET_MONTH,
  MAX_VIDEO_SECONDS,
  changedFields,
  planActivityImport,
  MAX_IMPORT_ROWS,
  readImportFile,
  groupImportWarnings,
} from '../src/utils/activityAdmin';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import type { Activity, ActivityGuide } from '../src/t2/types';

/** 一份完整的腳本（形狀照客戶模組一的腳本）。 */
const GUIDE: ActivityGuide = {
  length: '2 分钟',
  intro: '今天这个活动叫「跟着音乐动」。',
  principles: ['跟着节奏动，练协调。'],
  prep: { 场地: '客厅', 器材: '手机放一首有节奏的歌' },
  shots: [{ name: '放音乐', say: '我们来跳舞！' }],
  reactions: [{ if: '孩子不想动', then: '大人先跳。' }],
  mistakes: ['音乐太大声。'],
  down: '只拍手。',
  up: '音乐停就定住。',
  progress: ['能跟上节拍。'],
  outro: '每天动一动。',
};

/**
 * 活動庫標記頁的純函式（#62，規格 v2 §7.4）。
 *
 * 【為什麼要有這些】
 * 內容團隊要把 300 支活動一支一支填。四個進度數字說的是「還差多少」——算錯一個，
 * 上線當天家長拿到零支活動而後台顯示「已填 300」。收下一筆 PATCH 時每個欄位各有規則：
 * `targets` 只認 ★ 標籤（貼了只進報告的標籤，配對永遠對不上而畫面上看不出來），
 * 示範連結沿用素材庫的網址規則（`http://` 在家長端是混合內容，一張破圖沒有人會收到訊息）。
 */

/** 種子那 300 支讀成 Activity 的形狀：全部 `targetMonth = null`、`targets = []`、啟用。 */
const SEED: Activity[] = ACTIVITY_SEED.map(s => ({
  ...s,
  targetMonth: null,
  targets: [],
  avoidIf: [],
  durationMin: 0,
  equipment: [],
  steps: [],
  videoUrl: null,
  active: true,
}));

describe('activityCoverage —— 四個進度數字', () => {
  it('種子狀態：300／0／0／300', () => {
    expect(activityCoverage(SEED)).toEqual({ total: 300, targetMonthFilled: 0, targetsFilled: 0, active: 300 });
  });

  it('填一支 targetMonth 之後：300／1／0／300', () => {
    const list = SEED.map(a => (a.id === 'A017' ? { ...a, targetMonth: 30 } : a));
    expect(activityCoverage(list)).toEqual({ total: 300, targetMonthFilled: 1, targetsFilled: 0, active: 300 });
  });

  it('targets 空陣列不算已填；停用一支少一個啟用', () => {
    const list = SEED.map(a =>
      a.id === 'A001' ? { ...a, targets: ['mot.balance' as const], active: false } : a
    );
    expect(activityCoverage(list)).toEqual({ total: 300, targetMonthFilled: 0, targetsFilled: 1, active: 299 });
  });

  it('空活動庫：全零，不是 NaN', () => {
    expect(activityCoverage([])).toEqual({ total: 0, targetMonthFilled: 0, targetsFilled: 0, active: 0 });
  });
});

describe('filterActivities —— 模組、維度、還沒填 targetMonth', () => {
  const list = SEED.map(a => (a.id === 'A003' ? { ...a, targetMonth: 12 } : a));

  it('不篩：300 支原順序', () => {
    expect(filterActivities(list, { moduleNo: null, dimension: null, missingTargetMonth: false })).toHaveLength(300);
  });

  it('依模組：模組 1 是 A001–A020', () => {
    const out = filterActivities(list, { moduleNo: 1, dimension: null, missingTargetMonth: false });
    expect(out.map(a => a.id)).toEqual(SEED.slice(0, 20).map(a => a.id));
  });

  it('依維度：只留 dimensions 含該碼的', () => {
    const out = filterActivities(list, { moduleNo: null, dimension: 'LANG', missingTargetMonth: false });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(a => a.dimensions.includes('LANG'))).toBe(true);
  });

  it('還沒填 targetMonth：A003 不在裡面', () => {
    const out = filterActivities(list, { moduleNo: 1, dimension: null, missingTargetMonth: true });
    expect(out).toHaveLength(19);
    expect(out.some(a => a.id === 'A003')).toBe(false);
  });
});

describe('readActivityPatch —— 收下一筆標記', () => {
  const ok = (body: unknown) => {
    const r = readActivityPatch(body);
    if (!r.ok) throw new Error(r.error);
    return r.patch;
  };
  const bad = (body: unknown) => {
    const r = readActivityPatch(body);
    expect(r.ok, JSON.stringify(body)).toBe(false);
    return r.ok ? '' : r.error;
  };

  it('什麼都沒帶是錯，不是空的成功', () => {
    expect(bad({})).toContain('没有要更新');
    expect(bad(null)).toContain('没有要更新');
    expect(bad({ nonsense: 1 })).toContain('没有要更新');
  });

  it('targetMonth：0 到上限的整數，或 null（清掉）', () => {
    expect(ok({ targetMonth: 30 })).toEqual({ targetMonth: 30 });
    expect(ok({ targetMonth: 0 })).toEqual({ targetMonth: 0 });
    expect(ok({ targetMonth: null })).toEqual({ targetMonth: null });
    expect(ok({ targetMonth: MAX_TARGET_MONTH })).toEqual({ targetMonth: MAX_TARGET_MONTH });
    for (const v of [-1, 1.5, '30', MAX_TARGET_MONTH + 1, NaN]) bad({ targetMonth: v });
  });

  it('targets 只認 ★ 標籤：只進報告的與不認得的字整筆退回', () => {
    expect(ok({ targets: ['lang.expression', 'mot.balance'] })).toEqual({
      targets: ['lang.expression', 'mot.balance'],
    });
    expect(ok({ targets: [] })).toEqual({ targets: [] });
    expect(bad({ targets: ['emo.slow_to_warm'] })).toContain('emo.slow_to_warm');
    bad({ targets: ['lang.expresion'] });
    bad({ targets: 'lang.expression' });
    bad({ targets: [1] });
  });

  it('targets 去重、照受控詞彙的順序存', () => {
    expect(ok({ targets: ['mot.balance', 'lang.expression', 'mot.balance'] })).toEqual({
      targets: ['lang.expression', 'mot.balance'],
    });
  });

  it('avoidIf 認全部 57 個標籤（含只進報告的）', () => {
    // 照受控詞彙的順序存：★ 在前、只進報告的在後
    expect(ok({ avoidIf: ['emo.slow_to_warm', 'sen.tactile'] })).toEqual({
      avoidIf: ['sen.tactile', 'emo.slow_to_warm'],
    });
    bad({ avoidIf: ['nope'] });
  });

  it('dimensions 只認九碼、至少一個', () => {
    expect(ok({ dimensions: ['MOT', 'ADL'] })).toEqual({ dimensions: ['MOT', 'ADL'] });
    bad({ dimensions: [] });
    bad({ dimensions: ['gross_motor'] });
  });

  it('active 必須是布林', () => {
    expect(ok({ active: false })).toEqual({ active: false });
    bad({ active: 'false' });
    bad({ active: 0 });
  });

  it('示範連結沿用素材庫的規則：https:// 或站內 /；http:// 退回；空字串等於清掉', () => {
    expect(ok({ videoUrl: 'https://v.example.com/a17' })).toEqual({ videoUrl: 'https://v.example.com/a17' });
    expect(ok({ videoUrl: '/videos/a17.mp4' })).toEqual({ videoUrl: '/videos/a17.mp4' });
    expect(ok({ videoUrl: '' })).toEqual({ videoUrl: null });
    expect(ok({ videoUrl: null })).toEqual({ videoUrl: null });
    expect(bad({ videoUrl: 'http://v.example.com/a17' })).toContain('https://');
    bad({ videoUrl: '//evil.example.com/x' });
    bad({ videoUrl: 'javascript:alert(1)' });
  });

  it('圖文步驟沿用素材庫的規則，但活動允許零步（種子就是零步）', () => {
    expect(ok({ steps: [] })).toEqual({ steps: [] });
    expect(ok({ steps: [{ imageUrl: '/s/1.png', instruction: '放一首歌。' }] })).toEqual({
      steps: [{ imageUrl: '/s/1.png', instruction: '放一首歌。' }],
    });
    bad({ steps: [{ imageUrl: 'http://x/1.png', instruction: '不是 https' }] });
    bad({ steps: [{ imageUrl: '/s/1.png' }] });
    bad({ steps: 'x' });
  });

  it('標題、時長、器材', () => {
    expect(ok({ title: '  跟着音乐动 ' })).toEqual({ title: '跟着音乐动' });
    bad({ title: '' });
    expect(ok({ durationMin: 10 })).toEqual({ durationMin: 10 });
    bad({ durationMin: -1 });
    bad({ durationMin: 1.5 });
    expect(ok({ equipment: [' 积木', '小球', ''] })).toEqual({ equipment: ['积木', '小球'] });
    bad({ equipment: [1] });
  });

  it('一次帶多個欄位；不認得的欄位被忽略而不是報錯', () => {
    expect(ok({ targetMonth: 24, active: true, id: 'A999', moduleNo: 3 })).toEqual({ targetMonth: 24, active: true });
  });

  // ── Keep 規格 K04／K17：步驟圖選填、內容欄位 ──

  it('只有文字的步驟存得進去；有圖時照舊驗網址', () => {
    expect(ok({ steps: [{ instruction: '大人趴下来当示范。' }, { imageUrl: '/s/2.png', instruction: '让孩子爬过来拿。' }] })).toEqual({
      steps: [
        { imageUrl: null, instruction: '大人趴下来当示范。' },
        { imageUrl: '/s/2.png', instruction: '让孩子爬过来拿。' },
      ],
    });
    bad({ steps: [{ imageUrl: 'http://x/1.png', instruction: '有图但不是 https' }] });
  });

  it('手冊的文字欄位：修掉前後空白；空字串是清掉；null 也當清掉', () => {
    expect(ok({ tip: '  选孩子喜欢的歌。 ' })).toEqual({ tip: '选孩子喜欢的歌。' });
    expect(ok({ tip: '' })).toEqual({ tip: '' });
    expect(ok({ tip: null })).toEqual({ tip: '' });
    expect(ok({ people: '亲子', need: '一块垫子', trains: '练协调', easier: '慢一点', harder: '快一点', deeper: '物理治疗册 模组九' })).toEqual({
      people: '亲子', need: '一块垫子', trains: '练协调', easier: '慢一点', harder: '快一点', deeper: '物理治疗册 模组九',
    });
    bad({ tip: 3 });
    bad({ easier: ['慢一点'] });
  });

  it('手冊的文字欄位超過欄寬整筆退回，不默默截斷', () => {
    expect(bad({ people: '亲'.repeat(17) })).toContain('16');
    expect(bad({ trains: '练'.repeat(256) })).toContain('255');
    expect(ok({ trains: '练'.repeat(255) })).toEqual({ trains: '练'.repeat(255) });
  });

  // 適齡是配對硬閘（ageMonths）的來源（規格 §4.1「age_min_month／age_max_month 照舊由它解析」）：
  // 只改畫面上的字、不改硬閘，家長看到「适合 3–6岁」而 7 歲的孩子照樣配得到。
  it('適齡：改了原文就連帶改硬閘；解析不了、空的整筆退回', () => {
    expect(ok({ ageLabel: ' 3–6岁 ' })).toEqual({ ageLabel: '3–6岁', ageMonths: { min: 36, max: 72 } });
    expect(ok({ ageLabel: '6个月–3岁' })).toEqual({ ageLabel: '6个月–3岁', ageMonths: { min: 6, max: 36 } });
    expect(bad({ ageLabel: '三到六岁' })).toContain('三到六岁');
    bad({ ageLabel: '' });
    bad({ ageLabel: null });
  });

  it('ageMonths 不能直接送 —— 它只由適齡原文解析', () => {
    expect(bad({ ageMonths: { min: 0, max: 1 } })).toContain('没有要更新');
  });

  it('封面沿用示範連結的網址規則；片長是 1 到上限的整數秒，或清掉', () => {
    expect(ok({ posterUrl: '/media/activities/A001.jpg' })).toEqual({ posterUrl: '/media/activities/A001.jpg' });
    expect(ok({ posterUrl: '' })).toEqual({ posterUrl: null });
    bad({ posterUrl: 'http://x/1.jpg' });
    expect(ok({ videoSeconds: 10 })).toEqual({ videoSeconds: 10 });
    expect(ok({ videoSeconds: null })).toEqual({ videoSeconds: null });
    for (const v of [0, -1, 1.5, '10', MAX_VIDEO_SECONDS + 1]) bad({ videoSeconds: v });
  });

  it('腳本：整份照 readGuide 驗；不能整份刪掉（遷移重跑只填 NULL，刪掉的會被填回來）', () => {
    expect(ok({ guide: GUIDE })).toEqual({ guide: GUIDE });
    expect(bad({ guide: { ...GUIDE, shots: [{ name: '示范' }] } })).toContain('分镜');
    expect(bad({ guide: null })).toContain('脚本');
  });
});

/**
 * 批量匯入（v2.1 S25，客戶 9/21 工作單 #14）：客戶的 E 表一次給 300 支的 targetMonth 與標籤。
 * 逐列獨立：壞的那一列整列不入庫，其他列照寫。列號從 1 起算（`rows[0]` 是第 1 列）。
 * E 表還沒來，這裡全是假資料。
 */
describe('planActivityImport —— 匯入的逐列檢查', () => {
  const IDS = new Set(SEED.map(a => a.id));
  /** 一列最少要帶的三欄：A017 在模組 1。 */
  const base = { id: 'A017', moduleNo: 1, targetMonth: 30 };

  const plan = (rows: unknown[], dryRun?: boolean) => {
    const r = planActivityImport(dryRun === undefined ? { rows } : { rows, dryRun }, IDS);
    if (!r.ok) throw new Error(r.error);
    return r;
  };
  /** 只有一列、而且那一列被退：回它的錯誤訊息。 */
  const rejected = (row: unknown) => {
    const r = plan([row]);
    expect(r.ready, JSON.stringify(row)).toEqual([]);
    expect(r.failed).toHaveLength(1);
    return r.failed[0];
  };

  it('一列全對：成為一筆局部更新，id 與 moduleNo 不在更新裡', () => {
    const r = plan([{ ...base, targets: ['mot.balance'], avoidIf: ['sen.vestibular'], durationMin: 10, active: true }]);
    expect(r.failed).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.dryRun).toBe(false);
    expect(r.ready).toEqual([
      {
        row: 1,
        id: 'A017',
        patch: { targetMonth: 30, targets: ['mot.balance'], avoidIf: ['sen.vestibular'], durationMin: 10, active: true },
      },
    ]);
  });

  // 匯入只改、不新增（ADR-0005：300 支由種子寫入，之後新增走遷移）。
  it('id：活動庫裡沒有的整列退回，錯誤帶著那個 id', () => {
    expect(rejected({ ...base, id: 'A301', moduleNo: 16 })).toMatchObject({ row: 1, id: 'A301', error: expect.stringContaining('A301') });
    expect(rejected({ ...base, id: 'B017' })).toMatchObject({ id: 'B017' });
  });

  it('id：格式不對的整列退回；不是字串的沒有 id 可帶', () => {
    expect(rejected({ ...base, id: 'a017' })).toMatchObject({ id: 'a017' });
    expect(rejected({ ...base, id: ' A017' })).toMatchObject({ id: ' A017' });
    expect(rejected({ ...base, id: 'A17' })).toMatchObject({ id: 'A17' });
    const noId = rejected({ moduleNo: 1, targetMonth: 30 });
    expect(noId.row).toBe(1);
    expect(noId).not.toHaveProperty('id');
    expect(rejected({ ...base, id: 17 })).not.toHaveProperty('id');
  });

  // 對不上多半是整張表錯位（規格 §7 第 2 條），寧可擋下。
  it('moduleNo：必填，且等於 ceil(編號 ÷ 20)', () => {
    expect(plan([{ ...base, id: 'A020', moduleNo: 1 }, { ...base, id: 'A021', moduleNo: 2 }, { ...base, id: 'A300', moduleNo: 15 }]).failed).toEqual([]);
    expect(rejected({ ...base, moduleNo: 2 })).toMatchObject({ id: 'A017', error: expect.stringContaining('模组') });
    expect(rejected({ ...base, id: 'A021', moduleNo: 1 }).error).toContain('2');
    const { moduleNo: _omit, ...noModule } = base;
    rejected(noModule);
    for (const v of [null, '1', 1.0000001, 0]) rejected({ ...base, moduleNo: v });
  });

  // 工作單驗收「targetMonth 无 null」：PATCH 可以送 null 清掉，匯入不行。
  it('targetMonth：必填、0–216 的整數；null、越界、小數、字串都整列退回', () => {
    expect(plan([{ ...base, targetMonth: 0 }]).ready[0].patch.targetMonth).toBe(0);
    expect(plan([{ ...base, targetMonth: MAX_TARGET_MONTH }]).ready[0].patch.targetMonth).toBe(MAX_TARGET_MONTH);
    const { targetMonth: _omit, ...noMonth } = base;
    expect(rejected(noMonth).error).toContain('目标月龄');
    for (const v of [null, -1, MAX_TARGET_MONTH + 1, 30.5, '30', NaN]) {
      expect(rejected({ ...base, targetMonth: v }).error, String(v)).toContain('目标月龄');
    }
  });

  it('其餘欄位照 readActivityPatch：targets 貼了只進報告的標籤 → 整列退回，錯誤點名那個字', () => {
    const f = rejected({ ...base, targets: ['mot.balance', 'emo.slow_to_warm'] });
    expect(f).toMatchObject({ row: 1, id: 'A017' });
    expect(f.error).toContain('emo.slow_to_warm');
    expect(rejected({ ...base, durationMin: 181 }).error).toContain('时长');
    expect(rejected({ ...base, active: 'yes' }).error).toContain('启用');
  });

  it('不認得的欄位：忽略、寫進 warnings，不擋那一列', () => {
    const r = plan([
      { ...base, 名称: '跟着音乐动', remark: '先做这支' },
      { ...base, id: 'A018' },
    ]);
    expect(r.ready.map(x => x.id)).toEqual(['A017', 'A018']);
    expect(r.ready[0].patch).toEqual({ targetMonth: 30 });
    expect(r.warnings).toEqual([
      { row: 1, field: '名称' },
      { row: 1, field: 'remark' },
    ]);
  });

  // 「avoidIf 标『草稿』」暫採不入庫、不影響配對（v2.1 §7、§9 第 10 題）：
  // 草稿標記不管叫什麼名字，都是不認得的欄位；avoidIf 本身照樣寫。
  it('avoidIf 的草稿標記：當不認得的欄位 → warnings；avoidIf 照樣寫', () => {
    const r = plan([{ ...base, avoidIf: ['sen.vestibular'], avoidIfDraft: true, draft: ['sen.vestibular'] }]);
    expect(r.ready[0].patch).toEqual({ targetMonth: 30, avoidIf: ['sen.vestibular'] });
    expect(r.warnings).toEqual([
      { row: 1, field: 'avoidIfDraft' },
      { row: 1, field: 'draft' },
    ]);
  });

  it('ageMonths 不能直接送（它只由適齡原文解析）：當不認得的欄位', () => {
    const r = plan([{ ...base, ageMonths: { min: 0, max: 216 } }]);
    expect(r.ready[0].patch).toEqual({ targetMonth: 30 });
    expect(r.warnings).toEqual([{ row: 1, field: 'ageMonths' }]);
  });

  it('被退的列一樣列出不認得的欄位（改表時一次看到）', () => {
    const r = plan([{ ...base, targetMonth: null, note: 'x' }]);
    expect(r.failed).toHaveLength(1);
    expect(r.warnings).toEqual([{ row: 1, field: 'note' }]);
  });

  // Keep 規格 K17：「v2.1 的批量匯入（S25）一併收新欄位」。逐欄釘住，一欄都不進 warnings。
  it('Keep K17 的內容欄位逐欄收得下；適齡連帶改硬閘', () => {
    const content = {
      title: '跟着音乐动',
      ageLabel: '6个月–3岁',
      people: '亲子',
      trains: '练协调',
      need: '一首有节奏的歌',
      easier: '只拍手',
      harder: '音乐停就定住',
      tip: '选孩子喜欢的歌。',
      deeper: '物理治疗册 模组九',
      guide: GUIDE,
      videoUrl: '/media/activities/A017.mp4',
      posterUrl: '/media/activities/A017.jpg',
      videoSeconds: 10,
      dimensions: ['MOT', 'SEN'],
      equipment: ['软垫'],
    };
    const r = plan([{ ...base, ...content }]);
    expect(r.failed).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ready[0].patch).toEqual({
      targetMonth: 30,
      ...content,
      ageMonths: { min: 6, max: 36 },
    });
  });

  it('內容欄位的規則同 PATCH：看不懂的適齡、整份刪掉腳本、超過欄寬 → 整列退回', () => {
    expect(rejected({ ...base, ageLabel: '三到六岁' }).error).toContain('三到六岁');
    expect(rejected({ ...base, guide: null }).error).toContain('脚本');
    expect(rejected({ ...base, people: '亲'.repeat(17) }).error).toContain('16');
    expect(rejected({ ...base, videoSeconds: 0 }).error).toContain('示范片长度');
    expect(rejected({ ...base, posterUrl: 'http://x/1.jpg' }).error).toContain('https://');
  });

  // ADR-0008（Keep K04）起步驟的圖選填。v2.1 §7 第 4 條「每步要圖要字」、§9 第 10 題「沒有圖送空陣列」
  // 寫於 ADR-0008 之前；匯入沿用同一個 readActivityPatch，不另加限制。
  it('步驟：只有文字的收得下（ADR-0008）；有圖時照舊驗網址；指令仍必填', () => {
    const r = plan([{ ...base, steps: [{ instruction: '让孩子站在软垫中间。' }, { imageUrl: 'https://example.com/A017-2.jpg', instruction: '双手张开。' }] }]);
    expect(r.ready[0].patch.steps).toEqual([
      { imageUrl: null, instruction: '让孩子站在软垫中间。' },
      { imageUrl: 'https://example.com/A017-2.jpg', instruction: '双手张开。' },
    ]);
    rejected({ ...base, steps: [{ imageUrl: 'http://x/1.png', instruction: '不是 https' }] });
    rejected({ ...base, steps: [{ imageUrl: '/s/1.png' }] });
  });

  // 同一支出現兩次，不知道哪一列才對（多半是表格錯位或複製貼上）；只寫其中一列等於猜。
  it('同一個 id 出現兩次：每一列都退回，錯誤說出另一列在哪', () => {
    const r = plan([
      { ...base, targetMonth: 30 },
      { ...base, id: 'A018' },
      { ...base, targetMonth: 36 },
    ]);
    expect(r.ready.map(x => x.id)).toEqual(['A018']);
    expect(r.failed.map(f => [f.row, f.id])).toEqual([[1, 'A017'], [3, 'A017']]);
    expect(r.failed[0].error).toContain('1、3');
  });

  it('逐列獨立：壞列之外的照常；failed 與 ready 都依列號排', () => {
    const r = plan([
      { ...base, id: 'A001' },
      { ...base, id: 'A002', targetMonth: null },
      { ...base, id: 'A003' },
      { ...base, id: 'A999', moduleNo: 50 },
    ]);
    expect(r.ready.map(x => [x.row, x.id])).toEqual([[1, 'A001'], [3, 'A003']]);
    expect(r.failed.map(f => [f.row, f.id])).toEqual([[2, 'A002'], [4, 'A999']]);
  });

  it('一列不是物件：整列退回', () => {
    for (const row of [null, 'A017', 17, ['A017', 1, 30]]) {
      expect(rejected(row)).toMatchObject({ row: 1 });
    }
  });

  it('dryRun：帶了 true 才是試跑；沒帶是正式匯入', () => {
    expect(plan([base], true).dryRun).toBe(true);
    expect(plan([base], false).dryRun).toBe(false);
    expect(plan([base]).dryRun).toBe(false);
  });

  describe('整份的形狀不對：整份退回，一列都不看', () => {
    const shapeError = (body: unknown) => {
      const r = planActivityImport(body, IDS);
      expect(r.ok, JSON.stringify(body)?.slice(0, 80)).toBe(false);
      return r.ok ? '' : r.error;
    };

    it('不是 { rows: [...] }', () => {
      for (const body of [null, undefined, [], 'rows', { rows: 'x' }, { rows: { 0: base } }, { row: [base] }]) {
        expect(shapeError(body)).toContain('rows');
      }
    });

    it('rows 是空的', () => {
      expect(shapeError({ rows: [] })).toContain('没有');
    });

    it('dryRun 不是布林 —— "false" 被當成試跑或正式匯入都是猜', () => {
      expect(shapeError({ rows: [base], dryRun: 'false' })).toContain('dryRun');
      shapeError({ rows: [base], dryRun: 1 });
    });

    it(`列數上限 ${MAX_IMPORT_ROWS}：剛好收、多一列整份退回`, () => {
      expect(MAX_IMPORT_ROWS).toBeGreaterThanOrEqual(300);
      const at = Array.from({ length: MAX_IMPORT_ROWS }, () => base);
      expect(planActivityImport({ rows: at }, IDS).ok).toBe(true);
      expect(shapeError({ rows: [...at, base] })).toContain(String(MAX_IMPORT_ROWS));
    });
  });

  // 驗收「300 支一次匯入、targetMonth 无 null」（v2.1 §2 S25）的純函式那一半；寫入那一半在 activitiesAdmin.http。
  it('300 支一次全對：300 筆更新，每一筆都有 targetMonth', () => {
    const rows = SEED.map((a, i) => ({ id: a.id, moduleNo: a.moduleNo, targetMonth: i % 217, targets: [] }));
    const r = plan(rows);
    expect(r.failed).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ready).toHaveLength(300);
    expect(r.ready.every(x => typeof x.patch.targetMonth === 'number')).toBe(true);
  });
});

describe('匯入畫面的兩個小工具', () => {
  it('readImportFile：附錄 C 的 { rows } 取出 rows；檔案裡的 dryRun 不算數（試跑與否由畫面決定）', () => {
    expect(readImportFile('{ "rows": [{ "id": "A017" }], "dryRun": false }')).toEqual({ ok: true, rows: [{ id: 'A017' }] });
  });

  // Excel／記事本存 UTF-8 常在檔頭加 BOM，JSON.parse 不收它。
  it('readImportFile：檔頭的 BOM 去掉', () => {
    expect(readImportFile('\uFEFF{ "rows": [] }')).toEqual({ ok: true, rows: [] });
  });

  it('readImportFile：不是 JSON、不是 { rows: [...] } → 說哪裡不對', () => {
    const bad = (text: string) => {
      const r = readImportFile(text);
      expect(r.ok, text).toBe(false);
      return r.ok ? '' : r.error;
    };
    expect(bad('id,moduleNo\nA017,1')).toContain('JSON');
    expect(bad('')).toContain('JSON');
    expect(bad('[{ "id": "A017" }]')).toContain('rows');
    expect(bad('{ "rows": "A017" }')).toContain('rows');
  });

  it('groupImportWarnings：同一個欄位的列號收成一組，依第一次出現的順序', () => {
    expect(
      groupImportWarnings([
        { row: 1, field: '名称' },
        { row: 1, field: 'remark' },
        { row: 2, field: '名称' },
        { row: 5, field: '名称' },
      ])
    ).toEqual([
      { field: '名称', rows: [1, 2, 5] },
      { field: 'remark', rows: [1] },
    ]);
    expect(groupImportWarnings([])).toEqual([]);
  });
});

describe('changedFields —— 畫面只送改過的欄位', () => {
  const base = SEED[16];

  it('一個都沒改 → 空物件', () => {
    expect(changedFields(base, { ...base })).toEqual({});
  });

  it('只填了月齡 → 只有 targetMonth', () => {
    expect(changedFields(base, { ...base, targetMonth: 30 })).toEqual({ targetMonth: 30 });
  });

  it('陣列比內容不比參照；順序不同算改過', () => {
    expect(changedFields(base, { ...base, dimensions: [...base.dimensions] })).toEqual({});
    const two: Activity = { ...base, dimensions: ['MOT', 'ADL'] };
    expect(changedFields(two, { ...two, dimensions: ['ADL', 'MOT'] })).toEqual({ dimensions: ['ADL', 'MOT'] });
  });

  it('id、moduleNo、ageMonths 不在可送的欄位裡', () => {
    expect(changedFields(base, { ...base, id: 'A999', moduleNo: 3, ageMonths: { min: 0, max: 1 } })).toEqual({});
  });

  it('內容欄位：改了小提醒只送小提醒；改了適齡只送原文（硬閘由伺服器解析）', () => {
    const filled: Activity = { ...base, tip: '旧的', ageLabel: '1–8岁', guide: GUIDE };
    expect(changedFields(filled, { ...filled, tip: '新的' })).toEqual({ tip: '新的' });
    expect(changedFields(filled, { ...filled, ageLabel: '2–8岁' })).toEqual({ ageLabel: '2–8岁' });
    expect(changedFields(filled, { ...filled, posterUrl: '/p.jpg', videoSeconds: 10 })).toEqual({ posterUrl: '/p.jpg', videoSeconds: 10 });
  });

  it('腳本比內容不比參照：沒改過的腳本不送，改了一個字就整份送', () => {
    const filled: Activity = { ...base, guide: GUIDE };
    expect(changedFields(filled, { ...filled, guide: JSON.parse(JSON.stringify(GUIDE)) })).toEqual({});
    const edited = { ...GUIDE, outro: '改过的收尾。' };
    expect(changedFields(filled, { ...filled, guide: edited })).toEqual({ guide: edited });
  });
});

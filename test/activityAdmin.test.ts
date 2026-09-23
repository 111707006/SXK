import { describe, it, expect } from 'vitest';
import {
  activityCoverage,
  filterActivities,
  readActivityPatch,
  MAX_TARGET_MONTH,
  MAX_VIDEO_SECONDS,
  changedFields,
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

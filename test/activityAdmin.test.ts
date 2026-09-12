import { describe, it, expect } from 'vitest';
import {
  activityCoverage,
  filterActivities,
  readActivityPatch,
  MAX_TARGET_MONTH,
  changedFields,
} from '../src/utils/activityAdmin';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import type { Activity } from '../src/t2/types';

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
});

import { describe, it, expect } from 'vitest';
import { RULES_VERSION } from '../src/t2/scoring';
import { TOOLKIT_VERSION } from '../src/t2/toolkit';
import { DIMENSION_CODES } from '../src/t2/types';
import type {
  Activity,
  Band,
  DimensionBand,
  DimensionCode,
  DimensionFinding,
  ModuleNo,
  T1Flag,
  T2Findings,
} from '../src/t2/types';
import type { ActivityTag, FindingTag } from '../src/t2/findingTags';
import {
  AGE_KEYS,
  DIM_MOD,
  MAX_PER_DIMENSION,
  OFFSET,
  SCORE,
  SLOTS_BY_BAND,
  WEEKLY_SLOTS,
  ageKeyOf,
  matchWeeklyActivities,
  scoreActivity,
  windowFor,
} from '../src/t2/activityMatch';

/**
 * 活動配對（#53，規格 v2 §7.2、§7.3）。
 *
 * 【這裡在防什麼】
 * 1. **不往上取**：窗口內沒活動時只往下（`targetMonth` 低於窗口下限）找，上方有再多也不拿。
 *    給孩子做不到的活動，家長會以為孩子又失敗了一次 —— 舊干預包測試「不退回鄰近年齡段、
 *    不退回通用方案」那幾條搬到這裡（下方「不跨維度、不跨模組群、不往上取」那一組），不刪。
 * 2. **`targetMonth` null 的活動配不到**，不是退回 `ageMonths`：退回會讓偏移規則失效而畫面上看不出來。
 * 3. **可重現**：同輸入兩次結果相同；同分取離窗口中點近的，再同取編號小的。
 * 4. **配額**：refer 2、watch 1、剩的輪流、同維度 ≤ 2、總數 ≤ 4。
 *
 * 【固定輸入】
 * 48 個月、LANG refer（`lang.expression`、`lang.vocabulary_size`）、ATT watch（`att.inattention`）。
 * refer 在 36–72 的窗口是 −24～−12 → [24, 36]；watch 是 −12～−6 → [36, 42]。
 */

const NINE = DIMENSION_CODES;

/** 一支活動；沒指定的欄位是種子的形狀（`targets` 空、`avoidIf` 空、啟用）。 */
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
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
    ...over,
  };
}

interface DimSpec { band: DimensionBand; tags?: FindingTag[]; t1Flag?: T1Flag }

/** 一份 `T2Findings`：只指定有事的維度，其餘 clear、沒標籤、T1 綠。 */
function findings(
  dims: Partial<Record<DimensionCode, DimSpec>>,
  over: Partial<Pick<T2Findings, 'diagnosisDirection' | 'child'>> = {},
): T2Findings {
  const dimensions: DimensionFinding[] = NINE.map(d => {
    const spec = dims[d] ?? { band: 'clear' as const };
    return {
      dimensionId: d,
      band: spec.band,
      drivenBy: null,
      tags: spec.tags ?? [],
      caveats: [],
      tools: [],
      t1Flag: spec.t1Flag ?? (spec.band === 'clear' ? 0 : 2),
    };
  });
  const t1 = {} as Record<DimensionCode, T1Flag>;
  for (const f of dimensions) t1[f.dimensionId] = f.t1Flag;
  return {
    version: 3,
    toolkitVersion: TOOLKIT_VERSION,
    rulesVersion: RULES_VERSION,
    child: { assessedAgeMonth: 48 },
    t1,
    diagnosisDirection: null,
    dimensions,
    toolResults: [],
    computedAt: '2026-09-12T00:00:00.000Z',
    ...over,
  };
}

const LANG_REFER: DimSpec = { band: 'refer', tags: ['lang.expression', 'lang.vocabulary_size'] };
const ATT_WATCH: DimSpec = { band: 'watch', tags: ['att.inattention'] };
const FIXED = findings({ LANG: LANG_REFER, ATT: ATT_WATCH });

function match(f: T2Findings, library: Activity[], ageMonth = 48, recent: string[] = []) {
  return matchWeeklyActivities(f, ageMonth, recent, library);
}

function idsFor(result: ReturnType<typeof matchWeeklyActivities>, d?: DimensionCode): string[] {
  return result.picks.filter(p => d === undefined || p.dimension === d).map(p => p.activity.id);
}

describe('年齡段鍵與偏移表（§7.2 重抄一次）', () => {
  it('四個年齡段：<12、12–36、36–72、72+，段界落在下一段', () => {
    expect(AGE_KEYS).toEqual(['<12', '12-36', '36-72', '72+']);
    expect(ageKeyOf(0)).toBe('<12');
    expect(ageKeyOf(11)).toBe('<12');
    expect(ageKeyOf(12)).toBe('12-36');
    expect(ageKeyOf(35)).toBe('12-36');
    expect(ageKeyOf(36)).toBe('36-72');
    expect(ageKeyOf(71)).toBe('36-72');
    expect(ageKeyOf(72)).toBe('72+');
    expect(ageKeyOf(216)).toBe('72+');
  });

  it('OFFSET 與 §7.2 的表逐格相同', () => {
    expect(OFFSET).toEqual({
      clear: { '<12': [-1, 1], '12-36': [-3, 3], '36-72': [-6, 6], '72+': [-12, 12] },
      watch: { '<12': [-3, -1], '12-36': [-6, -3], '36-72': [-12, -6], '72+': [-24, -12] },
      refer: { '<12': [-6, -3], '12-36': [-12, -6], '36-72': [-24, -12], '72+': [-36, -24] },
    });
  });

  it('窗口：48 refer → [24, 36]；48 watch → [36, 42]；10 refer → [4, 7]', () => {
    expect(windowFor('refer', 48)).toEqual({ lo: 24, hi: 36 });
    expect(windowFor('watch', 48)).toEqual({ lo: 36, hi: 42 });
    expect(windowFor('refer', 10)).toEqual({ lo: 4, hi: 7 });
    expect(windowFor('clear', 48)).toEqual({ lo: 42, hi: 54 });
  });

  it('下限不低於 0：2 個月 refer 是 [0, 0]，不是負的', () => {
    expect(windowFor('refer', 2)).toEqual({ lo: 0, hi: 0 });
    expect(windowFor('watch', 1)).toEqual({ lo: 0, hi: 0 });
  });

  it('月齡不是非負整數就丟錯，不猜一個年齡段', () => {
    for (const bad of [-1, 30.5, NaN, Infinity]) {
      expect(() => windowFor('refer', bad), String(bad)).toThrow();
      expect(() => match(FIXED, [act('A001', 7, 30)], bad), String(bad)).toThrow();
    }
  });
});

describe('維度 → 模組（§7.2 `DIM_MOD` 重抄一次）', () => {
  it('九個維度逐格相同', () => {
    expect(DIM_MOD).toEqual({
      MOT: [1, 2, 3, 4, 5],
      SEN: [2, 3, 5, 11, 14],
      COG: [7, 12, 13, 14, 15],
      LEARN: [2, 5, 9, 12, 13, 14, 15],
      ATT: [7, 9, 13, 14, 15],
      LANG: [7, 8, 9, 11],
      SOC: [7, 9, 12, 15],
      EMO: [9, 10, 11, 12, 15],
      ADL: [3, 5, 6, 9, 12, 15],
    });
  });

  it('LANG 只從模組 7／8／9／11 取', () => {
    const library = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as ModuleNo[])
      .map(m => act(`M${String(m).padStart(2, '0')}`, m, 30));
    const got = match(findings({ LANG: LANG_REFER }), library);
    expect(got.picks.every(p => [7, 8, 9, 11].includes(p.activity.moduleNo))).toBe(true);
    expect(got.picks).toHaveLength(2);
  });

  it('SEN 不會拿到模組 8', () => {
    const library = [act('A150', 8, 30), act('A151', 8, 28), act('A040', 2, 30)];
    const got = match(findings({ SEN: { band: 'refer' } }), library);
    expect(idsFor(got)).toEqual(['A040']);
  });
});

describe('打分（§7.3 第 2 條）', () => {
  const stars = new Set<ActivityTag>(['lang.expression', 'lang.vocabulary_size']);

  it('★ 對上每個 +3、只有維度對上 +1、四週內派過 −2', () => {
    expect(SCORE).toEqual({ perTag: 3, dimensionOnly: 1, recent: -2 });
    expect(scoreActivity(act('A', 8, 30, { targets: ['lang.expression', 'lang.vocabulary_size'] }), stars, new Set()))
      .toEqual({ score: 6, matchedTags: ['lang.expression', 'lang.vocabulary_size'] });
    expect(scoreActivity(act('A', 8, 30), stars, new Set())).toEqual({ score: 1, matchedTags: [] });
    // targets 有、但沒對上 —— 也是「只有維度對上」
    expect(scoreActivity(act('A', 8, 30, { targets: ['lang.pragmatics'] }), stars, new Set()))
      .toEqual({ score: 1, matchedTags: [] });
    expect(scoreActivity(act('A', 8, 30, { targets: ['lang.expression'] }), stars, new Set(['A'])))
      .toEqual({ score: 1, matchedTags: ['lang.expression'] });
    expect(scoreActivity(act('A', 8, 30), stars, new Set(['A']))).toEqual({ score: -1, matchedTags: [] });
  });

  it('matchedTags 照活動 targets 的順序，且只列孩子有的', () => {
    const a = act('A', 8, 30, { targets: ['lang.vocabulary_size', 'lang.pragmatics', 'lang.expression'] });
    expect(scoreActivity(a, stars, new Set()).matchedTags).toEqual(['lang.vocabulary_size', 'lang.expression']);
  });

  it('兩個 ★ 對上（+6）贏過只維度對上（+1），即使後者更靠窗口中點', () => {
    const library = [
      act('A160', 8, 30), // 正中點、沒標籤
      act('A161', 8, 24, { targets: ['lang.expression', 'lang.vocabulary_size'] }), // 貼下限、兩個都對上
    ];
    const got = match(findings({ LANG: LANG_REFER }), library);
    expect(idsFor(got)).toEqual(['A161', 'A160']);
    expect(got.picks[0].score).toBe(6);
    expect(got.picks[0].reason.matchedTags).toEqual(['lang.expression', 'lang.vocabulary_size']);
  });

  it('四週內派過的同分時輸', () => {
    const library = [
      act('A160', 8, 30, { targets: ['lang.expression'] }),
      act('A161', 8, 30, { targets: ['lang.expression'] }),
    ];
    // 沒派過時 A160 編號小贏；派過之後 −2 輸給 A161
    expect(idsFor(match(findings({ LANG: LANG_REFER }), library))).toEqual(['A160', 'A161']);
    expect(idsFor(match(findings({ LANG: LANG_REFER }), library, 48, ['A160']))).toEqual(['A161', 'A160']);
  });

  it('打分只看該維度自己的 ★ 標籤：ATT 的標籤不會替 LANG 的名額加分', () => {
    // 模組 7 同時在 LANG 與 ATT 的模組群裡；A121 練的是 att.inattention
    const library = [
      act('A121', 7, 30, { targets: ['att.inattention'] }),
      act('A122', 7, 30, { targets: ['lang.expression'] }),
      act('A123', 7, 30),
    ];
    const got = match(findings({ LANG: LANG_REFER, ATT: ATT_WATCH }), library);
    const lang = got.picks.filter(p => p.dimension === 'LANG');
    expect(lang[0].activity.id).toBe('A122');
    expect(lang.map(p => p.reason.matchedTags)).toEqual([['lang.expression'], []]);
    // A121 對 ATT 才是 +3；ATT 的窗口 [36, 42] 裡沒東西，它是退路往下取到的那一支
    expect(idsFor(got, 'ATT')).toEqual(['A121']);
    expect(got.picks.find(p => p.dimension === 'ATT')?.reason).toMatchObject({ matchedTags: ['att.inattention'], belowWindow: true });
  });

  it('只進報告的標籤（沒有 ★）不加分，也不擋孩子拿活動', () => {
    const f = findings({ EMO: { band: 'watch', tags: ['emo.slow_to_warm', 'emo.regulation'] } });
    const library = [act('A201', 11, 38, { targets: ['emo.regulation'] }), act('A202', 11, 38)];
    const got = match(f, library);
    expect(idsFor(got)).toEqual(['A201', 'A202']);
    expect(got.picks[0].reason.matchedTags).toEqual(['emo.regulation']);
  });
});

describe('avoidIf：活動的禁忌對上孩子任何一個標籤就不給', () => {
  it('對上的是別的維度的標籤、只進報告的標籤，也擋', () => {
    const f = findings({
      LANG: LANG_REFER,
      SEN: { band: 'clear', tags: ['sen.impact_play'] },
    });
    const library = [
      act('A160', 8, 30, { avoidIf: ['sen.impact_play'] }),
      act('A161', 8, 30, { avoidIf: ['sen.tactile'] }),
    ];
    expect(idsFor(match(f, library))).toEqual(['A161']);
  });
});

describe('配額（§7.3 第 3 條）', () => {
  /** 給一個維度的第一個模組在指定月齡塞 n 支。 */
  function fill(dim: DimensionCode, targetMonth: number, n: number, prefix: string): Activity[] {
    const moduleNo = DIM_MOD[dim][0];
    return Array.from({ length: n }, (_, i) => act(`${prefix}${i}`, moduleNo, targetMonth));
  }

  it('常數：每週 4 支、同維度 ≤ 2、refer 2 個名額、watch 1 個', () => {
    expect(WEEKLY_SLOTS).toBe(4);
    expect(MAX_PER_DIMENSION).toBe(2);
    expect(SLOTS_BY_BAND).toEqual({ refer: 2, watch: 1 });
  });

  it('LANG refer、ATT watch → LANG 2 支、ATT 1 支、第 4 支輪給有標記的維度（ATT 還有位子）', () => {
    // SEN 的模組 2 塞在 ATT 窗口內，但 SEN 是 clear —— 它不是有標記的維度，第 4 支不會給它
    const library = [...fill('LANG', 30, 3, 'L'), ...fill('ATT', 40, 3, 'T'), ...fill('SEN', 40, 3, 'S')];
    const got = match(FIXED, library);
    expect(got.picks).toHaveLength(4);
    expect(idsFor(got, 'LANG')).toHaveLength(2);
    expect(idsFor(got, 'ATT')).toHaveLength(2);
    expect(idsFor(got, 'SEN')).toEqual([]);
    // 名額順序：LANG 第一支、ATT 第一支、LANG 第二支、ATT 第四支
    expect(got.picks.map(p => p.dimension)).toEqual(['LANG', 'ATT', 'LANG', 'ATT']);
  });

  it('LANG refer、ATT watch、ATT 窗口只有一支 → 第 4 支沒得給，總數 3', () => {
    const library = [...fill('LANG', 30, 3, 'L'), ...fill('ATT', 40, 1, 'T')];
    const got = match(FIXED, library);
    expect(idsFor(got, 'LANG')).toHaveLength(2);
    expect(idsFor(got, 'ATT')).toHaveLength(1);
    expect(got.picks).toHaveLength(3);
  });

  it('三個維度都 refer → 每維度 ≤ 2 且總數 4；先每維度一支，第二支依 §8 排序給', () => {
    // 模組不重疊：LANG 8、SOC 12、MOT 1
    const library = [
      ...Array.from({ length: 3 }, (_, i) => act(`L${i}`, 8, 30)),
      ...Array.from({ length: 3 }, (_, i) => act(`S${i}`, 12, 30)),
      ...Array.from({ length: 3 }, (_, i) => act(`M${i}`, 1, 30)),
    ];
    const f = findings({ LANG: { band: 'refer' }, SOC: { band: 'refer' }, MOT: { band: 'refer' } });
    const got = match(f, library);
    expect(got.picks).toHaveLength(4);
    expect(got.picks.map(p => p.dimension)).toEqual(['LANG', 'SOC', 'MOT', 'LANG']);
  });

  it('只有一個 watch 維度 → 1 個名額 ＋ 剩的輪給它，到上限 2 為止', () => {
    const got = match(findings({ ATT: ATT_WATCH }), fill('ATT', 40, 5, 'T'));
    expect(got.picks).toHaveLength(2);
    expect(got.picks.every(p => p.dimension === 'ATT')).toBe(true);
  });

  it('refer 在前、同 band 依 T1 標記、再依固定順序（§8）', () => {
    const f = findings({
      EMO: { band: 'refer', t1Flag: 1 },
      SOC: { band: 'watch', t1Flag: 2 },
      LANG: { band: 'watch', t1Flag: 1 },
      COG: { band: 'watch', t1Flag: 1 },
    });
    const library = [act('E', 10, 30), act('S', 12, 40), act('L', 8, 40), act('C', 13, 40)];
    expect(match(f, library).picks.map(p => p.dimension)).toEqual(['EMO', 'SOC', 'LANG', 'COG']);
  });

  it('同一支活動不會被兩個維度各拿一次', () => {
    // 模組 7 同時屬於 LANG 與 ATT；兩個都 refer 讓窗口疊起來
    const f = findings({ LANG: { band: 'refer' }, ATT: { band: 'refer' } });
    const library = [act('A121', 7, 30), act('A122', 7, 30)];
    const got = match(f, library);
    expect(idsFor(got).sort()).toEqual(['A121', 'A122']);
    expect(got.picks.map(p => p.dimension)).toEqual(['LANG', 'ATT']);
  });

  it('clear／partial／not_assessed／no_tool 的維度一支都不配，也不算準備中', () => {
    const f = findings({
      LANG: { band: 'partial' },
      SOC: { band: 'not_assessed', t1Flag: 1 },
      MOT: { band: 'no_tool' },
      COG: { band: 'clear', t1Flag: 2 },
    });
    const library = [act('A', 8, 30), act('B', 12, 30), act('C', 1, 30), act('D', 13, 48)];
    const got = match(f, library);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual([]);
  });
});

describe('可重現（§7.3 第 4 條）', () => {
  it('同輸入跑兩次結果相同；輸入陣列的順序也不影響', () => {
    const library = [
      act('A165', 8, 26, { targets: ['lang.expression'] }),
      act('A162', 8, 34, { targets: ['lang.expression'] }),
      act('A170', 8, 30),
      act('A121', 7, 30, { targets: ['lang.vocabulary_size'] }),
      act('A248', 13, 40, { targets: ['att.inattention'] }),
      act('A249', 13, 41),
    ];
    const a = match(FIXED, library);
    expect(match(FIXED, library)).toEqual(a);
    expect(match(FIXED, [...library].reverse())).toEqual(a);
    expect(a.picks).toHaveLength(4);
  });

  it('同分取離窗口中點近的：[24, 36] 中點 30，30 贏 24 也贏 36', () => {
    const library = [act('A162', 8, 24), act('A161', 8, 36), act('A163', 8, 30)];
    expect(idsFor(match(findings({ LANG: { band: 'refer' } }), library))[0]).toBe('A163');
  });

  it('同分同距離取編號小者', () => {
    const library = [act('A165', 8, 30), act('A162', 8, 30), act('A170', 8, 30)];
    expect(idsFor(match(findings({ LANG: { band: 'refer' } }), library))).toEqual(['A162', 'A165']);
    // 兩側各一支：24 與 36 離 30 都是 6 → 編號小者
    expect(idsFor(match(findings({ LANG: { band: 'refer' } }), [act('A170', 8, 24), act('A169', 8, 36)])))
      .toEqual(['A169', 'A170']);
  });

  it('回傳的 reason 是新物件：改它不影響下一次', () => {
    const library = [act('A160', 8, 30, { targets: ['lang.expression'] })];
    const a = match(findings({ LANG: LANG_REFER }), library);
    a.picks[0].reason.matchedTags.push('lang.pragmatics');
    a.picks[0].reason.window.lo = 0;
    expect(match(findings({ LANG: LANG_REFER }), library).picks[0].reason)
      .toEqual({ band: 'refer', window: { lo: 24, hi: 36 }, matchedTags: ['lang.expression'], belowWindow: false });
  });
});

describe('退路（§7.3）：只往下、只一支、順序固定', () => {
  const LANG_ONLY = findings({ LANG: { band: 'refer', tags: ['lang.expression'] } });

  it('窗口內無活動、窗口下方有 → 取最接近下限那支，reason 標明 belowWindow', () => {
    const library = [act('A162', 8, 12), act('A161', 8, 20), act('A160', 8, 6)];
    const got = match(LANG_ONLY, library);
    expect(idsFor(got)).toEqual(['A161']);
    expect(got.picks[0].reason).toEqual({
      band: 'refer', window: { lo: 24, hi: 36 }, matchedTags: [], belowWindow: true,
    });
    expect(got.preparing).toEqual([]);
  });

  it('退路只給一支：refer 有 2 個名額，第二個名額不再往下取', () => {
    const library = [act('A162', 8, 20), act('A161', 8, 20), act('A160', 8, 18)];
    expect(idsFor(match(LANG_ONLY, library))).toHaveLength(1);
  });

  it('下方同月齡有幾支時，照打分挑（★ 對上的贏）、再編號小者', () => {
    const library = [act('A162', 8, 20), act('A161', 8, 20, { targets: ['lang.expression'] }), act('A160', 8, 20)];
    const got = match(LANG_ONLY, library);
    expect(idsFor(got)).toEqual(['A161']);
    expect(got.picks[0].reason.matchedTags).toEqual(['lang.expression']);
    expect(idsFor(match(LANG_ONLY, [act('A162', 8, 20), act('A160', 8, 20)]))).toEqual(['A160']);
  });

  it('窗口上方有、下方無 → 不取，該維度準備中', () => {
    const library = [act('A160', 8, 37), act('A161', 8, 48), act('A162', 8, 60)];
    const got = match(LANG_ONLY, library);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual(['LANG']);
  });

  it('窗口內有一支就不退路：第二個名額空著，不往下補', () => {
    const library = [act('A160', 8, 30), act('A161', 8, 20)];
    expect(idsFor(match(LANG_ONLY, library))).toEqual(['A160']);
  });

  it('退路也守 avoidIf、停用、targetMonth null', () => {
    const f = findings({ LANG: { band: 'refer', tags: ['lang.expression', 'sen.tactile'] } });
    const library = [
      act('A160', 8, 22, { avoidIf: ['sen.tactile'] }),
      act('A161', 8, 21, { active: false }),
      act('A162', 8, null),
      act('A163', 8, 18),
    ];
    expect(idsFor(match(f, library))).toEqual(['A163']);
  });

  it('退路那一支已被別的維度拿走時，取下一支最接近的', () => {
    // 模組 7 屬於 ATT 與 LANG。ATT refer 窗口 [24, 36] 內有 A121；LANG watch 窗口 [36, 42] 內沒有、
    // 下方最接近的也是 A121。ATT 排前面先拿走 A121，LANG 退路改拿 A122
    const f = findings({ ATT: { band: 'refer' }, LANG: { band: 'watch' } });
    const library = [act('A121', 7, 30), act('A122', 7, 28)];
    const got = match(f, library);
    expect(got.picks.map(p => [p.dimension, p.activity.id])).toEqual([['ATT', 'A121'], ['LANG', 'A122']]);
    expect(got.picks[1].reason.belowWindow).toBe(true);
  });
});

/**
 * 舊干預包測試（`test/interventionMatch.test.ts`「不退回鄰近年齡段、不退回通用方案」）搬過來。
 * 那邊的「格」是（維度，年齡段，嚴重度）；這邊是（維度的模組群，band 的窗口）。主張不變：
 * **取出來的必須是那一格、或那一格往下的東西，不是像那一格的東西**。
 */
describe('不跨維度、不跨模組群、不往上取（舊測試搬入）', () => {
  const LANG_ONLY = findings({ LANG: { band: 'refer' } });

  it('同模組群、但活動在上方的年齡段 —— 準備中（不退回鄰近年齡段）', () => {
    // 對 48 個月 refer 的孩子，[24, 36] 上方的 37–42 是 watch 的窗口，也不拿
    const neighbours = [act('A160', 8, 40), act('A161', 8, 50)];
    const got = match(LANG_ONLY, neighbours);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual(['LANG']);
  });

  it('同模組群、但只合另一個 band 的窗口 —— 準備中（不退回另一個嚴重度）', () => {
    // A160 在 watch 的 [36, 42]，孩子是 refer
    expect(match(LANG_ONLY, [act('A160', 8, 38)]).preparing).toEqual(['LANG']);
    // 反過來，refer 窗口裡的活動對 watch 的孩子是往下取（退路），不是準備中 —— 那是規格明寫的往前取
    const watch = match(findings({ LANG: { band: 'watch' } }), [act('A160', 8, 30)]);
    expect(idsFor(watch)).toEqual(['A160']);
    expect(watch.picks[0].reason.belowWindow).toBe(true);
  });

  it('同窗口、但別的維度的模組群 —— 準備中（不跨維度）', () => {
    // SOC 的模組 12 在窗口內有活動；LANG 一支都沒有
    const f = findings({ LANG: { band: 'refer' }, SOC: { band: 'refer' } });
    const got = match(f, [act('A230', 12, 30), act('A231', 12, 30)]);
    expect(idsFor(got, 'LANG')).toEqual([]);
    expect(idsFor(got, 'SOC')).toEqual(['A230', 'A231']);
    expect(got.preparing).toEqual(['LANG']);
  });

  it('`DIM_MOD` 以外的模組不補（不跨模組群），即使活動自己的 dimensions 寫著這個維度', () => {
    // 模組 6「自己來」不在 LANG 的模組群；後台把它的 dimensions 改成 LANG 也不算
    const generic = act('A110', 6, 30, { dimensions: ['LANG'] });
    expect(match(LANG_ONLY, [generic]).preparing).toEqual(['LANG']);
  });

  it('模組群裡 targetMonth 全是 null —— 準備中，不退回 ageMonths', () => {
    const untouched = [act('A160', 8, null, { ageMonths: { min: 24, max: 36 } }), act('A161', 8, null)];
    const got = match(LANG_ONLY, untouched);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual(['LANG']);
  });

  it('其他維度、其他窗口全滿、獨缺這一格 —— 仍然準備中', () => {
    const everythingElse: Activity[] = [];
    for (const d of NINE) {
      if (d === 'LANG') continue;
      for (const m of DIM_MOD[d]) {
        if (DIM_MOD.LANG.includes(m)) continue;
        for (const t of [6, 12, 18, 24, 30, 36, 42, 48, 60]) everythingElse.push(act(`${d}-${m}-${t}`, m, t));
      }
    }
    // LANG 自己的模組群只有上方的
    everythingElse.push(act('A160', 8, 42), act('A161', 7, 48), act('A162', 9, 60), act('A163', 11, 72));
    const got = match(LANG_ONLY, everythingElse);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual(['LANG']);
  });
});

describe('停用與空活動庫（舊測試搬入）', () => {
  const LANG_ONLY = findings({ LANG: { band: 'refer' } });

  it('活動已停用 —— 準備中，不是配到', () => {
    expect(match(LANG_ONLY, [act('A160', 8, 30, { active: false })]).preparing).toEqual(['LANG']);
  });

  it('活動庫整個是空的 —— 有標記的維度全部準備中，依 §8 排序', () => {
    const f = findings({ ATT: { band: 'watch' }, LANG: { band: 'refer' }, SOC: { band: 'watch' } });
    const got = match(f, []);
    expect(got.picks).toEqual([]);
    expect(got.preparing).toEqual(['LANG', 'SOC', 'ATT']);
  });

  it('同一支有停用與啟用兩列時只看啟用的那一列', () => {
    const both = [act('A160', 8, 30, { active: false, title: '旧的' }), act('A160', 8, 30, { title: '新的' })];
    expect(match(LANG_ONLY, both).picks.map(p => p.activity.title)).toEqual(['新的']);
  });

  it('`targetMonth` null 的活動在任何窗口都不出現，也不擋別的活動', () => {
    for (const [band, age] of [['refer', 48], ['watch', 48], ['refer', 10], ['watch', 100]] as Array<[Band, number]>) {
      const f = findings({ LANG: { band } });
      const { lo } = windowFor(band, age);
      const library = [act('A160', 8, null), act('A161', 8, lo)];
      expect(idsFor(match(f, library, age)), `${band}@${age}`).toEqual(['A161']);
    }
  });
});

describe('輸入守衛', () => {
  it('活動配對用的是傳進來的實足月齡，不是 findings 裡的測評月齡', () => {
    // findings 記 48；孩子現在 60。refer 在 36–72 的窗口是 [36, 48]，不是 [24, 36]
    const library = [act('A160', 8, 30), act('A161', 8, 42)];
    const got = match(findings({ LANG: { band: 'refer' } }), library, 60);
    expect(idsFor(got)).toEqual(['A161']);
    expect(got.picks[0].reason.window).toEqual({ lo: 36, hi: 48 });
  });

  it('findings 不是剛好九個維度就丟錯：少一個、同一個維度重複兩次都算', () => {
    const f = findings({ LANG: { band: 'refer' } });
    expect(() => match({ ...f, dimensions: f.dimensions.slice(0, 8) }, [act('A160', 8, 30)])).toThrow();
    // 重複的那個維度會有兩個 state，配額「同維度 ≤ 2」就守不住
    const lang = f.dimensions.find(d => d.dimensionId === 'LANG')!;
    expect(() => match({ ...f, dimensions: [...f.dimensions, lang] }, [act('A160', 8, 30)])).toThrow();
  });
});

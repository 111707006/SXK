import { describe, it, expect } from 'vitest';
import {
  adjustmentFromCompletion,
  candidatesFor,
  monthIndexOf,
  monthWindows,
  periodAlternates,
  planActivityIds,
  replaceInactive,
  periodWindow,
  planPeriod,
  variantFor,
  type PlanPeriodInput,
} from '../src/t2/trainingPush';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIM_MOD } from '../src/t2/activityMatch';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Activity, DimensionBand, DimensionCode, T1Flag } from '../src/t2/types';

/**
 * 一期（T2 v3 規格 §4）：月齡窗、從模組裡依編號挑、36 格。活動庫用真的 300 支種子（`ACTIVITY_SEED`，
 * 編號、模組、適齡區間都是客戶原文算出來的），不自己編。
 */

const LIBRARY: ReadonlyArray<Activity> = ACTIVITY_SEED;

function dims(over: Partial<Record<DimensionCode, DimensionBand | [DimensionBand, T1Flag]>> = {}): PlanPeriodInput['dimensions'] {
  return DIMENSION_CODES.map(d => {
    const v = over[d] ?? 'clear';
    const [band, t1Flag] = Array.isArray(v) ? v : [v, 0 as T1Flag];
    return { dimensionId: d, band, t1Flag };
  });
}

const ids = (plan: ReturnType<typeof planPeriod>) => plan.weeks.flat().map(s => s.activityId);
const overlaps = (a: Activity, [lo, hi]: [number, number]) => a.ageMonths.min <= hi && a.ageMonths.max >= lo;
const byId = new Map(LIBRARY.map(a => [a.id, a] as const));

describe('第三關：月齡窗', () => {
  it('原文例子：4 岁（48 个月）语言判红 24–36、感觉处理判橙 36–42、动作判绿 42–54', () => {
    expect(periodWindow('red', 48)).toEqual([24, 36]);
    expect(periodWindow('orange', 48)).toEqual([36, 42]);
    expect(periodWindow('green', 48)).toEqual([42, 54]);
  });

  it('窗口最低到 0 个月为止，不会算出负数', () => {
    expect(periodWindow('red', 4)).toEqual([0, 1]);
    expect(periodWindow('red', 2)).toEqual([0, 0]);
  });

  it('三个月逐月上移：24–36 → 24–28、28–32、32–36', () => {
    expect(monthWindows([24, 36])).toEqual([
      [24, 28],
      [28, 32],
      [32, 36],
    ]);
  });

  it('做法：简单 → 标准 → 难一点；「进步良好」全用难一点、「执行困难」全用简单', () => {
    expect([0, 1, 2].map(m => variantFor(m, 'none'))).toEqual(['easy', 'standard', 'hard']);
    expect([0, 1, 2].map(m => variantFor(m, 'stable'))).toEqual(['easy', 'standard', 'hard']);
    expect([0, 1, 2].map(m => variantFor(m, 'good'))).toEqual(['hard', 'hard', 'hard']);
    expect([0, 1, 2].map(m => variantFor(m, 'hard'))).toEqual(['easy', 'easy', 'easy']);
  });
});

describe('第四、五關：從模組裡依編號挑', () => {
  it('原文例子：4 岁语言判红、窗口 24–36 → 只在 121–180、201–220 号里，月龄有重叠的按编号排', () => {
    const list = candidatesFor('LANG', [24, 36], LIBRARY);
    const inside = list.filter(c => !c.relaxed).map(c => c.activity);
    expect(inside.length).toBeGreaterThan(4);
    for (const a of inside) {
      expect(DIM_MOD.LANG).toContain(a.moduleNo);
      expect(overlaps(a, [24, 36]), a.id).toBe(true);
    }
    expect(inside.map(a => a.id)).toEqual([...inside.map(a => a.id)].sort());
    expect(inside[0].id >= 'A121').toBe(true);
  });

  it('窗口內的全部排在放寬的前面；放寬的依距離近→遠、同距離先往下', () => {
    const list = candidatesFor('MOT', [0, 1], LIBRARY);
    const firstRelaxed = list.findIndex(c => c.relaxed);
    expect(list.slice(firstRelaxed).every(c => c.relaxed)).toBe(true);
    const gaps = list.slice(firstRelaxed).map(c => c.activity.ageMonths.min - 1);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  it('不跨模組群：放寬也只在該能力的模組裡', () => {
    for (const d of DIMENSION_CODES) {
      for (const c of candidatesFor(d, [500, 600], LIBRARY)) expect(DIM_MOD[d]).toContain(c.activity.moduleNo);
    }
  });

  it('上一期練過的（stable）排到同一段的最後：先用沒練過的', () => {
    const plain = candidatesFor('LANG', [24, 36], LIBRARY).filter(c => !c.relaxed);
    const avoid = new Set(plain.slice(0, 2).map(c => c.activity.id));
    const again = candidatesFor('LANG', [24, 36], LIBRARY, { avoid }).filter(c => !c.relaxed);
    expect(again.slice(0, -2).every(c => !avoid.has(c.activity.id))).toBe(true);
    expect(again.slice(-2).map(c => c.activity.id).sort()).toEqual([...avoid].sort());
  });
});

describe('planPeriod：一期 36 格', () => {
  const example = planPeriod({ dimensions: dims({ LANG: 'refer', COG: 'refer', ATT: 'watch', SEN: 'watch' }), ageMonth: 48, library: LIBRARY });

  it('原文第六節例子：语言 4、认知 4、注意力 2、感觉处理 2；12 週、每週 3 格', () => {
    expect(example.dimensions.map(d => [d.dimension, d.quota])).toEqual([
      ['LANG', 4],
      ['COG', 4],
      ['ATT', 2],
      ['SEN', 2],
    ]);
    expect(example.weeks).toHaveLength(12);
    expect(example.weeks.every(w => w.length === 3)).toBe(true);
    expect(example.weeks.map(w => w.map(s => s.week)).flat()).toEqual(Array.from({ length: 12 }, (_, i) => [i + 1, i + 1, i + 1]).flat());
  });

  it('一期之內不重複（任何能力都算）', () => {
    const got = ids(example).filter((x): x is string => x !== null);
    expect(new Set(got).size).toBe(got.length);
    expect(got).toHaveLength(36);
  });

  it('每一格的活動在該能力的模組裡；沒放寬的那幾格，適齡與那個月的窗口有重疊', () => {
    for (const slot of example.weeks.flat()) {
      const a = byId.get(slot.activityId!)!;
      expect(DIM_MOD[slot.dimension]).toContain(a.moduleNo);
      if (!slot.reason.relaxed) expect(overlaps(a, slot.reason.window), `${slot.week} ${a.id}`).toBe(true);
    }
  });

  it('同一能力、同一個月，依編號由小到大給（下个月再从新窗口里编号最小的开始）', () => {
    for (let m = 0; m < 3; m++) {
      const month = example.weeks.slice(m * 4, m * 4 + 4).flat();
      for (const d of ['LANG', 'COG', 'ATT', 'SEN'] as const) {
        const picked = month.filter(s => s.dimension === d && !s.reason.relaxed).map(s => s.activityId!);
        expect(picked, `${m} ${d}`).toEqual([...picked].sort());
      }
    }
  });

  it('三個月的做法：简单、标准、难一点；三個月的窗口不同', () => {
    expect([0, 4, 8].map(w => example.weeks[w][0].variant)).toEqual(['easy', 'standard', 'hard']);
    const lang = example.weeks.flat().filter(s => s.dimension === 'LANG');
    expect(new Set(lang.map(s => JSON.stringify(s.reason.window))).size).toBe(3);
  });

  it('「為什麼給」：顏色、來源（T2 分級／T1 推定）、模組、窗口', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer', SEN: 'partial' }), t1Scores: { SEN: 6 }, ageMonth: 48, library: LIBRARY });
    const lang = plan.weeks.flat().find(s => s.dimension === 'LANG')!;
    const sen = plan.weeks.flat().find(s => s.dimension === 'SEN')!;
    expect(lang.reason).toMatchObject({ color: 'red', source: 't2', window: [24, 28], relaxed: false });
    expect(sen.reason).toMatchObject({ color: 'orange', source: 't1' });
    expect(DIM_MOD.LANG).toContain(lang.reason.module);
  });

  it('九維全綠 → 语言、动作、认知各 4，綠色窗口（上下都有）', () => {
    const plan = planPeriod({ dimensions: dims(), ageMonth: 48, library: LIBRARY });
    expect(plan.dimensions.map(d => [d.dimension, d.quota, d.window])).toEqual([
      ['LANG', 4, [42, 54]],
      ['MOT', 4, [42, 54]],
      ['COG', 4, [42, 54]],
    ]);
  });

  it('期末「进步良好」：顏色往輕一格重算窗口、全用难一点、每週 3', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 48, library: LIBRARY, adjustment: 'good' });
    const lang = plan.dimensions.find(d => d.dimension === 'LANG')!;
    expect([lang.color, lang.windowColor, lang.window]).toEqual(['red', 'orange', [36, 42]]); // 原文「窗口变成 36 到 42 个月」
    expect(plan.perWeek).toBe(3);
    expect(plan.weeks.flat().every(s => s.variant === 'hard')).toBe(true);
  });

  it('移一檔只動窗口：參加的能力與名額照評估的顏色（原本綠的不會冒出來、原本橙的不會消失）', () => {
    const good = planPeriod({ dimensions: dims({ LANG: 'refer', ATT: 'watch' }), ageMonth: 48, library: LIBRARY, adjustment: 'good' });
    // 红 3、橙 2 → 7.2／4.8 → 6（上限）／5 不滿 12，依序補动作（綠、權重 1）→ 6／4／2
    expect(good.dimensions.map(d => [d.dimension, d.color, d.windowColor, d.quota])).toEqual([
      ['LANG', 'red', 'orange', 6],
      ['ATT', 'orange', 'green', 4],
      ['MOT', 'green', 'green', 2],
    ]);
  });

  it('期末「执行困难」：窗口往重一格、每週 2（每月 8）、全用简单', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'watch', MOT: 'watch' }), ageMonth: 48, library: LIBRARY, adjustment: 'hard' });
    expect(plan.dimensions.map(d => [d.color, d.windowColor])).toEqual([['orange', 'red'], ['orange', 'red']]);
    expect(plan.perWeek).toBe(2);
    expect(plan.weeks.every(w => w.length === 2)).toBe(true);
    expect(plan.weeks.flat().every(s => s.variant === 'easy')).toBe(true);
  });

  it('期末「稳定」：先避開上一期的 36 支（只换活动内容）', () => {
    const first = planPeriod({ dimensions: dims({ LANG: 'refer', MOT: 'watch' }), ageMonth: 48, library: LIBRARY });
    const prev = ids(first).filter((x): x is string => x !== null);
    const next = planPeriod({ dimensions: dims({ LANG: 'refer', MOT: 'watch' }), ageMonth: 51, library: LIBRARY, adjustment: 'stable', previousIds: prev });
    const overlap = ids(next).filter(x => x !== null && prev.includes(x));
    expect(overlap.length).toBeLessThan(prev.length / 3);
  });

  it('停用的活動不排', () => {
    const library = LIBRARY.map(a => (a.id === 'A121' ? { ...a, active: false } : a));
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 12, library });
    expect(ids(plan)).not.toContain('A121');
  });

  it('示範片模式：只排有片的，不看模組與窗口', () => {
    const library = LIBRARY.map(a => (['A001', 'A002', 'A003', 'A004'].includes(a.id) ? { ...a, videoUrl: `/media/activities/${a.id}.mp4` } : a));
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 48, library, sampleOnly: true });
    const got = ids(plan).filter(x => x !== null);
    expect(new Set(got)).toEqual(new Set(['A001', 'A002', 'A003', 'A004']));
    expect(plan.weeks.flat().filter(s => s.activityId === null).length).toBe(36 - 4);
  });

  it('同輸入兩次結果相同（純函式）', () => {
    const input = { dimensions: dims({ LANG: 'refer', EMO: 'watch' }), ageMonth: 30, library: LIBRARY };
    expect(planPeriod(input)).toEqual(planPeriod(input));
  });

  it('九個維度不齊或月齡不對就丟錯', () => {
    expect(() => planPeriod({ dimensions: dims().slice(1), ageMonth: 30, library: LIBRARY })).toThrow();
    expect(() => planPeriod({ dimensions: dims(), ageMonth: -1, library: LIBRARY })).toThrow();
    expect(() => planPeriod({ dimensions: dims(), ageMonth: 2.5, library: LIBRARY })).toThrow();
  });

  it('窮舉 0–216 個月 × 幾種顏色組合：不丟錯、36 格、不重複、每格都排得到活動', () => {
    const combos: Array<Partial<Record<DimensionCode, DimensionBand>>> = [
      {},
      { LANG: 'refer' },
      { MOT: 'watch', SEN: 'watch' },
      { EMO: 'refer', SOC: 'refer', ADL: 'watch' },
      Object.fromEntries(DIMENSION_CODES.map(d => [d, 'refer'])),
      { LEARN: 'not_screened', ATT: 'not_screened' },
    ];
    const bad: string[] = [];
    for (let age = 0; age <= 216; age++) {
      for (const over of combos) {
        const plan = planPeriod({ dimensions: dims(over), ageMonth: age, library: LIBRARY });
        const got = ids(plan);
        const real = got.filter(x => x !== null);
        if (got.length !== 36 || real.length !== 36 || new Set(real).size !== 36) bad.push(`${age} ${JSON.stringify(over)}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('開期之後', () => {
  const base = planPeriod({ dimensions: dims({ LANG: 'refer', MOT: 'watch' }), ageMonth: 48, library: LIBRARY });

  it('第幾週 → 第幾個月：1–4 → 0、5–8 → 1、9–12 → 2，超過 12 照最後一個月', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 30].map(monthIndexOf)).toEqual([0, 0, 1, 1, 2, 2, 2, 2]);
  });

  it('換著玩：同能力、這個月窗口內、不在這一期 36 格裡，依編號最多 5 支', () => {
    const alt = periodAlternates(base, 1, LIBRARY);
    const planned = new Set(planActivityIds(base));
    for (const [d, list] of Object.entries(alt) as Array<[DimensionCode, Activity[]]>) {
      expect(list.length).toBeLessThanOrEqual(5);
      const dim = base.dimensions.find(x => x.dimension === d)!;
      for (const a of list) {
        expect(planned.has(a.id)).toBe(false);
        expect(DIM_MOD[d]).toContain(a.moduleNo);
        expect(overlaps(a, dim.monthWindows[0])).toBe(true);
      }
      expect(list.map(a => a.id)).toEqual([...list.map(a => a.id)].sort());
    }
  });

  it('停用補位：那一週停用的那一格換成下一支沒排過的，標 replaced；其他週不動', () => {
    const victim = base.weeks[4][0];
    const library = LIBRARY.map(a => (a.id === victim.activityId ? { ...a, active: false } : a));
    const next = replaceInactive(base, 5, library);
    const slot = next.weeks[4][0];
    expect(slot.activityId).not.toBe(victim.activityId);
    expect(slot.reason.replaced).toBe(true);
    expect(slot.dimension).toBe(victim.dimension);
    expect(planActivityIds(base)).not.toContain(slot.activityId);
    expect(next.weeks.filter((_, i) => i !== 4)).toEqual(base.weeks.filter((_, i) => i !== 4));
    expect(replaceInactive(base, 5, LIBRARY)).toBe(base);
  });

  it('期末判檔：≥80% 进步良好、50–79% 稳定、<50% 执行困难；算不出來當稳定', () => {
    expect([0.8, 0.95, 0.79, 0.5, 0.49, 0, null].map(adjustmentFromCompletion)).toEqual([
      'good',
      'good',
      'stable',
      'stable',
      'hard',
      'hard',
      'stable',
    ]);
  });
});

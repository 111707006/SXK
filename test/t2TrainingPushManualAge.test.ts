import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ageSpanOf,
  assertPushManualAgeSwitch,
  candidatesFor,
  planActivityIds,
  planPeriod,
  replaceInactive,
  targetCloseness,
  type PlanPeriodInput,
} from '../src/t2/trainingPush';
import { planFrom, storedPlanOf } from '../src/db/t2TrainingPeriods';
import { weeklyActivitiesOf } from '../src/t2/trainingPeriodService';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';
import type { ActivityTag } from '../src/t2/findingTags';
import type { Activity, DimensionBand, DimensionCode } from '../src/t2/types';

/**
 * 推送用手冊適齡區間對月齡窗（`TRAINING_PUSH_MANUAL_AGE`，ADR-0019）。
 * 活動庫＝300 支種子套上 11/16 那一批影片標籤（正式站現況）。
 */

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'deploy', 'activity-tags', '2026-11-16-videos.json'), 'utf8')) as
  | { rows: Array<{ id: string; targetMonth: number; targets: ActivityTag[] }> }
  | Array<{ id: string; targetMonth: number; targets: ActivityTag[] }>;
const ROWS = Array.isArray(raw) ? raw : raw.rows;
const BY_ID = new Map(ROWS.map(r => [r.id, r] as const));
const TAGGED: ReadonlyArray<Activity> = ACTIVITY_SEED.map(a => {
  const r = BY_ID.get(a.id);
  return r ? { ...a, videoUrl: `/media/activities/${a.id}.mp4`, targetMonth: r.targetMonth, targets: r.targets } : a;
});

function dims(over: Partial<Record<DimensionCode, DimensionBand>> = {}): PlanPeriodInput['dimensions'] {
  return DIMENSION_CODES.map(d => ({ dimensionId: d, band: over[d] ?? 'clear', t1Flag: 0 as const }));
}
const fake = (id: string, over: Partial<Activity>): Activity => ({ ...ACTIVITY_SEED[0], id, videoUrl: '/v.mp4', ...over });

describe('ageSpanOf／targetCloseness', () => {
  const a = fake('A900', { targets: ['mot.balance'], targetMonth: 66, ageMonths: { min: 36, max: 96 } });

  it('手冊適齡模式：貼過標籤的也用手冊區間；沒開照舊是那一個點', () => {
    expect(ageSpanOf(a, true, true)).toEqual({ min: 36, max: 96 });
    expect(ageSpanOf(a, true)).toEqual({ min: 66, max: 66 });
    expect(ageSpanOf(a, false, true)).toEqual({ min: 36, max: 96 });
  });

  it('離窗口近的分數小；窗口裡離中間近的更小；沒標月齡的排最後', () => {
    expect(targetCloseness(a, [60, 70])).toBeLessThan(targetCloseness(a, [80, 90]));
    expect(targetCloseness(a, [64, 68])).toBeLessThan(targetCloseness(a, [60, 70]) + 1);
    expect(targetCloseness(fake('A901', { targets: [], targetMonth: null }), [60, 70])).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('candidatesFor：手冊適齡模式', () => {
  const pool = [
    fake('A900', { targets: ['mot.balance'], targetMonth: 66, ageMonths: { min: 36, max: 96 } }),
    fake('A901', { targets: ['mot.balance'], targetMonth: 40, ageMonths: { min: 24, max: 96 } }),
    fake('A902', { targets: ['mot.balance'], targetMonth: 30, ageMonths: { min: 24, max: 48 } }),
  ];

  it('80 個月的窗口：點都在窗外，手冊區間有兩支在窗內；離窗口近的先', () => {
    const point = candidatesFor('MOT', [78, 82], pool, { tagged: true });
    expect(point.every(c => c.relaxed)).toBe(true);
    const manual = candidatesFor('MOT', [78, 82], pool, { tagged: true, manualAge: true });
    expect(manual.map(c => [c.activity.id, c.relaxed])).toEqual([
      ['A900', false],
      ['A901', false],
      ['A902', true],
    ]);
  });

  it('不是標籤模式時這個選項不作用', () => {
    expect(candidatesFor('MOT', [78, 82], pool, { manualAge: true }).map(c => c.activity.id))
      .toEqual(candidatesFor('MOT', [78, 82], pool).map(c => c.activity.id));
  });
});

describe('planPeriod：手冊適齡模式', () => {
  /** 9 個月齡 × 5 種紅黃組合各排一期，算有幾成格子是放寬才排進來的（ADR-0019 的模擬）。 */
  function relaxedShare(manualAge: boolean): number {
    const sets: Array<Partial<Record<DimensionCode, DimensionBand>>> = [
      { LANG: 'refer' }, { MOT: 'refer', ATT: 'watch' }, { SOC: 'refer', EMO: 'watch' }, { COG: 'refer', LEARN: 'watch' }, { SEN: 'refer', ADL: 'watch' },
    ];
    let slots = 0;
    let relaxed = 0;
    for (const ageMonth of [8, 18, 30, 42, 54, 66, 80, 100, 130]) {
      for (const over of sets) {
        const p = planPeriod({ dimensions: dims(over), ageMonth, library: TAGGED, tagged: true, manualAge });
        for (const s of p.weeks.flat()) {
          slots++;
          if (s.activityId !== null && s.reason.relaxed) relaxed++;
        }
      }
    }
    return relaxed / slots;
  }

  it('放寬的格子明顯變少（模擬：77% → 30% 左右）', () => {
    const before = relaxedShare(false);
    const after = relaxedShare(true);
    expect(before).toBeGreaterThan(0.6);
    expect(after).toBeLessThan(0.4);
  });

  it('一期記 manualAge；沒開不記；不是標籤模式不記', () => {
    const base = { dimensions: dims({ LANG: 'refer' }), ageMonth: 80, library: TAGGED } as const;
    expect(planPeriod({ ...base, tagged: true, manualAge: true }).manualAge).toBe(true);
    expect('manualAge' in planPeriod({ ...base, tagged: true })).toBe(false);
    expect('manualAge' in planPeriod({ ...base, manualAge: true })).toBe(false);
  });

  it('窮舉幾個月齡：不丟錯、36 格、同一期不重複', () => {
    for (const ageMonth of [3, 12, 24, 48, 72, 96, 144, 200]) {
      const p = planPeriod({ dimensions: dims({ ATT: 'refer', COG: 'watch' }), ageMonth, library: TAGGED, tagged: true, manualAge: true, childTags: ['att.working_memory'] });
      expect(p.weeks.flat()).toHaveLength(36);
      const ids = planActivityIds(p);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('停用補位照那一期的手冊適齡模式；往前取的標記看手冊區間', () => {
    const p = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 80, library: TAGGED, tagged: true, manualAge: true });
    const slot = p.weeks[0].find(s => s.activityId)!;
    const next = replaceInactive(p, 1, TAGGED.map(a => (a.id === slot.activityId ? { ...a, active: false } : a)));
    expect(next.manualAge).toBe(true);
    const week = weeklyActivitiesOf({ periodNo: 1, plan: storedPlanOf(p) }, 1, TAGGED);
    for (const pick of week.picks) {
      const a = TAGGED.find(x => x.id === pick.id)!;
      if (pick.reason.belowWindow) expect(a.ageMonths.max).toBeLessThan(pick.reason.window.lo);
    }
  });
});

describe('存與讀', () => {
  it('manualAge 存得下、讀得回；之前的一期沒有這一欄；不是 true 讀不動', () => {
    const p = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 60, library: TAGGED, tagged: true, manualAge: true });
    const stored = storedPlanOf(p);
    expect(planFrom(JSON.stringify(stored))?.manualAge).toBe(true);
    const { manualAge: _drop, ...old } = stored;
    expect(planFrom(JSON.stringify(old))?.manualAge).toBeUndefined();
    expect(planFrom(JSON.stringify({ ...stored, manualAge: false }))).toBeNull();
  });
});

describe('開關', () => {
  it('TRAINING_PUSH_MANUAL_AGE 要配 TRAINING_PUSH_TAGS', () => {
    expect(() => assertPushManualAgeSwitch(true, false)).toThrow(/TRAINING_PUSH_TAGS/);
    expect(() => assertPushManualAgeSwitch(true, true)).not.toThrow();
    expect(() => assertPushManualAgeSwitch(false, false)).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assertPushTagsSwitch,
  candidatesFor,
  periodAlternates,
  planPeriod,
  replaceInactive,
  type PlanPeriodInput,
} from '../src/t2/trainingPush';
import { planFrom, storedPlanOf } from '../src/db/t2TrainingPeriods';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';
import type { ActivityTag } from '../src/t2/findingTags';
import type { Activity, DimensionBand, DimensionCode } from '../src/t2/types';

/**
 * 推送看標籤（`TRAINING_PUSH_TAGS`，ADR-0015，客戶 11/03 簡報第 26 頁「換著玩每個維度都是同樣五支」）。
 * 活動庫＝300 支種子＋正式站有示範片的 94 支套上 `deploy/activity-tags/2026-11-07-videos.json` 的草稿。
 */

const DRAFT = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'deploy', 'activity-tags', '2026-11-07-videos.json'), 'utf8'),
) as { rows: Array<{ id: string; targetMonth: number; targets: ActivityTag[] }> };
const DRAFT_BY_ID = new Map(DRAFT.rows.map(r => [r.id, r] as const));

/** 標籤還沒匯入、但片子都在的樣子（＝正式站現況，`target_month` 是虛構值）。 */
const VIDEOS_ONLY: ReadonlyArray<Activity> = ACTIVITY_SEED.map(a =>
  DRAFT_BY_ID.has(a.id) ? { ...a, videoUrl: `/media/activities/${a.id}.mp4`, targetMonth: 100 } : a,
);
/** 匯入草稿之後。 */
const TAGGED: ReadonlyArray<Activity> = ACTIVITY_SEED.map(a => {
  const r = DRAFT_BY_ID.get(a.id);
  return r ? { ...a, videoUrl: `/media/activities/${a.id}.mp4`, targetMonth: r.targetMonth, targets: r.targets } : a;
});
const byId = new Map(TAGGED.map(a => [a.id, a] as const));

function dims(over: Partial<Record<DimensionCode, DimensionBand>> = {}): PlanPeriodInput['dimensions'] {
  return DIMENSION_CODES.map(d => ({ dimensionId: d, band: over[d] ?? 'clear', t1Flag: 0 as const }));
}

const fake = (id: string, over: Partial<Activity>): Activity => ({ ...ACTIVITY_SEED[0], id, videoUrl: '/v.mp4', ...over });

describe('candidatesFor：標籤模式', () => {
  const pool = [
    fake('A900', { moduleNo: 1, targets: ['lang.expression'], targetMonth: 30 }), // 模組一但標的是語言
    fake('A901', { moduleNo: 8, targets: ['mot.balance'], targetMonth: 30 }), // 模組八但標的是動作
    fake('A902', { moduleNo: 1, targets: [], targetMonth: 30, ageMonths: { min: 24, max: 96 } }), // 沒貼標籤
    fake('A903', { moduleNo: 1, targets: ['mot.postural'], targetMonth: 80, ageMonths: { min: 24, max: 96 } }),
  ];

  it('貼過標籤的看標籤歸哪個維度、不看模組；沒貼的照舊看模組群', () => {
    const got = candidatesFor('MOT', [24, 36], pool, { tagged: true }).map(c => c.activity.id);
    expect(got).toContain('A901');
    expect(got).toContain('A902');
    expect(got).not.toContain('A900');
    expect(candidatesFor('LANG', [24, 36], pool, { tagged: true }).map(c => c.activity.id)).toContain('A900');
  });

  it('貼過標籤的月齡看 targetMonth（手冊適齡蓋到窗口也不算窗口內）；同窗口內貼過的先', () => {
    const got = candidatesFor('MOT', [24, 36], pool, { tagged: true });
    expect(got.map(c => [c.activity.id, c.relaxed])).toEqual([
      ['A901', false],
      ['A902', false],
      ['A903', true],
    ]);
  });

  it('沒開標籤模式：一行不動（模組群＋手冊適齡）', () => {
    const got = candidatesFor('MOT', [24, 36], pool).map(c => c.activity.id);
    expect(got).toEqual(['A900', 'A902', 'A903']);
  });
});

describe('planPeriod：標籤模式', () => {
  it('只排有示範片的；sampleOnly 同時開著也照標籤排；一期記 tagged', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer', EMO: 'watch' }), ageMonth: 36, library: TAGGED, sampleOnly: true, tagged: true });
    expect(plan.tagged).toBe(true);
    expect(plan.sampleOnly).toBe(false);
    for (const s of plan.weeks.flat()) {
      if (s.activityId === null) continue;
      const a = byId.get(s.activityId)!;
      expect(a.videoUrl, s.activityId).not.toBeNull();
      // 每一格都是那個維度的：貼過標籤的有那個維度的標籤
      const prefix = { LANG: 'lang.', EMO: 'emo.', MOT: 'mot.', COG: 'cog.', ATT: 'att.', SEN: 'sen.', LEARN: 'learn.', SOC: 'soc.', ADL: 'adl.' }[s.dimension];
      expect(a.targets.some(t => t.startsWith(prefix)), `${s.dimension} ${s.activityId}`).toBe(true);
    }
  });

  it('簡報第 26 頁：不同維度推的不是同一批片（示範片模式是）', () => {
    const input = { dimensions: dims({ LANG: 'refer', MOT: 'refer', EMO: 'watch' }), ageMonth: 40 };
    const first = (plan: ReturnType<typeof planPeriod>, d: DimensionCode) =>
      plan.weeks.flat().filter(s => s.dimension === d && s.activityId).map(s => s.activityId!);
    const tagged = planPeriod({ ...input, library: TAGGED, tagged: true });
    const lang = new Set(first(tagged, 'LANG'));
    const mot = new Set(first(tagged, 'MOT'));
    expect([...lang].every(id => byId.get(id)!.targets.some(t => t.startsWith('lang.')))).toBe(true);
    expect([...mot].every(id => byId.get(id)!.targets.some(t => t.startsWith('mot.')))).toBe(true);

    const alt = periodAlternates(tagged, 1, TAGGED);
    const lists = Object.values(alt).map(l => l!.map(a => a.id).join(','));
    expect(new Set(lists).size).toBe(lists.length);

    const sample = planPeriod({ ...input, library: VIDEOS_ONLY, sampleOnly: true });
    const sampleAlt = Object.values(periodAlternates(sample, 1, VIDEOS_ONLY)).map(l => l!.map(a => a.id).join(','));
    expect(new Set(sampleAlt).size).toBe(1); // 舊的示範片模式：每個維度同樣五支
  });

  it('標籤還沒匯入（targets 全空）：退回模組群＋手冊適齡，但仍只排有片的', () => {
    const plan = planPeriod({ dimensions: dims({ MOT: 'refer' }), ageMonth: 30, library: VIDEOS_ONLY, tagged: true });
    const got = plan.weeks.flat().filter(s => s.activityId && s.dimension === 'MOT').map(s => byId.get(s.activityId!)!);
    expect(got.length).toBeGreaterThan(0);
    for (const a of got) {
      expect(a.videoUrl).not.toBeNull();
      expect([1, 2, 3, 4, 5]).toContain(a.moduleNo);
    }
  });

  it('窮舉 0–216 個月 × 幾種顏色組合：不丟錯、36 格、同一期不重複', () => {
    const combos: Array<Partial<Record<DimensionCode, DimensionBand>>> = [
      {},
      { LANG: 'refer' },
      { COG: 'refer', ATT: 'watch', LEARN: 'watch' },
      Object.fromEntries(DIMENSION_CODES.map(d => [d, 'refer'])),
    ];
    for (let m = 0; m <= 216; m += 3) {
      for (const c of combos) {
        for (const adjustment of ['none', 'hard'] as const) {
          const plan = planPeriod({ dimensions: dims(c), ageMonth: m, library: TAGGED, tagged: true, adjustment });
          const ids = plan.weeks.flat().flatMap(s => (s.activityId ? [s.activityId] : []));
          expect(plan.weeks).toHaveLength(12);
          expect(new Set(ids).size, `${m} ${JSON.stringify(c)}`).toBe(ids.length);
        }
      }
    }
  }, 60_000);

  it('停用補位照同一個規則：補上來的也是有片、標籤對得上的', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED, tagged: true });
    const target = plan.weeks[0].find(s => s.activityId)!;
    const library = TAGGED.map(a => (a.id === target.activityId ? { ...a, active: false } : a));
    const next = replaceInactive(plan, 1, library);
    const slot = next.weeks[0].find(s => s.reason.replaced)!;
    expect(slot).toBeDefined();
    if (slot.activityId) {
      const a = byId.get(slot.activityId)!;
      expect(a.videoUrl).not.toBeNull();
      expect(a.targets.some(t => t.startsWith('lang.'))).toBe(true);
    }
  });
});

describe('存與讀', () => {
  it('tagged 存得下、讀得回；之前的一期沒有這一欄照樣讀得動；tagged 不是 true 讀不動', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED, tagged: true });
    const stored = storedPlanOf(plan);
    expect(planFrom(JSON.stringify(stored))?.tagged).toBe(true);
    const old = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED });
    expect('tagged' in storedPlanOf(old)).toBe(false);
    expect(planFrom(JSON.stringify(storedPlanOf(old)))).not.toBeNull();
    expect(planFrom(JSON.stringify({ ...stored, tagged: false }))).toBeNull();
  });
});

describe('開關', () => {
  it('TRAINING_PUSH_TAGS 要配 TRAINING_PUSH_V3', () => {
    expect(() => assertPushTagsSwitch(true, false)).toThrow(/TRAINING_PUSH_V3/);
    expect(() => assertPushTagsSwitch(true, true)).not.toThrow();
    expect(() => assertPushTagsSwitch(false, false)).not.toThrow();
  });
});

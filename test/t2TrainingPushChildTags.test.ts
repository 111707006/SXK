import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assertPushChildTagsSwitch,
  candidatesFor,
  childMatches,
  periodAlternates,
  planActivityIds,
  planPeriod,
  replaceInactive,
  type PlanPeriodInput,
} from '../src/t2/trainingPush';
import { planFrom, storedPlanOf } from '../src/db/t2TrainingPeriods';
import { weeklyActivitiesOf } from '../src/t2/trainingPeriodService';
import { reasonSentence } from '../src/t2/weeklyCopy';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';
import type { ActivityTag } from '../src/t2/findingTags';
import type { Activity, DimensionBand, DimensionCode } from '../src/t2/types';

/**
 * 推送看孩子的細項（`TRAINING_PUSH_CHILD_TAGS`，ADR-0018）：標籤模式之上，同一個方面裡對中孩子細項的影片先推。
 * 活動庫＝300 支種子套上 11/16 那一批影片標籤（正式站現況）。
 */

const DRAFT = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'deploy', 'activity-tags', '2026-11-16-videos.json'), 'utf8'),
) as { rows: Array<{ id: string; targetMonth: number; targets: ActivityTag[] }> } | Array<{ id: string; targetMonth: number; targets: ActivityTag[] }>;
const ROWS = Array.isArray(DRAFT) ? DRAFT : DRAFT.rows;
const DRAFT_BY_ID = new Map(ROWS.map(r => [r.id, r] as const));
const TAGGED: ReadonlyArray<Activity> = ACTIVITY_SEED.map(a => {
  const r = DRAFT_BY_ID.get(a.id);
  return r ? { ...a, videoUrl: `/media/activities/${a.id}.mp4`, targetMonth: r.targetMonth, targets: r.targets } : a;
});
const byId = new Map(TAGGED.map(a => [a.id, a] as const));

function dims(over: Partial<Record<DimensionCode, DimensionBand>> = {}): PlanPeriodInput['dimensions'] {
  return DIMENSION_CODES.map(d => ({ dimensionId: d, band: over[d] ?? 'clear', t1Flag: 0 as const }));
}

const fake = (id: string, over: Partial<Activity>): Activity => ({ ...ACTIVITY_SEED[0], id, videoUrl: '/v.mp4', ...over });

describe('candidatesFor：孩子的細項', () => {
  const pool = [
    fake('A900', { targets: ['lang.comprehension'], targetMonth: 30 }),
    fake('A901', { targets: ['lang.expression'], targetMonth: 30 }),
    fake('A902', { targets: ['lang.expression', 'lang.pragmatics'], targetMonth: 30 }),
    fake('A903', { targets: ['lang.expression', 'att.inattention'], targetMonth: 80 }), // 窗口外
    fake('A904', { targets: ['lang.comprehension', 'att.inattention'], targetMonth: 30 }),
  ];

  it('窗口內：對中孩子細項多的先，再編號；對不中的照舊補在後面', () => {
    const got = candidatesFor('LANG', [24, 36], pool, { tagged: true, childTags: new Set(['lang.expression', 'lang.pragmatics']) });
    expect(got.map(c => [c.activity.id, c.relaxed])).toEqual([
      ['A902', false],
      ['A901', false],
      ['A900', false],
      ['A904', false],
      ['A903', true],
    ]);
  });

  it('只算這個方面的細項：孩子有「持续注意」，排語言時不因此往前', () => {
    const got = candidatesFor('LANG', [24, 36], pool, { tagged: true, childTags: new Set(['att.inattention']) });
    expect(got.map(c => c.activity.id)).toEqual(['A900', 'A901', 'A902', 'A904', 'A903']);
    expect(childMatches(pool[4], 'LANG', new Set(['att.inattention']))).toEqual([]);
    expect(childMatches(pool[4], 'ATT', new Set(['att.inattention']))).toEqual(['att.inattention']);
  });

  it('不傳、空集合、或不是標籤模式：一行不動', () => {
    const base = candidatesFor('LANG', [24, 36], pool, { tagged: true }).map(c => c.activity.id);
    expect(candidatesFor('LANG', [24, 36], pool, { tagged: true, childTags: new Set() }).map(c => c.activity.id)).toEqual(base);
    expect(candidatesFor('LANG', [24, 36], pool, { childTags: new Set(['lang.expression']) }).map(c => c.activity.id))
      .toEqual(candidatesFor('LANG', [24, 36], pool).map(c => c.activity.id));
  });
});

describe('planPeriod：孩子的細項', () => {
  const base = { dimensions: dims({ LANG: 'refer', MOT: 'watch' }), ageMonth: 36, library: TAGGED, tagged: true } as const;

  it('一期記下孩子的細項；對中的影片排在前面幾週', () => {
    const childTags = ['lang.pragmatics'];
    const plan = planPeriod({ ...base, childTags });
    expect(plan.childTags).toEqual(childTags);
    const without = planPeriod(base);
    const langIds = (p: typeof plan) => p.weeks.flat().filter(s => s.dimension === 'LANG' && s.activityId).map(s => s.activityId!);
    const hits = (ids: string[]) => ids.filter(id => byId.get(id)!.targets.includes('lang.pragmatics')).length;
    // 第一個月（前四週）對中的支數不會比沒看細項時少，而且至少一支
    const firstMonth = (p: typeof plan) => p.weeks.slice(0, 4).flat().filter(s => s.dimension === 'LANG' && s.activityId).map(s => s.activityId!);
    expect(hits(firstMonth(plan))).toBeGreaterThan(0);
    expect(hits(firstMonth(plan))).toBeGreaterThanOrEqual(hits(firstMonth(without)));
    // 排出來的格數一樣（對不中的照舊補滿）
    expect(langIds(plan).length).toBe(langIds(without).length);
  });

  it('沒傳 childTags 的一期沒有這一欄（ADR-0015 的形狀不變）；不是標籤模式也不記', () => {
    expect('childTags' in planPeriod(base)).toBe(false);
    expect('childTags' in planPeriod({ ...base, tagged: false, childTags: ['lang.expression'] })).toBe(false);
  });

  it('窮舉幾個月齡 × 細項組合：不丟錯、36 格、同一期不重複', () => {
    for (const ageMonth of [6, 18, 36, 60, 96, 150]) {
      for (const childTags of [[], ['lang.expression'], ['mot.balance', 'emo.regulation', 'emo.anxiety', 'mot.motor_planning']]) {
        const plan = planPeriod({ ...base, ageMonth, childTags });
        expect(plan.weeks.flat()).toHaveLength(36);
        const ids = planActivityIds(plan);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('換著玩與停用補位照那一期的細項', () => {
    const plan = planPeriod({ ...base, childTags: ['lang.expression'] });
    expect(() => periodAlternates(plan, 1, TAGGED)).not.toThrow();
    const slot = plan.weeks[0].find(s => s.activityId)!;
    const library = TAGGED.map(a => (a.id === slot.activityId ? { ...a, active: false } : a));
    const next = replaceInactive(plan, 1, library);
    expect(next.childTags).toEqual(['lang.expression']);
    const replaced = next.weeks[0].find(s => s.reason.replaced)!;
    expect(replaced.activityId).not.toBe(slot.activityId);
  });
});

describe('每週活動的理由句寫對上的那一個', () => {
  it('對中的活動 matchedTags 有值，句子帶「这次看到」；沒有細項的一期照舊是空的', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED, tagged: true, childTags: ['lang.expression'] });
    const stored = storedPlanOf(plan);
    const week = weeklyActivitiesOf({ periodNo: 1, plan: stored }, 1, TAGGED);
    const hit = week.picks.find(p => p.dimension === 'LANG' && byId.get(p.id)!.targets.includes('lang.expression'));
    expect(hit).toBeDefined();
    expect(hit!.reason.matchedTags).toEqual(['lang.expression']);
    expect(reasonSentence('LANG', hit!.reason)).toContain('这次看到');

    const plain = weeklyActivitiesOf({ periodNo: 1, plan: storedPlanOf(planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED, tagged: true })) }, 1, TAGGED);
    for (const p of plain.picks) expect(p.reason.matchedTags).toEqual([]);
  });
});

describe('存與讀', () => {
  it('childTags 存得下、讀得回；之前的一期沒有這一欄照樣讀得動；形狀不對讀不動', () => {
    const plan = planPeriod({ dimensions: dims({ LANG: 'refer' }), ageMonth: 36, library: TAGGED, tagged: true, childTags: ['lang.expression'] });
    const stored = storedPlanOf(plan);
    expect(planFrom(JSON.stringify(stored))?.childTags).toEqual(['lang.expression']);
    const { childTags: _drop, ...old } = stored;
    expect(planFrom(JSON.stringify(old))).not.toBeNull();
    expect(planFrom(JSON.stringify(old))!.childTags).toBeUndefined();
    expect(planFrom(JSON.stringify({ ...stored, childTags: 'lang.expression' }))).toBeNull();
    expect(planFrom(JSON.stringify({ ...stored, childTags: [1] }))).toBeNull();
  });
});

describe('開關', () => {
  it('TRAINING_PUSH_CHILD_TAGS 要配 TRAINING_PUSH_TAGS', () => {
    expect(() => assertPushChildTagsSwitch(true, false)).toThrow(/TRAINING_PUSH_TAGS/);
    expect(() => assertPushChildTagsSwitch(true, true)).not.toThrow();
    expect(() => assertPushChildTagsSwitch(false, false)).not.toThrow();
  });
});

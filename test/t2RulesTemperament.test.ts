import { describe, it, expect } from 'vitest';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, DimensionCode, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { ASD_TOOL_IDS } from '../src/t2/rules/asd';
import { ATTENTION_SENSORY_TOOL_IDS } from '../src/t2/rules/attentionSensory';
import { DEV_ADL_LEARNING_TOOL_IDS } from '../src/t2/rules/devAdlLearning';
import { PUBLIC_TOOL_IDS } from '../src/t2/rules/publicTools';
import { TEMPERAMENT_RULES, TEMPERAMENT_TOOL_IDS } from '../src/t2/rules/temperament';
import { TOOL_RULES, ruleFor } from '../src/t2/rules';

/**
 * 氣質兩支（tempa 1–3 歲、tempb 3–7 歲）的規則表（#51，規格 v2 §5.4、§5.5、§5.9）。
 *
 * 【這裡在防什麼】
 * 1. **不出 band**：氣質描述的是特質不是缺口，任何維度、任何分數都回 `null`。這一條翻錯，
 *    一個活動量大的孩子會被判「情緒需關注」然後拿到情緒活動。
 * 2. 標籤看 `dev` 的**方向**，不只看 `|dev|`：八個向度貼在 hi 端（`dev ≥ 1.0`），只有 D7 堅持度
 *    貼在 lo 端（`dev ≤ −1.0`）—— 堅持不下去才是要留意的事。tier 3 只知道 |dev| ≥ 1.0，
 *    不知道方向，所以規則得讀 `native.dev.<D>`。
 * 3. 「稍偏」（0.42 ≤ |dev| < 1.0）不出標籤，只留在 native。
 *
 * 【兩層】
 * 分界那一層把 `native['dev.Dn']` 換成 ±1.0／±0.99（tier 用 `tierFor` 重算）；端到端那一層
 * 用真的八題作答湊 raw 28（dev 1.0）、27（0.875）、12（−1.0）、13（−0.875）—— dev 是 0.125 的倍數，
 * 0.99 真實作答踩不到。兩支的題目、分段、對應表完全相同，`describe.each` 跑同一組。
 */

const AT = '2026-09-12T00:00:00.000Z';

/** 兩支各在自己的窗口內挑一個月齡（tempa 12–36、tempb 36–84）。 */
const TOOLS: ReadonlyArray<[ToolId, number]> = [['sxk-tempa', 24], ['sxk-tempb', 48]];

const DIM_KEYS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'] as const;

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, computedAt: AT });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

function flat(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

/** 把 `raw` 分配到這些題上（每題 0–5）。放不進去就讓測試自己壞掉。 */
function distribute(target: Record<string, AnswerValue>, keys: ReadonlyArray<string>, raw: number): void {
  let left = raw;
  if (left < 0 || left > 5 * keys.length) throw new Error(`raw ${raw} 放不進 ${keys.length} 題`);
  for (const k of keys) {
    const add = Math.min(5, left);
    target[k] = add;
    left -= add;
  }
}

/**
 * 依「各向度 raw」造一份作答；沒指定的向度給 raw 20（八題均分 2.5、dev 0，兩端之間）。
 * 基準刻意放在 dev 0 而不是全 0 —— 全 0 是每個向度都 dev −2.5，D7 會自己出標籤。
 */
function byDim(toolId: ToolId, ageMonth: number, raws: Partial<Record<(typeof DIM_KEYS)[number], number>>): ToolResult {
  const grouped: Record<string, string[]> = {};
  for (const a of askedItems(toolId, ageMonth)) (grouped[a.sectionKey] ??= []).push(a.key);
  const out: Record<string, AnswerValue> = {};
  for (const [sectionKey, keys] of Object.entries(grouped)) {
    distribute(out, keys, raws[sectionKey as (typeof DIM_KEYS)[number]] ?? 20);
  }
  return score(toolId, ageMonth, out);
}

/** 把某個向度的 dev 換成指定值（tier 用真的 `tierFor` 重算）。 */
function withDev(r: ToolResult, key: string, dev: number): ToolResult {
  const tier = tierFor('profile', TOOLKIT[r.toolId].tiers, Math.abs(dev));
  return {
    ...r,
    sections: { ...r.sections, [key]: { ...r.sections[key], tier } },
    native: { ...r.native, [`dev.${key}`]: dev, [`mean.${key}`]: dev + 2.5 },
  };
}

function bandsOf(toolId: ToolId, r: ToolResult): Record<DimensionCode, Band | null> {
  const rule = ruleFor(toolId);
  return Object.fromEntries(DIMENSION_CODES.map(d => [d, rule.bandFor(r, d)])) as Record<DimensionCode, Band | null>;
}

const ALL_NULL: Record<DimensionCode, Band | null> = {
  COG: null, LANG: null, SOC: null, EMO: null, ATT: null, MOT: null, SEN: null, ADL: null, LEARN: null,
};

/**
 * §5.9 氣質那一列，逐向度重抄：hi 端（dev ≥ 1.0）與 lo 端（dev ≤ −1.0）各出什麼。
 * 空陣列是「那一側不出標籤」。
 */
const TEMPERAMENT_EXPECTED: ReadonlyArray<[(typeof DIM_KEYS)[number], string, ReadonlyArray<string>, ReadonlyArray<string>]> = [
  ['D1', '活动量', ['emo.activity_high'], []],
  ['D2', '规律性', ['emo.regularity_low'], []],
  ['D3', '趋避性', ['emo.slow_to_warm'], []],
  ['D4', '适应度', ['emo.adaptability_low'], []],
  ['D5', '反应强度', ['emo.intensity_high'], []],
  ['D6', '情绪本质', ['emo.mood_negative'], []],
  ['D7', '坚持度', [], ['learn.task_persistence']],
  ['D8', '注意分散度', ['att.inattention'], []],
  ['D9', '反应阈', ['sen.threshold_low'], []],
];

describe.each(TOOLS)('%s', (toolId, age) => {
  const rule = ruleFor(toolId);
  const bank = TOOLKIT[toolId];

  describe('題庫的形狀：九向度各八題、無前置題', () => {
    it('D1–D9 各 8 題', () => {
      expect(bank.sections.map(s => `${s.key}:${s.items.length}`)).toEqual(DIM_KEYS.map(k => `${k}:8`));
      expect(bank.sections.map(s => s.name)).toEqual(TEMPERAMENT_EXPECTED.map(([, name]) => name));
      expect(askedItems(toolId, age)).toHaveLength(72);
      expect(bank.preQuestions).toEqual([]);
    });
  });

  describe('不出 band（§5.4）', () => {
    it('登錄表 producesBand=false；feeds 是 EMO（只用來排 extras）', () => {
      expect(TOOL_SPECS[toolId].producesBand).toBe(false);
      expect(TOOL_SPECS[toolId].feeds.map(f => f.dimension)).toEqual(['EMO']);
    });

    it('全 0、全 5、dev 0、每個向度 ±1.0 —— 九個維度全 null，連 EMO 也是', () => {
      expect(bandsOf(toolId, score(toolId, age, flat(toolId, age, 0)))).toEqual(ALL_NULL);
      expect(bandsOf(toolId, score(toolId, age, flat(toolId, age, 5)))).toEqual(ALL_NULL);
      expect(bandsOf(toolId, byDim(toolId, age, {}))).toEqual(ALL_NULL);
      let r = byDim(toolId, age, {});
      for (const key of DIM_KEYS) r = withDev(r, key, key === 'D7' ? -1 : 1);
      expect(bandsOf(toolId, r)).toEqual(ALL_NULL);
    });

    it('overall 那一格是「—」：tier null；就算硬塞一個 tier 3 進去也還是 null', () => {
      const base = byDim(toolId, age, {});
      expect(base.overall.tier).toBeNull();
      const forced = { ...base, overall: { ...base.overall, tier: 3 as const } };
      expect(bandsOf(toolId, forced)).toEqual(ALL_NULL);
    });
  });

  describe('標籤：dev ≥ 1.0 出 hi 端、dev ≤ −1.0 出 lo 端（§5.5、§5.9）', () => {
    for (const [key, name, hi, lo] of TEMPERAMENT_EXPECTED) {
      it(`${key} ${name}：+1.0 → [${hi.join(',')}]；+0.99 → []；−1.0 → [${lo.join(',')}]；−0.99 → []`, () => {
        const base = byDim(toolId, age, {});
        expect(rule.tags(withDev(base, key, 1.0))).toEqual([...hi]);
        expect(rule.tags(withDev(base, key, 0.99))).toEqual([]);
        expect(rule.tags(withDev(base, key, -1.0))).toEqual([...lo]);
        expect(rule.tags(withDev(base, key, -0.99))).toEqual([]);
        expect(rule.tags(withDev(base, key, 2.5))).toEqual([...hi]);
        expect(rule.tags(withDev(base, key, -2.5))).toEqual([...lo]);
      });
    }

    it('D3 dev 1.0 → emo.slow_to_warm；0.99 → 無（票 #51 的驗收）', () => {
      const base = byDim(toolId, age, {});
      expect(rule.tags(withDev(base, 'D3', 1.0))).toEqual(['emo.slow_to_warm']);
      expect(rule.tags(withDev(base, 'D3', 0.99))).toEqual([]);
    });

    it('D7 dev −1.0 → learn.task_persistence；D7 dev 1.0 → 無（堅持度貼在 lo 端）', () => {
      const base = byDim(toolId, age, {});
      expect(rule.tags(withDev(base, 'D7', -1.0))).toEqual(['learn.task_persistence']);
      expect(rule.tags(withDev(base, 'D7', 1.0))).toEqual([]);
    });

    it('「稍偏」只留在 native：D1 dev 0.5（tier 2）→ 無標籤，native.dev.D1 是 0.5', () => {
      const r = byDim(toolId, age, { D1: 24 });
      expect(r.sections.D1.tier).toBe(2);
      expect(r.native['dev.D1']).toBe(0.5);
      expect(r.native['mean.D1']).toBe(3);
      expect(rule.tags(r)).toEqual([]);
    });

    it('全 5 → 八個 hi 端標籤照 D1–D9 排（沒有 D7）；全 0 → 只有 learn.task_persistence', () => {
      expect(rule.tags(score(toolId, age, flat(toolId, age, 5)))).toEqual([
        'emo.activity_high', 'emo.regularity_low', 'emo.slow_to_warm', 'emo.adaptability_low',
        'emo.intensity_high', 'emo.mood_negative', 'att.inattention', 'sen.threshold_low',
      ]);
      expect(rule.tags(score(toolId, age, flat(toolId, age, 0)))).toEqual(['learn.task_persistence']);
    });

    it('dev 0 → 無標籤；沒有 severe（分段表只有三段）', () => {
      expect(rule.tags(byDim(toolId, age, {}))).toEqual([]);
      expect(rule.tags(score(toolId, age, flat(toolId, age, 5)))).not.toContain('severity.severe');
    });

    it('向度 scored=false → 不出（安全網）', () => {
      const base = withDev(byDim(toolId, age, {}), 'D3', 1.0);
      const r = { ...base, sections: { ...base.sections, D3: { ...base.sections.D3, scored: false } } };
      expect(rule.tags(r)).toEqual([]);
    });

    it('native 裡沒有那個向度的 dev → 不出（不從 tier 猜方向）', () => {
      const base = withDev(byDim(toolId, age, {}), 'D3', 1.0);
      const native = { ...base.native };
      delete native['dev.D3'];
      expect(base.sections.D3.tier).toBe(3);
      expect(rule.tags({ ...base, native })).toEqual([]);
    });
  });

  describe('端到端：八題 raw → dev ＝ raw ÷ 8 − 2.5，是 0.125 的倍數', () => {
    it('D3 raw 28 → dev 1.0 → emo.slow_to_warm；raw 27 → 0.875 → 無', () => {
      const hot = byDim(toolId, age, { D3: 28 });
      expect(hot.native['dev.D3']).toBe(1);
      expect(hot.sections.D3.tier).toBe(3);
      expect(rule.tags(hot)).toEqual(['emo.slow_to_warm']);
      const warm = byDim(toolId, age, { D3: 27 });
      expect(warm.native['dev.D3']).toBe(0.875);
      expect(warm.sections.D3.tier).toBe(2);
      expect(rule.tags(warm)).toEqual([]);
    });

    it('D7 raw 12 → dev −1.0 → learn.task_persistence；raw 13 → −0.875 → 無；raw 28 → 1.0 → 無', () => {
      const low = byDim(toolId, age, { D7: 12 });
      expect(low.native['dev.D7']).toBe(-1);
      expect(rule.tags(low)).toEqual(['learn.task_persistence']);
      expect(rule.tags(byDim(toolId, age, { D7: 13 }))).toEqual([]);
      const high = byDim(toolId, age, { D7: 28 });
      expect(high.sections.D7.tier).toBe(3);
      expect(rule.tags(high)).toEqual([]);
    });

    it('D1 raw 28 且 D7 raw 12 → 兩個標籤照向度順序', () => {
      expect(rule.tags(byDim(toolId, age, { D1: 28, D7: 12 }))).toEqual(['emo.activity_high', 'learn.task_persistence']);
    });
  });

  describe('caveats：parent_report＋unsourced_threshold（§5.6 的 18 支含氣質，勘誤 B2）', () => {
    it('任何分數都是這兩個', () => {
      expect(rule.caveats(byDim(toolId, age, {}))).toEqual(['parent_report', 'unsourced_threshold']);
      expect(rule.caveats(score(toolId, age, flat(toolId, age, 5)))).toEqual(['parent_report', 'unsourced_threshold']);
      expect(rule.caveats(score(toolId, age, flat(toolId, age, 0)))).toEqual(['parent_report', 'unsourced_threshold']);
    });

    it('舊紀錄：窗口外 → age_out_of_window；沒全答 → incomplete', () => {
      const base = byDim(toolId, age, {});
      const outside = toolId === 'sxk-tempa' ? 37 : 85;
      expect(rule.caveats({ ...base, assessedAgeMonth: outside })).toEqual(['parent_report', 'unsourced_threshold', 'age_out_of_window']);
      expect(rule.caveats({ ...base, answeredCount: 71 })).toEqual(['parent_report', 'unsourced_threshold', 'incomplete']);
    });
  });

  it('每次呼叫回新的陣列，改了不會污染下一次', () => {
    rule.tags(byDim(toolId, age, { D3: 28 })).push('emo.regulation');
    expect(rule.tags(byDim(toolId, age, { D3: 28 }))).toEqual(['emo.slow_to_warm']);
    rule.caveats(byDim(toolId, age, {})).push('few_items');
    expect(rule.caveats(byDim(toolId, age, {}))).toEqual(['parent_report', 'unsourced_threshold']);
  });
});

describe('tempa 與 tempb：同一份作答，三個輸出一模一樣', () => {
  it('D2 raw 32、D7 raw 8', () => {
    const a = byDim('sxk-tempa', 24, { D2: 32, D7: 8 });
    const b = byDim('sxk-tempb', 48, { D2: 32, D7: 8 });
    expect(ruleFor('sxk-tempa').tags(a)).toEqual(ruleFor('sxk-tempb').tags(b));
    expect(ruleFor('sxk-tempa').tags(a)).toEqual(['emo.regularity_low', 'learn.task_persistence']);
    expect(ruleFor('sxk-tempa').caveats(a)).toEqual(ruleFor('sxk-tempb').caveats(b));
    expect(bandsOf('sxk-tempa', a)).toEqual(bandsOf('sxk-tempb', b));
  });
});

// ---------------------------------------------------------------------------
// 登錄：#51 之後 22 支全部有規則
// ---------------------------------------------------------------------------

describe('規則表登錄', () => {
  it('這張票的兩支', () => {
    expect([...TEMPERAMENT_TOOL_IDS]).toEqual(['sxk-tempa', 'sxk-tempb']);
    expect(Object.keys(TEMPERAMENT_RULES)).toEqual(['sxk-tempa', 'sxk-tempb']);
  });

  it('五張票加起來是 22 支，順序照票的先後；每一支 §3 登錄表裡的工具都有規則', () => {
    expect(Object.keys(TOOL_RULES)).toEqual([
      ...ACHIEVEMENT_TOOL_IDS, ...ASD_TOOL_IDS, ...ATTENTION_SENSORY_TOOL_IDS, ...DEV_ADL_LEARNING_TOOL_IDS,
      ...PUBLIC_TOOL_IDS, ...TEMPERAMENT_TOOL_IDS,
    ]);
    expect(Object.keys(TOOL_RULES).sort()).toEqual([...TOOL_IDS].sort());
    for (const toolId of TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.toolId).toBe(toolId);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數', () => {
    for (const toolId of TEMPERAMENT_TOOL_IDS) {
      expect(ruleFor(toolId).source).toContain(TOOLKIT[toolId].source.file);
      expect(ruleFor(toolId).source).toContain('LEVELS');
    }
  });

  it('不存在的工具問 ruleFor 會丟錯，不會安靜地當成沒有判定', () => {
    expect(() => ruleFor('sxk-nope' as ToolId)).toThrow(/sxk-nope/);
  });
});

import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { ITEM_TAGS } from '../src/t2/itemTags';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, SectionStat, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue, ScoreInput } from '../src/t2/scoring';
import { ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { ASD_TOOL_IDS } from '../src/t2/rules/asd';
import { ATTENTION_SENSORY_RULES, ATTENTION_SENSORY_TOOL_IDS } from '../src/t2/rules/attentionSensory';
import { TOOL_RULES, ruleFor } from '../src/t2/rules';

/**
 * 注意力（ab、att）與感覺處理（spa、spb）的規則表（#49，規格 v2 §5.1、§5.4、§5.5、§5.6、§5.9）。
 *
 * 【這裡在防什麼】
 * 關切率族剩下的四支。跟 asb／asr（#48）同族但判法不同，每一處翻錯都沒有型別錯誤：
 * 1. 切分各支自己一套（att 25／33／42、ab 33／41／50、spa／spb 28／36／45）—— 同樣 30%
 *    在 att 是 watch、在 ab 是 clear。統一成一套會讓 att 每個孩子都被判鬆一級。
 * 2. 標籤在**面向級**（面向 tier ≥ 2 出，不是逐題）—— 對應表在 `sectionTags.ts`，這裡把
 *    §5.9 的四列重抄一次逐格比對，期望值不是從它讀出來的。
 * 3. 前置題**不改 band**：ab「出現場合」≤1 個 → `single_setting`；att「持續多久」<6 個月 →
 *    `recent_onset`；spa／spb「影響參與」勾「無」→ `no_functional_impact`、勾其餘各出一個
 *    只進報告的 `sen.impact_*`。把任何一條做成 refer，等於把家長的脈絡回報當成分數。
 * 4. att 另記 `native.hotSettings`（tier ≥ 2 的情境數）—— 這一格在計分層寫（`native` 是
 *    `ToolResult` 的一部分，規則層不碰），這裡驗的是端到端。
 *
 * 【兩層】
 * 分界那一層把總分（或某個面向）的 pct 換成要測的值，tier 用 #46 的 `tierFor` 重算；
 * 端到端那一層用 att 40 題（滿分 120）與 spa 75 題（滿分 225）真的湊出邊界值。
 */

const AT = '2026-09-12T00:00:00.000Z';

/** 每支挑一個「全部題目都出」的月齡：ab 最晚起始 60、att 60、spa 全部 24、spb 全部 60。 */
const AGE: Readonly<Record<string, number>> = { 'sxk-ab': 72, 'sxk-att': 72, 'sxk-spa': 48, 'sxk-spb': 72 };

const FOUR = ['sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb'] as const;
const SENSORY = ['sxk-spa', 'sxk-spb'] as const;

function score(toolId: ToolId, answers: Record<string, AnswerValue>, pre?: ScoreInput['pre']): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: AGE[toolId], rater: 'mother', answers, pre, computedAt: AT });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 全部答同一個值。 */
function flat(toolId: ToolId, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, AGE[toolId])) out[a.key] = value;
  return out;
}

/**
 * 全答「很少或没有」（0），再把指定面向的原始分湊到指定值（前面的題給 3，剩下的給 0）。
 * `{ SU: 9 }` 是 ab 的 SU 面向 raw 9（8 題滿分 24 → 38% → tier 2）。
 */
function bySectionRaw(toolId: ToolId, raws: Record<string, number>, pre?: ScoreInput['pre']): ToolResult {
  const out = flat(toolId, 0);
  const left = { ...raws };
  for (const a of askedItems(toolId, AGE[toolId])) {
    const want = left[a.sectionKey];
    if (want === undefined || want <= 0) continue;
    const v = Math.min(3, want);
    out[a.key] = v;
    left[a.sectionKey] = want - v;
  }
  for (const [key, rest] of Object.entries(left)) {
    if (rest !== 0) throw new Error(`raw ${raws[key]} 放不進 ${toolId} 的 ${key}`);
  }
  return score(toolId, out, pre);
}

/** 依「總分 raw」造一份作答：前面的題給 3，剩下的給 0。 */
function byTotal(toolId: ToolId, raw: number): ToolResult {
  const out: Record<string, AnswerValue> = {};
  let left = raw;
  for (const a of askedItems(toolId, AGE[toolId])) {
    const v = Math.min(3, left);
    out[a.key] = v;
    left -= v;
  }
  if (left !== 0) throw new Error(`raw ${raw} 放不進 ${toolId}@${AGE[toolId]}`);
  return score(toolId, out);
}

/** 指定 pct 的替身。tier 由真的 `tierFor` 算；`raw` 只是湊個對得上的數 —— 規則不讀它。 */
function statAt(toolId: ToolId, pct: number, n: number): SectionStat {
  return {
    n,
    raw: Math.round((pct / 100) * n * 3),
    max: n * 3,
    pct,
    tier: tierFor('concern', TOOLKIT[toolId].tiers, pct),
    scored: n >= TOOL_SPECS[toolId].minItems,
  };
}

function withOverall(r: ToolResult, pct: number): ToolResult {
  return { ...r, overall: statAt(r.toolId, pct, r.overall.n) };
}

function withSection(r: ToolResult, key: string, pct: number): ToolResult {
  return { ...r, sections: { ...r.sections, [key]: statAt(r.toolId, pct, r.sections[key].n) } };
}

const QUIET_CACHE = new Map<ToolId, ToolResult>();

/** 四支各一份「全 0」的基準：總分 0%、tier 1、沒有前置題，沒有任何標籤或跟著前置題走的 caveat 該出。 */
function quiet(toolId: ToolId): ToolResult {
  const cached = QUIET_CACHE.get(toolId);
  if (cached) return cached;
  const r = score(toolId, flat(toolId, 0));
  QUIET_CACHE.set(toolId, r);
  return r;
}

/** 這支餵的那個維度（ab／att → ATT，spa／spb → SEN）。 */
function fedDimension(toolId: ToolId) {
  return TOOL_SPECS[toolId].feeds[0].dimension;
}

// ---------------------------------------------------------------------------
// 一、分界（§5.3 × §5.4）：各支自己的切分
// ---------------------------------------------------------------------------

/** [pct, band, 帶不帶 severity.severe]。從規格 §5.3 重抄。 */
const ATT_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false], [25, 'clear', false],
  [26, 'watch', false], [33, 'watch', false],
  [34, 'refer', false], [42, 'refer', false],
  [43, 'refer', true], [100, 'refer', true],
];

const AB_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false], [33, 'clear', false],
  [34, 'watch', false], [41, 'watch', false],
  [42, 'refer', false], [50, 'refer', false],
  [51, 'refer', true], [100, 'refer', true],
];

/** spa 與 spb 同一組。 */
const SP_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false], [28, 'clear', false],
  [29, 'watch', false], [36, 'watch', false],
  [37, 'refer', false], [45, 'refer', false],
  [46, 'refer', true], [100, 'refer', true],
];

describe('分界：總關切率餵 ATT（ab、att）／SEN（spa、spb）', () => {
  const CASES: ReadonlyArray<[ToolId, ReadonlyArray<[number, Band, boolean]>]> = [
    ['sxk-att', ATT_BOUNDARY],
    ['sxk-ab', AB_BOUNDARY],
    ['sxk-spa', SP_BOUNDARY],
    ['sxk-spb', SP_BOUNDARY],
  ];
  for (const [toolId, boundary] of CASES) {
    it(`${toolId} → ${fedDimension(toolId)}`, () => {
      const rule = ruleFor(toolId);
      for (const [pct, band, severe] of boundary) {
        const r = withOverall(quiet(toolId), pct);
        expect(`${pct} → ${rule.bandFor(r, fedDimension(toolId))}`).toBe(`${pct} → ${band}`);
        expect(`${pct} severe=${rule.tags(r).includes('severity.severe')}`).toBe(`${pct} severe=${severe}`);
      }
    });
  }

  it('同樣 30% 在 att 是 watch、在 ab 是 clear —— 各用自己的切分，沒有統一', () => {
    expect(ruleFor('sxk-att').bandFor(withOverall(quiet('sxk-att'), 30), 'ATT')).toBe('watch');
    expect(ruleFor('sxk-ab').bandFor(withOverall(quiet('sxk-ab'), 30), 'ATT')).toBe('clear');
  });

  it('同樣 34% 在 ab 是 watch、在 att 是 refer；同樣 29% 在 spa 是 watch、在 att 是 watch、在 ab 是 clear', () => {
    expect(ruleFor('sxk-ab').bandFor(withOverall(quiet('sxk-ab'), 34), 'ATT')).toBe('watch');
    expect(ruleFor('sxk-att').bandFor(withOverall(quiet('sxk-att'), 34), 'ATT')).toBe('refer');
    expect(ruleFor('sxk-spa').bandFor(withOverall(quiet('sxk-spa'), 29), 'SEN')).toBe('watch');
    expect(ruleFor('sxk-att').bandFor(withOverall(quiet('sxk-att'), 29), 'ATT')).toBe('watch');
    expect(ruleFor('sxk-ab').bandFor(withOverall(quiet('sxk-ab'), 29), 'ATT')).toBe('clear');
  });

  it('分數是 null（總分沒算出 tier）→ band 也是 null，不是最好的那一段', () => {
    for (const toolId of FOUR) {
      const base = quiet(toolId);
      const r = { ...base, overall: { ...base.overall, pct: null, tier: null } };
      expect(ruleFor(toolId).bandFor(r, fedDimension(toolId))).toBeNull();
    }
  });
});

describe('端到端：att 40 題（滿分 120），真的湊出六個邊界值', () => {
  // pct = round(raw ÷ 120 × 100)：30→25、31→25.8→26、40→33.3→33、41→34.2→34、50→41.7→42、51→42.5→43
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [30, 25, 'clear', false],
    [31, 26, 'watch', false],
    [40, 33, 'watch', false],
    [41, 34, 'refer', false],
    [50, 42, 'refer', false],
    [51, 43, 'refer', true],
  ];
  for (const [raw, pct, band, severe] of CASES) {
    it(`raw ${raw} → ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = byTotal('sxk-att', raw);
      expect(askedItems('sxk-att', AGE['sxk-att'])).toHaveLength(40);
      expect(r.overall.pct).toBe(pct);
      const rule = ruleFor('sxk-att');
      expect(rule.bandFor(r, 'ATT')).toBe(band);
      expect(rule.tags(r).includes('severity.severe')).toBe(severe);
    });
  }
});

describe('端到端：spa 75 題（滿分 225），真的湊出六個邊界值', () => {
  // pct = round(raw ÷ 225 × 100)：64→28.4→28、65→28.9→29、82→36.4→36、83→36.9→37、102→45.3→45、103→45.8→46
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [64, 28, 'clear', false],
    [65, 29, 'watch', false],
    [82, 36, 'watch', false],
    [83, 37, 'refer', false],
    [102, 45, 'refer', false],
    [103, 46, 'refer', true],
  ];
  for (const [raw, pct, band, severe] of CASES) {
    it(`raw ${raw} → ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = byTotal('sxk-spa', raw);
      expect(askedItems('sxk-spa', AGE['sxk-spa'])).toHaveLength(75);
      expect(r.overall.pct).toBe(pct);
      const rule = ruleFor('sxk-spa');
      expect(rule.bandFor(r, 'SEN')).toBe(band);
      expect(rule.tags(r).includes('severity.severe')).toBe(severe);
    });
  }
});

// ---------------------------------------------------------------------------
// 二、只餵一個維度，其餘八個 null（§5.7）
// ---------------------------------------------------------------------------

describe('ab／att 只餵 ATT，spa／spb 只餵 SEN', () => {
  for (const toolId of FOUR) {
    it(`${toolId} 全 3（每個面向的標籤都出）→ 只有 ${fedDimension(toolId)} 有 band`, () => {
      const rule = ruleFor(toolId);
      const r = score(toolId, flat(toolId, 3));
      const bands = Object.fromEntries(DIMENSION_CODES.map(d => [d, rule.bandFor(r, d)]));
      expect(bands).toEqual(Object.fromEntries(DIMENSION_CODES.map(d => [d, d === fedDimension(toolId) ? 'refer' : null])));
    });
  }

  it('ab 的 OD 面向 tier 4、其餘全 0 → 出 emo.regulation，但 EMO 的 band 是 null（ab 不餵 EMO）', () => {
    const r = withSection(quiet('sxk-ab'), 'OD', 100);
    const rule = ruleFor('sxk-ab');
    expect(rule.tags(r)).toContain('emo.regulation');
    expect(rule.bandFor(r, 'EMO')).toBeNull();
    expect(rule.bandFor(r, 'ATT')).toBe('clear');
  });

  it('att 的 HW 面向 tier 2 → 出 learn.task_persistence，但 LEARN 的 band 是 null（att 不餵 LEARN）', () => {
    const r = withSection(quiet('sxk-att'), 'HW', 26);
    const rule = ruleFor('sxk-att');
    expect(rule.tags(r)).toContain('learn.task_persistence');
    expect(rule.bandFor(r, 'LEARN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 三、面向級標籤（§5.5：面向 scored 且 tier ≥ 2；§5.9 的四列重抄）
// ---------------------------------------------------------------------------

/** §5.9 ab 那一列，逐面向重抄。 */
const AB_SECTION_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['SU', ['att.inattention']],                          // 持续专注
  ['DI', ['att.inattention']],                          // 抗干扰
  ['IM', ['att.impulsivity']],                          // 冲动控制
  ['HY', ['att.hyperactivity']],                        // 活动量
  ['EF', ['att.organization']],                         // 组织与执行
  ['OD', ['emo.regulation']],                           // 对立与情绪（只出標籤）
];

/** §5.9 att 那一列。 */
const ATT_SECTION_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['CL', ['att.inattention']],                          // 课堂情境
  ['HW', ['att.inattention', 'learn.task_persistence']],  // 作业情境
  ['HM', ['att.inattention']],                          // 居家情境
  ['IP', ['att.impulsivity']],                          // 人际情境
  ['SM', ['att.organization']],                         // 自我管理
];

/** §5.9 spa／spb 那一列，兩支相同。 */
const SP_SECTION_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['TA', ['sen.tactile']],                              // 触觉
  ['VE', ['sen.vestibular']],                           // 前庭觉
  ['PR', ['sen.body_awareness']],                       // 本体觉
  ['AU', ['sen.auditory']],                             // 听觉
  ['VI', ['sen.visual']],                               // 视觉
  ['OR', ['sen.oral']],                                 // 口腔与进食
  ['RG', ['sen.regulation']],                           // 调节与专注
];

/** 各支 tier 2 的下緣與 tier 1 的上緣（§5.3）。 */
const TIER2_FLOOR: Readonly<Record<string, number>> = { 'sxk-ab': 34, 'sxk-att': 26, 'sxk-spa': 29, 'sxk-spb': 29 };
const TIER1_CEIL: Readonly<Record<string, number>> = { 'sxk-ab': 33, 'sxk-att': 25, 'sxk-spa': 28, 'sxk-spb': 28 };

describe('面向級：面向 tier 2 出、tier 1 不出（整張表逐格）', () => {
  const TABLES: ReadonlyArray<[ToolId, ReadonlyArray<[string, ReadonlyArray<string>]>]> = [
    ['sxk-ab', AB_SECTION_TAGS],
    ['sxk-att', ATT_SECTION_TAGS],
    ['sxk-spa', SP_SECTION_TAGS],
    ['sxk-spb', SP_SECTION_TAGS],
  ];
  for (const [toolId, table] of TABLES) {
    describe(toolId, () => {
      const rule = ruleFor(toolId);

      it('面向 key 與順序跟題庫一致（表是從規格重抄的，不是從題庫讀的）', () => {
        expect(TOOLKIT[toolId].sections.map(s => s.key)).toEqual(table.map(([key]) => key));
      });

      for (const [key, tags] of table) {
        it(`${key} pct ${TIER2_FLOOR[toolId]}（tier 2）→ [${tags.join(',')}]；pct ${TIER1_CEIL[toolId]}（tier 1）→ []`, () => {
          const hot = withSection(quiet(toolId), key, TIER2_FLOOR[toolId]);
          expect(hot.sections[key].tier).toBe(2);
          expect(rule.tags(hot)).toEqual(tags);
          const cool = withSection(quiet(toolId), key, TIER1_CEIL[toolId]);
          expect(cool.sections[key].tier).toBe(1);
          expect(rule.tags(cool)).toEqual([]);
        });
      }

      it('面向 tier 3、tier 4 也出（不只 tier 2）；tier 4 的面向不出 severe —— severe 只看總分', () => {
        for (const [key, tags] of table) {
          const r = withSection(quiet(toolId), key, 100);
          expect(r.sections[key].tier).toBe(4);
          expect(rule.tags(r)).toEqual(tags);
        }
      });

      it('scored=false 的面向不出標籤（安全網：四支在窗口內每個面向都 scored）', () => {
        const [key, tags] = table[0];
        const base = withSection(quiet(toolId), key, 100);
        expect(rule.tags(base)).toEqual(tags);
        const unscored = { ...base, sections: { ...base.sections, [key]: { ...base.sections[key], scored: false } } };
        expect(rule.tags(unscored)).toEqual([]);
      });
    });
  }

  it('去重：ab 的 SU 與 DI 都 tier 2 → att.inattention 一次', () => {
    const r = withSection(withSection(quiet('sxk-ab'), 'SU', 34), 'DI', 34);
    expect(ruleFor('sxk-ab').tags(r)).toEqual(['att.inattention']);
  });

  it('去重：att 的 CL、HW、HM 都 tier 2 → att.inattention 一次、learn.task_persistence 一次，照面向順序', () => {
    const r = withSection(withSection(withSection(quiet('sxk-att'), 'CL', 26), 'HW', 26), 'HM', 26);
    expect(ruleFor('sxk-att').tags(r)).toEqual(['att.inattention', 'learn.task_persistence']);
  });

  it('順序照題庫的面向順序，不照 sections 物件的鍵序', () => {
    // 故意把 RG 寫在最前面、TA 寫在最後面
    const base = quiet('sxk-spa');
    const { RG: _quietRg, TA: _quietTa, ...rest } = base.sections;
    const r = { ...base, sections: { RG: statAt('sxk-spa', 100, 10), ...rest, TA: statAt('sxk-spa', 100, 12) } };
    expect(Object.keys(r.sections)[0]).toBe('RG');
    expect(Object.keys(r.sections).at(-1)).toBe('TA');
    expect(ruleFor('sxk-spa').tags(r)).toEqual(['sen.tactile', 'sen.regulation']);
  });

  it('全 3 → 每個標籤一次、照面向順序，最後是 severe', () => {
    expect(ruleFor('sxk-ab').tags(score('sxk-ab', flat('sxk-ab', 3)))).toEqual([
      'att.inattention', 'att.impulsivity', 'att.hyperactivity', 'att.organization', 'emo.regulation', 'severity.severe',
    ]);
    expect(ruleFor('sxk-att').tags(score('sxk-att', flat('sxk-att', 3)))).toEqual([
      'att.inattention', 'learn.task_persistence', 'att.impulsivity', 'att.organization', 'severity.severe',
    ]);
    for (const toolId of SENSORY) {
      expect(ruleFor(toolId).tags(score(toolId, flat(toolId, 3)))).toEqual([
        'sen.tactile', 'sen.vestibular', 'sen.body_awareness', 'sen.auditory', 'sen.visual', 'sen.oral', 'sen.regulation',
        'severity.severe',
      ]);
    }
  });

  it('這四支沒有逐題規則（§5.9）—— 規則表不掃逐題；要加逐題規則得同時改規則表', () => {
    for (const toolId of FOUR) expect(ITEM_TAGS[toolId]).toBeUndefined();
  });
});

describe('端到端：真的作答讓一個面向到 tier 2', () => {
  it('ab SU 8 題 raw 9 → 38% tier 2 → att.inattention；raw 8 → 33% tier 1 → 無；總分都還是 clear', () => {
    const rule = ruleFor('sxk-ab');
    const hot = bySectionRaw('sxk-ab', { SU: 9 });
    expect(hot.sections.SU).toMatchObject({ pct: 38, tier: 2 });
    expect(rule.tags(hot)).toEqual(['att.inattention']);
    expect(rule.bandFor(hot, 'ATT')).toBe('clear');
    const cool = bySectionRaw('sxk-ab', { SU: 8 });
    expect(cool.sections.SU).toMatchObject({ pct: 33, tier: 1 });
    expect(rule.tags(cool)).toEqual([]);
  });

  it('spa TA 12 題 raw 11 → 31% tier 2 → sen.tactile；raw 10 → 28% tier 1 → 無', () => {
    const rule = ruleFor('sxk-spa');
    expect(rule.tags(bySectionRaw('sxk-spa', { TA: 11 }))).toEqual(['sen.tactile']);
    expect(rule.tags(bySectionRaw('sxk-spa', { TA: 10 }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 四、att 的 native.hotSettings（§5.9：tier ≥ 2 的情境數；計分層寫，這裡驗端到端）
// ---------------------------------------------------------------------------

describe('att native.hotSettings', () => {
  it('全 0 → 0', () => {
    expect(quiet('sxk-att').native.hotSettings).toBe(0);
  });

  it('CL 與 HW 各 raw 7（29%，tier 2）、其餘 0 → 2；總分 12% 仍是 clear', () => {
    const r = bySectionRaw('sxk-att', { CL: 7, HW: 7 });
    expect(r.sections.CL.tier).toBe(2);
    expect(r.sections.HW.tier).toBe(2);
    expect(r.sections.HM.tier).toBe(1);
    expect(r.native.hotSettings).toBe(2);
    expect(ruleFor('sxk-att').bandFor(r, 'ATT')).toBe('clear');
  });

  it('CL raw 6（25%，tier 1）→ 不算：CL 6、HW 7 → 1', () => {
    expect(bySectionRaw('sxk-att', { CL: 6, HW: 7 }).native.hotSettings).toBe(1);
  });

  it('tier 3、4 也算：CL 全 3、HW raw 7 → 2；全 3 → 5', () => {
    expect(bySectionRaw('sxk-att', { CL: 24, HW: 7 }).native.hotSettings).toBe(2);
    expect(score('sxk-att', flat('sxk-att', 3)).native.hotSettings).toBe(5);
  });

  it('只有 att 有這一格 —— ab／spa／spb 沒有', () => {
    for (const toolId of ['sxk-ab', 'sxk-spa', 'sxk-spb'] as const) {
      expect(score(toolId, flat(toolId, 3)).native.hotSettings).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 五、前置題（§5.1、§5.6）：只出 caveat／只進報告的標籤，不改 band
// ---------------------------------------------------------------------------

describe('前置題的值，從題庫釘住', () => {
  it('ab：settings 複選 home／school／other，沒有互斥項', () => {
    const q = TOOLKIT['sxk-ab'].preQuestions.find(p => p.key === 'settings');
    expect(q?.kind).toBe('multi');
    expect(q?.options?.map(o => `${o.value}${o.exclusive ? '!' : ''}`)).toEqual(['home', 'school', 'other']);
  });

  it('att：duration 單選 lt3m／3to6m／gt6m／always', () => {
    const q = TOOLKIT['sxk-att'].preQuestions.find(p => p.key === 'duration');
    expect(q?.kind).toBe('single');
    expect(q?.options?.map(o => o.value)).toEqual(['lt3m', '3to6m', 'gt6m', 'always']);
  });

  for (const toolId of SENSORY) {
    it(`${toolId}：impact 複選，none 互斥，其餘 adl／group／play`, () => {
      const q = TOOLKIT[toolId].preQuestions.find(p => p.key === 'impact');
      expect(q?.kind).toBe('multi');
      expect(q?.options?.map(o => `${o.value}${o.exclusive ? '!' : ''}`)).toEqual(['none!', 'adl', 'group', 'play']);
    });
  }
});

describe('ab「出現場合」：≤1 個 → single_setting', () => {
  const rule = ruleFor('sxk-ab');

  it('只勾「家里」→ single_setting；只勾「学校」也是', () => {
    expect(rule.caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home'] }))).toContain('single_setting');
    expect(rule.caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: ['school'] }))).toContain('single_setting');
  });

  it('勾兩個 → 無；勾三個 → 無', () => {
    expect(rule.caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home', 'school'] }))).not.toContain('single_setting');
    expect(rule.caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home', 'school', 'other'] }))).not.toContain('single_setting');
  });

  it('答了但一個都沒勾（空陣列）→ 長度 0 ≤ 1，照 §5.1 出 single_setting', () => {
    expect(rule.caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: [] }))).toContain('single_setting');
  });

  it('沒答前置題（pre 是空物件）→ 無：不知道有幾個場合，沒有立場說「只在一個」', () => {
    expect(quiet('sxk-ab').pre).toEqual({});
    expect(rule.caveats(quiet('sxk-ab'))).not.toContain('single_setting');
  });

  it('前置題不改 band：pct 45（refer）只勾一個場合仍是 refer；pct 5 勾一個場合仍是 clear', () => {
    const hi = withOverall(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home'] }), 45);
    expect(rule.bandFor(hi, 'ATT')).toBe('refer');
    expect(rule.caveats(hi)).toContain('single_setting');
    const lo = withOverall(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home'] }), 5);
    expect(rule.bandFor(lo, 'ATT')).toBe('clear');
    expect(rule.caveats(lo)).toContain('single_setting');
  });

  it('前置題不出任何標籤', () => {
    expect(rule.tags(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home'] }))).toEqual([]);
  });
});

describe('att「持續多久」：<6 個月 → recent_onset', () => {
  const rule = ruleFor('sxk-att');

  it('lt3m、3to6m → recent_onset', () => {
    expect(rule.caveats(score('sxk-att', flat('sxk-att', 0), { duration: 'lt3m' }))).toContain('recent_onset');
    expect(rule.caveats(score('sxk-att', flat('sxk-att', 0), { duration: '3to6m' }))).toContain('recent_onset');
  });

  it('gt6m、always → 無；沒答 → 無', () => {
    expect(rule.caveats(score('sxk-att', flat('sxk-att', 0), { duration: 'gt6m' }))).not.toContain('recent_onset');
    expect(rule.caveats(score('sxk-att', flat('sxk-att', 0), { duration: 'always' }))).not.toContain('recent_onset');
    expect(rule.caveats(quiet('sxk-att'))).not.toContain('recent_onset');
  });

  it('前置題不改 band：pct 40（refer）答 lt3m 仍是 refer；pct 5 答 lt3m 仍是 clear；caveat 都照出', () => {
    const hi = withOverall(score('sxk-att', flat('sxk-att', 0), { duration: 'lt3m' }), 40);
    expect(rule.bandFor(hi, 'ATT')).toBe('refer');
    expect(rule.caveats(hi)).toContain('recent_onset');
    expect(rule.tags(hi)).toEqual([]);
    const lo = withOverall(score('sxk-att', flat('sxk-att', 0), { duration: 'lt3m' }), 5);
    expect(rule.bandFor(lo, 'ATT')).toBe('clear');
    expect(rule.caveats(lo)).toContain('recent_onset');
  });
});

describe('spa／spb「影響參與」：勾「無」→ no_functional_impact；勾其餘 → 各一個只進報告的 sen.impact_*', () => {
  for (const toolId of SENSORY) {
    describe(toolId, () => {
      const rule = ruleFor(toolId);

      it('勾 none → no_functional_impact 且無 impact 標籤', () => {
        const r = score(toolId, flat(toolId, 0), { impact: ['none'] });
        expect(rule.caveats(r)).toContain('no_functional_impact');
        expect(rule.tags(r)).toEqual([]);
      });

      it('勾 adl＋play → 兩個 impact 標籤、無 caveat', () => {
        const r = score(toolId, flat(toolId, 0), { impact: ['adl', 'play'] });
        expect(rule.tags(r)).toEqual(['sen.impact_adl', 'sen.impact_play']);
        expect(rule.caveats(r)).not.toContain('no_functional_impact');
      });

      it('只勾 group → sen.impact_group；三個都勾 → 三個，照題庫選項順序', () => {
        expect(rule.tags(score(toolId, flat(toolId, 0), { impact: ['group'] }))).toEqual(['sen.impact_group']);
        expect(rule.tags(score(toolId, flat(toolId, 0), { impact: ['play', 'group', 'adl'] })))
          .toEqual(['sen.impact_adl', 'sen.impact_group', 'sen.impact_play']);
      });

      it('沒答（pre 是空物件）或空陣列 → 沒有 caveat 也沒有標籤', () => {
        expect(rule.caveats(quiet(toolId))).not.toContain('no_functional_impact');
        expect(rule.tags(quiet(toolId))).toEqual([]);
        const empty = score(toolId, flat(toolId, 0), { impact: [] });
        expect(rule.caveats(empty)).not.toContain('no_functional_impact');
        expect(rule.tags(empty)).toEqual([]);
      });

      it('前置題不改 band：pct 40（refer）勾 none 仍是 refer；pct 5 勾 none 仍是 clear；pct 5 勾 adl 仍是 clear', () => {
        const hi = withOverall(score(toolId, flat(toolId, 0), { impact: ['none'] }), 40);
        expect(rule.bandFor(hi, 'SEN')).toBe('refer');
        expect(rule.caveats(hi)).toContain('no_functional_impact');
        const loNone = withOverall(score(toolId, flat(toolId, 0), { impact: ['none'] }), 5);
        expect(rule.bandFor(loNone, 'SEN')).toBe('clear');
        expect(rule.caveats(loNone)).toContain('no_functional_impact');
        const lo = withOverall(score(toolId, flat(toolId, 0), { impact: ['adl'] }), 5);
        expect(rule.bandFor(lo, 'SEN')).toBe('clear');
        expect(rule.tags(lo)).toEqual(['sen.impact_adl']);
      });

      it('順序：面向標籤在前、前置題標籤在後、severe 最後', () => {
        const r = score(toolId, flat(toolId, 3), { impact: ['group'] });
        expect(rule.tags(r)).toEqual([
          'sen.tactile', 'sen.vestibular', 'sen.body_awareness', 'sen.auditory', 'sen.visual', 'sen.oral', 'sen.regulation',
          'sen.impact_group', 'severity.severe',
        ]);
      });
    });
  }

  it('spb 與 spa 規則相同：同一份作答與前置題，兩支的 band／標籤／caveats 一模一樣', () => {
    const answers = bySectionRaw('sxk-spa', { TA: 11, RG: 9 }).answers;
    for (const pre of [{ impact: ['none'] }, { impact: ['adl', 'play'] }, {}] as ScoreInput['pre'][]) {
      const a = score('sxk-spa', answers, pre);
      const b = score('sxk-spb', answers, pre);
      expect(ruleFor('sxk-spb').bandFor(b, 'SEN')).toBe(ruleFor('sxk-spa').bandFor(a, 'SEN'));
      expect(ruleFor('sxk-spb').tags(b)).toEqual(ruleFor('sxk-spa').tags(a));
      expect(ruleFor('sxk-spb').caveats(b)).toEqual(ruleFor('sxk-spa').caveats(a));
    }
  });
});

// ---------------------------------------------------------------------------
// 六、caveats（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('caveats：固定值逐支相符', () => {
  it('四支都是 parent_report＋unsourced_threshold，沒有別的', () => {
    for (const toolId of FOUR) {
      expect(ruleFor(toolId).caveats(quiet(toolId))).toEqual(['parent_report', 'unsourced_threshold']);
    }
  });

  it('前置題的 caveat 接在固定的後面', () => {
    expect(ruleFor('sxk-ab').caveats(score('sxk-ab', flat('sxk-ab', 0), { settings: ['home'] })))
      .toEqual(['parent_report', 'unsourced_threshold', 'single_setting']);
    expect(ruleFor('sxk-att').caveats(score('sxk-att', flat('sxk-att', 0), { duration: 'lt3m' })))
      .toEqual(['parent_report', 'unsourced_threshold', 'recent_onset']);
    expect(ruleFor('sxk-spa').caveats(score('sxk-spa', flat('sxk-spa', 0), { impact: ['none'] })))
      .toEqual(['parent_report', 'unsourced_threshold', 'no_functional_impact']);
  });

  it('舊紀錄被新窗口重讀：月齡在窗口外 → age_out_of_window；沒全答 → incomplete', () => {
    expect(ruleFor('sxk-ab').caveats({ ...quiet('sxk-ab'), assessedAgeMonth: 35 })).toContain('age_out_of_window');
    expect(ruleFor('sxk-ab').caveats({ ...quiet('sxk-ab'), assessedAgeMonth: 193 })).toContain('age_out_of_window');
    expect(ruleFor('sxk-att').caveats({ ...quiet('sxk-att'), assessedAgeMonth: 59 })).toContain('age_out_of_window');
    expect(ruleFor('sxk-spa').caveats({ ...quiet('sxk-spa'), assessedAgeMonth: 72 })).toContain('age_out_of_window');
    expect(ruleFor('sxk-spb').caveats({ ...quiet('sxk-spb'), assessedAgeMonth: 59 })).toContain('age_out_of_window');
    expect(ruleFor('sxk-spb').caveats({ ...quiet('sxk-spb'), answeredCount: 74 })).toContain('incomplete');
    for (const toolId of FOUR) expect(ruleFor(toolId).caveats(quiet(toolId))).not.toContain('age_out_of_window');
  });

  it('每次呼叫回新的陣列，改了不會污染下一次', () => {
    const rule = ruleFor('sxk-spa');
    const c = rule.caveats(quiet('sxk-spa'));
    c.push('no_functional_impact');
    expect(rule.caveats(quiet('sxk-spa'))).toEqual(['parent_report', 'unsourced_threshold']);
    const t = rule.tags(withSection(quiet('sxk-spa'), 'TA', 100));
    t.push('sen.oral');
    expect(rule.tags(withSection(quiet('sxk-spa'), 'TA', 100))).toEqual(['sen.tactile']);
  });
});

// ---------------------------------------------------------------------------
// 七、登錄
// ---------------------------------------------------------------------------

describe('規則表登錄', () => {
  it('這張票的四支', () => {
    expect([...ATTENTION_SENSORY_TOOL_IDS]).toEqual(['sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb']);
    expect(Object.keys(ATTENTION_SENSORY_RULES)).toEqual(['sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb']);
  });

  it('四支都在登錄表裡、排在達成率族六支與 asb／asr 之後（完整的登錄清單由最新的那張票釘住）；toolId 對得上 key，版本是計分那一版', () => {
    const upToHere = ACHIEVEMENT_TOOL_IDS.length + ASD_TOOL_IDS.length + ATTENTION_SENSORY_TOOL_IDS.length;
    expect(Object.keys(TOOL_RULES).slice(0, upToHere))
      .toEqual([...ACHIEVEMENT_TOOL_IDS, ...ASD_TOOL_IDS, ...ATTENTION_SENSORY_TOOL_IDS]);
    for (const toolId of ATTENTION_SENSORY_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.toolId).toBe(toolId);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數', () => {
    for (const toolId of ATTENTION_SENSORY_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
      expect(rule.source).toContain('LEVELS');
    }
  });
});

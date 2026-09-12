import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, SectionStat, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue, ScoreInput } from '../src/t2/scoring';
import { ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { ASD_RULES, ASD_TOOL_IDS } from '../src/t2/rules/asd';
import { TOOL_RULES, ruleFor } from '../src/t2/rules';

/**
 * 自閉行為（asb）與社交溝通（asr）的規則表（#48，規格 v2 §5.4、§5.5、§5.6、§5.9）。
 *
 * 【這裡在防什麼】
 * 這兩支跟達成率族有三處不同，每一處翻錯都沒有型別錯誤：
 * 1. 分數越高越糟（關切率），切分各支自己一套（asb 22／31／40、asr 20／29／38）。
 * 2. 前置題「能力倒退」答有 → 不論分數直接 `refer`＋`regression_reported`。漏掉這條，
 *    一個家長明說「以前會叫媽媽、現在不叫了」的孩子會因為總分不高被判「沒事」。
 * 3. asb SH 第 8 項「出现自伤行为」答 ≥2 → `safety_concern`，與 band 無關。
 * 標籤是逐題的（答 ≥2 出）：每個面向各一條「答 2 出、答 1 不出」，另把 §5.9 的整張逐題表
 * 重抄一次逐格比對 —— 對應表在 `itemTags.ts`，這裡的期望值不是從它讀出來的。
 *
 * 【兩層】
 * 分界那一層把總分的 pct 換成要測的值（tier 用 #46 的 `tierFor` 重算）—— asr 15 題
 * 滿分 45，pct 只能是 2.2 的倍數，21／30／39 三個切點真實作答踩不到。端到端那一層用
 * asb 57 題（滿分 171）真的湊出六個邊界值，asr 湊出跨過每個切點的最近整數。
 */

const AT = '2026-09-12T00:00:00.000Z';
const AGE = 72;   // 兩支的窗口都涵蓋（asb 18–180、asr 24–180），且全部題目都出

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>, pre?: ScoreInput['pre']): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, pre, computedAt: AT });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 全部答同一個值。 */
function flat(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

/** 全答「很少或没有」（0，最好），再改掉指定的幾題。 */
function quietBut(toolId: ToolId, overrides: Record<string, AnswerValue>, pre?: ScoreInput['pre']): ToolResult {
  return score(toolId, AGE, { ...flat(toolId, AGE, 0), ...overrides }, pre);
}

/** 依「總分 raw」造一份作答：前面的題給 3，剩下的給 0。 */
function byTotal(toolId: ToolId, raw: number): ToolResult {
  const out: Record<string, AnswerValue> = {};
  let left = raw;
  for (const a of askedItems(toolId, AGE)) {
    const v = Math.min(3, left);
    out[a.key] = v;
    left -= v;
  }
  if (left !== 0) throw new Error(`raw ${raw} 放不進 ${toolId}@${AGE}`);
  return score(toolId, AGE, out);
}

/** 總分換成指定 pct 的替身。tier 由真的 `tierFor` 算；`raw` 只是湊個對得上的數 —— 規則不讀它。 */
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

const QUIET_CACHE = new Map<ToolId, ToolResult>();

/** 兩支各一份「全 0」的基準：總分 0%、tier 1、沒有前置題，沒有任何標籤或跟著判定走的 caveat 該出。 */
function quiet(toolId: ToolId): ToolResult {
  const cached = QUIET_CACHE.get(toolId);
  if (cached) return cached;
  const r = score(toolId, AGE, flat(toolId, AGE, 0));
  QUIET_CACHE.set(toolId, r);
  return r;
}

// ---------------------------------------------------------------------------
// 一、分界（§5.3 × §5.4）：各支自己的切分，📞 §10.1 第 2 題定案前照原值
// ---------------------------------------------------------------------------

/** [pct, band, 帶不帶 severity.severe]。從規格 §5.3 重抄：asb 0–22／23–31／32–40／≥41。 */
const ASB_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false],
  [22, 'clear', false],
  [23, 'watch', false],
  [31, 'watch', false],
  [32, 'refer', false],
  [40, 'refer', false],
  [41, 'refer', true],
  [100, 'refer', true],
];

/** asr 0–20／21–29／30–38／≥39。 */
const ASR_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false],
  [20, 'clear', false],
  [21, 'watch', false],
  [29, 'watch', false],
  [30, 'refer', false],
  [38, 'refer', false],
  [39, 'refer', true],
  [100, 'refer', true],
];

describe('分界：總關切率餵 SOC', () => {
  const CASES: ReadonlyArray<[ToolId, ReadonlyArray<[number, Band, boolean]>]> = [
    ['sxk-asb', ASB_BOUNDARY],
    ['sxk-asr', ASR_BOUNDARY],
  ];
  for (const [toolId, boundary] of CASES) {
    it(`${toolId} → SOC`, () => {
      const rule = ruleFor(toolId);
      for (const [pct, band, severe] of boundary) {
        const r = withOverall(quiet(toolId), pct);
        expect(`${pct} → ${rule.bandFor(r, 'SOC')}`).toBe(`${pct} → ${band}`);
        expect(`${pct} severe=${rule.tags(r).includes('severity.severe')}`).toBe(`${pct} severe=${severe}`);
      }
    });
  }

  it('同樣 30% 在 asr 是 refer、在 asb 是 watch —— 兩支各用自己的切分，沒有統一', () => {
    expect(ruleFor('sxk-asr').bandFor(withOverall(quiet('sxk-asr'), 30), 'SOC')).toBe('refer');
    expect(ruleFor('sxk-asb').bandFor(withOverall(quiet('sxk-asb'), 30), 'SOC')).toBe('watch');
  });
});

describe('端到端：asb 57 題（滿分 171），真的湊出六個邊界值', () => {
  // pct = round(raw ÷ 171 × 100)：38→22.2→22、39→22.8→23、53→31.0→31、54→31.6→32、69→40.4→40、70→40.9→41
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [38, 22, 'clear', false],
    [39, 23, 'watch', false],
    [53, 31, 'watch', false],
    [54, 32, 'refer', false],
    [69, 40, 'refer', false],
    [70, 41, 'refer', true],
  ];
  for (const [raw, pct, band, severe] of CASES) {
    it(`raw ${raw} → ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = byTotal('sxk-asb', raw);
      expect(r.overall.pct).toBe(pct);
      const rule = ruleFor('sxk-asb');
      expect(rule.bandFor(r, 'SOC')).toBe(band);
      expect(rule.tags(r).includes('severity.severe')).toBe(severe);
    });
  }
});

describe('端到端：asr 15 題（滿分 45），每個切點兩側最近的整數', () => {
  // pct = round(raw ÷ 45 × 100)：9→20、10→22、13→29、14→31、17→38、18→40（21／30／39 踩不到）
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [9, 20, 'clear', false],
    [10, 22, 'watch', false],
    [13, 29, 'watch', false],
    [14, 31, 'refer', false],
    [17, 38, 'refer', false],
    [18, 40, 'refer', true],
  ];
  for (const [raw, pct, band, severe] of CASES) {
    it(`raw ${raw} → ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = byTotal('sxk-asr', raw);
      expect(r.overall.pct).toBe(pct);
      const rule = ruleFor('sxk-asr');
      expect(rule.bandFor(r, 'SOC')).toBe(band);
      expect(rule.tags(r).includes('severity.severe')).toBe(severe);
    });
  }
});

// ---------------------------------------------------------------------------
// 二、不餵的維度回 null（§5.7）—— 標籤會出到 sen／lang／emo／adl，band 不會
// ---------------------------------------------------------------------------

describe('只餵 SOC，其餘八個維度 null', () => {
  for (const toolId of ['sxk-asb', 'sxk-asr'] as const) {
    it(`${toolId} 全 3（每個維度的標籤都出）→ 只有 SOC 有 band`, () => {
      const rule = ruleFor(toolId);
      const r = score(toolId, AGE, flat(toolId, AGE, 3));
      const bands = Object.fromEntries(DIMENSION_CODES.map(d => [d, rule.bandFor(r, d)]));
      expect(bands).toEqual({
        COG: null, LANG: null, SOC: 'refer', EMO: null, ATT: null, MOT: null, SEN: null, ADL: null, LEARN: null,
      });
    });
  }

  it('分數是 null（總分沒算出 tier）→ band 也是 null，不是最好的那一段', () => {
    const base = quiet('sxk-asb');
    const r = { ...base, overall: { ...base.overall, pct: null, tier: null } };
    expect(ruleFor('sxk-asb').bandFor(r, 'SOC')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 三、前置題「能力倒退」（§5.1、§5.4、§5.6）
// ---------------------------------------------------------------------------

describe('前置題的值：題庫裡「沒有」是 none，另外兩個是 language／social', () => {
  for (const toolId of ['sxk-asb', 'sxk-asr'] as const) {
    it(`${toolId}`, () => {
      const q = TOOLKIT[toolId].preQuestions.find(p => p.key === 'regression');
      expect(q?.kind).toBe('single');
      expect(q?.options?.map(o => `${o.value}${o.exclusive ? '!' : ''}`)).toEqual(['none!', 'language', 'social']);
    });
  }
});

describe('倒退：答有 → 不論分數 refer＋regression_reported；答「沒有」或沒答 → 照分數', () => {
  for (const toolId of ['sxk-asb', 'sxk-asr'] as const) {
    describe(toolId, () => {
      const rule = ruleFor(toolId);

      it('pct 5、答「语言能力出现倒退」→ refer＋regression_reported；tier 還是 1 所以沒有 severe', () => {
        const r = withOverall(score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'language' }), 5);
        expect(r.overall.tier).toBe(1);
        expect(rule.bandFor(r, 'SOC')).toBe('refer');
        expect(rule.caveats(r)).toContain('regression_reported');
        expect(rule.tags(r)).not.toContain('severity.severe');
      });

      it('答「社交能力出现倒退」同法', () => {
        const r = withOverall(score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'social' }), 5);
        expect(rule.bandFor(r, 'SOC')).toBe('refer');
        expect(rule.caveats(r)).toContain('regression_reported');
      });

      it('答「没有出现倒退」→ 照分數：pct 5 clear、沒有 regression_reported', () => {
        const r = withOverall(score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'none' }), 5);
        expect(rule.bandFor(r, 'SOC')).toBe('clear');
        expect(rule.caveats(r)).not.toContain('regression_reported');
      });

      it('沒答前置題（pre 是空物件）→ 照分數', () => {
        const r = withOverall(quiet(toolId), 5);
        expect(r.pre).toEqual({});
        expect(rule.bandFor(r, 'SOC')).toBe('clear');
        expect(rule.caveats(r)).not.toContain('regression_reported');
      });

      it('有倒退且分數本來就 tier 4 → refer＋severe 都在（倒退不動 tier）', () => {
        const r = withOverall(score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'language' }), 100);
        expect(rule.bandFor(r, 'SOC')).toBe('refer');
        expect(rule.tags(r)).toContain('severity.severe');
        expect(rule.caveats(r)).toContain('regression_reported');
      });

      it('倒退只推 SOC：不餵的維度仍是 null，不會跟著變 refer', () => {
        const r = score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'language' });
        for (const d of DIMENSION_CODES) expect(`${d}=${rule.bandFor(r, d)}`).toBe(`${d}=${d === 'SOC' ? 'refer' : 'null'}`);
      });

      it('倒退不出任何標籤 —— 它是 caveat，不是要練的能力', () => {
        expect(rule.tags(score(toolId, AGE, flat(toolId, AGE, 0), { regression: 'language' }))).toEqual([]);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 四、safety_concern：asb SH 第 8 項「出现自伤行为」答 ≥2（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('safety_concern', () => {
  const rule = ruleFor('sxk-asb');

  it('SH 第 8 項答 2 → 有；答 3 → 有；答 1 → 無；答 0 → 無', () => {
    expect(rule.caveats(quietBut('sxk-asb', { 'SH.8': 2 }))).toContain('safety_concern');
    expect(rule.caveats(quietBut('sxk-asb', { 'SH.8': 3 }))).toContain('safety_concern');
    expect(rule.caveats(quietBut('sxk-asb', { 'SH.8': 1 }))).not.toContain('safety_concern');
    expect(rule.caveats(quietBut('sxk-asb', { 'SH.8': 0 }))).not.toContain('safety_concern');
  });

  it('與 band 無關：其餘全 0、只有第 8 項答 2 → SOC 仍 clear（1%），caveat 照出、不出任何標籤', () => {
    const r = quietBut('sxk-asb', { 'SH.8': 2 });
    expect(r.overall).toMatchObject({ pct: 1, tier: 1 });
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
    expect(rule.caveats(r)).toEqual(['parent_report', 'unsourced_threshold', 'safety_concern']);
    expect(rule.tags(r)).toEqual([]);
  });

  it('其他題答 3 不出 safety_concern —— 只有第 8 項是自傷', () => {
    expect(rule.caveats(quietBut('sxk-asb', { 'SH.7': 3, 'SH.9': 3, 'BO.9': 3 }))).not.toContain('safety_concern');
  });

  it('asr 沒有這一條：全 3 也不出', () => {
    expect(ruleFor('sxk-asr').caveats(score('sxk-asr', AGE, flat('sxk-asr', AGE, 3)))).not.toContain('safety_concern');
  });

  it('倒退與自傷同時有：兩個 caveat 都在，倒退在前、自傷在後；只出一次', () => {
    const r = quietBut('sxk-asb', { 'SH.8': 3 }, { regression: 'social' });
    expect(rule.caveats(r)).toEqual(['parent_report', 'unsourced_threshold', 'regression_reported', 'safety_concern']);
  });
});

// ---------------------------------------------------------------------------
// 五、asb 逐題標籤（§5.5 關切率族：答 ≥2；§5.9 的逐題表）
// ---------------------------------------------------------------------------

/**
 * §5.9 asb 那一列，逐題重抄。空陣列是規格明寫「不出標籤」的（BO 4、8、9；SH 6）
 * 與只出 caveat 的（SH 8）。
 */
const ASB_ITEM_EXPECTED: Readonly<Record<string, ReadonlyArray<string>>> = {
  SE: [
    'sen.auditory', 'sen.tactile', 'sen.visual', 'sen.oral', 'sen.tactile', 'sen.visual',
    'sen.visual', 'sen.tactile', 'sen.tactile', 'sen.auditory', 'sen.oral', 'sen.auditory',
  ],
  RE: [
    'soc.social_initiation', 'soc.eye_contact', 'soc.response_to_name', 'soc.joint_attention',
    'soc.emotion_reciprocity', 'soc.social_initiation', 'soc.social_initiation', 'soc.joint_attention',
    'soc.emotion_reciprocity', 'soc.social_initiation', 'soc.imitation', 'soc.emotion_reciprocity',
  ],
  BO: [
    'soc.stereotyped_behavior', 'soc.stereotyped_behavior', 'soc.stereotyped_behavior', '',
    'soc.stereotyped_behavior', 'soc.stereotyped_behavior', 'mot.balance', '', '',
    'soc.stereotyped_behavior', 'soc.imitation',
  ],
  LA: [
    'lang.expression', 'lang.pragmatics', 'lang.pragmatics', 'lang.pragmatics', 'lang.pragmatics',
    'lang.pragmatics', 'lang.pragmatics', 'lang.pragmatics', 'lang.comprehension', 'lang.pragmatics',
    'lang.pragmatics', 'lang.pragmatics',
  ],
  SH: [
    'emo.adaptability_low', 'sen.oral', 'emo.regularity_low', 'adl.toileting', 'adl.dressing', '',
    'emo.regulation', '', 'soc.stereotyped_behavior', 'emo.adaptability_low',
  ],
};

describe('asb 逐題：答 2 出、答 1 不出', () => {
  const rule = ruleFor('sxk-asb');

  const ONE_PER_SECTION: ReadonlyArray<[string, string]> = [
    ['SE.1', 'sen.auditory'],       // 对声音过度反应或完全无反应
    ['RE.2', 'soc.eye_contact'],     // 眼神接触短暂或回避
    ['BO.7', 'mot.balance'],         // 动作协调明显笨拙
    ['LA.9', 'lang.comprehension'],  // 听不懂比喻或玩笑
    ['SH.4', 'adl.toileting'],       // 如厕训练明显困难
  ];
  for (const [key, tag] of ONE_PER_SECTION) {
    it(`${key} 答 2 → [${tag}]；答 1 → []；答 3 → [${tag}]`, () => {
      expect(rule.tags(quietBut('sxk-asb', { [key]: 2 }))).toEqual([tag]);
      expect(rule.tags(quietBut('sxk-asb', { [key]: 1 }))).toEqual([]);
      expect(rule.tags(quietBut('sxk-asb', { [key]: 3 }))).toEqual([tag]);
    });
  }

  it('BO 4、8、9 與 SH 6 答 3 也不出標籤', () => {
    for (const key of ['BO.4', 'BO.8', 'BO.9', 'SH.6']) {
      expect(`${key} → ${rule.tags(quietBut('sxk-asb', { [key]: 3 })).join(',')}`).toBe(`${key} → `);
    }
    expect(rule.tags(quietBut('sxk-asb', { 'BO.4': 3, 'BO.8': 3, 'BO.9': 3, 'SH.6': 3 }))).toEqual([]);
  });

  it('整張逐題表：57 題各自單獨答 2，逐格與 §5.9 相符', () => {
    expect(askedItems('sxk-asb', AGE)).toHaveLength(57);
    for (const [section, tags] of Object.entries(ASB_ITEM_EXPECTED)) {
      expect(TOOLKIT['sxk-asb'].sections.find(s => s.key === section)?.items).toHaveLength(tags.length);
      tags.forEach((tag, i) => {
        const key = `${section}.${i + 1}`;
        const expected = tag === '' ? [] : [tag];
        expect(`${key} → ${rule.tags(quietBut('sxk-asb', { [key]: 2 })).join(',')}`).toBe(`${key} → ${expected.join(',')}`);
      });
    }
  });

  it('去重：RE 1 與 RE 6 都答 2 → soc.social_initiation 只出一次', () => {
    expect(rule.tags(quietBut('sxk-asb', { 'RE.1': 2, 'RE.6': 2 }))).toEqual(['soc.social_initiation']);
  });

  it('順序照題庫的面向與題號，不照 answers 物件的鍵序', () => {
    // 故意把 SH 寫在最前面
    expect(rule.tags(quietBut('sxk-asb', { 'SH.4': 2, 'SE.1': 2, 'RE.2': 2 })))
      .toEqual(['sen.auditory', 'soc.eye_contact', 'adl.toileting']);
  });

  it('全 3 → 每個標籤一次、照題號先出現的位置排，最後是 severe', () => {
    expect(rule.tags(score('sxk-asb', AGE, flat('sxk-asb', AGE, 3)))).toEqual([
      'sen.auditory', 'sen.tactile', 'sen.visual', 'sen.oral',                               // SE
      'soc.social_initiation', 'soc.eye_contact', 'soc.response_to_name', 'soc.joint_attention',
      'soc.emotion_reciprocity', 'soc.imitation',                                             // RE
      'soc.stereotyped_behavior', 'mot.balance',                                              // BO
      'lang.expression', 'lang.pragmatics', 'lang.comprehension',                             // LA
      'emo.adaptability_low', 'emo.regularity_low', 'adl.toileting', 'adl.dressing', 'emo.regulation',  // SH
      'severity.severe',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 六、asr 逐題（§5.9 用全域題號 1–15：SC 1–5、SN 6–8、BH 9–12、GN 13–15）
// ---------------------------------------------------------------------------

/** §5.9 asr 那一列，逐項重抄；14、15 不出標籤。 */
const ASR_ITEM_EXPECTED: ReadonlyArray<ReadonlyArray<string>> = [
  ['soc.social_initiation'],            // 1 与人的关系
  ['soc.imitation'],                    // 2 模仿能力
  ['emo.regulation'],                   // 3 情绪反应
  ['lang.expression', 'lang.pragmatics'],  // 4 语言沟通
  ['lang.pragmatics'],                  // 5 非语言沟通
  ['sen.visual', 'soc.eye_contact'],    // 6 视觉反应
  ['sen.auditory'],                     // 7 听觉反应
  ['sen.tactile', 'sen.oral'],          // 8 味嗅触觉反应
  ['soc.stereotyped_behavior'],         // 9 身体运用
  ['soc.stereotyped_behavior'],         // 10 物品运用
  ['emo.adaptability_low'],             // 11 对改变的适应
  ['emo.activity_high'],                // 12 活动量水平
  ['emo.regulation'],                   // 13 紧张与恐惧
  [],                                   // 14 能力发展的均匀度
  [],                                   // 15 整体印象
];

/** 面向順序與項數，從規格重抄；全域題號 n → 題 key。 */
const ASR_SECTIONS: ReadonlyArray<[string, number]> = [['SC', 5], ['SN', 3], ['BH', 4], ['GN', 3]];

function asrKey(globalNo: number): string {
  let base = 0;
  for (const [key, count] of ASR_SECTIONS) {
    if (globalNo <= base + count) return `${key}.${globalNo - base}`;
    base += count;
  }
  throw new Error(`asr 沒有第 ${globalNo} 項`);
}

describe('asr 逐題：答 2 出、答 1 不出', () => {
  const rule = ruleFor('sxk-asr');

  it('題 key 的換算：1 → SC.1、5 → SC.5、6 → SN.1、9 → BH.1、12 → BH.4、13 → GN.1、15 → GN.3', () => {
    expect([1, 5, 6, 9, 12, 13, 15].map(asrKey)).toEqual(['SC.1', 'SC.5', 'SN.1', 'BH.1', 'BH.4', 'GN.1', 'GN.3']);
    expect(askedItems('sxk-asr', AGE).map(a => a.key)).toEqual(Array.from({ length: 15 }, (_, i) => asrKey(i + 1)));
  });

  const ONE_PER_SECTION: ReadonlyArray<[number, ReadonlyArray<string>]> = [
    [1, ['soc.social_initiation']],
    [6, ['sen.visual', 'soc.eye_contact']],
    [9, ['soc.stereotyped_behavior']],
    [13, ['emo.regulation']],
  ];
  for (const [no, tags] of ONE_PER_SECTION) {
    it(`第 ${no} 項答 2 → [${tags.join(',')}]；答 1 → []`, () => {
      expect(rule.tags(quietBut('sxk-asr', { [asrKey(no)]: 2 }))).toEqual(tags);
      expect(rule.tags(quietBut('sxk-asr', { [asrKey(no)]: 1 }))).toEqual([]);
    });
  }

  it('第 12 項「活动量水平」答 2 → emo.activity_high（工具沒有分偏高／偏低側，一律出）；答 1 → 無', () => {
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(12)]: 2 }))).toEqual(['emo.activity_high']);
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(12)]: 1 }))).toEqual([]);
  });

  it('第 14、15 項答 3 → 無標籤', () => {
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(14)]: 3 }))).toEqual([]);
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(15)]: 3 }))).toEqual([]);
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(14)]: 3, [asrKey(15)]: 3 }))).toEqual([]);
  });

  it('整張逐題表：15 項各自單獨答 2，逐格與 §5.9 相符', () => {
    ASR_ITEM_EXPECTED.forEach((tags, i) => {
      const no = i + 1;
      expect(`${no} → ${rule.tags(quietBut('sxk-asr', { [asrKey(no)]: 2 })).join(',')}`).toBe(`${no} → ${tags.join(',')}`);
    });
  });

  it('去重：第 9 與第 10 項都答 2 → soc.stereotyped_behavior 一次；第 3 與 13 → emo.regulation 一次', () => {
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(9)]: 2, [asrKey(10)]: 2 }))).toEqual(['soc.stereotyped_behavior']);
    expect(rule.tags(quietBut('sxk-asr', { [asrKey(3)]: 2, [asrKey(13)]: 2 }))).toEqual(['emo.regulation']);
  });

  it('全 3 → 13 個標籤照項次去重，最後是 severe', () => {
    expect(rule.tags(score('sxk-asr', AGE, flat('sxk-asr', AGE, 3)))).toEqual([
      'soc.social_initiation', 'soc.imitation', 'emo.regulation', 'lang.expression', 'lang.pragmatics',
      'sen.visual', 'soc.eye_contact', 'sen.auditory', 'sen.tactile', 'sen.oral',
      'soc.stereotyped_behavior', 'emo.adaptability_low', 'emo.activity_high',
      'severity.severe',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 七、caveats（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('caveats：固定值逐支相符', () => {
  it('asb：parent_report＋unsourced_threshold；asr 另固定 rater_role_parent（2026-09-11 決定完整給家長填）', () => {
    expect(ruleFor('sxk-asb').caveats(quiet('sxk-asb'))).toEqual(['parent_report', 'unsourced_threshold']);
    expect(ruleFor('sxk-asr').caveats(quiet('sxk-asr'))).toEqual(['parent_report', 'unsourced_threshold', 'rater_role_parent']);
  });

  it('asb 不帶 rater_role_parent —— 它本來就是家長填的', () => {
    expect(ruleFor('sxk-asb').caveats(score('sxk-asb', AGE, flat('sxk-asb', AGE, 3), { regression: 'language' })))
      .not.toContain('rater_role_parent');
  });

  it('舊紀錄被新窗口重讀：月齡在窗口外 → age_out_of_window；沒全答 → incomplete', () => {
    const asb = ruleFor('sxk-asb');
    expect(asb.caveats({ ...quiet('sxk-asb'), assessedAgeMonth: 181 })).toContain('age_out_of_window');
    expect(asb.caveats({ ...quiet('sxk-asb'), assessedAgeMonth: 17 })).toContain('age_out_of_window');
    expect(asb.caveats(quiet('sxk-asb'))).not.toContain('age_out_of_window');
    const asr = ruleFor('sxk-asr');
    expect(asr.caveats({ ...quiet('sxk-asr'), assessedAgeMonth: 23 })).toContain('age_out_of_window');
    expect(asr.caveats({ ...quiet('sxk-asr'), answeredCount: 14 })).toContain('incomplete');
  });

  it('每次呼叫回新的陣列，改了不會污染下一次', () => {
    const rule = ruleFor('sxk-asb');
    const c = rule.caveats(quiet('sxk-asb'));
    c.push('safety_concern');
    expect(rule.caveats(quiet('sxk-asb'))).toEqual(['parent_report', 'unsourced_threshold']);
    const t = rule.tags(quietBut('sxk-asb', { 'SE.1': 2 }));
    t.push('sen.oral');
    expect(rule.tags(quietBut('sxk-asb', { 'SE.1': 2 }))).toEqual(['sen.auditory']);
  });
});

// ---------------------------------------------------------------------------
// 八、登錄
// ---------------------------------------------------------------------------

describe('規則表登錄', () => {
  it('這張票的兩支', () => {
    expect([...ASD_TOOL_IDS]).toEqual(['sxk-asb', 'sxk-asr']);
    expect(Object.keys(ASD_RULES)).toEqual(['sxk-asb', 'sxk-asr']);
  });

  it('目前登錄的是達成率族六支＋這兩支（#49–#51 各自再加）；toolId 對得上 key，版本是計分那一版', () => {
    expect(Object.keys(TOOL_RULES)).toEqual([...ACHIEVEMENT_TOOL_IDS, ...ASD_TOOL_IDS]);
    for (const toolId of ASD_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.toolId).toBe(toolId);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數', () => {
    for (const toolId of ASD_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
      expect(rule.source).toContain('LEVELS');
    }
  });
});

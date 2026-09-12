import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, DimensionCode, SectionStat, Tier, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { ACHIEVEMENT_RULES, ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { TOOL_RULES, bandOfTier, ruleFor } from '../src/t2/rules';

/**
 * 達成率族六支的規則表（#47，規格 v2 §5.4、§5.5、§5.9）。
 *
 * 【這裡在防什麼】
 * 規則表把 #46 算出來的 tier 翻成家長看得到的三級判定，再依面向與逐題出發現標籤。
 * 翻錯不會有型別錯誤 —— tier 3 翻成 `watch`，家長看到的是「居家練習為主」而不是
 * 「建議進一步評估」。所以每一條分界、每一種觸發條件各自一條測試。
 *
 * 【兩層】
 * 規則函式只讀 `ToolResult` 的 `pct`／`tier`／`scored`／`answers`。分界那一層先真的算一份
 * 全對的作答，再把某一個面向（或總分）的 pct **換成**要測的值 —— tier 用 #46 的
 * `tierFor` 重算，不是手填。這樣才踩得到 85／84 這種真實作答踩不到的整數
 * （sxk-voc 30 題的滿分是 60，pct 只能是 1.67 的倍數，84 不存在）。
 * 端到端那一層用 sxk-gm 在 72 個月的 40 題（滿分 80，pct 是 1.25 的倍數）真的湊出
 * 六個邊界值，確認整條路都通。
 *
 * 門檻、標籤、caveat 都是從規格**重新抄一次**的，不是從程式碼的常數讀出來的。
 */

const AT = '2026-09-12T00:00:00.000Z';

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, computedAt: AT });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 全部答同一個值。 */
function flat(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

/** 全答「已经会」，再改掉指定的幾題。 */
function allButItems(toolId: ToolId, ageMonth: number, overrides: Record<string, AnswerValue>): ToolResult {
  return score(toolId, ageMonth, { ...flat(toolId, ageMonth, 2), ...overrides });
}

/** 依「總分 raw」造一份作答：前面的題給 2，剩下的給 0（湊得出的每個整數 raw 都湊得出）。 */
function byTotal(toolId: ToolId, ageMonth: number, raw: number): ToolResult {
  const out: Record<string, AnswerValue> = {};
  let left = raw;
  for (const a of askedItems(toolId, ageMonth)) {
    const v = Math.min(2, left);
    out[a.key] = v;
    left -= v;
  }
  if (left !== 0) throw new Error(`raw ${raw} 放不進 ${toolId}@${ageMonth}`);
  return score(toolId, ageMonth, out);
}

/**
 * 一個面向（或總分）換成指定 pct 的替身。tier 由真的 `tierFor` 算；`raw` 只是湊個
 * 對得上的數 —— 規則不讀它。
 */
function statAt(toolId: ToolId, pct: number, n = 8): SectionStat {
  return {
    n,
    raw: Math.round((pct / 100) * n * 2),
    max: n * 2,
    pct,
    tier: tierFor('achievement', TOOLKIT[toolId].tiers, pct),
    scored: n >= TOOL_SPECS[toolId].minItems,
  };
}

function withOverall(r: ToolResult, pct: number): ToolResult {
  return { ...r, overall: statAt(r.toolId, pct, r.overall.n) };
}

function withSections(r: ToolResult, pcts: Record<string, number>, n?: number): ToolResult {
  const sections = { ...r.sections };
  for (const [key, pct] of Object.entries(pcts)) sections[key] = statAt(r.toolId, pct, n ?? r.sections[key].n);
  return { ...r, sections };
}

/** 六支各一份「全對」的基準：所有面向 100%、tier 1，沒有任何標籤該出。月齡取全部題都出的那一個。 */
const PERFECT_AGE: Readonly<Partial<Record<ToolId, number>>> = {
  'sxk-gm': 72, 'sxk-soc': 72, 'sxk-lang': 72, 'sxk-adp': 72, 'sxk-voc': 36, 'sxk-asq': 36,
};

const PERFECT_CACHE = new Map<ToolId, ToolResult>();

function perfect(toolId: ToolId): ToolResult {
  const cached = PERFECT_CACHE.get(toolId);
  if (cached) return cached;
  const age = PERFECT_AGE[toolId];
  if (age === undefined) throw new Error(`${toolId} 不是達成率族，沒有基準作答`);
  const r = score(toolId, age, flat(toolId, age, 2));
  PERFECT_CACHE.set(toolId, r);
  return r;
}

// ---------------------------------------------------------------------------
// 一、tier → band（§5.4）
// ---------------------------------------------------------------------------

describe('tier → band（§5.4）', () => {
  it('1 clear、2 watch、3 refer、4 refer；null 還是 null', () => {
    const cases: Array<[Tier | null, Band | null]> = [[1, 'clear'], [2, 'watch'], [3, 'refer'], [4, 'refer'], [null, null]];
    for (const [tier, band] of cases) expect(`${tier} → ${bandOfTier(tier)}`).toBe(`${tier} → ${band}`);
  });
});

// ---------------------------------------------------------------------------
// 二、六支的分界（§5.3 × §5.4）
// ---------------------------------------------------------------------------

/** [pct, band, 帶不帶 severity.severe]。從規格重抄：≥85 clear、70–84 watch、55–69 refer、≤54 refer＋severe。 */
const BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [100, 'clear', false],
  [85, 'clear', false],
  [84, 'watch', false],
  [70, 'watch', false],
  [69, 'refer', false],
  [55, 'refer', false],
  [54, 'refer', true],
  [0, 'refer', true],
];

describe('分界：總達成率餵單一維度的五支', () => {
  const FIVE: ReadonlyArray<[ToolId, DimensionCode]> = [
    ['sxk-gm', 'MOT'], ['sxk-soc', 'SOC'], ['sxk-lang', 'LANG'], ['sxk-adp', 'COG'], ['sxk-voc', 'LANG'],
  ];
  for (const [toolId, dimension] of FIVE) {
    it(`${toolId} → ${dimension}`, () => {
      const rule = ruleFor(toolId);
      for (const [pct, band, severe] of BOUNDARY) {
        const r = withOverall(perfect(toolId), pct);
        expect(`${pct} → ${rule.bandFor(r, dimension)}`).toBe(`${pct} → ${band}`);
        expect(`${pct} severe=${rule.tags(r).includes('severity.severe')}`).toBe(`${pct} severe=${severe}`);
      }
    });
  }
});

describe('分界：asq 每個領域各自餵一個維度', () => {
  const FEEDS: ReadonlyArray<[string, DimensionCode]> = [['CO', 'LANG'], ['GM', 'MOT'], ['PS', 'COG'], ['PE', 'SOC']];
  for (const [section, dimension] of FEEDS) {
    it(`${section} → ${dimension}`, () => {
      const rule = ruleFor('sxk-asq');
      for (const [pct, band, severe] of BOUNDARY) {
        const r = withSections(perfect('sxk-asq'), { [section]: pct });
        expect(`${pct} → ${rule.bandFor(r, dimension)}`).toBe(`${pct} → ${band}`);
        expect(`${pct} severe=${rule.tags(r).includes('severity.severe')}`).toBe(`${pct} severe=${severe}`);
      }
    });
  }

  it('asq 的總分不餵任何維度：總分 0% 而四個領域 100% → 四個維度全 clear、沒有 severe', () => {
    const rule = ruleFor('sxk-asq');
    const r = withOverall(perfect('sxk-asq'), 0);
    for (const [, dimension] of FEEDS) expect(rule.bandFor(r, dimension)).toBe('clear');
    expect(rule.tags(r)).not.toContain('severity.severe');
  });
});

describe('端到端：sxk-gm 72 個月 40 題，真的湊出六個邊界值', () => {
  // 滿分 80，pct = raw × 1.25：68→85、67→83.75→84、56→70、55→68.75→69、44→55、43→53.75→54
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [68, 85, 'clear', false],
    [67, 84, 'watch', false],
    [56, 70, 'watch', false],
    [55, 69, 'refer', false],
    [44, 55, 'refer', false],
    [43, 54, 'refer', true],
  ];
  for (const [raw, pct, band, severe] of CASES) {
    it(`raw ${raw} → ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = byTotal('sxk-gm', 72, raw);
      expect(r.overall.pct).toBe(pct);
      const rule = ruleFor('sxk-gm');
      expect(rule.bandFor(r, 'MOT')).toBe(band);
      expect(rule.tags(r).includes('severity.severe')).toBe(severe);
    });
  }
});

// ---------------------------------------------------------------------------
// 三、不餵的維度回 null（§5.7）
// ---------------------------------------------------------------------------

describe('不餵的維度回 null', () => {
  it('sxk-gm 只餵 MOT：其餘八個維度全 null，不是 clear', () => {
    const rule = ruleFor('sxk-gm');
    const r = perfect('sxk-gm');
    const bands = Object.fromEntries(DIMENSION_CODES.map(d => [d, rule.bandFor(r, d)]));
    expect(bands).toEqual({
      COG: null, LANG: null, SOC: null, EMO: null, ATT: null, MOT: 'clear', SEN: null, ADL: null, LEARN: null,
    });
  });

  it('五支各自只餵一個維度', () => {
    expect(ruleFor('sxk-soc').bandFor(perfect('sxk-soc'), 'EMO')).toBeNull();
    expect(ruleFor('sxk-lang').bandFor(perfect('sxk-lang'), 'SOC')).toBeNull();
    expect(ruleFor('sxk-adp').bandFor(perfect('sxk-adp'), 'MOT')).toBeNull();
    expect(ruleFor('sxk-adp').bandFor(perfect('sxk-adp'), 'ADL')).toBeNull();
    expect(ruleFor('sxk-voc').bandFor(perfect('sxk-voc'), 'COG')).toBeNull();
  });

  it('asq 餵四個維度，不餵 EMO／ATT／SEN／ADL／LEARN', () => {
    const rule = ruleFor('sxk-asq');
    const r = perfect('sxk-asq');
    for (const d of ['LANG', 'MOT', 'COG', 'SOC'] as const) expect(rule.bandFor(r, d)).toBe('clear');
    for (const d of ['EMO', 'ATT', 'SEN', 'ADL', 'LEARN'] as const) expect(rule.bandFor(r, d)).toBeNull();
  });

  it('分數是 null（面向沒算出 tier）→ band 也是 null，不是最好的那一段', () => {
    const rule = ruleFor('sxk-gm');
    const r = { ...perfect('sxk-gm'), overall: { ...perfect('sxk-gm').overall, pct: null, tier: null } };
    expect(rule.bandFor(r, 'MOT')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 四、asq：多維度工具（§5.4、§5.9）
// ---------------------------------------------------------------------------

describe('asq：每個領域用自己那組面向出 band', () => {
  it('CO tier 2 而 GM tier 1 → LANG watch、MOT clear；PS／PE 不受影響', () => {
    const rule = ruleFor('sxk-asq');
    const r = withSections(perfect('sxk-asq'), { CO: 75 });
    expect(rule.bandFor(r, 'LANG')).toBe('watch');
    expect(rule.bandFor(r, 'MOT')).toBe('clear');
    expect(rule.bandFor(r, 'COG')).toBe('clear');
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
    expect(rule.tags(r)).toEqual(['lang.expression']);
  });

  it('FM 對任何維度都 null：FM 0% 時 MOT 仍照 GM 判 clear、沒有 severe，但 mot.fine_motor 照出', () => {
    const rule = ruleFor('sxk-asq');
    const r = withSections(perfect('sxk-asq'), { FM: 0 });
    for (const d of DIMENSION_CODES) expect(rule.bandFor(r, d)).toBe(['LANG', 'MOT', 'COG', 'SOC'].includes(d) ? 'clear' : null);
    expect(rule.tags(r)).toEqual(['mot.fine_motor']);
  });

  it('FM tier 2（75%）也出 mot.fine_motor', () => {
    expect(ruleFor('sxk-asq').tags(withSections(perfect('sxk-asq'), { FM: 75 }))).toEqual(['mot.fine_motor']);
  });

  it('PE 前三項各對一個生活自理標籤、後三項是社交；PE 全 0 → SOC refer＋severe', () => {
    const rule = ruleFor('sxk-asq');
    const r = allButItems('sxk-asq', 36, { 'PE.1': 0, 'PE.2': 0, 'PE.3': 0, 'PE.4': 0, 'PE.5': 0, 'PE.6': 0 });
    expect(r.sections.PE).toMatchObject({ pct: 0, tier: 4 });
    expect(rule.bandFor(r, 'SOC')).toBe('refer');
    expect(rule.bandFor(r, 'ADL')).toBeNull();
    expect(rule.tags(r)).toEqual(['adl.feeding', 'adl.toileting', 'adl.dressing', 'soc.social_initiation', 'severity.severe']);
  });

  it('PE 第 1 項答 1、其餘全 2 → 只出 adl.feeding；PE 整體仍 tier 1', () => {
    const rule = ruleFor('sxk-asq');
    const r = allButItems('sxk-asq', 36, { 'PE.1': 1 });
    expect(r.sections.PE.tier).toBe(1);
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
    expect(rule.tags(r)).toEqual(['adl.feeding']);
  });

  it('PE 第 4 項答 2 不出標籤 —— 達成率族的逐題規則是答 ≤1 才觸發', () => {
    expect(ruleFor('sxk-asq').tags(allButItems('sxk-asq', 36, { 'PE.4': 2 }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 五、面向級標籤（§5.5、§5.9）
// ---------------------------------------------------------------------------

describe('面向級標籤：scored 且 tier ≥ 2 才出', () => {
  it('sxk-gm 全答「还不会」→ 五個面向的標籤照面向順序、去重，再加 ball_skills 與 severe', () => {
    const r = score('sxk-gm', 72, flat('sxk-gm', 72, 0));
    expect(ruleFor('sxk-gm').tags(r)).toEqual([
      'mot.postural',       // P1、P2、P3 三個面向都對它，只出一次
      'mot.locomotion',     // P4
      'mot.balance',        // P5
      'mot.ball_skills',    // P5 第 3、6 項答 0
      'severity.severe',
    ]);
  });

  it('tier 2（75%）就出，tier 1（85%）不出', () => {
    const rule = ruleFor('sxk-lang');
    expect(rule.tags(withSections(perfect('sxk-lang'), { AR: 75 }))).toEqual(['lang.articulation']);
    expect(rule.tags(withSections(perfect('sxk-lang'), { AR: 85 }))).toEqual([]);
  });

  it('scored=false 的面向不出標籤：P5 只有 2 題、50%（tier 4）→ 沒有 mot.balance', () => {
    const rule = ruleFor('sxk-gm');
    const notScored = withSections(perfect('sxk-gm'), { P5: 50 }, 2);
    expect(notScored.sections.P5).toMatchObject({ scored: false, tier: 4 });
    expect(rule.tags(notScored)).toEqual([]);
    // 同樣的分數、題數夠 → 出
    expect(rule.tags(withSections(perfect('sxk-gm'), { P5: 50 }, 3))).toEqual(['mot.balance']);
  });

  it('全部一起看：六支每一個面向 tier 2 時出的標籤，逐格與 §5.9 相符', () => {
    const EXPECTED: Record<string, Record<string, string[]>> = {
      'sxk-gm': { P1: ['mot.postural'], P2: ['mot.postural'], P3: ['mot.postural'], P4: ['mot.locomotion'], P5: ['mot.balance'] },
      'sxk-soc': {
        S1: ['soc.joint_attention', 'soc.eye_contact'], S2: ['soc.emotion_reciprocity'],
        S3: ['soc.imitation'], S4: ['soc.social_initiation'], S5: ['emo.regulation'],
      },
      // EX／V2 設 75 時理解面向還是 100，差 25 → 衍生的「表達弱於理解」也一起出（§5.5）
      'sxk-lang': {
        RC: ['lang.comprehension'], EX: ['lang.expression', 'lang.expression_below_comprehension'],
        AR: ['lang.articulation'], PR: ['lang.pragmatics'],
      },
      'sxk-adp': {
        A1: ['cog.visual_attention'], A2: ['mot.fine_motor'], A3: ['cog.problem_solving'],
        A4: ['cog.concepts'], A5: ['adl.routines'],
      },
      'sxk-voc': {
        V1: ['lang.comprehension'], V2: ['lang.expression', 'lang.expression_below_comprehension'],
        V3: ['lang.vocabulary_size'],
      },
      'sxk-asq': { CO: ['lang.expression'], GM: ['mot.locomotion'], FM: ['mot.fine_motor'], PS: ['cog.problem_solving'], PE: [] },
    };
    for (const toolId of ACHIEVEMENT_TOOL_IDS) {
      const rule = ruleFor(toolId);
      for (const section of TOOLKIT[toolId].sections) {
        const r = withSections(perfect(toolId), { [section.key]: 75 });
        expect(`${toolId} ${section.key} → ${rule.tags(r).join(',')}`)
          .toBe(`${toolId} ${section.key} → ${EXPECTED[toolId][section.key].join(',')}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 六、只出標籤的面向（§5.9：soc S5、adp A2／A5）
// ---------------------------------------------------------------------------

describe('只出標籤、不餵那個維度的 band', () => {
  it('soc S5 → emo.regulation，但 EMO 的 band 是 null、SOC 照總分', () => {
    const rule = ruleFor('sxk-soc');
    const r = withSections(perfect('sxk-soc'), { S5: 0 });
    expect(rule.tags(r)).toEqual(['emo.regulation']);
    expect(rule.bandFor(r, 'EMO')).toBeNull();
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
  });

  it('adp A2 → mot.fine_motor、A5 → adl.routines；MOT 與 ADL 的 band 都是 null', () => {
    const rule = ruleFor('sxk-adp');
    const r = withSections(perfect('sxk-adp'), { A2: 0, A5: 0 });
    expect(rule.tags(r)).toEqual(['mot.fine_motor', 'adl.routines']);
    expect(rule.bandFor(r, 'MOT')).toBeNull();
    expect(rule.bandFor(r, 'ADL')).toBeNull();
    expect(rule.bandFor(r, 'COG')).toBe('clear');
  });
});

// ---------------------------------------------------------------------------
// 七、逐題：gm 的球類兩題（§5.9）
// ---------------------------------------------------------------------------

describe('gm 的 ball_skills：P5 第 3 項或第 6 項答 ≤1', () => {
  it('第 3 項答 1、其餘全 2 → 出；P5 本身仍 tier 1 所以沒有 mot.balance', () => {
    const r = allButItems('sxk-gm', 72, { 'P5.3': 1 });
    expect(r.sections.P5.tier).toBe(1);
    expect(ruleFor('sxk-gm').tags(r)).toEqual(['mot.ball_skills']);
  });

  it('第 3 項答 2 → 不出', () => {
    expect(ruleFor('sxk-gm').tags(allButItems('sxk-gm', 72, { 'P5.3': 2 }))).toEqual([]);
  });

  it('第 6 項答 0 → 出；兩項都答 1 → 只出一次', () => {
    expect(ruleFor('sxk-gm').tags(allButItems('sxk-gm', 72, { 'P5.6': 0 }))).toEqual(['mot.ball_skills']);
    expect(ruleFor('sxk-gm').tags(allButItems('sxk-gm', 72, { 'P5.3': 1, 'P5.6': 1 }))).toEqual(['mot.ball_skills']);
  });

  it('P5 其他題答 0 不出 ball_skills（第 1 項不是球類題）', () => {
    const r = allButItems('sxk-gm', 72, { 'P5.1': 0 });
    expect(r.sections.P5.tier).toBe(1);
    expect(ruleFor('sxk-gm').tags(r)).toEqual([]);
  });

  it('30 個月只出到第 3 項：第 3 項答 0 照樣出；第 6 項這個月齡沒出題', () => {
    expect(askedItems('sxk-gm', 30).map(a => a.key)).toContain('P5.3');
    expect(askedItems('sxk-gm', 30).map(a => a.key)).not.toContain('P5.6');
    const r = allButItems('sxk-gm', 30, { 'P5.3': 0 });
    // 這個月齡 P5 只有 4 題（第 1–4 項），一題答 0 就是 6/8 → 75% → tier 2，面向級的 mot.balance 也出
    expect(r.sections.P5).toMatchObject({ n: 4, pct: 75, tier: 2, scored: true });
    expect(ruleFor('sxk-gm').tags(r)).toEqual(['mot.balance', 'mot.ball_skills']);
  });
});

// ---------------------------------------------------------------------------
// 八、表達弱於理解（§5.5）
// ---------------------------------------------------------------------------

describe('lang.expression_below_comprehension：差 ≥15 且表達那一面向 tier ≥2', () => {
  const GAP_CASES: ReadonlyArray<[number, number, boolean, string]> = [
    [90, 75, true, '差 15、EX tier 2 → 出'],
    [88, 75, false, '差 13 → 不出'],
    [95, 86, false, '差 9 且 EX tier 1 → 不出'],
    [100, 84, true, '差 16、EX tier 2 → 出'],
    [100, 85, false, 'EX tier 1 → 不出，就算差 15'],
  ];

  for (const [rc, ex, expected, label] of GAP_CASES) {
    it(`lang RC ${rc}、EX ${ex}：${label}`, () => {
      const r = withSections(perfect('sxk-lang'), { RC: rc, EX: ex });
      expect(ruleFor('sxk-lang').tags(r).includes('lang.expression_below_comprehension')).toBe(expected);
    });
    it(`voc V1 ${rc}、V2 ${ex}：${label}`, () => {
      const r = withSections(perfect('sxk-voc'), { V1: rc, V2: ex });
      expect(ruleFor('sxk-voc').tags(r).includes('lang.expression_below_comprehension')).toBe(expected);
    });
  }

  it('出的時候排在面向級標籤之後：RC 90、EX 75 → [lang.expression, lang.expression_below_comprehension]', () => {
    const r = withSections(perfect('sxk-lang'), { RC: 90, EX: 75 });
    expect(ruleFor('sxk-lang').tags(r)).toEqual(['lang.expression', 'lang.expression_below_comprehension']);
  });

  it('表達那一面向 scored=false 時不出（題數不夠的面向不出任何標籤）', () => {
    const r = withSections(perfect('sxk-lang'), { RC: 90 });
    const notScored = withSections(r, { EX: 75 }, 2);
    expect(ruleFor('sxk-lang').tags(notScored)).toEqual([]);
  });

  it('只看 RC／EX，AR 與 PR 的分數不參與', () => {
    const r = withSections(perfect('sxk-lang'), { AR: 100, PR: 100, RC: 80, EX: 80 });
    expect(ruleFor('sxk-lang').tags(r)).toEqual(['lang.comprehension', 'lang.expression']);
  });
});

// ---------------------------------------------------------------------------
// 九、caveats（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('caveats：固定值逐支相符，加上跟著判定走的', () => {
  it('固定值（含 22 支都帶的 parent_report）', () => {
    const EXPECTED: Record<string, string[]> = {
      'sxk-gm': ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
      'sxk-soc': ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
      'sxk-lang': ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
      'sxk-adp': ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
      'sxk-voc': ['parent_report', 'unsourced_threshold'],
      'sxk-asq': ['parent_report', 'unsourced_threshold', 'parent_administered_task', 'few_items', 'narrow_window'],
    };
    for (const toolId of ACHIEVEMENT_TOOL_IDS) {
      expect(`${toolId}: ${ruleFor(toolId).caveats(perfect(toolId)).join(',')}`)
        .toBe(`${toolId}: ${EXPECTED[toolId].join(',')}`);
    }
  });

  it('lang 判 refer 時加 hearing_check_first；watch 與 clear 時不加', () => {
    const rule = ruleFor('sxk-lang');
    expect(rule.caveats(withOverall(perfect('sxk-lang'), 69))).toContain('hearing_check_first');
    expect(rule.caveats(withOverall(perfect('sxk-lang'), 0))).toContain('hearing_check_first');
    expect(rule.caveats(withOverall(perfect('sxk-lang'), 70))).not.toContain('hearing_check_first');
    expect(rule.caveats(withOverall(perfect('sxk-lang'), 100))).not.toContain('hearing_check_first');
  });

  it('voc 同法', () => {
    const rule = ruleFor('sxk-voc');
    expect(rule.caveats(withOverall(perfect('sxk-voc'), 69)))
      .toEqual(['parent_report', 'unsourced_threshold', 'hearing_check_first']);
    expect(rule.caveats(withOverall(perfect('sxk-voc'), 70))).toEqual(['parent_report', 'unsourced_threshold']);
  });

  it('其餘四支判 refer 也不加 hearing_check_first —— 那是語言工具專屬的', () => {
    for (const toolId of ['sxk-gm', 'sxk-soc', 'sxk-adp'] as const) {
      expect(ruleFor(toolId).caveats(withOverall(perfect(toolId), 0))).not.toContain('hearing_check_first');
    }
    expect(ruleFor('sxk-asq').caveats(withSections(perfect('sxk-asq'), { CO: 0 }))).not.toContain('hearing_check_first');
  });

  it('舊紀錄被新窗口重讀：月齡在窗口外 → age_out_of_window；沒全答 → incomplete', () => {
    const rule = ruleFor('sxk-voc');
    const base = perfect('sxk-voc');
    expect(rule.caveats(base)).not.toContain('age_out_of_window');
    expect(rule.caveats({ ...base, assessedAgeMonth: 43 })).toContain('age_out_of_window');
    expect(rule.caveats({ ...base, answeredCount: base.askedCount - 1 })).toContain('incomplete');
  });

  it('每次呼叫回新的陣列，改了不會污染下一次', () => {
    const rule = ruleFor('sxk-gm');
    const a = rule.caveats(perfect('sxk-gm'));
    a.push('safety_concern');
    expect(rule.caveats(perfect('sxk-gm'))).not.toContain('safety_concern');
    const t = rule.tags(withSections(perfect('sxk-gm'), { P4: 0 }));
    t.push('sen.oral');
    expect(rule.tags(withSections(perfect('sxk-gm'), { P4: 0 }))).toEqual(['mot.locomotion']);
  });
});

// ---------------------------------------------------------------------------
// 十、登錄
// ---------------------------------------------------------------------------

describe('規則表登錄', () => {
  it('達成率族就是 §5.2 那六支，從登錄表的 family 推出來', () => {
    expect([...ACHIEVEMENT_TOOL_IDS]).toEqual(['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq']);
    expect(Object.keys(ACHIEVEMENT_RULES)).toEqual([...ACHIEVEMENT_TOOL_IDS]);
  });

  it('六支都在登錄表裡（完整的登錄清單由最新的那張票釘住）；toolId 對得上 key，版本是計分那一版', () => {
    for (const toolId of ACHIEVEMENT_TOOL_IDS) expect(TOOL_RULES[toolId]).toBeDefined();
    for (const [key, rule] of Object.entries(TOOL_RULES)) {
      expect(rule.toolId).toBe(key);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
      expect(rule.rulesVersion).toBe('v2-2026-09-11');
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數', () => {
    for (const toolId of ACHIEVEMENT_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
      expect(rule.source).toContain('LEVELS');
    }
  });

  it('還沒做的工具問 ruleFor 會丟錯，不會安靜地當成沒有判定', () => {
    expect(() => ruleFor('sxk-dev')).toThrow(/sxk-dev/);
    expect(TOOL_RULES['sxk-dev']).toBeUndefined();
  });
});

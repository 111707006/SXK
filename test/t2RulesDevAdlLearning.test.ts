import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { ITEM_TAGS } from '../src/t2/itemTags';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, DimensionCode, SectionStat, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { ASD_TOOL_IDS } from '../src/t2/rules/asd';
import { ATTENTION_SENSORY_TOOL_IDS } from '../src/t2/rules/attentionSensory';
import {
  ADL_FEW_ITEMS_SECTION,
  DEV_ADL_LEARNING_RULES,
  DEV_ADL_LEARNING_TOOL_IDS,
  FEW_ITEMS_MAX,
  INDEPENDENCE_ITEM_MAX,
} from '../src/t2/rules/devAdlLearning';
import { TOOL_RULES, ruleFor } from '../src/t2/rules';

/**
 * 分齡發展（dev）、生活自理（adl）、學習障礙（ldp／lds）的規則表
 * （#50，規格 v2 §5.3、§5.4、§5.5、§5.6、§5.9）。
 *
 * 【這裡在防什麼】
 * 三個計分族、四支工具，每一處翻錯都沒有型別錯誤：
 * 1. dev 是**多維度**工具：五個領域各餵自己的維度。少接一條，那個維度會安靜地變成
 *    `null`（＝「沒做」）；多接一條，一個語言落後的孩子會連認知也被判 refer。
 * 2. dev 的 FM **不出 band 但出標籤**；五題全「不評」的領域是 `null` 不是 0 分。
 * 3. adl 的逐項門檻在 **4／5** 之間：5 是「口頭引導、大人不用動手」，4 是「大人幫忙
 *    起頭或收尾」。差一級，一個只需要提醒的孩子會拿到一串「要練」的標籤。
 * 4. ldp／lds 的 band 比的是**原始總分**（0–90），方面比的是另一張 0–18 的表。
 *    拿百分比去比 10／20／30 那張表會得到「剛好對，然後在別的分數上默默錯掉」。
 *
 * 【兩層】
 * 分界那一層把某個面向（或總分）的統計換掉，tier 用 #46 的 `tierFor` 重算 ——
 * dev 一個領域只有 5 題，89／74／59 這些整數真實作答踩不到。端到端那一層用
 * adl 的 18 項（獨立率 0–100）與 ldp 的 30 題（總分 0–90）真的湊出每一個邊界值。
 *
 * §5.9 的三張對應表（dev 六個領域、adl 18 項、ldp／lds 五個方面）都是**整張重抄**的，
 * 不從 `sectionTags.ts`／`itemTags.ts` 讀出來比。
 */

const AT = '2026-09-12T00:00:00.000Z';

/** 每支挑一個「本次全部題目都出」的月齡：dev 49–72 段 30 題、adl 42 起 18 項、ldp／lds 全題無起始月齡。 */
const AGE: Readonly<Record<string, number>> = { 'sxk-dev': 60, 'sxk-adl': 60, 'sxk-ldp': 96, 'sxk-lds': 156 };

/** ldp 與 lds 的題目、分段、對應表完全相同——每一條測試都跑兩遍。 */
const LEARNING: ReadonlyArray<ToolId> = ['sxk-ldp', 'sxk-lds'];

function score(toolId: ToolId, answers: Record<string, AnswerValue>, age = AGE[toolId]): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: age, rater: 'mother', answers, computedAt: AT });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 全部答同一個值。 */
function flat(toolId: ToolId, value: AnswerValue, age = AGE[toolId]): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, age)) out[a.key] = value;
  return out;
}

/** 換掉一個面向的統計。規則只讀 `n`／`pct`／`tier`／`scored`，`raw`／`max` 只是湊個對得上的數。 */
function patchSection(r: ToolResult, key: string, patch: Partial<SectionStat>): ToolResult {
  return { ...r, sections: { ...r.sections, [key]: { ...r.sections[key], ...patch } } };
}

const tagsOf = (toolId: ToolId, r: ToolResult): string[] => ruleFor(toolId).tags(r);
const bandsOf = (toolId: ToolId, r: ToolResult): Record<string, Band | null> =>
  Object.fromEntries(DIMENSION_CODES.map(d => [d, ruleFor(toolId).bandFor(r, d)]));

// ---------------------------------------------------------------------------
// 一、dev：分界（§5.3 × §5.4）
// ---------------------------------------------------------------------------

const DEV = 'sxk-dev';
const PASS = 'pass';
const FAIL = 'fail';
const SKIP = 'skip';

/** dev：六個領域全「通過」，再把指定領域的五題換成指定的作答（照題序）。 */
function dev(domains: Record<string, ReadonlyArray<AnswerValue>>): ToolResult {
  const out = flat(DEV, PASS);
  for (const a of askedItems(DEV, AGE[DEV])) {
    const list = domains[a.sectionKey];
    if (!list) continue;
    if (list[a.item.no - 1] === undefined) throw new Error(`${a.sectionKey} 少給第 ${a.item.no} 題的作答`);
    out[a.key] = list[a.item.no - 1];
  }
  return score(DEV, out);
}

/** 把一個領域換成指定的通過率。`pct` 為 `null` 代表整個領域都「不評」（分母 0）。 */
function devAt(r: ToolResult, domain: string, pct: number | null, n = 5): ToolResult {
  return patchSection(r, domain, {
    n,
    raw: pct === null ? 0 : Math.round((pct / 100) * n),
    max: n,
    pct,
    tier: tierFor('pass', TOOLKIT[DEV].tiers, pct),
    scored: n >= TOOL_SPECS[DEV].minItems,
  });
}

/** [pct, band, 帶不帶 severity.severe]。從規格 §5.3 的 dev 分段重抄：≥90 / 75–89 / 60–74 / ≤59。 */
const DEV_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [100, 'clear', false],
  [90, 'clear', false],
  [89, 'watch', false],
  [75, 'watch', false],
  [74, 'refer', false],
  [60, 'refer', false],
  [59, 'refer', true],
  [0, 'refer', true],
];

/** 五個出 band 的領域 ← 各自的維度（§5.9；FM 不在內）。 */
const DEV_FEEDS: ReadonlyArray<[string, DimensionCode]> = [
  ['MOT', 'MOT'], ['LANG', 'LANG'], ['SOC', 'SOC'], ['ADL', 'ADL'], ['COG', 'COG'],
];

describe('dev 分界：每個領域各餵自己的維度', () => {
  const perfect = () => dev({});

  for (const [domain, dimension] of DEV_FEEDS) {
    it(`${domain} → ${dimension}`, () => {
      for (const [pct, band, severe] of DEV_BOUNDARY) {
        const r = devAt(perfect(), domain, pct);
        expect(`${pct} → ${ruleFor(DEV).bandFor(r, dimension)}`).toBe(`${pct} → ${band}`);
        expect(`${pct} severe=${tagsOf(DEV, r).includes('severity.severe')}`).toBe(`${pct} severe=${severe}`);
      }
    });
  }

  it('一個領域壞掉不會牽動別的領域：LANG 0%、其餘 100% → 只有 LANG refer', () => {
    const r = devAt(dev({}), 'LANG', 0);
    expect(bandsOf(DEV, r)).toEqual({
      COG: 'clear', LANG: 'refer', SOC: 'clear', EMO: null, ATT: null,
      MOT: 'clear', SEN: null, ADL: 'clear', LEARN: null,
    });
  });

  it('dev 的總分不餵任何維度：總分 0% 而五個領域 100% → 五個維度全 clear、沒有 severe', () => {
    const base = dev({});
    const r: ToolResult = { ...base, overall: { ...base.overall, pct: 0, tier: 4 } };
    for (const [, dimension] of DEV_FEEDS) expect(ruleFor(DEV).bandFor(r, dimension)).toBe('clear');
    expect(tagsOf(DEV, r)).not.toContain('severity.severe');
  });
});

// ---------------------------------------------------------------------------
// 二、dev：真實可達的通過率（§5.1 的「不評」不進分母）
// ---------------------------------------------------------------------------

describe('dev 端到端：一個領域五題，真的湊得出來的比例', () => {
  /** [作答, n, pct, tier, band]。「不評」不進分母 —— 3 通過 1 未通過 1 不評是 3／4 不是 3／5。 */
  const CASES: ReadonlyArray<[ReadonlyArray<string>, number, number | null, number | null, Band | null]> = [
    [[PASS, PASS, PASS, PASS, PASS], 5, 100, 1, 'clear'],
    [[PASS, PASS, PASS, PASS, FAIL], 5, 80, 2, 'watch'],
    [[PASS, PASS, PASS, FAIL, SKIP], 4, 75, 2, 'watch'],
    [[PASS, PASS, PASS, FAIL, FAIL], 5, 60, 3, 'refer'],
    [[PASS, PASS, FAIL, FAIL, SKIP], 4, 50, 4, 'refer'],
    [[SKIP, SKIP, SKIP, SKIP, SKIP], 0, null, null, null],
  ];

  for (const [answers, n, pct, tier, band] of CASES) {
    it(`LANG ${answers.join('／')} → n=${n}、${pct}%、tier ${tier}、${band}`, () => {
      const r = dev({ LANG: answers });
      expect(r.sections.LANG).toMatchObject({ n, pct, tier });
      expect(ruleFor(DEV).bandFor(r, 'LANG')).toBe(band);
    });
  }

  it('通過 4／5 → LANG watch，caveats 帶 few_items（一個領域只有 5 題，§5.4「一律標」）', () => {
    const r = dev({ LANG: [PASS, PASS, PASS, PASS, FAIL] });
    expect(ruleFor(DEV).bandFor(r, 'LANG')).toBe('watch');
    expect(ruleFor(DEV).caveats(r)).toContain('few_items');
    expect(tagsOf(DEV, r)).toEqual(['lang.comprehension', 'lang.expression']);
  });

  it('五題全「不評」→ 那個維度 null（不是 clear、也不是 0 分）；scored 是 false、標籤不出', () => {
    const r = dev({ COG: [SKIP, SKIP, SKIP, SKIP, SKIP] });
    expect(r.sections.COG).toMatchObject({ n: 0, raw: 0, pct: null, tier: null, scored: false });
    expect(ruleFor(DEV).bandFor(r, 'COG')).toBeNull();
    expect(tagsOf(DEV, r)).toEqual([]);
  });

  it('問 dev 不餵的維度（SEN、EMO、ATT、LEARN）→ null', () => {
    const r = dev({});
    for (const d of ['SEN', 'EMO', 'ATT', 'LEARN'] as const) expect(ruleFor(DEV).bandFor(r, d)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 三、dev：FM 不出 band、只出標籤（§5.9）
// ---------------------------------------------------------------------------

describe('dev 的 FM：不出 band，標籤照出', () => {
  it('FM 通過 3／5（tier 3）→ 九個維度全照其他領域判，但 mot.fine_motor 照出', () => {
    const r = dev({ FM: [PASS, PASS, PASS, FAIL, FAIL] });
    expect(r.sections.FM).toMatchObject({ pct: 60, tier: 3 });
    expect(bandsOf(DEV, r)).toEqual({
      COG: 'clear', LANG: 'clear', SOC: 'clear', EMO: null, ATT: null,
      MOT: 'clear', SEN: null, ADL: 'clear', LEARN: null,
    });
    expect(tagsOf(DEV, r)).toEqual(['mot.fine_motor']);
  });

  it('FM 全未通過（tier 4）也不出 severity.severe —— severe 只看拿去出 band 的 tier（勘誤 F1）', () => {
    const r = dev({ FM: [FAIL, FAIL, FAIL, FAIL, FAIL] });
    expect(r.sections.FM.tier).toBe(4);
    expect(tagsOf(DEV, r)).toEqual(['mot.fine_motor']);
  });

  it('MOT 領域壞掉才會推 MOT 的 band —— FM 與 MOT 是兩個領域', () => {
    const r = dev({ MOT: [PASS, PASS, PASS, FAIL, FAIL], FM: [PASS, PASS, PASS, PASS, PASS] });
    expect(ruleFor(DEV).bandFor(r, 'MOT')).toBe('refer');
    expect(tagsOf(DEV, r)).toEqual(['mot.locomotion']);
  });
});

// ---------------------------------------------------------------------------
// 四、dev：領域標籤表（§5.9 整張重抄）
// ---------------------------------------------------------------------------

/** §5.9 的 dev 那一列，六個領域逐格重抄。觸發條件是領域 `scored` 且 tier ≥ 2。 */
const DEV_SECTION_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['MOT', ['mot.locomotion']],
  ['FM', ['mot.fine_motor']],
  ['LANG', ['lang.comprehension', 'lang.expression']],
  ['SOC', ['soc.social_initiation']],
  ['ADL', ['adl.routines']],
  ['COG', ['cog.problem_solving']],
];

describe('dev 領域標籤：§5.9 的六列逐格比對', () => {
  for (const [domain, tags] of DEV_SECTION_TAGS) {
    it(`${domain} tier 3 → ${tags.join('＋') || '（無）'}`, () => {
      expect(tagsOf(DEV, dev({ [domain]: [PASS, PASS, PASS, FAIL, FAIL] }))).toEqual([...tags]);
    });
  }

  it('tier 2（80%）就出，tier 1（100%）不出', () => {
    expect(tagsOf(DEV, dev({ SOC: [PASS, PASS, PASS, PASS, FAIL] }))).toEqual(['soc.social_initiation']);
    expect(tagsOf(DEV, dev({}))).toEqual([]);
  });

  it('六個領域全未通過 → 六列的標籤照題庫的領域順序出，加 severe', () => {
    const allFail = Object.fromEntries(
      ['MOT', 'FM', 'LANG', 'SOC', 'ADL', 'COG'].map(k => [k, [FAIL, FAIL, FAIL, FAIL, FAIL]]),
    );
    expect(tagsOf(DEV, dev(allFail))).toEqual([
      'mot.locomotion', 'mot.fine_motor', 'lang.comprehension', 'lang.expression',
      'soc.social_initiation', 'adl.routines', 'cog.problem_solving', 'severity.severe',
    ]);
  });

  it('scored=false 的領域不出標籤（分母 0 之外的安全網）', () => {
    const notScored = devAt(dev({}), 'SOC', 40, 0);
    expect(notScored.sections.SOC).toMatchObject({ scored: false, tier: 4 });
    expect(tagsOf(DEV, notScored)).toEqual([]);
    expect(ruleFor(DEV).bandFor(notScored, 'SOC')).toBeNull();
  });

  it('§5.9 沒有給 dev 逐題規則 —— 規則表不掃逐題', () => {
    expect(ITEM_TAGS[DEV]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 五、dev：caveats（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('dev caveats', () => {
  it('固定四個：parent_report ＋ unsourced_threshold ＋ parent_administered_task ＋ few_items', () => {
    expect(ruleFor(DEV).caveats(dev({}))).toEqual([
      'parent_report', 'unsourced_threshold', 'parent_administered_task', 'few_items',
    ]);
  });

  it('判到 refer 也不加 hearing_check_first —— 那是 lang／voc 專屬的', () => {
    expect(ruleFor(DEV).caveats(devAt(dev({}), 'LANG', 0))).not.toContain('hearing_check_first');
  });

  it('舊紀錄被新窗口重讀：月齡在窗口外 → age_out_of_window；沒全答 → incomplete', () => {
    const base = dev({});
    expect(ruleFor(DEV).caveats({ ...base, assessedAgeMonth: 73 })).toContain('age_out_of_window');
    expect(ruleFor(DEV).caveats({ ...base, answeredCount: base.askedCount - 1 })).toContain('incomplete');
  });
});

// ---------------------------------------------------------------------------
// 六、adl：分界（§5.3 × §5.4），18 項真的湊出六個邊界值
// ---------------------------------------------------------------------------

const ADL = 'sxk-adl';

/** adl：全部答「完全自己做」（7），再換掉指定的幾項。 */
function adl(overrides: Record<string, AnswerValue> = {}, age = AGE[ADL]): ToolResult {
  return score(ADL, { ...flat(ADL, 7, age), ...overrides }, age);
}

/**
 * 依總分造一份作答。七級最低是 **1** 不是 0，所以從「全 1」（總分 18）起算，
 * 每一項最多再加 6 —— 獨立率 `(raw − n) ÷ (n×6)` 的分子就是這裡加上去的量。
 */
function adlByRaw(raw: number): ToolResult {
  const out: Record<string, AnswerValue> = {};
  let left = raw - askedItems(ADL, AGE[ADL]).length;
  for (const a of askedItems(ADL, AGE[ADL])) {
    const add = Math.min(6, Math.max(0, left));
    out[a.key] = 1 + add;
    left -= add;
  }
  if (left !== 0) throw new Error(`總分 ${raw} 放不進 adl 的 18 項`);
  return score(ADL, out);
}

describe('adl 分界：總獨立率 → ADL', () => {
  /** [總分, 獨立率, band, 帶不帶 severe]。獨立率＝round((raw−18)÷108×100)；切分 72／58／45（§5.3）。 */
  const CASES: ReadonlyArray<[number, number, Band, boolean]> = [
    [96, 72, 'clear', false],
    [95, 71, 'watch', false],
    [81, 58, 'watch', false],
    [80, 57, 'refer', false],
    [67, 45, 'refer', false],
    [66, 44, 'refer', true],
  ];

  for (const [raw, pct, band, severe] of CASES) {
    it(`總分 ${raw} → 獨立率 ${pct}% → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = adlByRaw(raw);
      expect(r.overall.pct).toBe(pct);
      expect(ruleFor(ADL).bandFor(r, 'ADL')).toBe(band);
      expect(tagsOf(ADL, r).includes('severity.severe')).toBe(severe);
    });
  }

  it('全「完全自己做」→ 100%、clear；全「完全由大人做」→ 0%、refer＋severe', () => {
    expect(adl().overall.pct).toBe(100);
    expect(ruleFor(ADL).bandFor(adl(), 'ADL')).toBe('clear');
    const worst = score(ADL, flat(ADL, 1));
    expect(worst.overall.pct).toBe(0);
    expect(ruleFor(ADL).bandFor(worst, 'ADL')).toBe('refer');
    expect(tagsOf(ADL, worst)).toContain('severity.severe');
  });

  it('adl 只餵 ADL：其餘八個維度全 null，MO 的四項再差也不推 MOT', () => {
    const r = adl({ 'MO.1': 1, 'MO.2': 1, 'MO.3': 1, 'MO.4': 1 });
    expect(bandsOf(ADL, r)).toEqual({
      COG: null, LANG: null, SOC: null, EMO: null, ATT: null, MOT: null, SEN: null, ADL: 'clear', LEARN: null,
    });
    expect(tagsOf(ADL, r)).toEqual(['mot.locomotion']);
  });
});

// ---------------------------------------------------------------------------
// 七、adl：逐項標籤（§5.9 整張重抄，18 項）
// ---------------------------------------------------------------------------

/** §5.9 的 adl 那一列，18 項逐格重抄。CC 的 3、4、5 明寫不出標籤。 */
const ADL_ITEM_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['SC.1', ['adl.feeding']],        // 进食
  ['SC.2', ['adl.dressing']],       // 穿脱上衣
  ['SC.3', ['adl.dressing']],       // 穿脱裤子与鞋袜
  ['SC.4', ['adl.hygiene']],        // 梳洗整理
  ['SC.5', ['adl.toileting']],      // 如厕动作
  ['SC.6', ['adl.hygiene']],        // 洗澡
  ['SP.1', ['adl.toileting']],      // 膀胱控制
  ['SP.2', ['adl.toileting']],      // 肠道控制
  ['MO.1', ['mot.locomotion']],     // 床椅转位
  ['MO.2', ['mot.locomotion']],     // 平地行走
  ['MO.3', ['mot.locomotion']],     // 如厕转位
  ['MO.4', ['mot.locomotion']],     // 上下楼梯
  ['CC.1', ['lang.comprehension']], // 理解他人的话或指令
  ['CC.2', ['lang.expression']],    // 表达自己的需求与想法
  ['CC.3', []],                     // 与人互动
  ['CC.4', []],                     // 注意力维持
  ['CC.5', []],                     // 解决日常小问题
  ['CC.6', ['adl.routines']],       // 记住并完成交代的事
];

describe('adl 逐項標籤：§5.9 的 18 項逐格比對', () => {
  for (const [key, tags] of ADL_ITEM_TAGS) {
    it(`${key} 答 4 → ${tags.join('＋') || '（無標籤）'}`, () => {
      expect(tagsOf(ADL, adl({ [key]: 4 }))).toEqual([...tags]);
    });
  }

  it('門檻在 4／5 之間：答 4（大人幫忙起頭或收尾）出，答 5（只是口頭引導）不出', () => {
    expect(INDEPENDENCE_ITEM_MAX).toBe(4);
    expect(tagsOf(ADL, adl({ 'SC.1': 5 }))).toEqual([]);
    expect(tagsOf(ADL, adl({ 'SC.1': 4 }))).toEqual(['adl.feeding']);
    expect(tagsOf(ADL, adl({ 'SC.1': 1 }))).toEqual(['adl.feeding']);
  });

  it('全答 5 → 獨立率 67%（tier 2、watch）而一個標籤都沒有：adl 沒有面向級規則', () => {
    const r = score(ADL, flat(ADL, 5));
    expect(r.overall).toMatchObject({ pct: 67, tier: 2 });
    expect(ruleFor(ADL).bandFor(r, 'ADL')).toBe('watch');
    expect(tagsOf(ADL, r)).toEqual([]);
  });

  it('全答 1 → 18 項的標籤去重、照題庫順序，加 severe', () => {
    expect(tagsOf(ADL, score(ADL, flat(ADL, 1)))).toEqual([
      'adl.feeding', 'adl.dressing', 'adl.hygiene', 'adl.toileting',
      'mot.locomotion', 'lang.comprehension', 'lang.expression', 'adl.routines',
      'severity.severe',
    ]);
  });

  it('30 個月只出 13 項：SC 第 4、6 項與 CC 第 6 項這個月齡沒出題，對應的標籤也不出', () => {
    const keys = askedItems(ADL, 30).map(a => a.key);
    expect(keys).toHaveLength(13);
    expect(keys).not.toContain('SC.4');
    expect(keys).not.toContain('CC.6');
    const r = score(ADL, flat(ADL, 1, 30), 30);
    expect(r.sections.SC.n).toBe(3);
    expect(tagsOf(ADL, r)).toEqual([
      'adl.feeding', 'adl.dressing', 'adl.toileting',
      'mot.locomotion', 'lang.comprehension', 'lang.expression',
      'severity.severe',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 八、adl：caveats（§5.6、§5.9）
// ---------------------------------------------------------------------------

describe('adl caveats：固定的兩個，加括約肌領域的 few_items', () => {
  it('parent_report ＋ unsourced_threshold ＋ rater_not_credentialed ＋ few_items', () => {
    expect(ruleFor(ADL).caveats(adl())).toEqual([
      'parent_report', 'unsourced_threshold', 'rater_not_credentialed', 'few_items',
    ]);
  });

  it('few_items 不在登錄表的固定值裡 —— 它講的是那個領域的題數，不是這支工具的性質', () => {
    expect([...TOOL_SPECS[ADL].fixedCaveats]).toEqual(['unsourced_threshold', 'rater_not_credentialed']);
  });

  it('括約肌領域只有 2 項，scored 依獨立率族的最少題數 2 判', () => {
    expect(TOOL_SPECS[ADL].minItems).toBe(2);
    expect(adl().sections[ADL_FEW_ITEMS_SECTION]).toMatchObject({ n: 2, scored: true });
  });

  it(`題數 ≤ ${FEW_ITEMS_MAX} 才出：剛好 6 出，7 就停（題庫哪天把括約肌拆細，這一條自己收手）`, () => {
    const six = patchSection(adl(), ADL_FEW_ITEMS_SECTION, { n: FEW_ITEMS_MAX });
    const seven = patchSection(adl(), ADL_FEW_ITEMS_SECTION, { n: FEW_ITEMS_MAX + 1 });
    expect(ruleFor(ADL).caveats(six)).toContain('few_items');
    expect(ruleFor(ADL).caveats(seven)).not.toContain('few_items');
  });

  it('那個領域不單獨判讀（scored=false）→ 不出：沒有被讀的東西不需要打折', () => {
    const notScored = patchSection(adl(), ADL_FEW_ITEMS_SECTION, { n: 1, scored: false });
    expect(ruleFor(ADL).caveats(notScored)).not.toContain('few_items');
  });

  it('rater_not_credentialed 不隨分數變：clear 與 refer 都帶', () => {
    expect(ruleFor(ADL).caveats(adl())).toContain('rater_not_credentialed');
    expect(ruleFor(ADL).caveats(score(ADL, flat(ADL, 1)))).toContain('rater_not_credentialed');
  });
});

// ---------------------------------------------------------------------------
// 九、ldp／lds：分界（§5.3 × §5.4）——比的是原始總分，不是百分比
// ---------------------------------------------------------------------------

/** ldp／lds：全答「从未」（0），再把指定方面的原始分湊到指定值（前面的題給 3，剩下的給 0）。 */
function learn(toolId: ToolId, raws: Record<string, number> = {}): ToolResult {
  const out: Record<string, AnswerValue> = {};
  const left = { ...raws };
  for (const a of askedItems(toolId, AGE[toolId])) {
    const want = left[a.sectionKey] ?? 0;
    const v = Math.min(3, Math.max(0, want));
    out[a.key] = v;
    left[a.sectionKey] = want - v;
  }
  for (const [key, rest] of Object.entries(left)) {
    if (rest !== 0) throw new Error(`原始分 ${raws[key]} 放不進 ${toolId} 的 ${key}`);
  }
  return score(toolId, out);
}

/** 依總分造一份作答：從第一個方面開始填滿。 */
function learnByTotal(toolId: ToolId, raw: number): ToolResult {
  const out: Record<string, AnswerValue> = {};
  let left = raw;
  for (const a of askedItems(toolId, AGE[toolId])) {
    const v = Math.min(3, left);
    out[a.key] = v;
    left -= v;
  }
  if (left !== 0) throw new Error(`總分 ${raw} 放不進 ${toolId} 的 30 題`);
  return score(toolId, out);
}

/** [總分, band, 帶不帶 severe]。從 §5.3 的總分分段重抄：≤9 / 10–19 / 20–29 / ≥30。 */
const LEARN_BOUNDARY: ReadonlyArray<[number, Band, boolean]> = [
  [0, 'clear', false],
  [9, 'clear', false],
  [10, 'watch', false],
  [19, 'watch', false],
  [20, 'refer', false],
  [29, 'refer', false],
  [30, 'refer', true],
  [90, 'refer', true],
];

describe.each(LEARNING)('%s 分界：總分 → LEARN', toolId => {
  for (const [raw, band, severe] of LEARN_BOUNDARY) {
    it(`總分 ${raw} → ${band}${severe ? '＋severe' : ''}`, () => {
      const r = learnByTotal(toolId, raw);
      expect(r.overall.raw).toBe(raw);
      expect(ruleFor(toolId).bandFor(r, 'LEARN')).toBe(band);
      expect(tagsOf(toolId, r).includes('severity.severe')).toBe(severe);
    });
  }

  it('比的是原始總分不是百分比：總分 9（11%）是 clear、總分 29（32%）是 refer 但沒有 severe', () => {
    const low = learnByTotal(toolId, 9);
    expect(low.overall.pct).toBe(10);
    expect(ruleFor(toolId).bandFor(low, 'LEARN')).toBe('clear');
    const high = learnByTotal(toolId, 29);
    expect(high.overall.pct).toBe(32);
    expect(ruleFor(toolId).bandFor(high, 'LEARN')).toBe('refer');
    expect(tagsOf(toolId, high)).not.toContain('severity.severe');
  });

  it('只餵 LEARN：其餘八個維度全 null', () => {
    const r = learn(toolId, { read: 18, attn: 18 });
    expect(bandsOf(toolId, r)).toEqual({
      COG: null, LANG: null, SOC: null, EMO: null, ATT: null, MOT: null, SEN: null, ADL: null, LEARN: 'refer',
    });
  });
});

// ---------------------------------------------------------------------------
// 十、ldp／lds：方面標籤（§5.9 整張重抄）——方面用自己那張 0–18 的分段表
// ---------------------------------------------------------------------------

/** §5.9 的 ldp／lds 那一列，五個方面逐格重抄。注意力方面只出標籤（LDP 只餵 LEARN）。 */
const LEARN_SECTION_TAGS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['read', ['learn.reading']],          // 阅读方面
  ['math', ['learn.number']],           // 数学方面
  ['write', ['learn.writing']],         // 书写方面
  ['attn', ['att.inattention']],        // 注意力方面
  ['lang', ['learn.phonological']],     // 语言处理方面
];

/** [方面原始分, 方面 tier, 出不出標籤]。從 §5.3 的方面分段重抄：≤4 / 5–8 / 9–12 / ≥13。 */
const LEARN_SECTION_BOUNDARY: ReadonlyArray<[number, number, boolean]> = [
  [4, 1, false],
  [5, 2, true],
  [8, 2, true],
  [9, 3, true],
  [12, 3, true],
  [13, 4, true],
  [18, 4, true],
];

describe.each(LEARNING)('%s 方面標籤：tier ≥ 2 才出', toolId => {
  for (const [section, tags] of LEARN_SECTION_TAGS) {
    it(`${section} 原始分 5（tier 2）→ ${tags.join('＋')}`, () => {
      expect(tagsOf(toolId, learn(toolId, { [section]: 5 }))).toEqual([...tags]);
    });
  }

  for (const [raw, tier, tagged] of LEARN_SECTION_BOUNDARY) {
    it(`阅读方面原始分 ${raw} → 方面 tier ${tier}、${tagged ? '出' : '不出'}標籤`, () => {
      const r = learn(toolId, { read: raw });
      expect(r.sections.read.tier).toBe(tier);
      expect(tagsOf(toolId, r).includes('learn.reading')).toBe(tagged);
    });
  }

  it('方面 tier 4 而總分只有 tier 2 → 沒有 severe（severe 只看拿去出 band 的 tier，勘誤 F1）', () => {
    const r = learn(toolId, { read: 13 });
    expect(r.sections.read.tier).toBe(4);
    expect(r.overall).toMatchObject({ raw: 13, tier: 2 });
    expect(ruleFor(toolId).bandFor(r, 'LEARN')).toBe('watch');
    expect(tagsOf(toolId, r)).toEqual(['learn.reading']);
  });

  it('注意力方面 tier 2 → att.inattention，但 ATT 的 band 是 null（只出標籤）', () => {
    const r = learn(toolId, { attn: 5 });
    expect(r.sections.attn.tier).toBe(2);
    expect(ruleFor(toolId).bandFor(r, 'ATT')).toBeNull();
    expect(ruleFor(toolId).bandFor(r, 'LEARN')).toBe('clear');
    expect(tagsOf(toolId, r)).toEqual(['att.inattention']);
  });

  it('五個方面全滿（各 18）→ 五列的標籤照題庫順序出，加 severe', () => {
    const r = learn(toolId, { read: 18, math: 18, write: 18, attn: 18, lang: 18 });
    expect(r.overall).toMatchObject({ raw: 90, tier: 4 });
    expect(tagsOf(toolId, r)).toEqual([
      'learn.reading', 'learn.number', 'learn.writing', 'att.inattention', 'learn.phonological',
      'severity.severe',
    ]);
  });

  it('全答「从未」→ 一個標籤都沒有、clear', () => {
    const r = learn(toolId);
    expect(tagsOf(toolId, r)).toEqual([]);
    expect(ruleFor(toolId).bandFor(r, 'LEARN')).toBe('clear');
  });

  it('scored=false 的方面不出標籤（總分照算，band 不受影響）', () => {
    const r = learn(toolId, { read: 18 });
    expect(tagsOf(toolId, r)).toEqual(['learn.reading']);
    const notScored = patchSection(r, 'read', { n: 0, scored: false });
    expect(tagsOf(toolId, notScored)).toEqual([]);
    expect(ruleFor(toolId).bandFor(notScored, 'LEARN')).toBe('watch');
  });

  it('§5.9 沒有給 ldp／lds 逐題規則 —— 規則表不掃逐題', () => {
    expect(ITEM_TAGS[toolId]).toBeUndefined();
  });

  it('caveats 只有 parent_report ＋ unsourced_threshold', () => {
    expect(ruleFor(toolId).caveats(learn(toolId))).toEqual(['parent_report', 'unsourced_threshold']);
    expect(ruleFor(toolId).caveats(learn(toolId, { read: 18 }))).toEqual(['parent_report', 'unsourced_threshold']);
  });
});

describe('ldp 與 lds 是同一張表的兩支', () => {
  it('同一份作答在兩支得到一樣的 band、標籤、caveats', () => {
    const raws = { read: 13, math: 5, attn: 9 };
    const p = learn('sxk-ldp', raws);
    const s = learn('sxk-lds', raws);
    expect(p.overall.raw).toBe(s.overall.raw);
    expect(ruleFor('sxk-ldp').bandFor(p, 'LEARN')).toBe(ruleFor('sxk-lds').bandFor(s, 'LEARN'));
    expect(tagsOf('sxk-ldp', p)).toEqual(tagsOf('sxk-lds', s));
    expect(ruleFor('sxk-ldp').caveats(p)).toEqual(ruleFor('sxk-lds').caveats(s));
  });
});

// ---------------------------------------------------------------------------
// 十一、四支共用的性質
// ---------------------------------------------------------------------------

describe('四支共用', () => {
  it('每次呼叫回新的陣列，改了不會污染下一次', () => {
    const tags = tagsOf(ADL, adl({ 'SC.1': 4 }));
    tags.push('sen.oral');
    expect(tagsOf(ADL, adl({ 'SC.1': 4 }))).toEqual(['adl.feeding']);
    const caveats = ruleFor(DEV).caveats(dev({}));
    caveats.push('safety_concern');
    expect(ruleFor(DEV).caveats(dev({}))).not.toContain('safety_concern');
  });

  it('分數是 null（面向沒算出 tier）→ band 也是 null，不是最好的那一段', () => {
    const r = adl();
    const blank: ToolResult = { ...r, overall: { ...r.overall, pct: null, tier: null } };
    expect(ruleFor(ADL).bandFor(blank, 'ADL')).toBeNull();
  });

  it('四支都沒有前置題，band 不受 pre 影響', () => {
    for (const toolId of DEV_ADL_LEARNING_TOOL_IDS) expect(TOOL_SPECS[toolId].preQuestions).toEqual([]);
    const r = adl();
    const withPre: ToolResult = { ...r, pre: { regression: ['language'] } };
    expect(ruleFor(ADL).bandFor(withPre, 'ADL')).toBe(ruleFor(ADL).bandFor(r, 'ADL'));
    expect(ruleFor(ADL).caveats(withPre)).toEqual(ruleFor(ADL).caveats(r));
  });
});

// ---------------------------------------------------------------------------
// 十二、登錄
// ---------------------------------------------------------------------------

describe('規則表登錄', () => {
  it('這張票的四支', () => {
    expect([...DEV_ADL_LEARNING_TOOL_IDS]).toEqual(['sxk-dev', 'sxk-adl', 'sxk-ldp', 'sxk-lds']);
    expect(Object.keys(DEV_ADL_LEARNING_RULES)).toEqual(['sxk-dev', 'sxk-adl', 'sxk-ldp', 'sxk-lds']);
  });

  it('目前登錄的是達成率族六支＋asb／asr＋ab／att／spa／spb＋這四支（#51 再加四支公開工具與氣質）', () => {
    expect(Object.keys(TOOL_RULES)).toEqual([
      ...ACHIEVEMENT_TOOL_IDS, ...ASD_TOOL_IDS, ...ATTENTION_SENSORY_TOOL_IDS, ...DEV_ADL_LEARNING_TOOL_IDS,
    ]);
    for (const toolId of DEV_ADL_LEARNING_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.toolId).toBe(toolId);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數；ldp／lds 另指方面那張表的出處', () => {
    for (const toolId of DEV_ADL_LEARNING_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
      expect(rule.source).toContain('LEVELS');
    }
    for (const toolId of LEARNING) expect(ruleFor(toolId).source).toContain('domLevel()');
    expect(ruleFor(DEV).source).not.toContain('domLevel()');
  });

  it('還沒做的工具問 ruleFor 會丟錯，不會安靜地當成沒有判定', () => {
    expect(() => ruleFor('sxk-tempa')).toThrow(/sxk-tempa/);
    expect(TOOL_RULES['sxk-tempa']).toBeUndefined();
  });
});

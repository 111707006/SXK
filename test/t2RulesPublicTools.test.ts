import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Band, DimensionCode, SectionStat, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, noneValueOf, scoreTool, tierFor } from '../src/t2/scoring';
import type { AnswerValue, ScoreInput } from '../src/t2/scoring';
import { ACHIEVEMENT_TOOL_IDS } from '../src/t2/rules/achievement';
import { ASD_TOOL_IDS } from '../src/t2/rules/asd';
import { ATTENTION_SENSORY_TOOL_IDS } from '../src/t2/rules/attentionSensory';
import { DEV_ADL_LEARNING_TOOL_IDS } from '../src/t2/rules/devAdlLearning';
import { PUBLIC_TOOL_IDS, PUBLIC_TOOL_RULES } from '../src/t2/rules/publicTools';
import { TOOL_RULES, ruleFor } from '../src/t2/rules';

/**
 * 四支公開工具的規則表：warn、mchat、snap、chexi（#51，規格 v2 §5.4、§5.5、§5.6、§5.9）。
 *
 * 【這裡在防什麼】
 * 四支各自有一條不在對應表裡的規則，翻錯都沒有型別錯誤：
 * - mchat：低風險但前置題「有擔心」→ `watch`；中等風險加 `follow_up_not_done`；第 2 題答「是」
 *   → `hearing_check_first`。三條都不動 tier。
 * - snap：IA、HI 取**較差者**餵 ATT，OD 單獨餵 EMO —— 取平均或取較好者都會把一個過動的孩子判成沒事。
 * - chexi：**不出 band**；因素 pct ≥ 67 出標籤，副量表均分 ≥ 4 再多一個。
 * - warn：維度不看面向 key（`m24`）而看**時點內的位置**（第 3 條→MOT）；倒退勾各推自己的維度；
 *   沒被點名的維度是 `clear`，不是跟著總 tier 變 `refer`。
 *
 * 【兩層】
 * 分界那一層直接把 `overall`／`sections`／`native` 換成要測的值（tier 用 #46 的 `tierFor` 重算），
 * 端到端那一層用真的作答走 `scoreTool`。§5.9 的四張對應表（mchat 20 題、snap 三個分量表、
 * chexi 兩個因素、warn 四個位置）都是整張重抄的，不從 `itemTags.ts`／`sectionTags.ts` 讀出來比。
 */

const AT = '2026-09-12T00:00:00.000Z';

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

/** 把 `raw` 分配到這些題上，每題落在 `lo`–`hi`。放不進去就讓測試自己壞掉。 */
function distribute(target: Record<string, AnswerValue>, keys: ReadonlyArray<string>, raw: number, lo: number, hi: number): void {
  let left = raw - lo * keys.length;
  if (left < 0 || left > (hi - lo) * keys.length) throw new Error(`raw ${raw} 放不進 ${keys.length} 題（每題 ${lo}–${hi}）`);
  for (const k of keys) {
    const add = Math.min(hi - lo, left);
    target[k] = lo + add;
    left -= add;
  }
}

/** 依「各面向 raw」造一份完整作答；沒指定的面向給 `lo`。 */
function bySection(toolId: ToolId, ageMonth: number, raws: Record<string, number>, lo: number, hi: number): Record<string, AnswerValue> {
  const grouped: Record<string, string[]> = {};
  for (const a of askedItems(toolId, ageMonth)) (grouped[a.sectionKey] ??= []).push(a.key);
  const out: Record<string, AnswerValue> = {};
  for (const [sectionKey, keys] of Object.entries(grouped)) {
    distribute(out, keys, raws[sectionKey] ?? lo * keys.length, lo, hi);
  }
  return out;
}

function bandsOf(toolId: ToolId, r: ToolResult): Record<DimensionCode, Band | null> {
  const rule = ruleFor(toolId);
  return Object.fromEntries(DIMENSION_CODES.map(d => [d, rule.bandFor(r, d)])) as Record<DimensionCode, Band | null>;
}

const ALL_NULL: Record<DimensionCode, Band | null> = {
  COG: null, LANG: null, SOC: null, EMO: null, ATT: null, MOT: null, SEN: null, ADL: null, LEARN: null,
};

// ===========================================================================
// 一、M-CHAT-R/F（風險題數 → SOC；§5.4 的例外、§5.9 的逐題表）
// ===========================================================================

const MCHAT: ToolId = 'mchat-rf';
const MCHAT_AGE = 24;   // 窗口 16–30

/** 指定哪幾題答到風險那一邊，其餘答安全的那一邊。題 2、5、12 的風險答案是「是」，其餘是「否」。 */
function mchat(riskItems: ReadonlyArray<number>, pre?: ScoreInput['pre']): ToolResult {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(MCHAT, MCHAT_AGE)) {
    const risky = a.item.riskAnswer ?? 'no';
    out[a.key] = riskItems.includes(a.item.no) ? risky : risky === 'yes' ? 'no' : 'yes';
  }
  return score(MCHAT, MCHAT_AGE, out, pre);
}

/** 前 n 題答到風險那一邊。 */
function mchatRisk(n: number, pre?: ScoreInput['pre']): ToolResult {
  return mchat(Array.from({ length: n }, (_, i) => i + 1), pre);
}

/** 總分換成指定風險數的替身；tier 由真的 `tierFor` 算。 */
function mchatAt(risk: number, pre?: ScoreInput['pre']): ToolResult {
  const base = mchat([], pre);
  const overall: SectionStat = { ...base.overall, raw: risk, tier: tierFor('risk', TOOLKIT[MCHAT].tiers, risk) };
  return { ...base, overall };
}

describe('mchat：分界（§5.3 × §5.4）—— 0–2 clear、3–7 watch、8–20 refer，沒有 tier 4', () => {
  const BOUNDARY: ReadonlyArray<[number, Band]> = [
    [0, 'clear'], [2, 'clear'], [3, 'watch'], [7, 'watch'], [8, 'refer'], [20, 'refer'],
  ];
  const rule = ruleFor(MCHAT);

  it('風險數 → SOC', () => {
    for (const [risk, band] of BOUNDARY) {
      expect(`${risk} → ${rule.bandFor(mchatAt(risk), 'SOC')}`).toBe(`${risk} → ${band}`);
    }
  });

  it('端到端：風險 2 → clear；3 → watch；7 → watch；8 → refer', () => {
    expect(rule.bandFor(mchatRisk(2), 'SOC')).toBe('clear');
    expect(rule.bandFor(mchatRisk(3), 'SOC')).toBe('watch');
    expect(rule.bandFor(mchatRisk(7), 'SOC')).toBe('watch');
    expect(rule.bandFor(mchatRisk(8), 'SOC')).toBe('refer');
  });

  it('20 題全風險 → refer、沒有 severity.severe（分段表只有三段）', () => {
    const r = mchatRisk(20);
    expect(r.overall.tier).toBe(3);
    expect(rule.bandFor(r, 'SOC')).toBe('refer');
    expect(rule.tags(r)).not.toContain('severity.severe');
  });

  it('只餵 SOC：其餘八個維度 null，即使標籤出到 lang／mot／sen', () => {
    expect(bandsOf(MCHAT, mchatRisk(20))).toEqual({ ...ALL_NULL, SOC: 'refer' });
  });

  it('總分沒算出 tier → band null，不是最好的那一段', () => {
    const base = mchat([]);
    expect(rule.bandFor({ ...base, overall: { ...base.overall, tier: null } }, 'SOC')).toBeNull();
  });
});

describe('mchat：前置題「有擔心」—— 低風險才被推成 watch（§5.1、§5.4）', () => {
  const rule = ruleFor(MCHAT);

  it('風險 2 ＋ 擔心 true → watch；不擔心 → clear', () => {
    expect(rule.bandFor(mchatRisk(2, { concern: true }), 'SOC')).toBe('watch');
    expect(rule.bandFor(mchatRisk(2, { concern: false }), 'SOC')).toBe('clear');
  });

  it('風險 0 ＋ 擔心 → watch', () => {
    expect(rule.bandFor(mchatRisk(0, { concern: true }), 'SOC')).toBe('watch');
  });

  it('中等與高風險不受擔心影響：3 ＋ 擔心 → watch；8 ＋ 擔心 → refer', () => {
    expect(rule.bandFor(mchatRisk(3, { concern: true }), 'SOC')).toBe('watch');
    expect(rule.bandFor(mchatRisk(8, { concern: true }), 'SOC')).toBe('refer');
  });

  /**
   * 題庫的前置題選項值是字串 `'true'`／`'false'`（`ToolkitPreQuestion.options[].value` 只能放字串），
   * 規格 §5.1 寫的型別是 boolean。兩種形狀都認，但 **`'false'` 這個字串絕不能被當成真** ——
   * `Boolean('false')` 是 true，那是最容易寫出來的錯。
   */
  it('字串 "true" 也算擔心；字串 "false" 不算', () => {
    expect(rule.bandFor(mchatRisk(2, { concern: 'true' }), 'SOC')).toBe('watch');
    expect(rule.bandFor(mchatRisk(2, { concern: 'false' }), 'SOC')).toBe('clear');
  });

  it('題庫的選項值就是 "false"／"true" 這兩個字串', () => {
    const q = TOOLKIT[MCHAT].preQuestions.find(p => p.key === 'concern');
    expect(q?.kind).toBe('boolean');
    expect(q?.options.map(o => o.value)).toEqual(['false', 'true']);
  });

  it('沒答前置題（pre 空）→ 照分數', () => {
    const r = mchatRisk(2);
    expect(r.pre).toEqual({});
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
  });

  it('認不得的形狀（陣列、其他字串）→ 當成沒擔心', () => {
    expect(rule.bandFor(mchatRisk(2, { concern: ['true'] }), 'SOC')).toBe('clear');
    expect(rule.bandFor(mchatRisk(2, { concern: 'yes' }), 'SOC')).toBe('clear');
  });

  it('擔心只推 SOC：其餘維度仍 null', () => {
    expect(bandsOf(MCHAT, mchatRisk(0, { concern: true }))).toEqual({ ...ALL_NULL, SOC: 'watch' });
  });

  it('總分沒算出 tier 時，擔心也推不出 band（沒有分數就沒有判定）', () => {
    const base = mchat([], { concern: true });
    expect(rule.bandFor({ ...base, overall: { ...base.overall, tier: null } }, 'SOC')).toBeNull();
  });

  it('擔心不出任何標籤、不出 caveat —— 它只改 band', () => {
    const r = mchatRisk(0, { concern: true });
    expect(rule.tags(r)).toEqual([]);
    expect(rule.caveats(r)).toEqual(['parent_report']);
  });
});

describe('mchat：caveats（§5.6）—— follow_up_not_done 只在 3–7 分；第 2 題答「是」→ hearing_check_first；不帶 unsourced_threshold', () => {
  const rule = ruleFor(MCHAT);

  it('風險 3、7 → follow_up_not_done；2、8 → 無', () => {
    expect(rule.caveats(mchatRisk(3))).toContain('follow_up_not_done');
    expect(rule.caveats(mchatRisk(7))).toContain('follow_up_not_done');
    expect(rule.caveats(mchatRisk(2))).not.toContain('follow_up_not_done');
    expect(rule.caveats(mchatRisk(8))).not.toContain('follow_up_not_done');
  });

  it('分界替身：tier 2 → 有；tier 1／3 → 無', () => {
    expect(rule.caveats(mchatAt(3))).toContain('follow_up_not_done');
    expect(rule.caveats(mchatAt(2))).not.toContain('follow_up_not_done');
    expect(rule.caveats(mchatAt(8))).not.toContain('follow_up_not_done');
  });

  it('低風險＋擔心被推成 watch，但**不帶** follow_up_not_done（§5.6 寫的是 3–7 分）', () => {
    expect(rule.caveats(mchatRisk(2, { concern: true }))).not.toContain('follow_up_not_done');
  });

  it('第 2 題「想過孩子可能是聾的」答「是」→ hearing_check_first；答「否」→ 無', () => {
    expect(rule.caveats(mchat([2]))).toContain('hearing_check_first');
    expect(rule.caveats(mchat([]))).not.toContain('hearing_check_first');
  });

  it('其他題答到風險那一邊不出 hearing_check_first', () => {
    expect(rule.caveats(mchat([1, 5, 12, 18]))).not.toContain('hearing_check_first');
  });

  it('完整清單：只有第 2 題風險 → parent_report＋hearing_check_first（1 分仍是低風險）', () => {
    const r = mchat([2]);
    expect(r.overall).toMatchObject({ raw: 1, tier: 1 });
    expect(rule.caveats(r)).toEqual(['parent_report', 'hearing_check_first']);
  });

  it('完整清單：1、2、3 風險 → parent_report、follow_up_not_done、hearing_check_first（固定 → 判定 → 逐題）', () => {
    expect(rule.caveats(mchat([1, 2, 3]))).toEqual(['parent_report', 'follow_up_not_done', 'hearing_check_first']);
  });

  it('全安全 → 只有 parent_report；永遠沒有 unsourced_threshold（官方切分）', () => {
    expect(rule.caveats(mchat([]))).toEqual(['parent_report']);
    expect(rule.caveats(mchatRisk(20))).not.toContain('unsourced_threshold');
    expect(TOOL_SPECS[MCHAT].fixedCaveats).toEqual([]);
  });

  it('舊紀錄：窗口外 → age_out_of_window；沒全答 → incomplete', () => {
    expect(rule.caveats({ ...mchat([]), assessedAgeMonth: 31 })).toContain('age_out_of_window');
    expect(rule.caveats({ ...mchat([]), assessedAgeMonth: 15 })).toContain('age_out_of_window');
    expect(rule.caveats({ ...mchat([]), answeredCount: 19 })).toContain('incomplete');
  });
});

/**
 * §5.9 mchat 那一列，逐題重抄（題號 1–20）。每題只有一個標籤。
 */
const MCHAT_ITEM_EXPECTED: ReadonlyArray<string> = [
  'soc.joint_attention',      // 1 順著你指的方向看
  'lang.comprehension',       // 2 想過孩子可能是聾的（另出 hearing_check_first）
  'soc.pretend_play',         // 3 假想遊戲
  'mot.locomotion',           // 4 喜歡攀爬
  'sen.visual',               // 5 眼睛附近的異常手指擺動
  'soc.joint_attention',      // 6 用手指指物表達需求
  'soc.joint_attention',      // 7 用手指指有趣的東西
  'soc.social_initiation',    // 8 對其他孩子感興趣
  'soc.joint_attention',      // 9 純粹為了分享而拿東西給你
  'soc.response_to_name',     // 10 叫名字有反應
  'soc.social_initiation',    // 11 你微笑時回以微笑
  'sen.auditory',             // 12 因日常噪音不安
  'mot.locomotion',           // 13 會走路
  'soc.eye_contact',          // 14 看著你的眼睛
  'soc.imitation',            // 15 模仿你做的事
  'soc.joint_attention',      // 16 你轉頭看時他跟著看
  'soc.joint_attention',      // 17 讓你去注視他
  'lang.comprehension',       // 18 聽得懂交代的事
  'soc.joint_attention',      // 19 有新事情發生時望向你
  'mot.locomotion',           // 20 喜歡動態活動
];

describe('mchat 逐題：答到風險那一邊出、答安全那一邊不出（§5.5「mchat 該題算風險」）', () => {
  const rule = ruleFor(MCHAT);

  it('整張逐題表：20 題各自單獨答風險，逐格與 §5.9 相符', () => {
    expect(askedItems(MCHAT, MCHAT_AGE)).toHaveLength(20);
    MCHAT_ITEM_EXPECTED.forEach((tag, i) => {
      const no = i + 1;
      expect(`${no} → ${rule.tags(mchat([no])).join(',')}`).toBe(`${no} → ${tag}`);
    });
  });

  it('全部答安全那一邊 → 沒有標籤', () => {
    expect(rule.tags(mchat([]))).toEqual([]);
  });

  /**
   * 票 #51 的驗收寫「第 5 題答『否』（非反向題）→ sen.visual」。題庫（`riskAnswer: 'yes'`）與
   * 規格 §5.2（「題 2、5、12 答 yes 算風險」）都說第 5 題**是**反向題 —— 眼睛附近有異常的手指
   * 擺動，答「是」才是風險。照題庫：答「是」出標籤，答「否」不出。
   */
  it('第 5 題是反向題：答「是」→ sen.visual；答「否」→ 無', () => {
    expect(TOOLKIT[MCHAT].sections[0].items[4]).toMatchObject({ no: 5, riskAnswer: 'yes' });
    expect(rule.tags(mchat([5]))).toEqual(['sen.visual']);
    expect(rule.tags(mchat([]))).not.toContain('sen.visual');
  });

  it('三個反向題 2、5、12 答「是」出標籤；正向題 1 答「是」不出', () => {
    expect(rule.tags(mchat([2, 5, 12]))).toEqual(['lang.comprehension', 'sen.visual', 'sen.auditory']);
    const yesEverywhere = score(MCHAT, MCHAT_AGE, flat(MCHAT, MCHAT_AGE, 'yes'));
    expect(yesEverywhere.native.riskItems).toEqual([2, 5, 12]);
    expect(rule.tags(yesEverywhere)).toEqual(['lang.comprehension', 'sen.visual', 'sen.auditory']);
  });

  it('去重：1 與 16 都風險 → soc.joint_attention 一次；8 與 11 → soc.social_initiation 一次', () => {
    expect(rule.tags(mchat([1, 16]))).toEqual(['soc.joint_attention']);
    expect(rule.tags(mchat([8, 11]))).toEqual(['soc.social_initiation']);
  });

  it('順序照題號：14、3、1 → joint_attention、pretend_play、eye_contact', () => {
    expect(rule.tags(mchat([14, 3, 1]))).toEqual(['soc.joint_attention', 'soc.pretend_play', 'soc.eye_contact']);
  });

  it('20 題全風險 → 十個標籤照首次出現的題號排，沒有 severe', () => {
    expect(rule.tags(mchatRisk(20))).toEqual([
      'soc.joint_attention', 'lang.comprehension', 'soc.pretend_play', 'mot.locomotion', 'sen.visual',
      'soc.social_initiation', 'soc.response_to_name', 'sen.auditory', 'soc.eye_contact', 'soc.imitation',
    ]);
  });

  it('標籤不看 band：只有第 2 題風險（低風險、clear）也出 lang.comprehension', () => {
    const r = mchat([2]);
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
    expect(rule.tags(r)).toEqual(['lang.comprehension']);
  });
});

// ===========================================================================
// 二、SNAP-IV（max(IA, HI) → ATT；OD → EMO；§5.4 的例外）
// ===========================================================================

const SNAP: ToolId = 'snap-iv';
const SNAP_AGE = 72;   // 窗口 72–216

function snapStat(sectionKey: string, ari: number): SectionStat {
  const n = TOOLKIT[SNAP].sections.find(s => s.key === sectionKey)?.items.length ?? 0;
  return { n, raw: Math.round(ari * n), max: n * 3, pct: null, tier: tierFor('mean-snap', TOOLKIT[SNAP].tiers, ari), scored: true };
}

let SNAP_QUIET: ToolResult | null = null;

/** 全 0 的基準，再把指定分量表換成指定均分的替身。 */
function snapAt(aris: Partial<Record<'IA' | 'HI' | 'OD', number>>): ToolResult {
  SNAP_QUIET ??= score(SNAP, SNAP_AGE, flat(SNAP, SNAP_AGE, 0));
  const sections = { ...SNAP_QUIET.sections };
  for (const [key, ari] of Object.entries(aris)) sections[key] = snapStat(key, ari);
  return { ...SNAP_QUIET, sections };
}

describe('snap：分界（§5.3）—— ≤1.2 clear、(1.2, 1.8] watch、>1.8 refer，三個分量表同一組參考點', () => {
  const BOUNDARY: ReadonlyArray<[number, Band]> = [
    [0, 'clear'], [1.2, 'clear'], [1.21, 'watch'], [1.8, 'watch'], [1.81, 'refer'], [3, 'refer'],
  ];
  const rule = ruleFor(SNAP);

  it('IA 單獨 → ATT；HI 單獨 → ATT；OD 單獨 → EMO', () => {
    for (const [ari, band] of BOUNDARY) {
      expect(`IA ${ari} → ${rule.bandFor(snapAt({ IA: ari }), 'ATT')}`).toBe(`IA ${ari} → ${band}`);
      expect(`HI ${ari} → ${rule.bandFor(snapAt({ HI: ari }), 'ATT')}`).toBe(`HI ${ari} → ${band}`);
      expect(`OD ${ari} → ${rule.bandFor(snapAt({ OD: ari }), 'EMO')}`).toBe(`OD ${ari} → ${band}`);
    }
  });

  it('ATT 取 IA、HI 較差者：1.5／1.0 → watch；1.0／1.9 → refer；1.9／1.0 → refer；1.0／1.0 → clear', () => {
    expect(rule.bandFor(snapAt({ IA: 1.5, HI: 1.0 }), 'ATT')).toBe('watch');
    expect(rule.bandFor(snapAt({ IA: 1.0, HI: 1.9 }), 'ATT')).toBe('refer');
    expect(rule.bandFor(snapAt({ IA: 1.9, HI: 1.0 }), 'ATT')).toBe('refer');
    expect(rule.bandFor(snapAt({ IA: 1.0, HI: 1.0 }), 'ATT')).toBe('clear');
  });

  it('OD 一視同仁（§10.2 第 3 項）：1.9 → EMO refer；1.5 → watch；1.0 → clear', () => {
    expect(rule.bandFor(snapAt({ OD: 1.9 }), 'EMO')).toBe('refer');
    expect(rule.bandFor(snapAt({ OD: 1.5 }), 'EMO')).toBe('watch');
    expect(rule.bandFor(snapAt({ OD: 1.0 }), 'EMO')).toBe('clear');
  });

  it('兩個維度互不影響：OD 3.0 時 ATT 仍 clear；IA、HI 3.0 時 EMO 仍 clear', () => {
    expect(bandsOf(SNAP, snapAt({ OD: 3 }))).toEqual({ ...ALL_NULL, ATT: 'clear', EMO: 'refer' });
    expect(bandsOf(SNAP, snapAt({ IA: 3, HI: 3 }))).toEqual({ ...ALL_NULL, ATT: 'refer', EMO: 'clear' });
  });

  it('只餵 ATT 與 EMO，其餘七個維度 null', () => {
    expect(bandsOf(SNAP, snapAt({}))).toEqual({ ...ALL_NULL, ATT: 'clear', EMO: 'clear' });
  });

  it('總分那一格是「—」：overall.tier null，但 band 不從它來', () => {
    expect(snapAt({}).overall.tier).toBeNull();
    expect(rule.bandFor(snapAt({ IA: 3 }), 'ATT')).toBe('refer');
  });

  it('分量表沒算出 tier → 那個維度 null；只有 IA null 時 ATT 看 HI', () => {
    const base = snapAt({ HI: 1.5 });
    const r: ToolResult = { ...base, sections: { ...base.sections, IA: { ...base.sections.IA, tier: null } } };
    expect(rule.bandFor(r, 'ATT')).toBe('watch');
    const both: ToolResult = { ...r, sections: { ...r.sections, HI: { ...r.sections.HI, tier: null } } };
    expect(rule.bandFor(both, 'ATT')).toBeNull();
  });
});

describe('snap 端到端：IA／HI 9 題、OD 8 題，均分保留兩位再比', () => {
  const rule = ruleFor(SNAP);

  // IA 9 題：raw 10 → 1.11（tier 1）、11 → 1.22（2）、16 → 1.78（2）、17 → 1.89（3）
  it('IA raw 10 → ATT clear；11 → watch；16 → watch；17 → refer', () => {
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { IA: 10 }, 0, 3)), 'ATT')).toBe('clear');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { IA: 11 }, 0, 3)), 'ATT')).toBe('watch');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { IA: 16 }, 0, 3)), 'ATT')).toBe('watch');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { IA: 17 }, 0, 3)), 'ATT')).toBe('refer');
  });

  it('HI raw 17 而 IA 0 → ATT refer（取較差者）', () => {
    const r = score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { HI: 17 }, 0, 3));
    expect(r.sections.IA.tier).toBe(1);
    expect(r.sections.HI.tier).toBe(3);
    expect(rule.bandFor(r, 'ATT')).toBe('refer');
  });

  // OD 8 題：raw 9 → 1.13（tier 1）、10 → 1.25（2）、14 → 1.75（2）、15 → 1.88（3）
  it('OD raw 9 → EMO clear；10 → watch；14 → watch；15 → refer', () => {
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { OD: 9 }, 0, 3)), 'EMO')).toBe('clear');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { OD: 10 }, 0, 3)), 'EMO')).toBe('watch');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { OD: 14 }, 0, 3)), 'EMO')).toBe('watch');
    expect(rule.bandFor(score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { OD: 15 }, 0, 3)), 'EMO')).toBe('refer');
  });
});

/** §5.9 snap 那一列，重抄。 */
const SNAP_SECTION_EXPECTED: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['IA', ['att.inattention']],                       // 注意力不足
  ['HI', ['att.hyperactivity', 'att.impulsivity']],  // 过动与冲动
  ['OD', ['emo.regulation']],                        // 对立违抗
];

describe('snap 標籤：面向級（tier ≥ 2 出）', () => {
  const rule = ruleFor(SNAP);

  it('三個分量表各自 1.21 → 各自的標籤；1.2 → 無', () => {
    for (const [key, tags] of SNAP_SECTION_EXPECTED) {
      expect(`${key} 1.21 → ${rule.tags(snapAt({ [key]: 1.21 })).join(',')}`).toBe(`${key} 1.21 → ${tags.join(',')}`);
      expect(`${key} 1.2 → ${rule.tags(snapAt({ [key]: 1.2 })).join(',')}`).toBe(`${key} 1.2 → `);
    }
  });

  it('全 3 → 四個標籤照 IA、HI、OD 排，沒有 severe（沒有 tier 4）', () => {
    const r = score(SNAP, SNAP_AGE, flat(SNAP, SNAP_AGE, 3));
    expect(rule.tags(r)).toEqual(['att.inattention', 'att.hyperactivity', 'att.impulsivity', 'emo.regulation']);
  });

  it('全 0 → 無標籤', () => {
    expect(rule.tags(snapAt({}))).toEqual([]);
  });

  it('分量表 scored=false → 不出標籤（安全網）', () => {
    const base = snapAt({ IA: 3 });
    const r = { ...base, sections: { ...base.sections, IA: { ...base.sections.IA, scored: false } } };
    expect(rule.tags(r)).toEqual([]);
    expect(rule.bandFor(r, 'ATT')).toBe('clear');   // HI 還在、tier 1
  });
});

describe('snap caveats 與 native', () => {
  const rule = ruleFor(SNAP);

  it('只有 parent_report；不帶 unsourced_threshold（Bussing 2008 的參考點）', () => {
    expect(rule.caveats(snapAt({}))).toEqual(['parent_report']);
    expect(rule.caveats(score(SNAP, SNAP_AGE, flat(SNAP, SNAP_AGE, 3)))).toEqual(['parent_report']);
    expect(TOOL_SPECS[SNAP].fixedCaveats).toEqual([]);
  });

  it('§5.9 的 native.symptomCounts 就是 §5.2 的 sx：計分層寫 sx.IA／sx.HI／sx.OD，規則表不另寫', () => {
    const r = score(SNAP, SNAP_AGE, bySection(SNAP, SNAP_AGE, { IA: 6, HI: 3, OD: 0 }, 0, 3));
    expect(r.native['sx.IA']).toBe(2);   // 6 = 3 + 3
    expect(r.native['sx.HI']).toBe(1);
    expect(r.native['sx.OD']).toBe(0);
    expect(r.native.symptomCounts).toBeUndefined();
  });
});

// ===========================================================================
// 三、CHEXI（不出 band；因素 pct ≥ 67 出標籤，副量表均分 ≥ 4 再多一個）
// ===========================================================================

const CHEXI: ToolId = 'chexi';
const CHEXI_AGE = 48;   // 窗口 48–155

let CHEXI_QUIET: ToolResult | null = null;

/** 全 1（0%）的基準，再把因素 pct 與副量表均分換成指定值。 */
function chexiAt(factors: Partial<Record<'F1' | 'F2', number>>, means: Partial<Record<'wm' | 'pl' | 'ib' | 'rg', number>> = {}): ToolResult {
  CHEXI_QUIET ??= score(CHEXI, CHEXI_AGE, flat(CHEXI, CHEXI_AGE, 1));
  const sections = { ...CHEXI_QUIET.sections };
  for (const [key, pct] of Object.entries(factors)) {
    sections[key] = { ...sections[key], pct, tier: tierFor('mean-chexi', TOOLKIT[CHEXI].tiers, pct) };
  }
  const native = { ...CHEXI_QUIET.native };
  for (const [key, mean] of Object.entries(means)) native[`mean.${key}`] = mean;
  return { ...CHEXI_QUIET, sections, native };
}

describe('chexi：不出 band（§5.4）', () => {
  it('登錄表 producesBand=false', () => {
    expect(TOOL_SPECS[CHEXI].producesBand).toBe(false);
  });

  it('全 1、全 5、因素 100% —— 九個維度全 null，連 feeds 的 ATT 也是', () => {
    expect(bandsOf(CHEXI, chexiAt({}))).toEqual(ALL_NULL);
    expect(bandsOf(CHEXI, score(CHEXI, CHEXI_AGE, flat(CHEXI, CHEXI_AGE, 5)))).toEqual(ALL_NULL);
    expect(bandsOf(CHEXI, chexiAt({ F1: 100, F2: 100 }, { pl: 5, rg: 5 }))).toEqual(ALL_NULL);
  });

  it('overall 那一格是「—」：tier null；就算硬塞一個 tier 3 進去也還是 null（不是靠 overall 剛好沒 tier）', () => {
    const base = chexiAt({});
    expect(base.overall.tier).toBeNull();
    const forced: ToolResult = { ...base, overall: { ...base.overall, tier: 3 } };
    expect(bandsOf(CHEXI, forced)).toEqual(ALL_NULL);
  });
});

/** §5.9 chexi 那一列，重抄：因素 → 標籤；副量表 → 另加的標籤。 */
const CHEXI_FACTOR_EXPECTED: ReadonlyArray<{ factor: 'F1' | 'F2'; tag: string; extraSection: 'pl' | 'rg'; extraTag: string }> = [
  { factor: 'F1', tag: 'att.working_memory', extraSection: 'pl', extraTag: 'att.organization' },   // 工作記憶＋計劃力
  { factor: 'F2', tag: 'att.inhibition', extraSection: 'rg', extraTag: 'emo.regulation' },         // 抑制力＋調節力
];

describe('chexi 標籤：因素 pct ≥ 67（§5.5、§5.9）', () => {
  const rule = ruleFor(CHEXI);

  for (const { factor, tag, extraSection, extraTag } of CHEXI_FACTOR_EXPECTED) {
    describe(`${factor} → ${tag}；${extraSection} 均分 ≥ 4 另加 ${extraTag}`, () => {
      it('pct 67 → 出；66 → 無；100 → 出', () => {
        expect(rule.tags(chexiAt({ [factor]: 67 }))).toEqual([tag]);
        expect(rule.tags(chexiAt({ [factor]: 66 }))).toEqual([]);
        expect(rule.tags(chexiAt({ [factor]: 100 }))).toEqual([tag]);
      });

      it('pct 67 且副量表均分 4.0 → 另加；3.99 → 不加', () => {
        expect(rule.tags(chexiAt({ [factor]: 67 }, { [extraSection]: 4 }))).toEqual([tag, extraTag]);
        expect(rule.tags(chexiAt({ [factor]: 67 }, { [extraSection]: 3.99 }))).toEqual([tag]);
        expect(rule.tags(chexiAt({ [factor]: 67 }, { [extraSection]: 5 }))).toEqual([tag, extraTag]);
      });

      it('副量表均分 5 但因素只有 66 → 什麼都不出（另加的標籤掛在因素底下）', () => {
        expect(rule.tags(chexiAt({ [factor]: 66 }, { [extraSection]: 5 }))).toEqual([]);
      });

      it('因素 scored=false → 不出（安全網）', () => {
        const base = chexiAt({ [factor]: 100 }, { [extraSection]: 5 });
        const r = { ...base, sections: { ...base.sections, [factor]: { ...base.sections[factor], scored: false } } };
        expect(rule.tags(r)).toEqual([]);
      });
    });
  }

  it('另一個副量表的均分不算：F1 67 且調節力 rg 5 → 只有 working_memory', () => {
    expect(rule.tags(chexiAt({ F1: 67 }, { rg: 5, wm: 5 }))).toEqual(['att.working_memory']);
  });

  it('兩個因素都 67、兩個副量表都 4 → 四個標籤照 F1、F2 排', () => {
    expect(rule.tags(chexiAt({ F1: 67, F2: 67 }, { pl: 4, rg: 4 })))
      .toEqual(['att.working_memory', 'att.organization', 'att.inhibition', 'emo.regulation']);
  });

  it('全 5 → 四個標籤；全 1 → 無；沒有 severe', () => {
    expect(rule.tags(score(CHEXI, CHEXI_AGE, flat(CHEXI, CHEXI_AGE, 5))))
      .toEqual(['att.working_memory', 'att.organization', 'att.inhibition', 'emo.regulation']);
    expect(rule.tags(chexiAt({}))).toEqual([]);
  });

  it('native 裡沒有那個副量表的均分 → 不加另加的標籤，因素的仍出', () => {
    const base = chexiAt({ F1: 67 });
    const native = { ...base.native };
    delete native['mean.pl'];
    expect(rule.tags({ ...base, native })).toEqual(['att.working_memory']);
  });
});

describe('chexi 端到端：F1 ＝ 工作記憶 9 題＋計劃力 4 題，pct = round((Σ − 13) ÷ 52 × 100)', () => {
  const rule = ruleFor(CHEXI);

  // raw 48 → 67.3 → 67；raw 47 → 65.4 → 65
  it('wm 32 ＋ pl 16（均分 4.0）→ F1 48 → 67% → working_memory＋organization', () => {
    const r = score(CHEXI, CHEXI_AGE, bySection(CHEXI, CHEXI_AGE, { wm: 32, pl: 16 }, 1, 5));
    expect(r.sections.F1).toMatchObject({ raw: 48, pct: 67, tier: 3 });
    expect(r.native['mean.pl']).toBe(4);
    expect(rule.tags(r)).toEqual(['att.working_memory', 'att.organization']);
  });

  it('wm 33 ＋ pl 15（均分 3.75）→ F1 48 → 67% → 只有 working_memory', () => {
    const r = score(CHEXI, CHEXI_AGE, bySection(CHEXI, CHEXI_AGE, { wm: 33, pl: 15 }, 1, 5));
    expect(r.sections.F1.pct).toBe(67);
    expect(r.native['mean.pl']).toBe(3.75);
    expect(rule.tags(r)).toEqual(['att.working_memory']);
  });

  it('wm 31 ＋ pl 16（均分 4.0）→ F1 47 → 65% → 無', () => {
    const r = score(CHEXI, CHEXI_AGE, bySection(CHEXI, CHEXI_AGE, { wm: 31, pl: 16 }, 1, 5));
    expect(r.sections.F1.pct).toBe(65);
    expect(rule.tags(r)).toEqual([]);
  });

  // F2 ＝ 抑制力 6 ＋ 調節力 5 ＝ 11 題：pct = round((Σ − 11) ÷ 44 × 100)；raw 41 → 68；raw 40 → 66
  it('ib 21 ＋ rg 20（均分 4.0）→ F2 41 → 68% → inhibition＋regulation；ib 20 ＋ rg 20 → 66% → 無', () => {
    const hot = score(CHEXI, CHEXI_AGE, bySection(CHEXI, CHEXI_AGE, { ib: 21, rg: 20 }, 1, 5));
    expect(hot.sections.F2).toMatchObject({ raw: 41, pct: 68 });
    expect(rule.tags(hot)).toEqual(['att.inhibition', 'emo.regulation']);
    const cool = score(CHEXI, CHEXI_AGE, bySection(CHEXI, CHEXI_AGE, { ib: 20, rg: 20 }, 1, 5));
    expect(cool.sections.F2.pct).toBe(66);
    expect(rule.tags(cool)).toEqual([]);
  });
});

describe('chexi caveats：恆帶 descriptive_only', () => {
  const rule = ruleFor(CHEXI);

  it('全 1、全 5、因素 67 —— 都是 parent_report＋descriptive_only，沒有 unsourced_threshold', () => {
    expect(rule.caveats(chexiAt({}))).toEqual(['parent_report', 'descriptive_only']);
    expect(rule.caveats(score(CHEXI, CHEXI_AGE, flat(CHEXI, CHEXI_AGE, 5)))).toEqual(['parent_report', 'descriptive_only']);
    expect(rule.caveats(chexiAt({ F1: 67, F2: 67 }))).toEqual(['parent_report', 'descriptive_only']);
  });

  it('舊紀錄：窗口外 → age_out_of_window 在 descriptive_only 之後', () => {
    expect(rule.caveats({ ...chexiAt({}), assessedAgeMonth: 47 })).toEqual(['parent_report', 'descriptive_only', 'age_out_of_window']);
  });
});

// ===========================================================================
// 四、SXK-WARN（不路由；維度看時點內的位置；倒退勾各推自己的維度）
// ===========================================================================

const WARN: ToolId = 'sxk-warn';
const WARN_AGE = 25;   // m24 那個時點

const WARN_NONE = noneValueOf(TOOLKIT[WARN], 'regression') ?? '';

/** 指定哪幾條（時點內位置 1–4）陽性。 */
function warn(positives: ReadonlyArray<number>, pre?: ScoreInput['pre'], ageMonth = WARN_AGE): ToolResult {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(WARN, ageMonth)) out[a.key] = positives.includes(a.item.no) ? 1 : 0;
  return score(WARN, ageMonth, out, pre);
}

const WARN_CLEAR: Record<DimensionCode, Band | null> = { ...ALL_NULL, LANG: 'clear', SOC: 'clear', MOT: 'clear' };

describe('warn：不路由，但規則表要在', () => {
  it('登錄表 routed=false、producesBand=true、餵 LANG／SOC／MOT', () => {
    expect(TOOL_SPECS[WARN].routed).toBe(false);
    expect(TOOL_SPECS[WARN].producesBand).toBe(true);
    expect(TOOL_SPECS[WARN].feeds.map(f => f.dimension)).toEqual(['LANG', 'SOC', 'MOT']);
  });

  it('十一個時點每個都是 4 條 —— 位置對應表只有四格，多一條就會沒有維度', () => {
    for (const s of TOOLKIT[WARN].sections) expect(`${s.key}: ${s.items.length}`).toBe(`${s.key}: 4`);
    expect(TOOLKIT[WARN].sections).toHaveLength(11);
  });

  it('陽性的值是 1、未見異常是 0（題庫的選項）', () => {
    expect(TOOLKIT[WARN].options.map(o => `${o.value}:${o.label}`)).toEqual(['0:未见异常', '1:阳性']);
  });
});

/** §5.9 warn 那一列，重抄：時點內第 n 條 → 維度、標籤。 */
const WARN_POSITION_EXPECTED: ReadonlyArray<[number, DimensionCode, ReadonlyArray<string>]> = [
  [1, 'LANG', []],
  [2, 'SOC', []],
  [3, 'MOT', ['mot.fine_motor']],
  [4, 'MOT', ['mot.locomotion']],
];

describe('warn band：陽性條目 → 該位置的維度 refer；沒被點名的維度 clear（§5.4、§5.9）', () => {
  const rule = ruleFor(WARN);

  it('全未見異常且無倒退 → LANG、SOC、MOT 皆 clear；其餘六個 null', () => {
    expect(warn([]).overall.tier).toBe(1);
    expect(bandsOf(WARN, warn([]))).toEqual(WARN_CLEAR);
    expect(bandsOf(WARN, warn([], { regression: [WARN_NONE] }))).toEqual(WARN_CLEAR);
    expect(bandsOf(WARN, warn([], { regression: [] }))).toEqual(WARN_CLEAR);
  });

  for (const [position, dimension, tags] of WARN_POSITION_EXPECTED) {
    it(`只有第 ${position} 條陽性 → ${dimension} refer，其餘 clear；標籤 [${tags.join(',')}]`, () => {
      const r = warn([position]);
      expect(r.overall.tier).toBe(3);
      expect(bandsOf(WARN, r)).toEqual({ ...WARN_CLEAR, [dimension]: 'refer' });
      expect(rule.tags(r)).toEqual([...tags]);
    });
  }

  it('第 3 條陽性 → MOT refer＋mot.fine_motor、LANG clear（總 tier 3 不會把 LANG 也拖成 refer）', () => {
    const r = warn([3]);
    expect(rule.bandFor(r, 'MOT')).toBe('refer');
    expect(rule.bandFor(r, 'LANG')).toBe('clear');
    expect(rule.bandFor(r, 'SOC')).toBe('clear');
    expect(rule.tags(r)).toEqual(['mot.fine_motor']);
  });

  it('第 3、4 條都陽性 → MOT refer，兩個標籤照位置排', () => {
    expect(bandsOf(WARN, warn([3, 4]))).toEqual({ ...WARN_CLEAR, MOT: 'refer' });
    expect(rule.tags(warn([3, 4]))).toEqual(['mot.fine_motor', 'mot.locomotion']);
    expect(rule.tags(warn([4, 3]))).toEqual(['mot.fine_motor', 'mot.locomotion']);
  });

  it('四條全陽性 → 三個維度全 refer', () => {
    expect(bandsOf(WARN, warn([1, 2, 3, 4]))).toEqual({ ...ALL_NULL, LANG: 'refer', SOC: 'refer', MOT: 'refer' });
  });

  it('位置對應不看時點 key：3 個月（m3）與 72 個月（m72）第 4 條陽性同樣是 MOT refer＋mot.locomotion', () => {
    for (const age of [3, 72, 83]) {
      const r = warn([4], undefined, age);
      expect(Object.keys(r.sections)).toHaveLength(1);
      expect(bandsOf(WARN, r)).toEqual({ ...WARN_CLEAR, MOT: 'refer' });
      expect(rule.tags(r)).toEqual(['mot.locomotion']);
    }
  });

  it('時點沒算出來（sections 空、overall 沒 scored）→ 三個維度 null，不是 clear', () => {
    const base = warn([]);
    const r = { ...base, sections: {}, overall: { ...base.overall, n: 0, scored: false, tier: null } };
    expect(bandsOf(WARN, r)).toEqual(ALL_NULL);
  });

  it('沒有 severe（分段表只有 1 與 3）', () => {
    expect(rule.tags(warn([1, 2, 3, 4], { regression: ['language', 'social'] }))).not.toContain('severity.severe');
  });
});

describe('warn 倒退勾：語言 → LANG refer、社交 → SOC refer；不出標籤、不出 caveat', () => {
  const rule = ruleFor(WARN);

  it('題庫的前置題是複選，選項 none!／language／social', () => {
    const q = TOOLKIT[WARN].preQuestions.find(p => p.key === 'regression');
    expect(q?.kind).toBe('multi');
    expect(q?.options.map(o => `${o.value}${o.exclusive ? '!' : ''}`)).toEqual(['none!', 'language', 'social']);
  });

  it('勾語言倒退 → LANG refer，SOC、MOT clear', () => {
    const r = warn([], { regression: ['language'] });
    expect(r.overall.tier).toBe(3);
    expect(bandsOf(WARN, r)).toEqual({ ...WARN_CLEAR, LANG: 'refer' });
  });

  it('勾社交倒退 → SOC refer', () => {
    expect(bandsOf(WARN, warn([], { regression: ['social'] }))).toEqual({ ...WARN_CLEAR, SOC: 'refer' });
  });

  it('兩個都勾 → LANG、SOC refer，MOT clear', () => {
    expect(bandsOf(WARN, warn([], { regression: ['language', 'social'] }))).toEqual({ ...WARN_CLEAR, LANG: 'refer', SOC: 'refer' });
  });

  it('單選字串也認（計分層同樣認）', () => {
    expect(bandsOf(WARN, warn([], { regression: 'social' }))).toEqual({ ...WARN_CLEAR, SOC: 'refer' });
  });

  it('倒退與陽性疊加：勾語言＋第 4 條陽性 → LANG、MOT refer；標籤只有 mot.locomotion', () => {
    const r = warn([4], { regression: ['language'] });
    expect(bandsOf(WARN, r)).toEqual({ ...WARN_CLEAR, LANG: 'refer', MOT: 'refer' });
    expect(rule.tags(r)).toEqual(['mot.locomotion']);
  });

  it('倒退不出標籤、不出 regression_reported（§5.9 的 caveats 欄是「無」；§5.6 那一條只給 asb／asr）', () => {
    const r = warn([], { regression: ['language', 'social'] });
    expect(rule.tags(r)).toEqual([]);
    expect(rule.caveats(r)).toEqual(['parent_report']);
  });

  /**
   * 計分層對認不出的倒退值往安全那邊倒（tier 3）。規則表跟著倒：不知道是哪一種倒退，
   * 就把兩種倒退各自的維度都推成 refer —— 否則 `overall.tier` 說異常而沒有任何維度說要轉診，
   * 同一筆結果自相矛盾。MOT 不動：倒退從來不指向動作。
   */
  it('認不出的值 → LANG 與 SOC 都 refer，MOT clear', () => {
    const r = warn([], { regression: ['打錯的值'] });
    expect(r.overall.tier).toBe(3);
    expect(bandsOf(WARN, r)).toEqual({ ...WARN_CLEAR, LANG: 'refer', SOC: 'refer' });
  });

  it('認得一個、認不得一個 → 認得的推自己的維度，認不得的兩個都推', () => {
    expect(bandsOf(WARN, warn([], { regression: ['social', '打錯的值'] }))).toEqual({ ...WARN_CLEAR, LANG: 'refer', SOC: 'refer' });
  });

  it('「未见异常」與語言同時勾（違反 exclusive，家長端該擋）→ 只推 LANG；none 是認得的值，不是「認不出」', () => {
    expect(bandsOf(WARN, warn([], { regression: [WARN_NONE, 'language'] }))).toEqual({ ...WARN_CLEAR, LANG: 'refer' });
  });
});

describe('warn caveats：無固定值 —— 只有 parent_report', () => {
  const rule = ruleFor(WARN);

  it('全清、全陽性、有倒退 → 都只有 parent_report', () => {
    expect(TOOL_SPECS[WARN].fixedCaveats).toEqual([]);
    expect(rule.caveats(warn([]))).toEqual(['parent_report']);
    expect(rule.caveats(warn([1, 2, 3, 4]))).toEqual(['parent_report']);
    expect(rule.caveats(warn([1], { regression: ['language'] }))).toEqual(['parent_report']);
  });

  it('舊紀錄：窗口外（85 個月）→ age_out_of_window；沒全答 → incomplete', () => {
    expect(rule.caveats({ ...warn([]), assessedAgeMonth: 85 })).toEqual(['parent_report', 'age_out_of_window']);
    expect(rule.caveats({ ...warn([]), answeredCount: 3 })).toEqual(['parent_report', 'incomplete']);
  });
});

// ===========================================================================
// 五、回傳的陣列是新的；登錄
// ===========================================================================

describe('每次呼叫回新的陣列，改了不會污染下一次', () => {
  it('mchat 的標籤與 caveats；warn 的標籤', () => {
    const m = ruleFor(MCHAT);
    m.tags(mchat([1])).push('sen.oral');
    expect(m.tags(mchat([1]))).toEqual(['soc.joint_attention']);
    m.caveats(mchat([2])).push('safety_concern');
    expect(m.caveats(mchat([2]))).toEqual(['parent_report', 'hearing_check_first']);
    const w = ruleFor(WARN);
    w.tags(warn([3])).push('mot.balance');
    expect(w.tags(warn([3]))).toEqual(['mot.fine_motor']);
  });
});

describe('規則表登錄', () => {
  it('這張票的四支公開工具，順序照 §3 的登錄表', () => {
    expect([...PUBLIC_TOOL_IDS]).toEqual(['sxk-warn', 'mchat-rf', 'snap-iv', 'chexi']);
    expect(Object.keys(PUBLIC_TOOL_RULES)).toEqual(['sxk-warn', 'mchat-rf', 'snap-iv', 'chexi']);
  });

  it('四支都在登錄表裡、排在 #50 的四支之後（氣質兩支在最後，由氣質那份測試釘住）', () => {
    const before = [...ACHIEVEMENT_TOOL_IDS, ...ASD_TOOL_IDS, ...ATTENTION_SENSORY_TOOL_IDS, ...DEV_ADL_LEARNING_TOOL_IDS];
    expect(Object.keys(TOOL_RULES).slice(before.length, before.length + PUBLIC_TOOL_IDS.length)).toEqual([...PUBLIC_TOOL_IDS]);
    for (const toolId of PUBLIC_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.toolId).toBe(toolId);
      expect(rule.rulesVersion).toBe(RULES_VERSION);
    }
  });

  it('source 指向工具包檔名與 LEVELS 常數', () => {
    for (const toolId of PUBLIC_TOOL_IDS) {
      const rule = ruleFor(toolId);
      expect(rule.source).toContain(TOOLKIT[toolId].source.file);
      expect(rule.source).toContain('LEVELS');
    }
  });
});

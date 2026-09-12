/**
 * 四支公開工具的規則表：warn、mchat、snap、chexi（規格 §5.9，#51）。
 *
 * 【為什麼四支放一起】
 * 這四支不是森心康自建的（衛健委的紅旗初篩、M-CHAT-R/F、SNAP-IV、CHEXI），切分是官方的
 * 或原作者的 —— 所以 mchat 與 snap **不帶** `unsourced_threshold`，chexi 乾脆不出 band。
 * 判法四支四樣，每支一條在對應表之外的規則，各自一個工廠；共用的只有 `./shared` 的積木。
 *
 * 【四支各自的那一條】
 * - `mchat-rf`：風險數餵 SOC（0–2 clear、3–7 watch、8–20 refer）。低風險但前置題「有擔心」為真
 *   → `watch`（§5.4）；中等風險加 caveat `follow_up_not_done`（第二階段訪談沒做，報告要說
 *   「建議由專家做第二階段訪談」）；第 2 題「想過孩子可能是聾的」答「是」→ `hearing_check_first`
 *   （寫在 `ITEM_TAGS` 的 `caveats` 欄，跟標籤走同一條逐題掃描）。三條都不動 tier。
 * - `snap-iv`：IA、HI 取**較差者**餵 ATT，OD 單獨餵 EMO（附錄 F 的 `feeds` 已經這樣寫，
 *   `bandFromFeeds` 取最差的那個就是它）。1.2／1.8 三級對 clear／watch／refer，OD 一視同仁
 *   （§10.2 第 3 項）。標籤在面向級。§5.9 提的 `native.symptomCounts` 是 §5.2 的 `sx.<分量表>`，
 *   由計分層寫，規則表只讀不寫。
 * - `chexi`：**不出 band** —— 紙本與 HTML 都寫「本檔不套用任何自造切分值」。因素 pct ≥ 67
 *   出標籤，該因素底下那個副量表的均分 ≥ 4 再多一個；固定帶 `descriptive_only`。
 *   副量表均分讀 `native['mean.<副量表>']` —— 這是 §5.9 的門檻直接寫在 §5.2 的數上，
 *   拿 `raw ÷ n` 重算一次等於把公式抄第二遍（`./shared` 的「只讀四個欄位」在這裡開的例外）。
 * - `sxk-warn`：不路由（§4.6），規則表仍要在。維度**不看面向 key**（`m24` 這種時點）而看
 *   **時點內的位置**：第 1 條→LANG、第 2 條→SOC、第 3 條→MOT（`mot.fine_motor`）、第 4 條→MOT
 *   （`mot.locomotion`），對應表在 `itemTags.ts` 的 `WARN_POSITION_FEEDS`。前置題勾語言倒退→LANG、
 *   社交倒退→SOC。被點名的維度 `refer`；**沒被點名的是 `clear`**，不是跟著總 tier 走 —— 第 3 條
 *   陽性時總 tier 是 3，但那講的是動作，語言沒有理由跟著轉診。無 caveat（§5.9），倒退也不出
 *   `regression_reported`（§5.6 那一條只給 asb／asr）。
 *
 * 【四支都沒有 tier 4】
 * 分段表最多三段，`severity.severe` 在這裡永遠不出。mchat 與 snap 仍呼叫 `severityTags`：§5.5
 * 的規則是跨工具的，分段表哪天加了第四段不必回來改。warn 的 `feeds.sections` 是位置不是面向 key，
 * chexi 與氣質不出 band，這三支不呼叫。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolId, ToolkitBank, ToolkitItem } from '../toolkit';
import type { Caveat } from '../caveats';
import type { FindingTag } from '../findingTags';
import { CHEXI_FACTORS, CHEXI_FACTOR_MIN_PCT } from '../sectionTags';
import { WARN_POSITION_FEEDS, WARN_REGRESSION_FEEDS } from '../itemTags';
import { feedsDimension } from '../toolSpecs';
import { RULES_VERSION, answerKey, noneValueOf, regressionReported } from '../scoring';
import type { AnswerValue } from '../scoring';
import type { Band, DimensionCode, Tier, ToolResult, ToolRule } from '../types';
import {
  bandFromFeeds,
  baseCaveats,
  dedupe,
  sectionLevelTags,
  severityTags,
  triggeredItemRules,
} from './shared';

function sourceOf(bank: ToolkitBank): string {
  return `${bank.source.file} LEVELS（紙本「分數解讀」）`;
}

// ---------------------------------------------------------------------------
// mchat-rf
// ---------------------------------------------------------------------------

/** §5.4：中等風險（3–7 分）才帶 `follow_up_not_done`。低風險被「擔心」推成 watch 時不帶。 */
export const FOLLOW_UP_TIER: Tier = 2;

/** 風險族的逐題觸發：答到題庫標的風險那一邊（題 2、5、12 是「是」，其餘是「否」）（§5.5）。 */
const RISK_ITEM_TRIGGER = (value: AnswerValue, item: ToolkitItem): boolean =>
  item.riskAnswer !== undefined && value === item.riskAnswer;

/**
 * 前置題「是否對兒童患上自閉症譜系障礙有擔心」有沒有答「是」。
 *
 * 規格 §5.1 寫的型別是 boolean；題庫的選項值卻是字串 `'true'`／`'false'`（`ToolkitPreQuestion`
 * 的 `value` 只能放字串）。兩種形狀都認，但**只認 `true` 與 `'true'`** —— `'false'` 這個字串
 * 在 `Boolean()` 底下是真，那是最容易寫出來的錯。其餘形狀（陣列、別的字）一律當成沒擔心：
 * 不知道的事不改判定，跟其他前置題同一個原則。
 */
export function concernReported(pre: ToolResult['pre']): boolean {
  const raw = pre.concern;
  return raw === true || raw === 'true';
}

function mchatRule(): ToolRule {
  const toolId: ToolId = 'mchat-rf';
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 照 feeds 算（只餵 SOC），低風險且有擔心 → watch。tier 沒算出來（null）時擔心也推不出
    // band：沒有分數就沒有判定。
    bandFor: (r, dimension) => {
      const band = bandFromFeeds(r, dimension);
      return band === 'clear' && concernReported(r.pre) ? 'watch' : band;
    },
    // 逐題（照題號）→ severe。同一個標籤只出一次（1、6、7、9、16、17、19 都對 `soc.joint_attention`）。
    tags: r => dedupe([
      ...triggeredItemRules(r, RISK_ITEM_TRIGGER).flatMap(rule => rule.tags),
      ...severityTags(r),
    ]),
    // 固定的 → 判定的（follow_up_not_done）→ 逐題的（hearing_check_first）。
    caveats: r => {
      const out: Caveat[] = baseCaveats(r);
      if (r.overall.scored && r.overall.tier === FOLLOW_UP_TIER) out.push('follow_up_not_done');
      out.push(...triggeredItemRules(r, RISK_ITEM_TRIGGER).flatMap(rule => rule.caveats ?? []));
      return dedupe(out);
    },
    source: sourceOf(bank),
  };
}

// ---------------------------------------------------------------------------
// snap-iv
// ---------------------------------------------------------------------------

function snapRule(): ToolRule {
  const toolId: ToolId = 'snap-iv';
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // feeds：ATT ← IA、HI（取較差者）；EMO ← OD。其餘七個維度 null。
    bandFor: (r, dimension) => bandFromFeeds(r, dimension),
    // 面向級（IA → HI → OD）→ severe。
    tags: r => dedupe([...sectionLevelTags(r), ...severityTags(r)]),
    caveats: r => baseCaveats(r),
    source: sourceOf(bank),
  };
}

// ---------------------------------------------------------------------------
// chexi
// ---------------------------------------------------------------------------

/**
 * 因素 pct ≥ 67 → 該因素的標籤；再看該因素底下那個副量表的均分（`native['mean.pl']`／
 * `native['mean.rg']`）≥ 4 → 另加一個。另加的掛在因素底下：因素沒過線時副量表再高也不出。
 */
function chexiTags(r: ToolResult): FindingTag[] {
  const out: FindingTag[] = [];
  for (const factor of CHEXI_FACTORS) {
    const stat = r.sections[factor.key];
    if (!stat || !stat.scored || stat.pct === null || stat.pct < CHEXI_FACTOR_MIN_PCT) continue;
    out.push(...factor.tags);
    const mean = r.native[`mean.${factor.extra.section}`];
    if (typeof mean === 'number' && mean >= factor.extra.minMean) out.push(...factor.extra.tags);
  }
  return out;
}

function chexiRule(): ToolRule {
  const toolId: ToolId = 'chexi';
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 不出 band（§5.4）：對任何維度、任何分數都 null。feeds 的 ATT 只用來排 extras。
    bandFor: () => null,
    tags: r => dedupe(chexiTags(r)),
    // 固定的（descriptive_only 在登錄表）。
    caveats: r => baseCaveats(r),
    source: sourceOf(bank),
  };
}

// ---------------------------------------------------------------------------
// sxk-warn
// ---------------------------------------------------------------------------

/** 題庫「阳性」的選項值。`scoring/families.ts` 的 `positive()` 也是拿這個值數的。 */
export const WARN_POSITIVE_VALUE = 1;

/** 倒退勾能指向的維度（LANG、SOC）。認不出的倒退值兩個都推。 */
const REGRESSION_DIMS: ReadonlyArray<DimensionCode> = dedupe(Object.values(WARN_REGRESSION_FEEDS));

/**
 * 本次出的那個時點裡，陽性條目的位置（1–4）。掃的是 `r.sections` 裡有的時點（正常只有一個），
 * 讀 `answers`，跟其他逐題規則同一條路 —— 不讀 `native.positives`。
 */
function positivePositions(r: ToolResult, bank: ToolkitBank): number[] {
  const out: number[] = [];
  for (const section of bank.sections) {
    if (r.sections[section.key] === undefined) continue;
    for (const item of section.items) {
      if (r.answers[answerKey(bank, section, item)] === WARN_POSITIVE_VALUE) out.push(item.no);
    }
  }
  return out;
}

/**
 * 倒退勾指向的維度。語言→LANG、社交→SOC（`WARN_REGRESSION_FEEDS`）。
 *
 * 計分層對認不出的值往安全那邊倒（`regressionReported` 說有倒退 → tier 3）。這裡跟著倒：
 * 認不出是哪一種倒退，就把兩種倒退各自的維度都推成 `refer` —— 否則 `overall.tier` 說異常
 * 而沒有任何維度說要轉診，同一筆結果自相矛盾。MOT 不動：倒退從來不指向動作。
 */
function regressionDims(r: ToolResult, bank: ToolkitBank): DimensionCode[] {
  if (!regressionReported(bank, r.pre)) return [];
  const raw = r.pre.regression;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const none = noneValueOf(bank, 'regression');
  const out: DimensionCode[] = [];
  for (const v of values) {
    if (v === none) continue;
    const dim = WARN_REGRESSION_FEEDS[v];
    out.push(...(dim ? [dim] : REGRESSION_DIMS));
  }
  // `regressionReported` 說有、卻一個值都攤不出來（形狀認不得）—— 同樣兩個都推。
  return dedupe(out.length > 0 ? out : [...REGRESSION_DIMS]);
}

/** 這一份 warn 點名了哪些維度：陽性條目的位置 ＋ 倒退勾。 */
function flaggedDims(r: ToolResult, bank: ToolkitBank): Set<DimensionCode> {
  const out = new Set<DimensionCode>(regressionDims(r, bank));
  for (const position of positivePositions(r, bank)) {
    const feed = WARN_POSITION_FEEDS.find(f => f.position === position);
    if (feed) out.add(feed.dimension);
  }
  return out;
}

function warnRule(): ToolRule {
  const toolId: ToolId = 'sxk-warn';
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 被點名的維度 refer；沒被點名、但這份有算出來（`overall.scored`）的維度 clear；
    // 不餵的維度 null。不看 `overall.tier`：它是「整份有沒有異常」，不是「哪個維度」。
    bandFor: (r, dimension): Band | null => {
      if (!feedsDimension(toolId, dimension)) return null;
      if (flaggedDims(r, bank).has(dimension)) return 'refer';
      return r.overall.scored ? 'clear' : null;
    },
    // 陽性條目照位置出標籤（第 3 條 `mot.fine_motor`、第 4 條 `mot.locomotion`；第 1、2 條沒有）。
    // 倒退不出標籤。沒有 tier 4，不呼叫 `severityTags`（它讀的 `feeds.sections` 在 warn 是位置不是面向 key）。
    tags: r => dedupe(
      positivePositions(r, bank).flatMap(position => WARN_POSITION_FEEDS.find(f => f.position === position)?.tags ?? []),
    ),
    // 只有固定的（§5.9 寫「無」，登錄表是空的，剩 parent_report）。
    caveats: r => baseCaveats(r),
    source: sourceOf(bank),
  };
}

/** 四張表，key 是 toolId。順序照 §3 的登錄表。 */
export const PUBLIC_TOOL_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = {
  'sxk-warn': warnRule(),
  'mchat-rf': mchatRule(),
  'snap-iv': snapRule(),
  'chexi': chexiRule(),
};

/** 這張票的四支公開工具，從上面那張表讀出來，不另抄一份。 */
export const PUBLIC_TOOL_IDS: ReadonlyArray<ToolId> = Object.keys(PUBLIC_TOOL_RULES) as ToolId[];

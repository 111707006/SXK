/**
 * 注意力（ab、att）與感覺處理（spa、spb）的規則表（規格 §5.9，#49）。
 *
 * 【為什麼這四支放一起】
 * 關切率族六支裡，asb／asr（#48）標籤是逐題的、前置題會直接改 band；剩下這四支
 * （a）標籤在**面向級**（面向 tier ≥ 2 出，跟達成率族一樣）、（b）前置題**只出 caveat**
 * （spa／spb 另出幾個只進報告的標籤）、（c）前置題**不改 band**。四支在對應表之外的
 * 規則只有前置題那一條，各支的形狀不同，所以是「一支一條」的表，不是一支一個分支。
 *
 * 【前置題：三種形狀（§5.1）】
 * - ab「出現場合」複選 → 勾了 ≤ 1 個 → `single_setting`（ADHD 的判斷要跨場合）。
 * - att「持續多久」單選 → `lt3m`／`3to6m`（< 6 個月）→ `recent_onset`。
 * - spa／spb「影響參與」複選 → 勾「無」→ `no_functional_impact`；勾其餘各出一個
 *   `sen.impact_adl`／`impact_group`／`impact_play`（對應表在 `sectionTags.ts` 的
 *   `PRE_QUESTION_TAGS`）。「無」與其餘互斥是登錄表 `exclusive` 的事（家長端擋），
 *   這裡不驗 `pre` —— 計分層驗 `pre` 是 #48 review 記下的另一件工作。
 *
 * **沒答前置題（`pre` 裡沒有那個 key）→ 那一條不觸發**，跟 asb／asr 的倒退同一個原則：
 * 不知道的事不出句子。ab 答了但一個都沒勾（空陣列）照 §5.1 的「長度 ≤ 1」出 caveat。
 *
 * 【att 的 `native.hotSettings`】
 * §5.9 另要 att 記「tier ≥ 2 的情境數」。`native` 是 `ToolResult` 的一部分，由計分層寫
 * （`scoring/index.ts`），這一層只讀 `sections`／`overall`／`answers`／`pre`，不碰它。
 *
 * band 用總關切率餵 ATT（ab、att）或 SEN（spa、spb）（附錄 F），切分各支自己的
 * （att 25／33／42、ab 33／41／50、spa／spb 28／36／45）。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolId, ToolkitBank } from '../toolkit';
import type { Caveat } from '../caveats';
import type { FindingTag } from '../findingTags';
import { PRE_QUESTION_TAGS } from '../sectionTags';
import { RULES_VERSION, noneValueOf } from '../scoring';
import type { ToolResult, ToolRule } from '../types';
import {
  bandFromFeeds,
  baseCaveats,
  dedupe,
  sectionLevelTags,
  severityTags,
} from './shared';

/** 這張票的四支。順序照 §3 的登錄表。 */
export const ATTENTION_SENSORY_TOOL_IDS: ReadonlyArray<ToolId> = ['sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb'];

/** att「持續多久」裡算「最近才開始」的兩個值（§5.1：< 6 個月）。 */
export const RECENT_ONSET_VALUES: ReadonlyArray<string> = ['lt3m', '3to6m'];

/**
 * 前置題的答案攤成字串陣列；**沒答回 `null`**，跟「答了但一個都沒勾」（`[]`）分開 ——
 * ab 的規則對這兩種情況給的答案不同。單選送字串、複選送陣列；boolean 是 mchat 的形狀，
 * 這四支不會有，當成沒答。
 */
function preValues(pre: ToolResult['pre'], key: string): string[] | null {
  const raw = pre[key];
  if (raw === undefined || raw === null || typeof raw === 'boolean') return null;
  return Array.isArray(raw) ? raw : [raw];
}

/** 一支工具的前置題規則：只讀 `pre`，回 caveats 與只進報告的標籤。 */
interface PreQuestionRule {
  caveats: (bank: ToolkitBank, pre: ToolResult['pre']) => Caveat[];
  tags: (bank: ToolkitBank, pre: ToolResult['pre']) => FindingTag[];
}

const NO_TAGS = (): FindingTag[] => [];

/** spa／spb 共用：「無」→ caveat；其餘照題庫的選項順序出標籤（不照家長勾的順序）。 */
const IMPACT_RULE: PreQuestionRule = {
  caveats: (bank, pre) => {
    const values = preValues(pre, 'impact');
    const none = noneValueOf(bank, 'impact');
    return values !== null && none !== undefined && values.includes(none) ? ['no_functional_impact'] : [];
  },
  tags: (bank, pre) => {
    const values = preValues(pre, 'impact');
    if (values === null) return [];
    const table = PRE_QUESTION_TAGS[bank.id]?.impact ?? {};
    const options = bank.preQuestions.find(q => q.key === 'impact')?.options ?? [];
    return options.filter(o => values.includes(o.value)).flatMap(o => table[o.value] ?? []);
  },
};

const PRE_RULES: Readonly<Record<string, PreQuestionRule>> = {
  'sxk-ab': {
    caveats: (_bank, pre) => {
      const values = preValues(pre, 'settings');
      return values !== null && values.length <= 1 ? ['single_setting'] : [];
    },
    tags: NO_TAGS,
  },
  'sxk-att': {
    caveats: (_bank, pre) => {
      const values = preValues(pre, 'duration');
      return values !== null && values.some(v => RECENT_ONSET_VALUES.includes(v)) ? ['recent_onset'] : [];
    },
    tags: NO_TAGS,
  },
  'sxk-spa': IMPACT_RULE,
  'sxk-spb': IMPACT_RULE,
};

function attentionSensoryRule(toolId: ToolId): ToolRule {
  const bank = TOOLKIT[toolId];
  const pre = PRE_RULES[toolId];
  if (!pre) throw new Error(`規則表：${toolId} 沒有前置題規則（#49 只登錄四支）`);

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 前置題不改 band：只看總關切率餵的那一個維度，其餘 null。
    bandFor: (r, dimension) => bandFromFeeds(r, dimension),
    // 面向級（照題庫面向順序）→ 前置題（只進報告）→ severe。同一個標籤只出一次
    // （ab 的 SU／DI 都對 `att.inattention`）。這四支沒有逐題規則（§5.9），不掃逐題。
    tags: r => dedupe([
      ...sectionLevelTags(r),
      ...pre.tags(bank, r.pre),
      ...severityTags(r),
    ]),
    // 固定的 → 前置題的。
    caveats: r => dedupe([...baseCaveats(r), ...pre.caveats(bank, r.pre)]),
    source: `${bank.source.file} LEVELS（紙本「分數解讀」）`,
  };
}

/** 四張表，key 是 toolId。 */
export const ATTENTION_SENSORY_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  ATTENTION_SENSORY_TOOL_IDS.map(id => [id, attentionSensoryRule(id)]),
);

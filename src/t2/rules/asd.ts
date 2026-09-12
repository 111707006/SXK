/**
 * 自閉行為（asb）與社交溝通（asr）的規則表（規格 §5.9，#48）。
 *
 * 【為什麼這兩支放一起】
 * 關切率族六支裡，只有這兩支（a）標籤是**逐題**的、（b）有前置題「能力倒退」、
 * （c）前置題會直接改 band。另外四支（ab、att、spa、spb，#49）標籤在面向級、
 * 前置題只出 caveat。分族是計分的事（#46）；規則表按「判法一不一樣」分檔。
 *
 * 【三條在對應表之外的規則】
 * 1. 前置題答有倒退（語言或社交）→ 不論分數直接 `refer`，加 caveat `regression_reported`
 *    （§5.4）。**不動 tier**：`severity.severe` 照樣只看 tier 4，所以「pct 5、有倒退」
 *    是 `refer` 而沒有 severe —— 這不矛盾，倒退是家長的回報，不是量表的分數。
 * 2. asb SH 第 8 項「出现自伤行为」答 ≥2 → caveat `safety_concern`，與 band 無關
 *    （§5.6；報告置頂是 #52／#59 的事，這裡只產出）。它寫在 `ITEM_TAGS` 的 `caveats`
 *    欄，跟標籤走同一條逐題掃描，不另立一支特例。
 * 3. asr 固定帶 `rater_role_parent`（2026-09-11 決定完整給家長填）—— 在登錄表的
 *    `fixedCaveats`，`baseCaveats()` 會帶出來，這一檔沒有 asr 專屬的分支。
 *
 * band 用總關切率餵 SOC（附錄 F），切分各支自己的（asb 22／31／40、asr 20／29／38；
 * 📞 §10.1 第 2 題定案前照原值）。逐題標籤的對應在 `itemTags.ts`，這裡只給觸發條件。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolId } from '../toolkit';
import type { Caveat } from '../caveats';
import { feedsDimension } from '../toolSpecs';
import { RULES_VERSION, regressionReported } from '../scoring';
import type { AnswerValue } from '../scoring';
import type { ToolRule } from '../types';
import {
  bandFromFeeds,
  baseCaveats,
  dedupe,
  severityTags,
  triggeredItemRules,
} from './shared';

/** 這張票的兩支。順序照 §3 的登錄表。 */
export const ASD_TOOL_IDS: ReadonlyArray<ToolId> = ['sxk-asb', 'sxk-asr'];

/** 關切率族的逐題觸發：答 ≥2（「经常」或「总是」；asr 是「中度不同」或「明显不同」）（§5.5）。 */
const CONCERN_ITEM_TRIGGER = (value: AnswerValue): boolean => typeof value === 'number' && value >= 2;

function asdRule(toolId: ToolId): ToolRule {
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 倒退只推**這支餵的**維度。先問餵不餵：不餵的維度一律 null，不然一個有倒退的
    // asb 會把 LANG／EMO 也推成 refer，而附錄 C 明寫 asb 不餵那兩格。
    bandFor: (r, dimension) => {
      if (!feedsDimension(toolId, dimension)) return null;
      if (regressionReported(bank, r.pre)) return 'refer';
      return bandFromFeeds(r, dimension);
    },
    // 逐題（照題庫的面向與題號順序）→ severe。同一個標籤只出一次（asb RE 1／6／7／10
    // 都對 `soc.social_initiation`）。
    tags: r => dedupe([
      ...triggeredItemRules(r, CONCERN_ITEM_TRIGGER).flatMap(rule => rule.tags),
      ...severityTags(r),
    ]),
    // 固定的 → 倒退 → 逐題的（safety_concern）。
    caveats: r => {
      const out: Caveat[] = baseCaveats(r);
      if (regressionReported(bank, r.pre)) out.push('regression_reported');
      out.push(...triggeredItemRules(r, CONCERN_ITEM_TRIGGER).flatMap(rule => rule.caveats ?? []));
      return dedupe(out);
    },
    source: `${bank.source.file} LEVELS（紙本「分數解讀」）`,
  };
}

/** 兩張表，key 是 toolId。 */
export const ASD_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  ASD_TOOL_IDS.map(id => [id, asdRule(id)]),
);

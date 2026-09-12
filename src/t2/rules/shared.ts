/**
 * 22 張規則表共用的積木（規格 §5.4、§5.5、§5.6）。
 *
 * 【這一層做什麼】
 * 把 #46 算出來的 `ToolResult` 翻成三樣東西：band（給家長的三級判定）、發現標籤
 * （練什麼）、caveats（這筆結果該打幾折）。每一支工具的規則表（`./achievement.ts` 起）
 * 都是用這裡的積木組起來的 —— 對應表在 `sectionTags.ts`／`itemTags.ts`，觸發條件在這裡，
 * 兩邊都不再抄第二次。
 *
 * 【只讀四個欄位】
 * 規則只讀 `ToolResult` 的 `sections[*].{pct,tier,scored}`、`overall.{tier,scored}`、
 * `answers`、`assessedAgeMonth`／`askedCount`／`answeredCount`。`raw`／`max` 在這一層
 * 一個都不碰 —— 測試因此可以只換掉一個面向的 pct 與 tier 來踩邊界。
 *
 * `native` 只有兩處讀：chexi 的副量表均分（`mean.pl`／`mean.rg`）與氣質的向度偏差
 * （`dev.D1`……）。那兩條規則的門檻（§5.9「計劃力 mean ≥ 4」、§5.5「dev ≥ 1.0」）直接寫在
 * §5.2 的 native 數上，tier 與 pct 都表達不了（tier 3 不知道 dev 的方向），從 `raw` 重算
 * 等於把公式抄第二遍。見 `./publicTools.ts`、`./temperament.ts`。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolkitItem } from '../toolkit';
import { UNIVERSAL_CAVEATS } from '../caveats';
import type { Caveat } from '../caveats';
import type { FindingTag } from '../findingTags';
import { SECTION_TAGS, SEVERITY_TAG, SEVERITY_TIER } from '../sectionTags';
import { itemRule } from '../itemTags';
import type { ItemTagRule } from '../itemTags';
import { TOOL_SPECS, inWindow, sectionsFor } from '../toolSpecs';
import { answerKey } from '../scoring';
import type { AnswerValue } from '../scoring';
import type { Band, DimensionCode, SectionStat, Tier, ToolResult } from '../types';

/** §5.4 的表：1 clear、2 watch、3 refer、4 refer（4 另出 `severity.severe`，見 `severityTags`）。 */
export const BAND_OF_TIER: Readonly<Record<Tier, Band>> = { 1: 'clear', 2: 'watch', 3: 'refer', 4: 'refer' };

export function bandOfTier(tier: Tier | null): Band | null {
  return tier === null ? null : BAND_OF_TIER[tier];
}

/**
 * 一個面向（或總分）的 band。
 *
 * `scored=false` 的面向不出 band —— §5.2 說它「不單獨判讀」。六支達成率族在窗口內
 * 每一個月齡的判定面向都 `scored`（`test/t2Scoring.test.ts` 掃過），所以這一條是安全網，
 * 不是常走的路；但它得在：題數不夠的面向若照樣出 band，一題的差距就是 33 個百分點，
 * 家長會看到一個抖得很厲害的判定。
 */
export function bandOfStat(stat: SectionStat | undefined): Band | null {
  if (!stat || !stat.scored) return null;
  return bandOfTier(stat.tier);
}

const BAND_RANK: Readonly<Record<Band, number>> = { clear: 0, watch: 1, refer: 2 };

/** 幾個 band 裡最差的那個（`refer` > `watch` > `clear`）；全 null 回 null。 */
export function worstBand(bands: ReadonlyArray<Band | null>): Band | null {
  let worst: Band | null = null;
  for (const b of bands) {
    if (b !== null && (worst === null || BAND_RANK[b] > BAND_RANK[worst])) worst = b;
  }
  return worst;
}

/**
 * 這個維度用哪些 `SectionStat` 出 band（附錄 F 的 `feeds`）：不餵回 `[]`，
 * `'overall'` 回總分，面向型回那幾個面向。多維度工具（asq、dev、snap）每個維度各自
 * 一組，這是「band 按該維度對應的面向分別算，不用總分」（§5.4）落地的地方。
 */
export function bandStats(r: ToolResult, dimension: DimensionCode): SectionStat[] {
  const sections = sectionsFor(r.toolId, dimension);
  if (sections === null) return [];
  if (sections === 'overall') return [r.overall];
  return sections.map(key => r.sections[key]).filter((s): s is SectionStat => s !== undefined);
}

/** 照 `feeds` 算這個維度的 band；一個維度對到多個面向時取最差的。不餵 → null。 */
export function bandFromFeeds(r: ToolResult, dimension: DimensionCode): Band | null {
  return worstBand(bandStats(r, dimension).map(bandOfStat));
}

/**
 * 面向級標籤（§5.5）：該面向 `scored` 且 tier ≥ 2 → 出 `SECTION_TAGS` 對應的那幾個。
 * 順序照題庫的面向順序，不照 `r.sections` 物件的鍵序 —— 後者是誰先寫進去誰在前。
 */
export function sectionLevelTags(r: ToolResult): FindingTag[] {
  const table = SECTION_TAGS[r.toolId];
  if (!table) return [];
  const out: FindingTag[] = [];
  for (const section of TOOLKIT[r.toolId].sections) {
    const stat = r.sections[section.key];
    if (!stat || !stat.scored || stat.tier === null || stat.tier < 2) continue;
    out.push(...(table[section.key] ?? []));
  }
  return out;
}

/**
 * 逐題規則裡被觸發的那些（§5.5 逐題級）。觸發條件依計分族，由呼叫端給：
 * 達成率族是答 ≤1、關切率族是答 ≥2、獨立率族是答 ≤4、mchat 是答到風險那一邊。
 *
 * 掃的是題庫的全部題，用 `answers` 有沒有那個 key 判斷「這題本次有沒有出」——
 * 沒出的題不在 `answers` 裡（#46 的計分拒收多餘的 key），自然不會觸發。
 * 回傳的是 `ITEM_TAGS` 裡的原物件，呼叫端只讀不改（型別上是 `ReadonlyArray`）。
 */
export function triggeredItemRules(
  r: ToolResult,
  triggered: (value: AnswerValue, item: ToolkitItem) => boolean,
): ItemTagRule[] {
  const bank = TOOLKIT[r.toolId];
  const out: ItemTagRule[] = [];
  for (const section of bank.sections) {
    for (const item of section.items) {
      const rule = itemRule(r.toolId, section.key, item.no);
      if (!rule) continue;
      const value = r.answers[answerKey(bank, section, item)];
      if (value === undefined || !triggered(value, item)) continue;
      out.push(rule);
    }
  }
  return out;
}

/**
 * `severity.severe`：出 band 的那個 tier 是 4 才出（§5.4 的表把它跟 `refer` 綁在同一列）。
 *
 * 單一維度的工具看總分的 tier；多維度的看每個判定面向。**不看**不出 band 的面向
 * （asq 的 FM）也不看單一維度工具的個別面向 —— 總分 tier 2 而某個面向 tier 4 時，
 * band 是 `watch`，同一筆結果裡再掛一個「嚴重」會讓報告自相矛盾。
 * §5.5 那句「任何工具的 tier 4」讀成「任何工具**拿去出 band 的** tier 4」，
 * 記在 `docs/specs/t2-v2-errata-2026-09-11.md` F1。
 */
export function severityTags(r: ToolResult): FindingTag[] {
  for (const feed of TOOL_SPECS[r.toolId].feeds) {
    for (const stat of bandStats(r, feed.dimension)) {
      if (stat.scored && stat.tier === SEVERITY_TIER) return [SEVERITY_TAG];
    }
  }
  return [];
}

/** 去重、保序。gm 的 P1／P2／P3 都對 `mot.postural`，asq PE 後三項都對 `soc.social_initiation`。 */
export function dedupe<T>(values: ReadonlyArray<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * 每一筆結果都有的 caveats：22 支都帶的、這支固定帶的（`ToolSpec.fixedCaveats`），
 * 再加兩個只有舊紀錄會碰到的（§5.6）—— 現在這一刻算不出來的結果根本進不了
 * `ToolResult`（#46 拒算），但一筆存了半年的結果被改過窗口的登錄表重讀時會走到這裡。
 * 跟著分數或前置題走的（`hearing_check_first`、`regression_reported`……）由各張規則表自己加。
 */
export function baseCaveats(r: ToolResult): Caveat[] {
  const out: Caveat[] = [...UNIVERSAL_CAVEATS, ...TOOL_SPECS[r.toolId].fixedCaveats];
  if (!inWindow(r.toolId, r.assessedAgeMonth)) out.push('age_out_of_window');
  if (r.answeredCount < r.askedCount) out.push('incomplete');
  return out;
}

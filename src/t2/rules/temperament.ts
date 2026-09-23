/**
 * 氣質兩支（tempa 1–3 歲、tempb 3–7 歲）的規則表（規格 §5.9，#51；v2.1 §4.4，S07）。
 *
 * 【氣質最高只判到留意】（v2.1 S07，客戶 9/21 工作單 #7）
 * v2 說它描述的是特質，不是缺口 —— 活動量大、慢熱、堅持不下去，都不是「落後」，所以任何維度都
 * 回 `null`。客戶改成：**指定的幾個向度**明顯偏到要留意的那一邊時，對情緒、注意力判「留意」，
 * 最高就是留意（`feeds` 的 `maxBand`），永遠不會是關注、也不會掛 `severity.severe`。
 * - 哪幾個向度、在哪段月齡：`toolSpecs.ts` 的 `TOOL_FEEDS`（tempa 情緒 D4–D6 12–36、注意力 D7／D8
 *   12–35；tempb 情緒 D4–D6 36–71）。段外、或不在 feed 裡的維度 → `null`，照舊只出標籤。
 * - 看哪一邊（暫採，§9 第 1 題）：**沿用下面標籤的方向** —— 那個向度在 `TEMPERAMENT_TAGS` 哪一側
 *   有標籤，就看哪一側（D4、D5、D6、D8 看 `dev ≥ +1`，D7 坚持度看 `dev ≤ −1`）。坚持度的題目是
 *   單向的（高＝「一直重试不放弃」），雙向判會把很能堅持的孩子標成注意力留意。
 * - 門檻（暫採）：`|dev| ≥ 1.00`，與標籤同一條線（`TEMPERAMENT_TAG_DEV`）。客戶寫的是「>1.00」。
 * - 任一向度偏 → `watch`；那幾個向度都算得出、都沒偏 → `clear`；有算不出的、其餘又沒偏 → `null`。
 * `tier` 仍不進判定：tier 3 只知道 `|dev| ≥ 1.0`，不知道方向。
 *
 * 標籤照樣出：T1 綠的維度也會收到 `emo.slow_to_warm`，`band = 'clear'`、標籤只進報告（§5.7 最後一條）。
 *
 * 【標籤看方向，不只看大小】
 * tier 3（「明顯偏」）只知道 `|dev| ≥ 1.0`，不知道偏向哪一邊。八個向度貼在 hi 端
 * （`dev ≥ 1.0`），只有 D7 堅持度貼在 lo 端（`dev ≤ −1.0`）—— 堅持不下去才是要留意的事。
 * 所以規則讀 `native['dev.<向度>']`，不讀 tier；對應表在 `sectionTags.ts` 的 `TEMPERAMENT_TAGS`。
 * 這是 `./shared` 的「只讀四個欄位」開的第二個例外（第一個是 chexi 的副量表均分）：
 * §5.5 的門檻直接寫在 §5.2 的 `dev` 上，從 `raw ÷ 8 − 2.5` 重算一次等於把公式抄第二遍。
 *
 * 「稍偏」（0.42 ≤ |dev| < 1.0）與沒列出的那一側不出標籤，只留在 native 給報告的氣質段落
 * （§5.9 寫的 `native.profile` 就是計分層寫的 `mean.<向度>`／`dev.<向度>`）。
 *
 * 【caveats】
 * 登錄表帶 `unsourced_threshold`（§5.6「18 支自建工具一律帶」，勘誤 B2），`baseCaveats` 帶出來，
 * 這一檔沒有自己的 caveat。兩支的題目、分段、對應表完全相同，共用同一個工廠。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolId } from '../toolkit';
import type { FindingTag } from '../findingTags';
import { TEMPERAMENT_TAGS, TEMPERAMENT_TAG_DEV } from '../sectionTags';
import { RULES_VERSION } from '../scoring';
import { feedAt } from '../toolSpecs';
import type { Band, DimensionCode, ToolResult, ToolRule } from '../types';
import { baseCaveats, capBand, dedupe } from './shared';

/** 這張票的兩支氣質。順序照 §3 的登錄表。 */
export const TEMPERAMENT_TOOL_IDS: ReadonlyArray<ToolId> = ['sxk-tempa', 'sxk-tempb'];

/**
 * 每個向度：`scored` 且 `dev ≥ 1.0` → hi 端的標籤；`dev ≤ −1.0` → lo 端的。
 * 順序照題庫的向度順序（D1–D9）。native 裡沒有那個向度的 `dev` → 不出，不從 tier 猜方向。
 */
function temperamentTags(r: ToolResult): FindingTag[] {
  const out: FindingTag[] = [];
  for (const section of TOOLKIT[r.toolId].sections) {
    const stat = r.sections[section.key];
    if (!stat || !stat.scored) continue;
    const dev = r.native[`dev.${section.key}`];
    if (typeof dev !== 'number') continue;
    const sides = TEMPERAMENT_TAGS[section.key];
    if (!sides) continue;
    if (dev >= TEMPERAMENT_TAG_DEV) out.push(...sides.hi);
    else if (dev <= -TEMPERAMENT_TAG_DEV) out.push(...sides.lo);
  }
  return out;
}

/**
 * 這個向度往哪一邊偏才要留意：`TEMPERAMENT_TAGS` 有標籤的那一側（檔頭「看哪一邊」）。
 * 兩側都有、或兩側都沒有，就說不出方向 —— 丟錯，不猜。
 */
function watchSide(key: string): 'hi' | 'lo' {
  const sides = TEMPERAMENT_TAGS[key];
  const hi = (sides?.hi.length ?? 0) > 0;
  const lo = (sides?.lo.length ?? 0) > 0;
  if (hi === lo) throw new Error(`規則表：氣質向度 ${key} 在 TEMPERAMENT_TAGS 裡看不出要留意的是哪一邊`);
  return hi ? 'hi' : 'lo';
}

/**
 * 氣質對這個維度的判定（檔頭「氣質最高只判到留意」）。feed 在這一筆的測評月齡不生效 → `null`。
 * 讀 `native['dev.<向度>']`，與標籤同一個數。
 */
function temperamentBand(r: ToolResult, dimension: DimensionCode): Band | null {
  const feed = feedAt(r.toolId, dimension, r.assessedAgeMonth);
  if (feed === null || feed.sections === 'overall') return null;
  let leaning = false;
  let allKnown = true;
  for (const key of feed.sections) {
    const stat = r.sections[key];
    const dev = r.native[`dev.${key}`];
    if (!stat || !stat.scored || typeof dev !== 'number') {
      allKnown = false;
      continue;
    }
    if (watchSide(key) === 'hi' ? dev >= TEMPERAMENT_TAG_DEV : dev <= -TEMPERAMENT_TAG_DEV) leaning = true;
  }
  const band: Band | null = leaning ? 'watch' : allKnown ? 'clear' : null;
  return capBand(band, feed.maxBand);
}

function temperamentRule(toolId: ToolId): ToolRule {
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    bandFor: temperamentBand,
    tags: r => dedupe(temperamentTags(r)),
    caveats: r => baseCaveats(r),
    source: `${bank.source.file} LEVELS（紙本「分數解讀」）`,
  };
}

/** 兩張表，key 是 toolId。 */
export const TEMPERAMENT_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  TEMPERAMENT_TOOL_IDS.map(id => [id, temperamentRule(id)]),
);

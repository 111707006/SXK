/**
 * 氣質兩支（tempa 1–3 歲、tempb 3–7 歲）的規則表（規格 §5.9，#51）。
 *
 * 【氣質不出 band】
 * 它描述的是特質，不是缺口 —— 活動量大、慢熱、堅持不下去，都不是「落後」。所以對任何維度、
 * 任何分數都回 `null`，恆不影響維度判定（§5.4）。標籤照樣出：T1 綠的維度也會收到
 * `emo.slow_to_warm`，`band = 'clear'`、標籤只進報告（§5.7 最後一條）。
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
import type { ToolResult, ToolRule } from '../types';
import { baseCaveats, dedupe } from './shared';

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

function temperamentRule(toolId: ToolId): ToolRule {
  const bank = TOOLKIT[toolId];

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 不出 band（§5.4）。feeds 的 EMO 只用來排 extras，這裡不看。
    bandFor: () => null,
    tags: r => dedupe(temperamentTags(r)),
    caveats: r => baseCaveats(r),
    source: `${bank.source.file} LEVELS（紙本「分數解讀」）`,
  };
}

/** 兩張表，key 是 toolId。 */
export const TEMPERAMENT_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  TEMPERAMENT_TOOL_IDS.map(id => [id, temperamentRule(id)]),
);

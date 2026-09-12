/**
 * 達成率族六支的規則表：gm、soc、lang、adp、voc、asq（規格 §5.9，#47）。
 *
 * 【六支長得一樣】
 * 每題 0／1／2，達成率 ≥85 clear、70–84 watch、55–69 refer、≤54 refer＋severe。
 * 五支用總達成率餵一個維度；asq 是多維度工具，四個領域各自餵一個維度、FM 只出標籤。
 * 這些差異全部寫在登錄表的 `feeds`（附錄 F）與 `SECTION_TAGS`／`ITEM_TAGS`（§5.9）裡，
 * 所以六張表是**同一個工廠**做出來的，這一檔沒有任何一支的專屬分支。
 *
 * 唯二不在對應表裡的規則，也都是這一族才有的：
 * - 「表達弱於理解」（lang RC−EX、voc V1−V2；`EXPRESSION_GAP_RULES`）。
 * - lang／voc 判 `refer` 時加 caveat `hearing_check_first`（§5.6：語言落後先排除聽力）。
 */

import { TOOLKIT, TOOL_IDS } from '../toolkit';
import type { ToolId } from '../toolkit';
import type { Caveat } from '../caveats';
import type { FindingTag } from '../findingTags';
import { EXPRESSION_GAP_MIN, EXPRESSION_GAP_RULES } from '../sectionTags';
import { TOOL_SPECS } from '../toolSpecs';
import { RULES_VERSION } from '../scoring';
import type { AnswerValue } from '../scoring';
import type { ToolResult, ToolRule } from '../types';
import {
  bandFromFeeds,
  baseCaveats,
  dedupe,
  sectionLevelTags,
  severityTags,
  triggeredItemRules,
} from './shared';

/** 六支，從登錄表的 `family` 推出來，不另列一份。順序照 §3 的登錄表。 */
export const ACHIEVEMENT_TOOL_IDS: ReadonlyArray<ToolId> =
  TOOL_IDS.filter(id => TOOL_SPECS[id].family === 'achievement');

/** 達成率族的逐題觸發：答 ≤1（「偶尔会」或「还不会」）（§5.5）。 */
const ACHIEVEMENT_ITEM_TRIGGER = (value: AnswerValue): boolean => typeof value === 'number' && value <= 1;

/** §5.9：lang 與 voc 判 `refer` 時加 `hearing_check_first`。 */
const HEARING_CHECK_ON_REFER: ReadonlyArray<ToolId> = ['sxk-lang', 'sxk-voc'];

/**
 * 「表達弱於理解」（§5.5）：理解面向的 pct − 表達面向的 pct ≥ 15，且表達那一面向本身
 * `scored` 且 tier ≥ 2。兩邊都很好時差 15 分沒有臨床意義，所以第二個條件不能省。
 */
function expressionGapTags(r: ToolResult): FindingTag[] {
  const out: FindingTag[] = [];
  for (const g of EXPRESSION_GAP_RULES) {
    if (g.toolId !== r.toolId) continue;
    const rc = r.sections[g.comprehension];
    const ex = r.sections[g.expression];
    if (!rc || !ex || rc.pct === null || ex.pct === null) continue;
    if (!ex.scored || ex.tier === null || ex.tier < 2) continue;
    if (rc.pct - ex.pct >= EXPRESSION_GAP_MIN) out.push(g.tag);
  }
  return out;
}

function achievementRule(toolId: ToolId): ToolRule {
  const spec = TOOL_SPECS[toolId];
  const bank = TOOLKIT[toolId];
  const bandFor: ToolRule['bandFor'] = (r, dimension) => bandFromFeeds(r, dimension);

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    bandFor,
    // 順序：面向級（照題庫面向順序）→ 逐題（gm 球類、asq 個人社會）→ 衍生（表達弱於理解）
    // → severe。同一個標籤只出一次（gm 的 P1／P2／P3 都對 `mot.postural`）。
    tags: r => dedupe([
      ...sectionLevelTags(r),
      ...triggeredItemRules(r, ACHIEVEMENT_ITEM_TRIGGER).flatMap(rule => rule.tags),
      ...expressionGapTags(r),
      ...severityTags(r),
    ]),
    caveats: r => {
      const out: Caveat[] = baseCaveats(r);
      if (HEARING_CHECK_ON_REFER.includes(toolId) && spec.feeds.some(f => bandFor(r, f.dimension) === 'refer')) {
        out.push('hearing_check_first');
      }
      return out;
    },
    source: `${bank.source.file} LEVELS（紙本「六、分數解讀」）`,
  };
}

/** 六張表，key 是 toolId。 */
export const ACHIEVEMENT_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  ACHIEVEMENT_TOOL_IDS.map(id => [id, achievementRule(id)]),
);

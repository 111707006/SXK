/**
 * 規則表的登錄：工具 → `ToolRule`（規格 §5.9）。
 *
 * 一支工具一張表，五張票分五族加進來：達成率族六支（#47）、asb／asr（#48）、
 * ab／att／spa／spb（#49）、dev／adl／ldp／lds（#50）、四支公開工具與氣質（#51）。
 * #52 的維度彙整只認這張表，不自己判。
 *
 * #51 之後 22 支都有了。沒登錄的工具問 `ruleFor()` 仍會**丟錯**，不回 null：一支沒有規則
 * 的工具在彙整裡等於「做了、沒事」，而那正是 §5.7 說「塌成同一個值就是沒做完被讀成沒事」
 * 的那種錯。要軟性查有沒有，讀 `TOOL_RULES[id]`。
 */

import type { ToolId } from '../toolkit';
import type { ToolRule } from '../types';
import { ACHIEVEMENT_RULES } from './achievement';
import { ASD_RULES } from './asd';
import { ATTENTION_SENSORY_RULES } from './attentionSensory';
import { DEV_ADL_LEARNING_RULES } from './devAdlLearning';
import { PUBLIC_TOOL_RULES } from './publicTools';
import { TEMPERAMENT_RULES } from './temperament';

export { bandOfTier, BAND_OF_TIER, severeFor } from './shared';

export const TOOL_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = {
  ...ACHIEVEMENT_RULES,
  ...ASD_RULES,
  ...ATTENTION_SENSORY_RULES,
  ...DEV_ADL_LEARNING_RULES,
  ...PUBLIC_TOOL_RULES,
  ...TEMPERAMENT_RULES,
};

export function ruleFor(toolId: ToolId): ToolRule {
  const rule = TOOL_RULES[toolId];
  if (!rule) throw new Error(`規則表：${toolId} 還沒有規則（§5.9）`);
  return rule;
}

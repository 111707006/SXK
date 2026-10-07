/**
 * 完整版題庫的維度判定（T2 v3 題庫規格 §5.1）。純函式：吃 T1 標記、這一次推了哪些量表、做完的結果，吐九個維度各一筆。
 *
 * 規則（照規格逐條，測試一條一個）：
 * 0. 這個月齡段不篩（學習 0–36、注意力 0–11，`routing.ts` 的 `NOT_SCREENED`）→ `not_screened`。
 * 1. 這一維**沒有一筆有 0–3 的結果**：
 *    - 推了主維度含這一維的量表 → T1 紅 `partial`、黃 `not_assessed`、綠 `clear`（照舊三種）；
 *    - 一支都沒推、T1 紅或黃 → `no_tool`（客規的「缺口」）；T1 綠 → `clear`。
 * 2. 有 → 這一維所有結果的 0–3 取最重（R-12 暫採），0 `clear`、1–2 `watch`、3 `refer`。
 *    沒推、但家長做過的（呼叫端給的「近 3 個月內」）也算 —— 多看一份不會讓判定變輕。
 *
 * 「有 0–3 的結果」看的是那一筆的 `score.grade03` 有沒有這一維：EMO 资料不足、ASR 不适用太多、QOL、氣質都沒有，
 * 不算數（做了但沒判定，跟沒做一樣不能說成沒事）。
 * 「推了哪些」由呼叫端從報告快照給（§5.1 末段），這裡不重算推薦。
 */

import { RECOMMEND_CONFIG } from './recommend/config';
import { notScreened } from './routing';
import type { Grade03 } from './kitv3/score';
import type { ToolResultV3 } from './kitv3/submit';
import { DIMENSION_CODES } from './types';
import type { DimensionBand, DimensionCode, T1Flag } from './types';

export interface DimensionFindingV3 {
  dimensionId: DimensionCode;
  band: DimensionBand;
  /** 取最重的那一份的 0–3；沒有判定（第 0、1 條）是 `null`。 */
  grade03: Grade03 | null;
  /** 哪一支把它推到這裡；同分取先交的。沒有判定時 `null`。 */
  drivenBy: string | null;
  /** 這一維有 0–3 的那幾支，依交卷順序。 */
  tools: string[];
  t1Flag: T1Flag;
}

export interface JudgeV3Input {
  /** 測評月齡（判「不篩」用）。 */
  ageMonth: number;
  t1: Record<DimensionCode, T1Flag>;
  /** 這一次推薦引擎推的量表（客規代碼）。 */
  recommended: ReadonlyArray<string>;
  /** 要算進來的結果（每支最新一筆、近 3 個月內），依交卷順序。 */
  results: ReadonlyArray<ToolResultV3>;
}

const bandOf = (g: Grade03): DimensionBand => (g === 0 ? 'clear' : g === 3 ? 'refer' : 'watch');

export function judgeDimensionV3(dim: DimensionCode, input: JudgeV3Input): DimensionFindingV3 {
  const t1Flag = input.t1[dim];
  const base = { dimensionId: dim, t1Flag };
  if (notScreened(dim, input.ageMonth)) return { ...base, band: 'not_screened', grade03: null, drivenBy: null, tools: [] };

  const graded = input.results.filter(r => r.score.grade03[dim] !== undefined);
  if (graded.length === 0) {
    const recommended = input.recommended.some(code => RECOMMEND_CONFIG.tools[code]?.primary.includes(dim));
    const band: DimensionBand = recommended
      ? t1Flag === 2 ? 'partial' : t1Flag === 1 ? 'not_assessed' : 'clear'
      : t1Flag === 0 ? 'clear' : 'no_tool';
    return { ...base, band, grade03: null, drivenBy: null, tools: [] };
  }

  let worst = graded[0];
  for (const r of graded) if (r.score.grade03[dim]! > worst.score.grade03[dim]!) worst = r;
  const grade03 = worst.score.grade03[dim]!;
  return { ...base, band: bandOf(grade03), grade03, drivenBy: worst.toolId, tools: graded.map(r => r.toolId) };
}

/** 九個維度各一筆，順序照 `DIMENSION_CODES`。 */
export function judgeDimensionsV3(input: JudgeV3Input): DimensionFindingV3[] {
  return DIMENSION_CODES.map(d => judgeDimensionV3(d, input));
}

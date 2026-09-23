/**
 * CONSEQ／PLAN 的取句規則（規格 v2.1 §6.3，S09；客戶 9/21 工作單 #10）。純函式，沒有 I/O、沒有 React。
 *
 * 【這一層做什麼】
 * 報告上每個留意／關注的維度多兩段：「若持续不处理，一般会怎样」（工具包的 `CONSEQ`）與
 * 「建议后续项目」（`PLAN`）。兩段都是**規則輸出、不經 AI**：句子原樣取自題庫的
 * `ToolkitBank.advice`，這裡只決定取哪幾句、什麼順序。段名與段首那一句在 `reportCopy.ts`。
 *
 * 【現在是空的】
 * 22 份題庫都沒有 `advice`（內容等新工具包、過得了禁字掃描才抽，S23），所以正式路徑上
 * `dimensionAdvice` 恆回 `null`，報告上兩段不出現。規則先寫好、用假資料測（`test/t2Advice.test.ts`），
 * 內容到了不必再動這一檔。
 *
 * 【取法】（§6.3，照工具包自己的報告那一段）
 * 1. 對象：判定是留意或關注的維度；取推出判定的那一支（`drivenBy`），只看它**餵這個維度的面向**
 *    （`sectionsFor`；`'overall'`＝全部面向）。只算 `scored` 的面向 —— 不單獨判讀的面向不出標籤，
 *    也不出後果句。
 * 2. 「若持续不处理」：每個 tier ≥ 2 的面向一句，`consequences[面向][tier − 2]`，照**題庫的面向順序**。
 * 3. 「建议后续项目」：tier ≥ 2 的面向裡最差的兩個 —— tier 高者先；同 tier 依百分比往壞的方向
 *    （`HIGHER_IS_WORSE`）；再同就照面向順序。第一個是主要方向、第二個是次要方向。
 * 4. `drivenBy` 沒有 `advice`（CHEXI、SNAP-IV、M-CHAT、WARN、氣質）→ 兩段都不出。
 * 5. 從快照算（與 SMART 目標同一個安排），不改 `T2Findings` 的形狀 —— 舊快照照樣讀得出來。
 *
 * 面向順序讀題庫，不讀 `ToolResult.sections` 的鍵：快照存在 MySQL 的 JSON 欄位，讀回來時物件鍵
 * 已經被資料庫重排過了。
 *
 * ⚠️ 第 2 條與工具包不同：工具包的後果段跟 PLAN 一樣**依嚴重度排**（最差的面向先），規格 v2.1 寫
 * 「照面向順序」。這裡照規格；兩者哪個對，等內容上線前跟客戶確認（改的話只動 `consequences` 那個迴圈）。
 */

import { TOOLKIT } from './toolkit';
import type { ToolId, ToolkitAdvice } from './toolkit';
import { TOOL_SPECS, sectionsFor } from './toolSpecs';
import type { DimensionCode, ScoringFamily, T2Findings, Tier } from './types';

/** 一支工具的 CONSEQ／PLAN 從哪裡來。正式路徑是題庫；測試換成假資料。 */
export type AdviceSource = (toolId: ToolId) => ToolkitAdvice | undefined;

/** 正式資料：題庫的 `advice`（現在 22 份都沒有）。 */
export const toolkitAdvice: AdviceSource = id => TOOLKIT[id].advice;

/** 「若持续不处理」的一句，附它講的是哪個面向（題庫原文的面向名稱）。 */
export interface ConsequenceLine {
  sectionKey: string;
  sectionName: string;
  text: string;
}

/** 主要方向／次要方向。家長端的字在 `reportCopy.ts` 的 `ADVICE_RANK_LABEL`。 */
export type AdviceRank = 'primary' | 'secondary';

/** 「建议后续项目」的一項。 */
export interface PlanLine {
  rank: AdviceRank;
  sectionKey: string;
  sectionName: string;
  title: string;
  focus: string[];
}

export interface DimensionAdvice {
  dimensionId: DimensionCode;
  /** 取句的那一支＝`DimensionFinding.drivenBy`。 */
  toolId: ToolId;
  /** 可能是空的（例如這一支只有 PLAN 沒有 CONSEQ）；畫面上空的那一段整段不出。 */
  consequences: ConsequenceLine[];
  plans: PlanLine[];
}

interface Cell {
  key: string;
  name: string;
  tier: Tier;
  pct: number | null;
}

const RANKS: ReadonlyArray<AdviceRank> = ['primary', 'secondary'];

/**
 * 同 tier 時百分比往哪邊算較差（§6.3 第 3 條）：達成率、通過率、獨立率越低越差；
 * 關切率、總分（ldp／lds 的各方面）越高越差。其餘幾族沒有可比的百分比，同 tier 照面向順序
 * —— 反正它們在工具包裡也沒有 CONSEQ／PLAN。
 */
const HIGHER_IS_WORSE: Readonly<Partial<Record<ScoringFamily, boolean>>> = {
  achievement: false,
  pass: false,
  independence: false,
  concern: true,
  total: true,
};

/**
 * 一個維度的兩段（檔頭「取法」）。沒有可出的句子一律回 `null` —— 不是留意／關注、沒有
 * `drivenBy`、那一支沒有 `advice`、快照裡找不到那一支、那一支不餵這個維度、或沒有一個面向
 * 到 tier 2（例如 asb 勾了能力倒退而直接判關注）。呼叫端只要看 `null` 就知道兩段都不出。
 */
export function dimensionAdvice(
  findings: T2Findings,
  dimensionId: DimensionCode,
  source: AdviceSource = toolkitAdvice,
): DimensionAdvice | null {
  const dimension = findings.dimensions.find(d => d.dimensionId === dimensionId);
  if (!dimension || dimension.drivenBy === null) return null;
  if (dimension.band !== 'watch' && dimension.band !== 'refer') return null;
  const toolId = dimension.drivenBy;
  const advice = source(toolId);
  const result = findings.toolResults.find(r => r.toolId === toolId);
  const sections = sectionsFor(toolId, dimensionId);
  if (!advice || !result || sections === null) return null;

  // dev 的面向 key 在六個年齡段裡重複出現，去重後才是「面向順序」。
  const bankSections = TOOLKIT[toolId].sections;
  const order = [...new Set(bankSections.map(s => s.key))];
  const keys = sections === 'overall' ? order : order.filter(k => sections.includes(k));
  const cells: Cell[] = [];
  for (const key of keys) {
    const stat = result.sections[key];
    if (!stat || !stat.scored || stat.tier === null || stat.tier < 2) continue;
    cells.push({ key, name: bankSections.find(s => s.key === key)?.name ?? '', tier: stat.tier, pct: stat.pct });
  }

  const consequences: ConsequenceLine[] = [];
  for (const cell of cells) {
    const text = advice.consequences[cell.key]?.[cell.tier - 2];
    if (text) consequences.push({ sectionKey: cell.key, sectionName: cell.name, text });
  }

  // 先取最差的兩格、再拿掉缺 PLAN 的：最差那一格缺了，剩下那一格仍是「次要方向」，不升格
  // （工具包的寫法：`slice(0,2)` 之後才看 `PLAN[key]`）。內容齊不齊是抽取那一票（S23）的事。
  const higherIsWorse = HIGHER_IS_WORSE[TOOL_SPECS[toolId].family];
  const worst = [...cells].sort((a, b) => worseFirst(a, b, higherIsWorse)).slice(0, RANKS.length);
  const plans: PlanLine[] = [];
  worst.forEach((cell, i) => {
    const plan = advice.plans[cell.key];
    if (plan) plans.push({ rank: RANKS[i], sectionKey: cell.key, sectionName: cell.name, title: plan.title, focus: [...plan.focus] });
  });

  if (consequences.length === 0 && plans.length === 0) return null;
  return { dimensionId, toolId, consequences, plans };
}

/**
 * 排序鍵：tier 高者先 → 同 tier 百分比較差者先 → 其餘不動（`sort` 是穩定的，＝面向順序）。
 * 百分比算不出來的排在算得出來的後面：說不出多差，就不搶主要方向。不能讓 `null` 對誰都回 0 ——
 * 那樣比較不可遞移，`sort` 的結果會跟著輸入順序亂跳。
 */
function worseFirst(a: Cell, b: Cell, higherIsWorse: boolean | undefined): number {
  if (a.tier !== b.tier) return b.tier - a.tier;
  if (higherIsWorse === undefined) return 0;
  if (a.pct === null || b.pct === null) return (a.pct === null ? 1 : 0) - (b.pct === null ? 1 : 0);
  return higherIsWorse ? b.pct - a.pct : a.pct - b.pct;
}

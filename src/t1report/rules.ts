/**
 * 新版 T1 報告的用字規則與字數（`report.ts` 的驗證器與 `prompt.ts` 的提示共用同一份，不各抄一次）。
 *
 * 【擋什麼】（使用者 2026-10-08 選 a：「數字與預測可以寫」）
 * 1. 只擋《家长报告用语对照表》禁字（`findBannedWords`）。百分比、週數、量表名、腦神經的說法都不擋了
 *    —— 這一天稍早還擋 T2 黑名單（量表名／診斷名／儀器療程藥物）、百分位／常模／％／預測、腦神經術語，
 *    使用者決定放寬。
 * 2. 但**預測與用數字說的結果**要接一句免責：同一個欄位（一段、一條）裡出現預測訊號
 *    （`PREDICTION_PATTERNS`：數字＋週／個月／％、「预计／可望／有望／回到／回归」……）就要有
 *    `PREDICTION_DISCLAIMER`，沒有就擋（→ 整份退模板）。提示叫模型照抄 `PREDICTION_DISCLAIMER_TEXT`（帶全形括號）。
 *    模板本身不寫預測。
 * 題目原文照舊先挖掉再掃（題目是客戶的量表原文，引用它是在講「這一題」）。
 */

import { findBannedWords } from '../utils/parentWording';

/** 字數（去空白的碼位數，同 T2 的 `charCount`）與條數。**暫採**：T1 報告沒有規格定字數，取擋得住空字串與整份塞一欄的寬界。 */
export const T1_REPORT_LIMITS = {
  summary: { min: 30, max: 240 },
  note: { min: 20, max: 200 },
  listItem: { min: 10, max: 150 },
  nextSteps: { min: 30, max: 240 },
  rehabCount: { min: 3, max: 4 },
  homeCount: { min: 3, max: 4 },
} as const;

/** 預測要接的那一句（驗證器只認這幾個字，括號有沒有都算）。 */
export const PREDICTION_DISCLAIMER = '一般经验，每个孩子进度不同';
/** 提示叫模型照抄的樣子。 */
export const PREDICTION_DISCLAIMER_TEXT = `（${PREDICTION_DISCLAIMER}）`;

/**
 * 預測訊號。**暫採**，寧鬆勿漏、但不誤傷排程與頻率：
 * - 阿拉伯數字＋週／星期／個月（「8 周后」「3-6 个月内」）；**後面接「后再做／再筛／再测／再评」的不算** ——
 *   那是約下一次篩查，不是預測。中文數字（「三个月后再做一次筛查」「一周三次」）不算，太常是排程與頻率；
 * - 數字＋％／%、「百分之」；
 * - 預測的字眼：预计、可望、有望、回归、追上、赶上、可以／能／会回到、回到…范围。
 */
export const PREDICTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\d+(?:\s*[-–~～至到]\s*\d+)?\s*(?:周|星期|个月)(?!\s*(?:后|以后|之后)?\s*再\s*(?:做|筛|测|评))/,
  /\d+(?:\.\d+)?\s*[%％]/,
  /百分之/,
  /预计|可望|有望|回归|追上|赶上|(?:可以|能|会)回到|回到[^。；，]{0,12}范围/,
];

/** `text` 裡第一個預測訊號（附前後文），沒有回 null。 */
export function findPredictionSignal(text: string): string | null {
  for (const re of PREDICTION_PATTERNS) {
    const m = re.exec(text);
    if (m) return `「${m[0]}」 …${text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12).replace(/\s+/g, ' ')}…`;
  }
  return null;
}

/** `text` 裡違規的地方：禁字（附前後文）、有預測卻沒有免責那一句。題目原文先挖掉。 */
export function findT1ReportViolations(text: string, questionTexts: ReadonlyArray<string> = []): string[] {
  let scrubbed = text;
  for (const q of questionTexts) scrubbed = scrubbed.split(q).join('');
  const hits = findBannedWords(scrubbed);
  const prediction = findPredictionSignal(scrubbed);
  if (prediction && !scrubbed.includes(PREDICTION_DISCLAIMER)) hits.push(`预测没有接「${PREDICTION_DISCLAIMER}」：${prediction}`);
  return hits;
}

/**
 * 十個計分族的原生計分（規格 §5.2）。
 *
 * 【每個函式都是同一個形狀】
 * 一串答案（與題同序）進去，一組數字出來。不知道自己屬於哪支工具、不看月齡、
 * 不碰前置題、不判 band、不出標籤 —— 那些是 `./index.ts` 與 #47 規則表的事。
 * 這樣寫的好處是測試可以餵任意長度的題組：`test/t2Scoring.test.ts` 的四捨五入
 * 那一條需要 100 題的面向，而 22 支工具裡最長的面向只有 18 題。
 *
 * 【面向與總分用同一個函式】
 * 「總分」在規格裡一律是「全部適用題同法」（§5.2 每一列的右欄），不是各面向
 * 分數的平均。所以總分就是把所有適用題串成一個大面向再算一次，沒有第二套算法。
 * 三族例外（snap、chexi、氣質）在規格裡總分那一格是「—」，由 `overall` 欄標示。
 *
 * 【四捨五入】
 * 百分比一律 `Math.round(x × 100)`，**先四捨五入再比門檻**（§5.2）。JS 的
 * `Math.round` 是 .5 進位（`Math.round(84.5) === 85`），與工具包 HTML 裡的
 * `Math.round` 同一個函式，所以不需要另寫一個「銀行家捨入」之類的東西。
 */

import type { ToolkitItem } from '../toolkit';
import type { ScoringFamily } from '../types';

/** §3.1 的作答值域：數字題是數字，dev 是 `'pass'|'fail'|'skip'`，mchat 是 `'yes'|'no'`。 */
export type AnswerValue = number | string;

/**
 * 一個面向（或總分）算完的原始數字，還沒配上 tier 與 `scored`。
 *
 * `tierValue` 是**拿去比分段表的那個數**，刻意與 `pct` 分開：ldp／lds 的分段比的是
 * 原始總分不是百分比、snap 比的是均分、mchat 比的是題數。把它們都塞進 `pct` 會讓
 * 「pct 是百分比」這件事變成謊話，分開則讓 `./index.ts` 不必知道任何一族的細節。
 */
export interface RawStat {
  n: number;
  raw: number;
  max: number;
  /** 這一族定義得出百分比時才有值；`n` 為 0 一律 `null`（0 分之 0 不是 0%）。 */
  pct: number | null;
  tierValue: number | null;
  /** 族專屬欄位。鍵在 `./index.ts` 加上面向前綴後寫進 `ToolResult.native`。 */
  native?: Record<string, number | number[]>;
}

export interface FamilyScorer {
  /**
   * 總分那一格怎麼處理。
   * - `'scored'`：與面向同法，有 pct、有 tier、有族專屬欄位。
   * - `'counts-only'`：只留 `n`／`raw`／`max`，pct 與 tier 都是 `null`。
   *   snap、chexi、氣質三族在 §5.2 的總分欄是「—」—— 跨分量表的均分沒有意義
   *   （把注意力不足與對立違抗平均起來不代表任何東西），所以不算。
   */
  overall: 'scored' | 'counts-only';
  section(values: ReadonlyArray<AnswerValue>, items: ReadonlyArray<ToolkitItem>): RawStat;
}

const EMPTY: RawStat = { n: 0, raw: 0, max: 0, pct: null, tierValue: null };

function sum(values: ReadonlyArray<AnswerValue>): number {
  let total = 0;
  for (const v of values) if (typeof v === 'number') total += v;
  return total;
}

function countAtLeast(values: ReadonlyArray<AnswerValue>, floor: number): number {
  let n = 0;
  for (const v of values) if (typeof v === 'number' && v >= floor) n += 1;
  return n;
}

/** 保留兩位。snap 的均分與 chexi 的副量表均分用（§5.2）。 */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function pctOf(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

/** 達成率：gm、soc、lang、adp、voc、asq。每題 0／1／2，滿分 `n×2`。 */
function achievement(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const max = n * 2;
  const pct = pctOf(raw, max);
  return { n, raw, max, pct, tierValue: pct };
}

/**
 * 通過率：dev。
 *
 * **`n` 是分母，不是出的題數。**「不評」合法地不進分母（§5.1）：五題答「通過 4、
 * 不評 1」時分母是 4、pct 是 100，不是 80。分母為 0（整個領域都「不評」）時
 * `pct = null`、`tier = null`，而 `n = 0 < minItems` 會讓 `scored` 也是 false ——
 * 三層都說同一件事：這個領域這次沒有資料，不要判讀，也不要當成零分。
 */
function pass(values: ReadonlyArray<AnswerValue>): RawStat {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const v of values) {
    if (v === 'pass') passed += 1;
    else if (v === 'fail') failed += 1;
    else if (v === 'skip') skipped += 1;
  }
  const n = passed + failed;
  const pct = pctOf(passed, n);
  return { n, raw: passed, max: n, pct, tierValue: pct, native: { skipped } };
}

/**
 * 獨立率：adl。七級協助類型 1–7，`pct = round((raw − n) ÷ (n×6) × 100)`。
 *
 * 減掉 `n` 是因為最低分是 1 不是 0 —— 全部「完全由大人做」應該是 0%，不是 14%。
 */
function independence(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const pct = pctOf(raw - n, n * 6);
  return { n, raw, max: n * 7, pct, tierValue: pct };
}

/**
 * 關切率：asb、asr、ab、att、spa、spb。每題 0–3，滿分 `n×3`。分數越高越要留意。
 *
 * `hi`（答 ≥2 的題數）是逐題標籤的門檻（§5.9「逐題（答 ≥2）」），在這裡先數起來，
 * #47 就不必把答案再掃一次。
 */
function concern(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const max = n * 3;
  const pct = pctOf(raw, max);
  return { n, raw, max, pct, tierValue: pct, native: { hi: countAtLeast(values, 2) } };
}

/**
 * 總分：ldp、lds。各方面 0–18、總分 0–90。
 *
 * ⚠️ **分段比的是 `raw`，不是 `pct`。** 總分 30 是 tier 4，而 30／90 = 33%；把
 * 33 拿去比 10／20／30 那張表會得到 tier 4 —— 剛好對，然後在別的分數上默默錯掉。
 * `pct` 仍然算出來是因為報告的雷達圖要一個 0–100 的數（#33），不是給判級用的。
 */
function total(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const max = n * 3;
  return { n, raw, max, pct: pctOf(raw, max), tierValue: raw };
}

/** SNAP-IV：各分量表均分 `ari` 0–3（保留兩位）、`sx` 為症狀計數（答 ≥2 的題數）。 */
function meanSnap(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const ari = round2(raw / n);
  return { n, raw, max: n * 3, pct: null, tierValue: ari, native: { ari, sx: countAtLeast(values, 2) } };
}

/**
 * CHEXI：各副量表均分 1–5（保留兩位）。
 *
 * 副量表本身**不判級** —— 紙本寫明「本檔不套用任何自造切分值」，所以 `tierValue`
 * 是 `null`。會判級的是兩個因素（F1＝工作記憶＋計劃力、F2＝抑制力＋調節力），
 * 那是跨副量表的合併，由 `./index.ts` 依 `CHEXI_FACTORS` 另外算。
 */
function meanChexi(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  return { n, raw, max: n * 5, pct: null, tierValue: null, native: { mean: round2(raw / n) } };
}

/**
 * M-CHAT-R/F：風險題數。
 *
 * 哪個答案算風險是**逐題**的（題 2、5、12 答「是」算風險，其餘答「否」算風險），
 * 讀題庫自己的 `riskAnswer`，不在這裡再抄一次那三個題號。
 */
function risk(values: ReadonlyArray<AnswerValue>, items: ReadonlyArray<ToolkitItem>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const riskItems: number[] = [];
  items.forEach((item, i) => {
    if (item.riskAnswer !== undefined && values[i] === item.riskAnswer) riskItems.push(item.no);
  });
  const count = riskItems.length;
  return { n, raw: count, max: n, pct: null, tierValue: count, native: { risk: count, riskItems } };
}

/**
 * 預警徵象：陽性數。`positives` 是**該時點內的第幾條**（1 起），因為 §5.9 的維度
 * 對應是按位置給的（第 1 條→LANG、第 2 條→SOC、第 3、4 條→MOT）。
 */
function positive(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const positives: number[] = [];
  values.forEach((v, i) => {
    if (v === 1) positives.push(i + 1);
  });
  const count = positives.length;
  return { n, raw: count, max: n, pct: null, tierValue: count, native: { count, positives } };
}

/**
 * 氣質：各向度均分 0–5、`dev = mean − 2.5`，判級比的是 `|dev|`。
 *
 * `mean` 與 `dev` 都**不四捨五入**：八題的總分是整數，除以 8 在二進位浮點數裡是
 * 精確的（k/8），減 2.5 也是精確的，所以 `|dev| = 1.0` 真的會等於 1.0，不會變成
 * 0.9999999。這裡多做一次 round 只會把已經精確的數字弄糊。
 */
function profile(values: ReadonlyArray<AnswerValue>): RawStat {
  const n = values.length;
  if (n === 0) return EMPTY;
  const raw = sum(values);
  const mean = raw / n;
  const dev = mean - 2.5;
  return { n, raw, max: n * 5, pct: null, tierValue: Math.abs(dev), native: { mean, dev } };
}

export const FAMILIES: Readonly<Record<ScoringFamily, FamilyScorer>> = {
  achievement: { overall: 'scored', section: achievement },
  pass: { overall: 'scored', section: pass },
  independence: { overall: 'scored', section: independence },
  concern: { overall: 'scored', section: concern },
  total: { overall: 'scored', section: total },
  'mean-snap': { overall: 'counts-only', section: meanSnap },
  'mean-chexi': { overall: 'counts-only', section: meanChexi },
  risk: { overall: 'scored', section: risk },
  positive: { overall: 'scored', section: positive },
  profile: { overall: 'counts-only', section: profile },
};

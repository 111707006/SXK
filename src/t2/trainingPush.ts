/**
 * 線上干預的推送規則（T2 v3 規格 `docs/specs/t2-v3-training-push-2026-10-06.md`，客戶 2026-10-06《推送规则说明书》）。
 *
 * 【這一層做什麼】
 * 純函式，沒有 I/O、沒有時鐘、沒有隨機：同輸入兩次結果相同。一期（12 週）開始時由伺服器呼叫一次，
 * 整份存進 `t2_training_periods`，之後不再重算（規格 §3）。
 *
 * 【五道關卡】（客戶原文「先决定顺序，再决定练几岁的，最后才决定给哪几个活动」）
 * 1. 顏色：T2 判定 → 紅／橙／綠；沒做量表的維度用 T1 推定（§4.1）。
 * 2. 順序：同色時照 `PUSH_ORDER`（只用在活動；報告與入口的順序不動）。
 * 3. 月齡窗：實足月齡＋`OFFSET[顏色][年齡段]`，一期三個月各取窗口的三分之一（§4.2）。
 * 4. 能力 → 模組：`DIM_MOD`（與 v2 相同，沿用）。
 * 5. 編號：窗口內依編號由小到大（§4.5）。
 *
 * 不看 `targetMonth`、`targets`、`avoidIf`、`dimensions`（§7：欄位留著，配對不讀）。
 */

import type { Band, DimensionCode, DimensionFinding, T1Flag } from './types';

// ══════════════════════════════════════════════
// 第一、二關：顏色與順序
// ══════════════════════════════════════════════

export type PushColor = 'red' | 'orange' | 'green';
/** 顏色從哪裡來：做過量表的「T2 分级」、沒做的「T1 推定」（客戶原文，卡片上要分開標）。 */
export type ColorSource = 't2' | 't1';

/** 客戶第二關的固定順序：语言 → 动作 → 认知 → 注意力 → 感觉处理 → 学习 → 社交 → 情绪 → 日常生活。 */
export const PUSH_ORDER: ReadonlyArray<DimensionCode> = ['LANG', 'MOT', 'COG', 'ATT', 'SEN', 'LEARN', 'SOC', 'EMO', 'ADL'];

/** 紅 3、橙 2、綠 1（客戶第六節的權重；也是排序時「重的先」的依據）。 */
export const COLOR_WEIGHT: Readonly<Record<PushColor, number>> = { red: 3, orange: 2, green: 1 };

/** 顏色 → 月齡偏移表的哪一列（`OFFSET` 的鍵沿用 v2 的 band 名）。 */
export const BAND_OF_COLOR: Readonly<Record<PushColor, Band>> = { red: 'refer', orange: 'watch', green: 'clear' };

/** T2 判定 → 顏色。客戶「0 分正常／1–2 分轻中度／3 分重度」對到我們的三級。 */
const COLOR_OF_BAND: Readonly<Record<Band, PushColor>> = { refer: 'red', watch: 'orange', clear: 'green' };

/**
 * T1 推定（客戶原文「88 分以上算绿、56 到 87 算橙、56 以下算红」）。得分率 ＝ 分數 ÷ 8 × 100：
 * 8 分 100 → 綠；7 分 87.5、6 分 75、5 分 62.5 → 橙；4 分 50 以下 → 紅。7 分落在原文「87」與「88」之間，取橙。
 *
 * ⚠️ 與 A 的 T1 報告三級（≤5 遲緩）、量表推薦規格書的等級（7 未見明顯）都不一樣 —— 三種讀法各管各的（規格 §4.1）。
 */
export function colorFromT1Score(score: number): PushColor {
  if (!Number.isInteger(score) || score < 0 || score > 8) throw new Error(`trainingPush：T1 分數要是 0–8 的整數，拿到 ${score}`);
  const rate = (score / 8) * 100;
  if (rate >= 88) return 'green';
  if (rate >= 56) return 'orange';
  return 'red';
}

/** 快照裡只有 T1 標記、沒有分數時（舊資料）的退路：紅 2、黃 1、綠 0。 */
const COLOR_OF_T1_FLAG: Readonly<Record<T1Flag, PushColor>> = { 2: 'red', 1: 'orange', 0: 'green' };

export interface DimensionColor {
  dimension: DimensionCode;
  color: PushColor;
  source: ColorSource;
}

/**
 * 九個維度的顏色。`not_screened`（這個月齡段 T2 不評）不在回傳裡 —— 不參加任何分配。
 * `t1Scores` 缺某一維時退回那一維的 T1 標記（`DimensionFinding.t1Flag`）。
 */
export function dimensionColors(
  dimensions: ReadonlyArray<Pick<DimensionFinding, 'dimensionId' | 'band' | 't1Flag'>>,
  t1Scores: Partial<Record<DimensionCode, number>> = {},
): DimensionColor[] {
  const out: DimensionColor[] = [];
  for (const d of dimensions) {
    if (d.band === 'not_screened') continue;
    if (d.band === 'clear' || d.band === 'watch' || d.band === 'refer') {
      out.push({ dimension: d.dimensionId, color: COLOR_OF_BAND[d.band], source: 't2' });
      continue;
    }
    const score = t1Scores[d.dimensionId];
    out.push({
      dimension: d.dimensionId,
      color: score === undefined ? COLOR_OF_T1_FLAG[d.t1Flag] : colorFromT1Score(score),
      source: 't1',
    });
  }
  return out;
}

/** 期末調整「移一檔」（規格 §5.2）：好 → 往輕（紅→橙→綠，綠留綠）；困難 → 往重（綠→橙→紅，紅留紅）。 */
export function shiftColor(color: PushColor, direction: 'lighter' | 'heavier'): PushColor {
  const ladder: PushColor[] = ['red', 'orange', 'green'];
  const i = ladder.indexOf(color) + (direction === 'lighter' ? 1 : -1);
  return ladder[Math.min(ladder.length - 1, Math.max(0, i))];
}

/** 排序：顏色重的先、同色照 `PUSH_ORDER`（客戶「颜色永远大过顺序」）。回傳新陣列。 */
export function sortByPush<T extends { dimension: DimensionCode; color: PushColor }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort(
    (a, b) => COLOR_WEIGHT[b.color] - COLOR_WEIGHT[a.color] || PUSH_ORDER.indexOf(a.dimension) - PUSH_ORDER.indexOf(b.dimension),
  );
}

/** 一個紅橙都沒有時取順序前幾名「維持」（客戶第六節：前三名，语言、动作、认知）。 */
export const MAINTAIN_DIMENSIONS = 3;

/**
 * 參加分配的能力（客戶第六節），已照 `sortByPush` 排好：所有紅、橙；一個都沒有 → `PUSH_ORDER` 裡前三個
 * （不篩的不算，它們不在 `colors` 裡），當綠。
 */
export function participants(colors: ReadonlyArray<DimensionColor>): DimensionColor[] {
  const flagged = colors.filter(c => c.color !== 'green');
  if (flagged.length > 0) return sortByPush(flagged);
  const byOrder = [...colors].sort((a, b) => PUSH_ORDER.indexOf(a.dimension) - PUSH_ORDER.indexOf(b.dimension));
  return byOrder.slice(0, MAINTAIN_DIMENSIONS);
}

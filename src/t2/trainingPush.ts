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

/** 名額湊不滿時依序補進來的能力：`PUSH_ORDER` 裡還沒參加的（不篩的不在 `colors` 裡，不會被補進來）。 */
export function reserveOf(colors: ReadonlyArray<DimensionColor>, taken: ReadonlyArray<DimensionColor>): DimensionColor[] {
  const used = new Set(taken.map(t => t.dimension));
  return [...colors]
    .filter(c => !used.has(c.dimension))
    .sort((a, b) => PUSH_ORDER.indexOf(a.dimension) - PUSH_ORDER.indexOf(b.dimension));
}

// ══════════════════════════════════════════════
// 名額與交錯（客戶第六節）
// ══════════════════════════════════════════════

/** 一般每月 12 支（每週 3）；期末「困難」那一檔每月 8 支（每週 2，規格 §5.2）。 */
export const MONTHLY_QUOTA = 12;
export const MONTHLY_QUOTA_HARD = 8;
/** 一個月 4 週、一期 3 個月。 */
export const WEEKS_PER_MONTH = 4;
export const MONTHS_PER_PERIOD = 3;

export interface Quota extends DimensionColor {
  /** 每月幾支。 */
  count: number;
}

const roundHalfUp = (x: number) => Math.floor(x + 0.5 + 1e-9);

/**
 * 每個能力每月幾支（規格 §4.3）。`ranked` 已照 `sortByPush` 排好（`participants` 的回傳）；`reserve` 是名額
 * 湊不滿時依序補進來的能力（`reserveOf`；補進來一律當綠、權重 1 —— 暫採，待問表 P-2）。
 *
 * 1. `exact = Q × 權重 ÷ Σ權重`，四捨五入（.5 進位）。
 * 2. 夾到 [1, Q/2]（客戶「至少 1 个」「最多 6 个，也就是一半」）。
 * 3. 一支一支校正到剛好 Q：太多從「多拿最多的」減（同值減順序後面的）；太少給「少拿最多的」加（同值給順序前面的），
 *    只加給 `exact` 比現在多的 —— 上限擋下來的名額不轉給輕的能力（不然綠色會拿得跟紅色一樣多）。
 * 4. 上限擋住、加不滿 → 從 `reserve` 補一個能力，重算。
 * 5. 參加的能力比 Q 還多（困難那一檔 Q＝8、九個都紅）→ 保留排在前面的 Q 個（暫採，待問表 P-12）。
 *
 * 回傳照 `ranked` 的順序（補進來的接在後面），每一個 `count ≥ 1`。
 */
export function monthlyQuotas(ranked: ReadonlyArray<DimensionColor>, reserve: ReadonlyArray<DimensionColor>, total: number): Quota[] {
  if (!Number.isInteger(total) || total < 1) throw new Error(`trainingPush：每月名額要是正整數，拿到 ${total}`);
  const cap = Math.max(1, Math.floor(total / 2));
  let members: DimensionColor[] = ranked.slice(0, total);
  const spare: DimensionColor[] = reserve.map(r => ({ ...r, color: 'green' }));

  for (;;) {
    const weights = members.map(m => COLOR_WEIGHT[m.color]);
    const sumW = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map(w => (total * w) / sumW);
    const n = exact.map(x => Math.min(cap, Math.max(1, roundHalfUp(x))));
    let sum = n.reduce((a, b) => a + b, 0);

    while (sum > total) {
      let pick = -1;
      for (let i = 0; i < n.length; i++) {
        if (n[i] <= 1) continue;
        if (pick < 0 || n[i] - exact[i] >= n[pick] - exact[pick] - 1e-9) pick = i; // 同值取後面的
      }
      if (pick < 0) break;
      n[pick]--;
      sum--;
    }
    while (sum < total) {
      let pick = -1;
      for (let i = 0; i < n.length; i++) {
        // 只給「少拿了」的（exact 比 n 大）：上限擋下來的不轉給別人，改從 reserve 補一個能力（第 4 步）
        if (n[i] >= cap || exact[i] - n[i] <= 1e-9) continue;
        if (pick < 0 || exact[i] - n[i] > exact[pick] - n[pick] + 1e-9) pick = i; // 同值取前面的
      }
      if (pick < 0) break;
      n[pick]++;
      sum++;
    }

    if (sum >= total || spare.length === 0) return members.map((m, i) => ({ ...m, count: n[i] }));
    members = [...members, spare.shift()!];
  }
}

/**
 * 一個月的名額排成一串（客戶「名额排定后交错排列，让同一周尽量涵盖两个以上的能力」）。
 *
 * 用平滑加權輪詢：每一步每個能力的累積值加上自己的名額，取最大的出一支、扣掉總名額；同值取 `quotas` 前面的
 * （重的、順序前的）。名額多的均勻散開，不會擠在月底（一輪一輪發的話 6／3／3 第 4 週會整週都是同一個能力）。
 * 原文例子 4／4／2／2 → 语认注感语认语认注感语认。
 */
export function interleave(quotas: ReadonlyArray<Pick<Quota, 'dimension' | 'count'>>): DimensionCode[] {
  const total = quotas.reduce((a, q) => a + q.count, 0);
  const current = quotas.map(() => 0);
  const out: DimensionCode[] = [];
  for (let step = 0; step < total; step++) {
    let pick = 0;
    quotas.forEach((q, i) => {
      current[i] += q.count;
      if (current[i] > current[pick]) pick = i;
    });
    current[pick] -= total;
    out.push(quotas[pick].dimension);
  }
  return out;
}

/** 一串切成 4 週，每週 `perWeek` 格（每月名額 ÷ 4）。 */
export function splitWeeks<T>(sequence: ReadonlyArray<T>, perWeek: number): T[][] {
  return Array.from({ length: WEEKS_PER_MONTH }, (_, w) => sequence.slice(w * perWeek, (w + 1) * perWeek));
}

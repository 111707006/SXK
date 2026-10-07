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

import { DIM_MOD, OFFSET, ageKeyOf } from './activityMatch';
import { DIMENSION_CODES } from './types';
import type { Activity, Band, DimensionCode, DimensionFinding, ModuleNo, T1Flag } from './types';

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

// ══════════════════════════════════════════════
// 第三關：月齡窗（客戶第三節、第七節）
// ══════════════════════════════════════════════

/** 閉區間，單位月；可以是小數（三等分）。 */
export type MonthRange = [number, number];

/** 整期的窗口：實足月齡＋`OFFSET[顏色][年齡段]`，上下都不低於 0（客戶「最低到 0 个月为止，不会算出负数」）。 */
export function periodWindow(color: PushColor, ageMonth: number): MonthRange {
  const [lo, hi] = OFFSET[BAND_OF_COLOR[color]][ageKeyOf(ageMonth)];
  return [Math.max(0, ageMonth + lo), Math.max(0, ageMonth + hi)];
}

/** 三個月各一段：窗口切三等分，一個月走一份（客戶「24–36 → 24–28、28–32、32–36」）。 */
export function monthWindows([lo, hi]: MonthRange): [MonthRange, MonthRange, MonthRange] {
  const s = (hi - lo) / MONTHS_PER_PERIOD;
  return [
    [lo, lo + s],
    [lo + s, lo + 2 * s],
    [lo + 2 * s, hi],
  ];
}

// ══════════════════════════════════════════════
// 第四、五關：從模組裡依編號挑
// ══════════════════════════════════════════════

/** 活動適齡區間與窗口的距離：有重疊是 0；活動整段在窗口下方是正的「往下」距離，上方是「往上」。 */
function distance(a: Activity, [lo, hi]: MonthRange): { gap: number; below: boolean } {
  if (a.ageMonths.max < lo) return { gap: lo - a.ageMonths.max, below: true };
  if (a.ageMonths.min > hi) return { gap: a.ageMonths.min - hi, below: false };
  return { gap: 0, below: false };
}

const byIdAsc = (a: Activity, b: Activity) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * 一個能力、一個月的候選，排好的順序就是取用的順序（規格 §4.5）：
 * 1. 窗口內（活動適齡與窗口有交集，閉區間），依編號由小到大 —— `relaxed: false`。
 * 2. 放寬（暫採 P-1）：同模組群其餘的，依距離近→遠，同距離先往下，再同就編號小 —— `relaxed: true`。
 *
 * `pool` 是已經篩過「啟用」的活動。`avoid`（上一期的 36 支，`stable` 時）在兩段裡各自排到最後：先用沒練過的，不夠再用。
 * 示範片模式（`sampleOnly`）：不看模組群、不看窗口，`pool` 全部依編號（使用者 2026-10-06「正式站先 17 支即可」）。
 */
export function candidatesFor(
  dimension: DimensionCode,
  window: MonthRange,
  pool: ReadonlyArray<Activity>,
  options: { avoid?: ReadonlySet<string>; sampleOnly?: boolean } = {},
): Array<{ activity: Activity; relaxed: boolean }> {
  const avoid = options.avoid ?? new Set<string>();
  const avoided = (a: Activity) => (avoid.has(a.id) ? 1 : 0);
  if (options.sampleOnly) {
    return [...pool].sort((a, b) => avoided(a) - avoided(b) || byIdAsc(a, b)).map(activity => ({ activity, relaxed: false }));
  }
  const modules = DIM_MOD[dimension];
  const inGroup = pool.filter(a => modules.includes(a.moduleNo));
  const inside = inGroup.filter(a => distance(a, window).gap === 0).sort((a, b) => avoided(a) - avoided(b) || byIdAsc(a, b));
  const outside = inGroup
    .filter(a => distance(a, window).gap > 0)
    .sort((a, b) => {
      const da = distance(a, window);
      const db = distance(b, window);
      return avoided(a) - avoided(b) || da.gap - db.gap || Number(db.below) - Number(da.below) || byIdAsc(a, b);
    });
  return [...inside.map(activity => ({ activity, relaxed: false })), ...outside.map(activity => ({ activity, relaxed: true }))];
}

// ══════════════════════════════════════════════
// 一期
// ══════════════════════════════════════════════

/** 期末調整（規格 §5.2）：`none` 第一期或新報告；其餘由上一期的完成率決定。 */
export type PeriodAdjustment = 'none' | 'good' | 'stable' | 'hard';
/** 本月做法：手冊的「简单」、標準玩法（步驟）、「难一点」。 */
export type Variant = 'easy' | 'standard' | 'hard';

/** 三個月照月份走：简单 → 标准 → 难一点（客戶第七節）；`good` 全用难一点、`hard` 全用简单（客戶第八節）。 */
export function variantFor(monthIndex: number, adjustment: PeriodAdjustment): Variant {
  if (adjustment === 'good') return 'hard';
  if (adjustment === 'hard') return 'easy';
  return (['easy', 'standard', 'hard'] as const)[monthIndex];
}

export interface PeriodDimension extends DimensionColor {
  /**
   * 算窗口用的顏色。期末調整「移一檔」只動這個（客戶「用橙色的规则重算」窗口）；`color` 是評估的顏色，
   * 決定參不參加、名額多少、卡片上寫判什麼色 —— 移一檔不讓原本沒事的能力冒出來，也不讓有事的能力消失。
   */
  windowColor: PushColor;
  /** 整期的窗口與三個月各自的窗口。 */
  window: MonthRange;
  monthWindows: [MonthRange, MonthRange, MonthRange];
  /** 每月幾支。 */
  quota: number;
  modules: ModuleNo[];
}

export interface SlotReason {
  color: PushColor;
  source: ColorSource;
  module: ModuleNo | null;
  /** 這個月的窗口。 */
  window: MonthRange;
  /** 窗口內不夠、放寬拿到的（或示範片模式）。 */
  relaxed: boolean;
  /** 開期之後那支被停用、由下一支補上的（規格 §4.6）。 */
  replaced?: boolean;
}

export interface PeriodSlot {
  /** 第幾週，1–12。 */
  week: number;
  dimension: DimensionCode;
  /** `null` ＝ 這個能力的模組群裡已經沒有可以排的（準備中）。 */
  activityId: string | null;
  variant: Variant;
  reason: SlotReason;
}

export interface PeriodPlan {
  adjustment: PeriodAdjustment;
  ageMonth: number;
  perWeek: number;
  sampleOnly: boolean;
  /** 參加分配的能力，照 `sortByPush`（補進來的接在後面）。 */
  dimensions: PeriodDimension[];
  /** 12 週，每週 `perWeek` 格。 */
  weeks: PeriodSlot[][];
}

export interface PlanPeriodInput {
  dimensions: ReadonlyArray<Pick<DimensionFinding, 'dimensionId' | 'band' | 't1Flag'>>;
  /** T1 每維分數（0–8），給沒做量表的維度推定顏色；缺的退回 T1 標記。 */
  t1Scores?: Partial<Record<DimensionCode, number>>;
  /** 一期開始那週的實足月齡（整數月）。 */
  ageMonth: number;
  /** 活動庫全部（含停用的）；這裡自己過濾。 */
  library: ReadonlyArray<Activity>;
  adjustment?: PeriodAdjustment;
  /** 上一期排過的活動（`stable` 時先避開）。 */
  previousIds?: ReadonlyArray<string>;
  sampleOnly?: boolean;
}

/**
 * 排一期（規格 §4）。九個維度要剛好九筆；月齡要是非負整數。回傳全是新物件（活動只記編號）。
 */
export function planPeriod(input: PlanPeriodInput): PeriodPlan {
  const { ageMonth, library } = input;
  const adjustment = input.adjustment ?? 'none';
  const sampleOnly = input.sampleOnly === true;
  ageKeyOf(ageMonth); // 月齡檢查（不是非負整數就丟錯）
  const seen = new Set(input.dimensions.map(d => d.dimensionId));
  if (input.dimensions.length !== DIMENSION_CODES.length || DIMENSION_CODES.some(d => !seen.has(d))) {
    throw new Error(`trainingPush：要剛好九個維度，拿到 ${JSON.stringify(input.dimensions.map(d => d.dimensionId))}`);
  }

  const shift = adjustment === 'good' ? 'lighter' : adjustment === 'hard' ? 'heavier' : null;
  const colored = dimensionColors(input.dimensions, input.t1Scores);
  const ranked = participants(colored);
  const total = adjustment === 'hard' ? MONTHLY_QUOTA_HARD : MONTHLY_QUOTA;
  const quotas = monthlyQuotas(ranked, reserveOf(colored, ranked), total);
  const perWeek = total / WEEKS_PER_MONTH;

  const dimensions: PeriodDimension[] = quotas.map(q => {
    const windowColor = shift ? shiftColor(q.color, shift) : q.color;
    const window = periodWindow(windowColor, ageMonth);
    return {
      dimension: q.dimension,
      color: q.color,
      source: q.source,
      windowColor,
      window,
      monthWindows: monthWindows(window),
      quota: q.count,
      modules: [...DIM_MOD[q.dimension]],
    };
  });

  const pool = library.filter(a => a.active && (!sampleOnly || a.videoUrl !== null));
  const avoid = new Set(adjustment === 'stable' ? input.previousIds ?? [] : []);
  const used = new Set<string>();
  const weeks: PeriodSlot[][] = [];

  for (let m = 0; m < MONTHS_PER_PERIOD; m++) {
    const variant = variantFor(m, adjustment);
    const lists = new Map(
      dimensions.map(d => [d.dimension, candidatesFor(d.dimension, d.monthWindows[m], pool, { avoid, sampleOnly })] as const),
    );
    const byDimension = new Map(dimensions.map(d => [d.dimension, d] as const));
    const sequence = interleave(dimensions.map(d => ({ dimension: d.dimension, count: d.quota })));
    splitWeeks(sequence, perWeek).forEach((dims, w) => {
      weeks.push(
        dims.map(dimension => {
          const d = byDimension.get(dimension)!;
          const next = lists.get(dimension)!.find(c => !used.has(c.activity.id));
          if (next) used.add(next.activity.id);
          return {
            week: m * WEEKS_PER_MONTH + w + 1,
            dimension,
            activityId: next ? next.activity.id : null,
            variant,
            reason: {
              color: d.color,
              source: d.source,
              module: next ? next.activity.moduleNo : null,
              window: d.monthWindows[m],
              relaxed: next ? next.relaxed || sampleOnly : false,
            },
          };
        }),
      );
    });
  }

  return { adjustment, ageMonth, perWeek, sampleOnly, dimensions, weeks };
}

/**
 * v3 推送規則（`TRAINING_PUSH_V3`）多記的一塊：這一格是哪一期、第幾週、本月做法、顏色從哪來（T2 分級／T1 推定）、
 * 取自哪個模組、是不是放寬或補位來的（規格 §6.2）。舊週次沒有這一塊；`reason` 仍照舊形狀存一份（band 由顏色換回），
 * 畫面上的「因為……所以練……」照舊讀得動。
 */
export interface StoredPush {
  periodNo: number;
  week: number;
  color: 'red' | 'orange' | 'green';
  source: 't2' | 't1';
  module: number | null;
  window: [number, number];
  variant: 'easy' | 'standard' | 'hard';
  relaxed: boolean;
  replaced?: boolean;
}

// ══════════════════════════════════════════════
// 開期之後：換著玩、停用補位、期末判檔
// ══════════════════════════════════════════════

/** 第幾週（1 起）→ 第幾個月（0 起）。超過 12 週照最後一個月算。 */
export function monthIndexOf(week: number): number {
  return Math.min(MONTHS_PER_PERIOD - 1, Math.max(0, Math.floor((week - 1) / WEEKS_PER_MONTH)));
}

/** 一期排過的全部活動編號。 */
export function planActivityIds(plan: Pick<PeriodPlan, 'weeks'>): string[] {
  return plan.weeks.flat().flatMap(s => (s.activityId ? [s.activityId] : []));
}

/** 換著玩每個能力最多幾支（沿用 Keep 規格 K08 的 5）。 */
export const ALTERNATES_PER_DIMENSION = 5;

/**
 * 換著玩（Keep K08；推送說明沒提，暫採 P-6）：每個參加的能力，這個月窗口內、不在這一期 36 格裡的，依編號取前 5 支。
 * 只放有備選的能力；放寬來的不列（換著玩是「同一個難度換一支」，不是往外找）。示範片模式照 `candidatesFor`。
 */
export function periodAlternates(
  plan: Pick<PeriodPlan, 'weeks' | 'dimensions' | 'sampleOnly'>,
  week: number,
  library: ReadonlyArray<Activity>,
): Partial<Record<DimensionCode, Activity[]>> {
  const m = monthIndexOf(week);
  const planned = new Set(planActivityIds(plan));
  const pool = library.filter(a => a.active && (!plan.sampleOnly || a.videoUrl !== null));
  const out: Partial<Record<DimensionCode, Activity[]>> = {};
  for (const d of plan.dimensions) {
    const list = candidatesFor(d.dimension, d.monthWindows[m], pool, { sampleOnly: plan.sampleOnly })
      .filter(c => !c.relaxed || plan.sampleOnly)
      .map(c => c.activity)
      .filter(a => !planned.has(a.id))
      .slice(0, ALTERNATES_PER_DIMENSION);
    if (list.length > 0) out[d.dimension] = list;
  }
  return out;
}

/**
 * 某一週要寫進每週活動時，那幾格的活動若已停用（或從活動庫消失），用同一能力、同一個月的候選裡下一支還沒排的補上
 * （規格 §4.6），`reason.replaced = true`。沒有可補的就變成準備中（`activityId: null`）。回傳新的一期；沒變就回原物件。
 */
export function replaceInactive(plan: PeriodPlan, week: number, library: ReadonlyArray<Activity>): PeriodPlan {
  const index = week - 1;
  const slots = plan.weeks[index];
  if (!slots) return plan;
  const byId = new Map(library.map(a => [a.id, a] as const));
  const usable = (id: string | null) => id === null || byId.get(id)?.active === true;
  if (slots.every(s => usable(s.activityId))) return plan;

  const m = monthIndexOf(week);
  const pool = library.filter(a => a.active && (!plan.sampleOnly || a.videoUrl !== null));
  const used = new Set(planActivityIds(plan));
  const nextSlots = slots.map(s => {
    if (usable(s.activityId)) return s;
    const d = plan.dimensions.find(x => x.dimension === s.dimension)!;
    const next = candidatesFor(s.dimension, d.monthWindows[m], pool, { sampleOnly: plan.sampleOnly }).find(c => !used.has(c.activity.id));
    if (next) used.add(next.activity.id);
    return {
      ...s,
      activityId: next ? next.activity.id : null,
      reason: {
        ...s.reason,
        module: next ? next.activity.moduleNo : null,
        relaxed: next ? next.relaxed || plan.sampleOnly : false,
        replaced: true,
      },
    };
  });
  return { ...plan, weeks: plan.weeks.map((w, i) => (i === index ? nextSlots : w)) };
}

/**
 * 期末判檔（規格 §5.2，客戶第八節的三檔、門檻 80％／50％）：`rate` 是這一期的完成率（`practiceStats.completionRate`）。
 * 沒有任何一週可算（`null`）當「稳定」：不往上也不往下。
 */
export function adjustmentFromCompletion(rate: number | null): Exclude<PeriodAdjustment, 'none'> {
  if (rate === null) return 'stable';
  if (rate >= 0.8) return 'good';
  if (rate >= 0.5) return 'stable';
  return 'hard';
}

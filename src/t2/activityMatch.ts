/**
 * 活動配對（規格 v2 §7.2、§7.3，#53）。
 *
 * 【這一層做什麼】
 * 一個純函式 `matchWeeklyActivities`：給 `T2Findings`、實足月齡、過去 4 週派過的活動編號、活動庫，
 * 回這一週的四支與各自的 reason。沒有 I/O、沒有時鐘、沒有隨機 —— 同輸入兩次結果相同。
 *
 * 【客戶的規則，原樣抄】（§7.2 `對應活動.docx`）
 * 維度 → 模組（`DIM_MOD`）、年齡段鍵（`ageKeyOf`）、依判定往前取的偏移（`OFFSET`）三張表在下面。
 * 「活動要從孩子做得到的地方開始，不是從實際年齡開始。落後越多、往前取得越多。」窗口用的是
 * **實足月齡**（訓練是現在要做的事），不是 `findings.child.assessedAgeMonth` —— 沿用 v1 與
 * 已退場的 `interventionMatch.ts`（#63）留下的那條註解。
 *
 * 【演算法】（§7.3）
 * 1. 對每個 band ∈ {watch, refer} 的維度：窗口 = `[max(0, m + off[0]), max(0, m + off[1])]`；
 *    候選 = 啟用、`moduleNo ∈ DIM_MOD[維度]`、`targetMonth` 非 null 且在窗口內、`avoidIf` 與孩子
 *    **全部**標籤（九個維度、含只進報告的）無交集。
 * 2. 打分：★ 對上每個 +3、只有維度對上 +1、四週內派過 −2。「孩子的 ★ 標籤」是**這個維度自己的**
 *    ★ 標籤：模組 7 同時在 LANG 與 ATT 的模組群裡，一支練 `att.inattention` 的活動替 LANG 的名額加分，
 *    報告會寫出「為了語言，我們選了一支對上注意力的活動」—— 那個名額是給語言的。
 * 3. 配額：每週 4 支，refer 的維度 2 個名額、watch 1 個，多的輪流分給有標記的維度（§8 排序），
 *    同一維度 ≤ 2。「有標記」＝ band 是 watch 或 refer：clear 的維度沒有候選（第 1 條），`partial`／
 *    `not_assessed`／`no_tool` 沒有判定。名額的發法是**一輪一輪**：先每個維度一支、再 refer 的第二支、
 *    再剩的輪流 —— 名額夠時跟「refer 2、watch 1」完全一樣；超過 4 時（三個 refer）沒有哪個維度
 *    一支都拿不到（規格沒說超過 4 時砍誰；記在勘誤檔）。
 * 4. 每個名額取分數最高者；同分取 `|targetMonth − 窗口中點|` 小者；再同分取編號小者。
 * 5. 每支附 reason：`{ band, window, matchedTags, belowWindow }`。
 *
 * 【退路只有兩種、順序固定】
 * - 窗口內沒有拿得到的活動 → 同模組群裡 `targetMonth` **低於窗口下限、最接近**的一支（仍是往前取）。
 *   **只給一支**、而且只在這個維度這週還一支都沒有時。**不往上取**：給孩子做不到的活動，家長會以為
 *   孩子又失敗了一次 —— 上方有再多也是「準備中」。
 * - 同模組群裡連一支拿得到的都沒有（沒有、全停用、全沒填 `targetMonth`、全被 `avoidIf` 擋掉、
 *   或全在窗口上方）→ 該維度「準備中」，列在 `preparing`。這是今天正式站的行為（0 列），不是退步。
 *
 * **不跨維度、不跨模組群**：LANG 沒活動時不從 SOC 的候選補，不從 `DIM_MOD` 以外的模組補 ——
 * 活動自己的 `dimensions` 欄位（附錄 B.3 的初值，後台可改）在這裡**不看**，看的只有 `moduleNo`。
 * `targetMonth` null 的活動永遠配不到，不是退回 `ageMonths`：退回會讓偏移規則失效而畫面上看不出來
 * （§7.4）。`ageMonths` 這裡也不看 —— §7.1 說它「仍保留當硬閘」但沒說閘什麼；拿孩子的實足月齡去閘，
 * 往前取到的活動幾乎都會被它擋掉，偏移規則等於沒有（記在勘誤檔）。
 * 舊干預包測試「不退回鄰近年齡段、不退回通用方案」那幾條搬進 `test/t2ActivityMatch.test.ts`，不刪。
 */

import { isActivityTag } from './findingTags';
import type { ActivityTag, FindingTag } from './findingTags';
import { prioritizeDimensions } from './dimensionOrder';
import { DIMENSION_CODES } from './types';
import type { Activity, Band, DimensionCode, DimensionFinding, ModuleNo, T2Findings } from './types';

/** 客戶的四個年齡段（§7.2）。段界落在下一段：12 是 `'12-36'`。 */
export type AgeKey = '<12' | '12-36' | '36-72' | '72+';
export const AGE_KEYS: ReadonlyArray<AgeKey> = ['<12', '12-36', '36-72', '72+'];

/** 維度 → 模組（§7.2 `DIM_MOD`，原樣）。配對只看這張表，不看 `Activity.dimensions`。 */
export const DIM_MOD: Readonly<Record<DimensionCode, ReadonlyArray<ModuleNo>>> = {
  MOT: [1, 2, 3, 4, 5],
  SEN: [2, 3, 5, 11, 14],
  COG: [7, 12, 13, 14, 15],
  LEARN: [2, 5, 9, 12, 13, 14, 15],
  ATT: [7, 9, 13, 14, 15],
  LANG: [7, 8, 9, 11],
  SOC: [7, 9, 12, 15],
  EMO: [9, 10, 11, 12, 15],
  ADL: [3, 5, 6, 9, 12, 15],
};

/**
 * 依判定往前取（§7.2 `OFFSET[band][ageKey]`，單位月、相對實足月齡，原樣）。
 * `clear` 那一列照客戶表抄著，§7.3 沒有用到它（只配 watch／refer）；留著讓窗口函式對三級都答得出來。
 */
export const OFFSET: Readonly<Record<Band, Readonly<Record<AgeKey, readonly [number, number]>>>> = {
  clear: { '<12': [-1, 1], '12-36': [-3, 3], '36-72': [-6, 6], '72+': [-12, 12] },
  watch: { '<12': [-3, -1], '12-36': [-6, -3], '36-72': [-12, -6], '72+': [-24, -12] },
  refer: { '<12': [-6, -3], '12-36': [-12, -6], '36-72': [-24, -12], '72+': [-36, -24] },
};

/** 每週幾支（§7.3 第 3 條）。 */
export const WEEKLY_SLOTS = 4;
/** 同一維度一週最多幾支。 */
export const MAX_PER_DIMENSION = 2;
/** refer 的維度佔幾個名額、watch 佔幾個。 */
export const SLOTS_BY_BAND: Readonly<Record<'refer' | 'watch', number>> = { refer: 2, watch: 1 };
/** 打分（§7.3 第 2 條）。 */
export const SCORE = { perTag: 3, dimensionOnly: 1, recent: -2 } as const;

/** 閉區間，單位月。 */
export interface MonthWindow { lo: number; hi: number }

export interface PickReason {
  band: Band;
  window: MonthWindow;
  /** 這支活動的 `targets` 裡孩子在這個維度有的 ★ 標籤，照 `targets` 的順序。 */
  matchedTags: ActivityTag[];
  /** 退路取到的（`targetMonth` 低於窗口下限）。報告要說「先從更早一步開始」。 */
  belowWindow: boolean;
}

export interface WeeklyPick {
  /** 活動庫裡的原物件，不複製。 */
  activity: Activity;
  /** 這支是為了哪個維度挑的（模組 7 同時屬於四個維度，光看活動不知道）。 */
  dimension: DimensionCode;
  score: number;
  reason: PickReason;
}

export interface WeeklyActivities {
  /** 依名額發放的順序（§8 排序、一輪一輪），最多 `WEEKLY_SLOTS` 支。 */
  picks: WeeklyPick[];
  /** 有標記、但模組群裡連一支拿得到的活動都沒有的維度（§8 排序）。畫面上是「準備中」。 */
  preparing: DimensionCode[];
}

function assertAge(ageMonth: number): void {
  if (!Number.isInteger(ageMonth) || ageMonth < 0) {
    throw new Error(`activityMatch：月齡要是非負整數（實足月齡，不進位），拿到 ${ageMonth}`);
  }
}

export function ageKeyOf(ageMonth: number): AgeKey {
  assertAge(ageMonth);
  if (ageMonth < 12) return '<12';
  if (ageMonth < 36) return '12-36';
  if (ageMonth < 72) return '36-72';
  return '72+';
}

/** 這個判定在這個實足月齡的窗口（§7.3 第 1 條）。下限與上限都不低於 0。回傳新物件。 */
export function windowFor(band: Band, ageMonth: number): MonthWindow {
  const [lo, hi] = OFFSET[band][ageKeyOf(ageMonth)];
  return { lo: Math.max(0, ageMonth + lo), hi: Math.max(0, ageMonth + hi) };
}

/**
 * 一支活動對一個維度的分數（§7.3 第 2 條）。`childStars` 是孩子在**這個維度**的 ★ 標籤（檔頭第 2 點）。
 * `targets` 為空或沒對上都是「只有維度對上」+1；四週內派過 −2（可以是負的）。
 */
export function scoreActivity(
  activity: Activity,
  childStars: ReadonlySet<ActivityTag>,
  recent: ReadonlySet<string>,
): { score: number; matchedTags: ActivityTag[] } {
  const matchedTags = activity.targets.filter(t => childStars.has(t));
  let score = matchedTags.length > 0 ? SCORE.perTag * matchedTags.length : SCORE.dimensionOnly;
  if (recent.has(activity.id)) score += SCORE.recent;
  return { score, matchedTags };
}

interface Scored {
  activity: Activity;
  /** 非 null —— 候選在進來之前就過了 `targetMonth !== null`。 */
  targetMonth: number;
  score: number;
  matchedTags: ActivityTag[];
}

/** 一個有標記的維度這週的狀態：窗口內的候選（排好）、窗口下方的候選（排好）、已拿幾支。 */
interface DimState {
  dimension: DimensionCode;
  band: 'watch' | 'refer';
  window: MonthWindow;
  inWindow: Scored[];
  below: Scored[];
  count: number;
}

function byId(a: Scored, b: Scored): number {
  return a.activity.id < b.activity.id ? -1 : a.activity.id > b.activity.id ? 1 : 0;
}

/** §7.3 第 4 條：分數高 → 離中點近 → 編號小。 */
function inWindowOrder(mid: number): (a: Scored, b: Scored) => number {
  return (a, b) =>
    b.score - a.score
    || Math.abs(a.targetMonth - mid) - Math.abs(b.targetMonth - mid)
    || byId(a, b);
}

/** 退路：最接近下限（`targetMonth` 大者）→ 分數高 → 編號小。 */
function belowOrder(a: Scored, b: Scored): number {
  return b.targetMonth - a.targetMonth || b.score - a.score || byId(a, b);
}

function stateFor(
  finding: DimensionFinding,
  band: 'watch' | 'refer',
  ageMonth: number,
  usable: ReadonlyArray<Activity>,
  recent: ReadonlySet<string>,
): DimState {
  const window = windowFor(band, ageMonth);
  const stars = new Set<ActivityTag>(finding.tags.filter(isActivityTag));
  const modules = DIM_MOD[finding.dimensionId];
  const inWindow: Scored[] = [];
  const below: Scored[] = [];
  for (const activity of usable) {
    const targetMonth = activity.targetMonth as number;
    if (!modules.includes(activity.moduleNo) || targetMonth > window.hi) continue;
    const scored = { activity, targetMonth, ...scoreActivity(activity, stars, recent) };
    (targetMonth >= window.lo ? inWindow : below).push(scored);
  }
  inWindow.sort(inWindowOrder((window.lo + window.hi) / 2));
  below.sort(belowOrder);
  return { dimension: finding.dimensionId, band, window, inWindow, below, count: 0 };
}

/**
 * 這一週的活動（檔頭「演算法」與「退路」）。
 *
 * - `findings`：T2 的唯一真相（§5.8）。這裡只讀九個維度的 band 與標籤；不是九個就丟錯。
 * - `ageMonth`：**實足月齡**（整數月，不進位）；不是非負整數就丟錯。
 * - `recentIds`：過去 4 週派過的活動編號，只用來扣分（−2），不排除。
 * - `library`：活動庫全部（含停用的）；這裡自己過濾。
 *
 * 回傳的 `picks` 與 `reason` 都是新物件；`activity` 是活動庫裡的原物件。
 */
export function matchWeeklyActivities(
  findings: T2Findings,
  ageMonth: number,
  recentIds: ReadonlyArray<string>,
  library: ReadonlyArray<Activity>,
): WeeklyActivities {
  assertAge(ageMonth);
  // 九個、不多不少：同一個維度出現兩次會有兩個 state，那個維度就能拿到四支
  const seen = new Set(findings.dimensions.map(d => d.dimensionId));
  if (findings.dimensions.length !== DIMENSION_CODES.length || DIMENSION_CODES.some(d => !seen.has(d))) {
    throw new Error(`activityMatch：findings 要剛好九個維度，拿到 ${JSON.stringify(findings.dimensions.map(d => d.dimensionId))}`);
  }

  const recent = new Set(recentIds);
  const childTags = new Set<FindingTag>(findings.dimensions.flatMap(d => d.tags));
  // 跟維度無關的三個條件先過一次：啟用、有 targetMonth、avoidIf 沒對上孩子任何一個標籤
  const usable = library.filter(a => a.active && a.targetMonth !== null && !a.avoidIf.some(t => childTags.has(t)));

  const states: DimState[] = [];
  for (const f of prioritizeDimensions(findings)) {
    if (f.band === 'watch' || f.band === 'refer') states.push(stateFor(f, f.band, ageMonth, usable, recent));
  }

  const picked = new Set<string>();
  const picks: WeeklyPick[] = [];
  const take = (s: DimState, x: Scored, belowWindow: boolean): void => {
    picked.add(x.activity.id);
    s.count += 1;
    picks.push({
      activity: x.activity,
      dimension: s.dimension,
      score: x.score,
      reason: { band: s.band, window: { ...s.window }, matchedTags: [...x.matchedTags], belowWindow },
    });
  };

  /** 給這個維度一支：窗口內最好的一支；窗口內拿不到、而且它還一支都沒有 → 退路一支。 */
  const tryPick = (s: DimState): boolean => {
    if (s.count >= MAX_PER_DIMENSION) return false;
    const next = s.inWindow.find(x => !picked.has(x.activity.id));
    if (next) {
      take(s, next, false);
      return true;
    }
    if (s.count > 0) return false;
    const fallback = s.below.find(x => !picked.has(x.activity.id));
    if (!fallback) return false;
    take(s, fallback, true);
    return true;
  };

  // 基本名額，一輪一輪：第 1 輪每個維度一支，第 2 輪 refer 的第二支；到 4 為止
  for (let round = 1; round <= SLOTS_BY_BAND.refer; round++) {
    for (const s of states) {
      if (picks.length >= WEEKLY_SLOTS) break;
      if (round <= SLOTS_BY_BAND[s.band]) tryPick(s);
    }
  }
  // 剩的名額輪流分給有標記的維度（已是 §8 排序），同維度 ≤ 2；整輪沒人拿得到就停
  let progressed = true;
  while (picks.length < WEEKLY_SLOTS && progressed) {
    progressed = false;
    for (const s of states) {
      if (picks.length >= WEEKLY_SLOTS) break;
      if (tryPick(s)) progressed = true;
    }
  }

  return {
    picks,
    preparing: states.filter(s => s.inWindow.length === 0 && s.below.length === 0).map(s => s.dimension),
  };
}

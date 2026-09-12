/**
 * 分級：把一個數字放進工具自己的分段表，得到 tier（規格 §5.3）。
 *
 * 【為什麼這件事需要一個獨立的檔案】
 * 22 支工具的分段表長得一樣（`{ tier, key, min?, max? }`），**讀法卻有三種**。
 * 同一組 `{ min: 1.2, max: 1.8 }`，在 snap-iv 是「1.2 不含、1.8 含」，在氣質是
 * 「1.2 含、1.8 不含」，在其餘 20 支是兩端都含。這個差異來自工具包原始碼裡三段
 * 不同的 `level()` 寫法，不是我們的選擇；把它收在這裡，是為了讓「哪一族用哪種
 * 讀法」只有一個地方可以答錯。
 *
 * 邊界在臨床上是有代價的：pct 85 與 84 差一個 tier，之後會差一個 band，再之後
 * 差的是家長看到「未見明顯問題」還是「建議進一步評估」。所以每一條界線上下各
 * 一個測試（`test/t2Scoring.test.ts`），不是形式上的覆蓋率。
 */

import type { ToolkitTier } from '../toolkit';
import type { ScoringFamily, Tier } from '../types';

/**
 * 一段分段的開閉慣例。
 *
 * - `closed`：兩端都含。整數分數的族用這種 —— 百分比、ldp／lds 的總分、
 *   mchat 的風險題數、warn 的陽性數、chexi 的因素百分比。
 * - `upper-inclusive`：`min` 不含、`max` 含。只有 snap-iv：`ari ≤ 1.2` 是 tier 1，
 *   1.2 落在**好的那一邊**。
 * - `lower-inclusive`：`min` 含、`max` 不含。只有氣質：`|dev| < 0.42` 是 tier 1，
 *   0.42 落在**偏的那一邊**。
 *
 * 兩個例外剛好方向相反，所以沒辦法用一個「浮點數就這樣讀」的通則含混過去。
 */
export type TierInterval = 'closed' | 'upper-inclusive' | 'lower-inclusive';

export function intervalOf(family: ScoringFamily): TierInterval {
  if (family === 'mean-snap') return 'upper-inclusive';
  if (family === 'profile') return 'lower-inclusive';
  return 'closed';
}

function within(t: ToolkitTier, value: number, interval: TierInterval): boolean {
  const aboveFloor = t.min === undefined
    ? true
    : interval === 'upper-inclusive' ? value > t.min : value >= t.min;
  const belowCeiling = t.max === undefined
    ? true
    : interval === 'lower-inclusive' ? value < t.max : value <= t.max;
  return aboveFloor && belowCeiling;
}

/**
 * `value` 落在哪一段。
 *
 * `value` 為 `null`（分母 0、或這一族的這一格不判級）時回 `null` —— 呼叫端拿到
 * `tier: null` 該做的事是「不判讀」，不是「當成最好的那一段」。同理，落不進任何
 * 一段時也回 `null` 而不是硬塞一個 tier：分段表有洞的話要看得見。
 *
 * 進來的 `value` 必須**已經四捨五入完畢**（§5.2「先四捨五入再比門檻」）。這裡不做
 * 四捨五入 —— 誰四捨五入、捨到第幾位，是各族自己的事（百分比取整、snap 與 chexi
 * 的均分留兩位、氣質的偏差不取），在這裡再做一次只會把已經對的數字再動一次。
 */
export function tierFor(
  family: ScoringFamily,
  tiers: ReadonlyArray<ToolkitTier>,
  value: number | null,
): Tier | null {
  if (value === null || !Number.isFinite(value)) return null;
  const interval = intervalOf(family);
  for (const t of tiers) {
    if (within(t, value, interval)) return t.tier;
  }
  return null;
}

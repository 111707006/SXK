/**
 * 發育指數：一次 T1 篩查的總分，在同月齡孩子裡大約落在哪一級，換成 100／90／80／75／70
 * （#68，規格 docs/specs/client-changes-2026-10-17.md §3.2；CONTEXT.md「同齡估算」「發育指數」）。
 * **它不是發育商**：依據是 `passRates.ts` 的逐題推估，不是 T1 的常模（T1 沒有常模）。
 *
 * 只給伺服器與測試（後台匯總表 #73 由伺服器算好送出），家長端不 import。
 *
 * 【怎麼算】（暫採，規格 Q-4、Q-5）
 * 1. 篩查當時的月齡（落在該年齡段的頭尾之間）→ 每題「可以做到」的機率 p；「有时・部分」(1−p)/2、「还不能」其餘。
 * 2. 36 題當作彼此獨立，卷積出同月齡孩子總分（0–72）的分布。
 * 3. 這個孩子的總分 → 同月齡孩子裡分數不高於他的比例 → 五級。
 *
 * 讀不到逐題作答（R1b 之前的舊成績、少一維、月齡不明）回 null，不補數字。
 */

import { T1_AGE_BANDS } from '../t1Data';
import type { T1AgeBand } from '../t1Data';
import { t1AnswersOf } from '../t1report/answers';
import { ageBandRange } from '../utils/ageBandDrift';
import { T1_PASS_RATES } from './passRates';
import type { DenverRow, PassRateRow } from './passRates';

export type DevelopmentIndex = 100 | 90 | 80 | 75 | 70;

/** 同月齡孩子裡分數不高於他的比例 → 指數。比例**大於**切點才算那一級（25％ 整是 90）。 */
const LEVELS: ReadonlyArray<{ above: number; index: DevelopmentIndex }> = [
  { above: 0.25, index: 100 },
  { above: 0.1, index: 90 },
  { above: 0.05, index: 80 },
  { above: 0.01, index: 75 },
];

/**
 * 任何一題的 p 都夾在這之間（暫採）：外插到 0 或 1 會讓一題答錯就變成「不可能的分數」，
 * 把獨立假設已經太薄的尾巴再壓扁。
 */
export const P_FLOOR = 0.03;
export const P_CAP = 0.97;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const ROWS = new Map<string, PassRateRow>(T1_PASS_RATES.map(r => [r.questionId, r]));
const BAND_OF = new Map<string, T1AgeBand>(T1_AGE_BANDS.flatMap(b => b.questions.map(q => [q.id, b] as const)));

/** 過 (月齡, 機率) 幾個點的折線；頭尾外用最近那一段的斜率延伸。 */
function polyline(points: ReadonlyArray<readonly [number, number]>, month: number): number {
  const seg = (i: number) => {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    return y0 + ((y1 - y0) * (month - x0)) / (x1 - x0);
  };
  if (month <= points[0][0]) return seg(0);
  for (let i = 0; i < points.length - 1; i++) if (month <= points[i + 1][0]) return seg(i);
  return seg(points.length - 2);
}

const DENVER_P = [0.25, 0.5, 0.75, 0.9] as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * CDC 只給一個月齡（75％ 做得到）。其餘三個點借這張表丹佛題目的形狀：
 * 25／50／90％ 的月齡 ÷ 75％ 的月齡，各取中位數。
 */
const CDC_RATIOS: readonly [number, number, number, number] = (() => {
  const rows = T1_PASS_RATES.filter((r): r is DenverRow => r.source === 'denver');
  const ratio = (k: number) => median(rows.map(r => r.ages[k] / r.ages[2]));
  return [ratio(0), ratio(1), 1, ratio(3)];
})();

/** 這一題在這個月齡約幾成孩子做得到；月齡夾在題目所屬年齡段的頭尾之間。不是 T1 的題目回 null。 */
export function passProbability(questionId: string, ageMonth: number): number | null {
  const row = ROWS.get(questionId);
  const band = BAND_OF.get(questionId);
  const range = band ? ageBandRange(band.id) : null;
  if (!row || !range) return null;
  const [bandStart, bandEnd] = range;
  const month = clamp(ageMonth, bandStart, bandEnd);
  let p: number;
  if (row.source === 'denver') {
    p = polyline(row.ages.map((a, i) => [a, DENVER_P[i]] as const), month);
  } else if (row.source === 'cdc') {
    p = polyline(CDC_RATIOS.map((r, i) => [row.ageMonths * r, DENVER_P[i]] as const), month);
  } else {
    p = polyline([[bandStart, row.atMin], [bandEnd, row.atMax]], month);
  }
  return clamp(p, P_FLOOR, P_CAP);
}

/**
 * @param scores 那一次篩查的成績（`DimensionScore[]`，當 unknown 收）。
 * @param ageMonth 篩查當時的月齡（成績上有 `assessedAgeMonth` 就用成績上的）。
 */
export function developmentIndex(scores: unknown, ageMonth?: number | null): DevelopmentIndex | null {
  const answers = t1AnswersOf(scores, ageMonth);
  if (answers.ageMonth === null || answers.counts === null) return null;
  const items = answers.dimensions.flatMap(d => d.items ?? []);
  const band = BAND_OF.get(items[0]?.questionId ?? '');
  if (!band || items.length !== band.questions.length) return null;

  // dist[s] ＝ 同月齡孩子總分為 s 的機率
  let dist = [1];
  let total = 0;
  for (const item of items) {
    const p = passProbability(item.questionId, answers.ageMonth);
    if (p === null) return null;
    const q = (1 - p) / 2;
    const next = new Array<number>(dist.length + 2).fill(0);
    dist.forEach((v, s) => {
      next[s] += v * q;
      next[s + 1] += v * q;
      next[s + 2] += v * p;
    });
    dist = next;
    total += item.answer;
  }
  const atOrBelow = dist.slice(0, total + 1).reduce((a, b) => a + b, 0);
  return LEVELS.find(l => atOrBelow > l.above)?.index ?? 70;
}

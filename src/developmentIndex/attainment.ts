/**
 * 發育指數的另一種算法：**達成率**（使用者 2026-10-18：「兩個都做，用開關來調整」，開關 `DEV_INDEX_BASIS`，見 `basis.ts`）。
 *
 * 照客戶《森心康分龄发育综合评估_SXK-ASQ3》HTML 的底層邏輯：總分 ÷ 滿分 × 100 四捨五入成達成率，
 * 再用森心康內部參考帶 85／70／55 分檔（`LEVELS`、`levelFor`）。T1 的題目本來就照年齡段出，
 * 所以這裡不再看同月齡的通過率 —— 與 `developmentIndex.ts`（同齡估算）是兩個不同的問題：
 * - 同齡估算：同月齡孩子裡大約落在哪一級；
 * - 達成率：這一份照年齡出的題目做到幾成。
 *
 * 客戶的參考帶只有四級，發育指數有五個值（CONTEXT.md「發育指數」）。55％ 以下再切一刀：
 * **40％ 是暫採**（規格 docs/specs/client-changes-2026-10-17.md Q-9），等客戶給數字再改。
 *
 * | 達成率 | 客戶的分級 | 發育指數 |
 * |---|---|---|
 * | ≥85 | 未见明显问题 | 100 |
 * | 70–84 | 轻微落后 | 90 |
 * | 55–69 | 中度落后 | 80 |
 * | 40–54 | 明显落后 | 75（暫採） |
 * | <40 | 明显落后 | 70（暫採） |
 *
 * 只要九維的總分，**不要逐題作答**：R1b 之前的舊成績也算得出來（同齡估算算不出來）。
 * 只給伺服器（後台匯總由伺服器算好送出）。
 */

import { getT1AgeBand } from '../t1Data';
import type { DevelopmentIndex } from './developmentIndex';

/** 達成率（整數百分比）大於等於 `min` 就是那一級。 */
const LEVELS: ReadonlyArray<{ min: number; index: DevelopmentIndex }> = [
  { min: 85, index: 100 },
  { min: 70, index: 90 },
  { min: 55, index: 80 },
  { min: 40, index: 75 },
];

/** T1 每一份都是九維（每維 4 題）。 */
export const T1_DIMENSION_COUNT = 9;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 這一次 T1 的達成率（0–100 的整數），照客戶 HTML 的 `Math.round(score / max * 100)`。
 * 九維不齊、分數不是數字、各維的篩查月齡落在不同年齡段（跨了兩次篩查，題目不是同一份）回 null。
 */
export function attainmentRate(scores: unknown): number | null {
  if (!Array.isArray(scores)) return null;
  const byDimension = new Map<string, { score: number; maxScore: number; ageMonth: number | null }>();
  for (const s of scores) {
    if (!isRecord(s) || s.tierId !== 'T1' || typeof s.dimensionId !== 'string') continue;
    const score = Number(s.score);
    const maxScore = Number(s.maxScore);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) return null;
    const ageMonth = typeof s.assessedAgeMonth === 'number' ? s.assessedAgeMonth : null;
    byDimension.set(s.dimensionId, { score, maxScore, ageMonth });
  }
  if (byDimension.size !== T1_DIMENSION_COUNT) return null;

  const bands = new Set([...byDimension.values()].flatMap(d => (d.ageMonth === null ? [] : [getT1AgeBand(d.ageMonth).id])));
  if (bands.size > 1) return null;

  let score = 0;
  let max = 0;
  for (const d of byDimension.values()) {
    score += d.score;
    max += d.maxScore;
  }
  return Math.round((score / max) * 100);
}

/** 達成率 → 發育指數（同樣只有五個值）。簽名與 `developmentIndex` 相同，月齡用不到。 */
export function attainmentIndex(scores: unknown, _ageMonth?: number | null): DevelopmentIndex | null {
  const rate = attainmentRate(scores);
  if (rate === null) return null;
  return LEVELS.find(l => rate >= l.min)?.index ?? 70;
}

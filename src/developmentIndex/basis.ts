/**
 * 發育指數用哪一種算法（開關 `DEV_INDEX_BASIS`，使用者 2026-10-18：「兩個都做，用開關來調整」）。
 *
 * - `peer`（不設或空字串＝預設）：同齡估算（`developmentIndex.ts`，#68，規格 §3.2）。
 * - `attainment`：達成率（`attainment.ts`，客戶 SXK-ASQ3 HTML 的 85／70／55 參考帶）。
 *
 * 兩種都只出 100／90／80／75／70，後台匯總表與導出的欄位、表頭不變；換開關只換數字怎麼來。
 * 認不得的值讓程序起不來（同其他開關）—— 打錯字悄悄退回預設，後台就會拿著另一套數字而沒有人知道。
 * 只給伺服器。
 */

import { attainmentIndex } from './attainment';
import { developmentIndex } from './developmentIndex';
import type { DevelopmentIndex } from './developmentIndex';

export type DevIndexBasis = 'peer' | 'attainment';

export function resolveDevIndexBasis(raw: string | undefined): DevIndexBasis {
  if (raw === undefined || raw === '' || raw === 'peer') return 'peer';
  if (raw === 'attainment') return 'attainment';
  throw new Error(
    `DEV_INDEX_BASIS is not recognised: ${JSON.stringify(raw)}. Only 'peer' (同齡估算, default) or 'attainment' (達成率) are accepted.`
  );
}

export function developmentIndexFor(basis: DevIndexBasis): (scores: unknown, ageMonth?: number | null) => DevelopmentIndex | null {
  return basis === 'attainment' ? attainmentIndex : developmentIndex;
}

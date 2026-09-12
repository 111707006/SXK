/**
 * §8 的維度排序：報告與活動配對共用的「哪個維度先」。
 *
 * 三把鍵，順序就是優先順序：band 最重的在前（refer > watch > 其餘）；同 band 取 T1 標記較重者；
 * 再依客戶的「功能處理順序」（有診斷方向、且客戶表那一格非空時，附錄 B.2）或固定順序
 * `LANG, SOC, ATT, MOT, COG, SEN, ADL, EMO, LEARN`。
 *
 * 客戶的順序**不是九個都在**（沒有一列有 ADL，抽動症只列七個）；§8 說「缺的維度怎麼補是報告那一層的事」，
 * 這裡的補法是依固定順序接在客戶列的後面 —— 客戶沒提的維度不該憑空插到他排好的中間。
 *
 * 「那一格是否非空」直接問 `planT2`（它的 `functionOrder` 就是這條規則），不另抄一份：
 * 學習障礙 0–36 客戶留白、選了等於沒選，兩處要永遠是同一個答案。
 *
 * `partial`／`not_assessed`／`no_tool` 排在 `clear` 之後不再細分 —— 這個順序給的是「先講誰」，
 * 而沒有判定的維度在報告與配對裡都不是講嚴重度的對象（§5.7）。
 */

import { planT2 } from './routing';
import type { DimensionCode, DimensionFinding, T2Findings } from './types';

/** §8 的固定順序。 */
export const FIXED_DIMENSION_ORDER: ReadonlyArray<DimensionCode> = [
  'LANG', 'SOC', 'ATT', 'MOT', 'COG', 'SEN', 'ADL', 'EMO', 'LEARN',
];

const BAND_WEIGHT: Readonly<Record<DimensionFinding['band'], number>> = {
  refer: 2, watch: 1, clear: 0, partial: 0, not_assessed: 0, no_tool: 0,
};

/**
 * 這份 findings 的第三鍵：客戶的順序（缺的依固定順序補在後面），或固定順序。回傳新陣列，九個都在。
 */
export function dimensionOrderOf(findings: Pick<T2Findings, 't1' | 'child' | 'diagnosisDirection'>): DimensionCode[] {
  const customer = planT2(findings.t1, findings.child.assessedAgeMonth, findings.diagnosisDirection).functionOrder;
  if (customer === null) return [...FIXED_DIMENSION_ORDER];
  return [...customer, ...FIXED_DIMENSION_ORDER.filter(d => !customer.includes(d))];
}

/** 九個維度依 §8 排好（band → T1 標記 → 順序）。回傳的是輸入裡的原物件，不複製。 */
export function prioritizeDimensions(findings: T2Findings): DimensionFinding[] {
  const order = dimensionOrderOf(findings);
  const rank = (d: DimensionCode) => order.indexOf(d);
  return [...findings.dimensions].sort((a, b) =>
    BAND_WEIGHT[b.band] - BAND_WEIGHT[a.band]
    || b.t1Flag - a.t1Flag
    || rank(a.dimensionId) - rank(b.dimensionId));
}

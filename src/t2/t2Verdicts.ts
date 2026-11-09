/**
 * 做過 T2 的方面，家長端的面板與首頁概況改照 T2 的判定（2026-11-10 實際走一遍清單第 5 條）。
 *
 * 以前評估面板只讀 T1：T1 動作紅、T2 粗大動作做完判「需要少量支持」，面板仍寫「需要较多支持」，
 * T2 報告與線上家庭訓練卻寫「少量」—— 同一個方面兩種說法。
 *
 * 只取**真的有 T2 判定**的方面：band 是 clear／watch／refer，而且 `drivenBy` 有值（是某一支量表判的）。
 * 沒做、做了沒判定、只照 T1 推定的（v3 的 T1 綠且沒推量表也是 `clear`，但 `drivenBy` 是 null）一律不算，
 * 照舊顯示 T1。純函式；報告本身、存檔、後台都不經過這裡。
 */
import type { AssessmentStatus, DimensionScore } from '../types';
import { SITE_DIMENSION_ID } from './dimensionMap';
import type { DimensionCode } from './types';
import { STATUS_OF_BAND } from './weeklyCopy';

interface FindingLike {
  dimensionId: DimensionCode;
  band: string;
  drivenBy: string | null;
}

/** 報告快照（舊 `T2Findings` 與完整版 `T2FindingsV3` 都有 `dimensions`）→ 站內維度 id → 三級判定。 */
export function t2VerdictsFrom(findings: { dimensions?: ReadonlyArray<FindingLike> } | null | undefined): Record<string, AssessmentStatus> {
  const out: Record<string, AssessmentStatus> = {};
  for (const d of findings?.dimensions ?? []) {
    if (!d || !d.drivenBy) continue;
    if (d.band !== 'clear' && d.band !== 'watch' && d.band !== 'refer') continue;
    const id = SITE_DIMENSION_ID[d.dimensionId];
    if (id) out[id] = STATUS_OF_BAND[d.band];
  }
  return out;
}

/** T1 成績照 T2 判定換掉 `status`（分數不動）；沒有 T2 判定的方面原樣。 */
export function applyT2Verdicts(scores: ReadonlyArray<DimensionScore>, verdicts: Readonly<Record<string, AssessmentStatus>>): DimensionScore[] {
  return scores.map(s => (s.tierId === 'T1' && verdicts[s.dimensionId] ? { ...s, status: verdicts[s.dimensionId] } : s));
}

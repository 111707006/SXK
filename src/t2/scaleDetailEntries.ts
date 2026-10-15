/**
 * 報告快照的量表详解（規格 `t2-v3-scale-detail-report.md` §6，開關 `T2_SCALE_DETAIL`）。**只給伺服器用**：
 * 這裡要整套題庫（`KITV3_BANKS`），前端是一支一支延遲載入的，不能被前端 import。
 */

import { recentResultsV3, type ScaleDetailEntry } from './findingsV3';
import { KITV3_BANKS } from './kitv3';
import type { ToolResultV3 } from './kitv3/submit';
import { scaleDetailOf, type ScaleDetail } from './scaleDetail';

type ResultRecord = { createdAt: string; result: ToolResultV3 };

function detailOfResult(r: ToolResultV3): ScaleDetail | null {
  const bank = KITV3_BANKS[r.toolId];
  return bank ? scaleDetailOf({ bank, answers: r.answers, score: r.score, context: r.context }) : null;
}

/**
 * 算進報告的每一支（`recentResultsV3`，同快照的 `toolResults`）各一份详解；沒有详解的工具（氣質）不列。
 * `previous`：同一支在算進來那一筆之前、最後一次交的（不限 90 天）—— 畫面寫「上次 4/8 → 这次 6/8」。
 */
export function scaleDetailEntriesOf(records: ReadonlyArray<ResultRecord>, now: Date): ScaleDetailEntry[] {
  const out: ScaleDetailEntry[] = [];
  for (const cur of recentResultsV3(records, now)) {
    const detail = detailOfResult(cur.result);
    if (!detail) continue;
    const t = Date.parse(cur.createdAt);
    const earlier = records
      .filter(r => r.result.toolId === cur.result.toolId && Date.parse(r.createdAt) < t)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .pop();
    const prev = earlier ? detailOfResult(earlier.result) : null;
    out.push({
      toolId: cur.result.toolId,
      detail,
      ...(earlier && prev
        ? { previous: { computedAt: earlier.createdAt, facets: prev.facets.map(f => ({ key: f.key, counts: [...f.counts] as [number, number, number] })) } }
        : {}),
    });
  }
  return out;
}

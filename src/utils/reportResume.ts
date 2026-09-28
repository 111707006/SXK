/**
 * 「現在這份 T1 成績」對得上哪一份已生成的 T1 報告。
 *
 * 兩個地方要同一個答案：
 * - 家長端（`App.tsx` 的 `liveReportResume`）：即時報告接續上一份，T2 入口就掛在那份報告裡。
 * - B→A 交接（`src/handoff/core.ts`）：帶過去的報告必須是 A 端接得上的那一份，否則家長到了 A
 *   看到的是一頁要重按「生成」的報告、T2 入口不見了（ADR-0009）。
 *
 * 對得上＝同一組成績：每一筆的維度、層級、完成時間、分數都一樣（重做過 T1 就對不上）。
 */
import type { AssessmentRecord, DimensionScore } from '../types';

type ScoreKey = Pick<DimensionScore, 'dimensionId' | 'tierId' | 'completedAt' | 'score'>;

export function sameScoreSet(a: ReadonlyArray<ScoreKey>, b: ReadonlyArray<ScoreKey>): boolean {
  return (
    a.length === b.length &&
    a.every(s => b.some(t => t.dimensionId === s.dimensionId && t.tierId === s.tierId && t.completedAt === s.completedAt && t.score === s.score))
  );
}

/** 歷史裡與這組成績相同、有 AI 報告本文的最新一份 T1 報告；沒有就是 `null`。 */
export function latestT1ReportFor(
  history: ReadonlyArray<AssessmentRecord>,
  scores: ReadonlyArray<ScoreKey>,
): AssessmentRecord | null {
  const timeOf = (r: AssessmentRecord) => (typeof r.createdAt === 'string' ? r.createdAt : '');
  return history
    .filter(r => r.type === 'T1_SCREENING' && r.aiReport && Array.isArray(r.scores) && sameScoreSet(r.scores, scores))
    .reduce<AssessmentRecord | null>((latest, r) => (!latest || timeOf(r) >= timeOf(latest) ? r : latest), null);
}

import type { DimensionScore } from '../../types';
import { STATUS_WORDING } from '../../utils/statusWording';
import { Avatar, ListRow, SectionHead, STATUS_TONE, Tile } from './ui';

/**
 * Ledo 版 T1 報告的摘要（設計稿第 6、17 頁「先摘要後明細」）：三個數字色塊＋「先看这几项」清單。
 * 放在報告本體最上面，底下的完整報告一字不動 —— 判定、文字都不在這裡重算，只數 `scores` 的狀態、
 * 取報告快照裡那一方面的說明（新版報告的 `perDimension`；沒有就用狀態的固定句）。
 */
export default function LedoReportSummary({ scores, notes }: {
  scores: DimensionScore[];
  /** 新版報告每個被標記方面的說明（dimensionId → note）；舊報告沒有 */
  notes?: ReadonlyArray<{ dimensionId: string; note: string }>;
}) {
  const count = (st: DimensionScore['status']) => scores.filter(s => s.status === st).length;
  const flagged = scores
    .filter(s => s.status !== 'normal')
    .sort((a, b) => (a.status === 'delay' ? 0 : 1) - (b.status === 'delay' ? 0 : 1));
  const noteOf = (id: string) => notes?.find(n => n.dimensionId === id)?.note;

  return (
    <div className="space-y-3" data-testid="ledo-report-summary">
      <div className="grid grid-cols-3 gap-2">
        <Tile tone="ok" value={count('normal')} label={STATUS_WORDING.normal.label} />
        <Tile tone="mild" value={count('borderline')} label={STATUS_WORDING.borderline.label.replace(/^需要/, '')} />
        <Tile tone="more" value={count('delay')} label={STATUS_WORDING.delay.label.replace(/^需要/, '')} />
      </div>
      {flagged.length > 0 && (
        <>
          <SectionHead title="先看这几项" />
          <div className="space-y-2.5">
            {flagged.map(s => (
              <ListRow
                key={s.dimensionId}
                avatar={<Avatar tone={STATUS_TONE[s.status]} text={s.dimensionName.slice(0, 1)} />}
                title={s.dimensionName}
                sub={<span className="line-clamp-2">{noteOf(s.dimensionId) ?? STATUS_WORDING[s.status].tag}</span>}
                right={null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

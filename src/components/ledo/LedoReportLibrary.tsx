import type { AssessmentRecord } from '../../types';
import { STATUS_WORDING } from '../../utils/statusWording';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, PlayButton, SectionHead } from './ui';

/**
 * Ledo 版報告庫（設計稿第 5 頁）：「这次的报告」插畫大卡（打開即時報告），下面一行一份歸檔報告。
 * 舊版的資料庫說明文字拿掉。設計稿的分類膠囊（筛查／深度评估／历次对照）先不做：這一頁只有篩查報告，
 * 深度評估的報告在 T2 那一頁 —— 放一排只有一顆能按的膠囊沒有意義。
 */
export default function LedoReportLibrary({ childName, t1Count, history, onOpenLive, onOpenRecord }: {
  childName: string;
  /** 目前做了幾個方面的 T1（0＝還沒做，大卡不出） */
  t1Count: number;
  /** 歸檔的 T1 報告（新的在前） */
  history: AssessmentRecord[];
  onOpenLive: () => void;
  onOpenRecord: (record: AssessmentRecord) => void;
}) {
  const md = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const latest = history[0];

  return (
    <div id="ledo-report-library" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <Greeting small={`${childName}的报告`} title="评估报告" />

      {t1Count > 0 && (
        <button
          type="button"
          id="ledo-open-live-report"
          onClick={onOpenLive}
          className="relative block aspect-[4/3] w-full overflow-hidden rounded-[28px] bg-ledo-ok text-left cursor-pointer active:scale-[0.99] transition"
        >
          <img src={LEDO_ART.report} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <Chip tone="white">这次的报告{latest ? ` · ${md(latest.createdAt)}` : ''} · {t1Count}/9 个方面</Chip>
            <PlayButton />
          </span>
        </button>
      )}

      <SectionHead title="历次报告" action={history.length > 0 ? `${history.length} 份` : undefined} />
      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ledo-line py-6 text-center text-xs text-ledo-ink-2">暂无归档的 T1 综合评估</p>
      ) : (
        <div className="space-y-2.5">
          {history.map(rec => {
            const delay = rec.scores.filter(s => s.status === 'delay').length;
            const mild = rec.scores.filter(s => s.status === 'borderline').length;
            const parts = [
              delay > 0 ? `${delay} 项${STATUS_WORDING.delay.label}` : '',
              mild > 0 ? `${mild} 项${STATUS_WORDING.borderline.label}` : '',
            ].filter(Boolean);
            return (
              <ListRow
                key={rec.id}
                avatar={<Avatar tone={delay > 0 ? 'more' : mild > 0 ? 'mild' : 'ok'} text={md(rec.createdAt)} />}
                title="儿童综合发展评估报告"
                sub={parts.length > 0 ? parts.join(' · ') : STATUS_WORDING.normal.label}
                onClick={() => onOpenRecord(rec)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

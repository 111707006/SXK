/**
 * 「家长」分頁的「汇总」檢視（#69，規格 docs/specs/client-changes-2026-10-17.md §3.1）。
 *
 * 一個孩子一行（最近一次 T1，沒做過的不列）；與家長列表同一個視野、同一組篩選。
 * 欄位與導出的 `.xlsx` 是同一份（伺服器的 `buildSummaryTable`），這裡只負責畫：
 * 篩查渠道、年齡的字都由伺服器給，畫面不自己組。
 *
 * 導出鍵在上面；每按一次伺服器在 `admin_exports` 記一筆（誰、何時、範圍、笔数）。
 */
import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { adminApi } from '../adminApi';
import type { SummaryOptions } from '../parentSummary';
import { statusLabel, type AdminErrorView } from '../adminView';
import { Button, EmptyState, ErrorNote, Spinner, toErrorView, useAsyncData } from '../ui';

const CELL_SKIN: Record<string, string> = {
  delay: 'bg-red-100 text-red-800',
  borderline: 'bg-amber-100 text-amber-800',
  normal: 'bg-emerald-50 text-emerald-800',
};

function shanghaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export default function ParentSummaryView({
  options,
  onError,
}: {
  options: SummaryOptions;
  onError: (view: AdminErrorView) => void;
}) {
  const load = useCallback(() => adminApi.parentSummary(options), [options.sort, options.booked]);
  const { data, loading, failure, reload } = useAsyncData(load, [options.sort, options.booked], onError);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const runExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      const { blob, fileName } = await adminApi.exportParentSummary(options);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const view = toErrorView(err);
      onError(view);
      setExportError(view.message);
    } finally {
      setExporting(false);
    }
  };

  const dimensions = data?.dimensions ?? [];
  const rows = data?.rows ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-brand-charcoal/50">
          一个孩子一行，取最近一次筛查；没做过筛查的不列。九个方面的底色照报告的判定。
        </p>
        <Button onClick={runExport} busy={exporting} disabled={loading || rows.length === 0}>
          <Download size={12} />
          导出 xlsx
        </Button>
      </div>
      {exportError && <p className="mb-3 text-[11px] text-red-700">{exportError}</p>}

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="这个视野里还没有做过筛查的孩子" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-stone text-[10px] tracking-wide text-brand-charcoal/45">
                <th className="py-2 pr-3 font-bold">孩子名字</th>
                <th className="py-2 pr-3 font-bold">电话</th>
                <th className="py-2 pr-3 font-bold">年龄</th>
                <th className="py-2 pr-3 font-bold">筛查渠道</th>
                <th className="py-2 pr-3 font-bold">筛查日期</th>
                {dimensions.map(d => (
                  <th key={d.id} className="py-2 pr-1 text-center font-bold">
                    {d.name}
                  </th>
                ))}
                <th className="py-2 pr-3 text-right font-bold">需关注几个方面</th>
                <th className="py-2 text-right font-bold">发育指数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.userId} className="border-b border-brand-stone/60 last:border-0">
                  <td className="py-2 pr-3 font-bold text-brand-charcoal">{r.childName ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.phone ?? '—'}</td>
                  <td className="py-2 pr-3">{r.ageLabel ?? '—'}</td>
                  <td className="py-2 pr-3">{r.channel}</td>
                  <td className="py-2 pr-3 tabular-nums">{shanghaiDate(r.screenedAt)}</td>
                  {r.cells.map((c, i) => (
                    <td key={dimensions[i]?.id ?? i} className="py-1 pr-1 text-center">
                      {c ? (
                        <span
                          className={`inline-block min-w-[3rem] rounded-md px-1.5 py-1 font-bold tabular-nums ${CELL_SKIN[c.status] ?? ''}`}
                          title={statusLabel(c.status)}
                        >
                          {c.score}/{c.maxScore}
                        </span>
                      ) : (
                        <span className="text-brand-charcoal/30">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-right font-bold tabular-nums">{r.flaggedCount}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{r.developmentIndex ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10px] text-brand-charcoal/40">共 {rows.length} 个孩子。</p>
        </div>
      )}
    </div>
  );
}

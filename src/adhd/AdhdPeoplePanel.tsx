/**
 * 成人 ADHD 後台「受评者列表」（設計第 2.3 節）：一筆評估一行（誰、手機、單位、什麼時候做、主要結論），
 * 點「查看报告」在同一頁用客戶頁面只讀打開那一筆（iframe，`/assess/?admin-view=`），導出 `.xlsx`。
 */
import { useCallback, useState } from 'react';
import { adminApi } from '../admin/adminApi';
import type { AdminErrorView } from '../admin/adminView';
import { Button, EmptyState, ErrorNote, Panel, Spinner, toErrorView, useAsyncData } from '../admin/ui';
import { ASSESS_PATH } from './page';
import type { AdhdAdminListItem } from './adminRows';

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

export default function AdhdPeoplePanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const [page, setPage] = useState(1);
  const load = useCallback(() => adminApi.adhdAssessments(page), [page]);
  const { data, loading, failure, reload } = useAsyncData(load, [page], onError);
  const [open, setOpen] = useState<AdhdAdminListItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await adminApi.exportAdhdAssessments();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      onError(toErrorView(err));
    } finally {
      setExporting(false);
    }
  };

  if (open) {
    return (
      <Panel
        title={`${open.subjectName} · ${open.conclusionTitle}`}
        description={`${open.phone ?? ''} ${open.companyName ? `· ${open.companyName} ` : ''}· ${when(open.createdAt)}`}
        action={
          <Button variant="ghost" onClick={() => setOpen(null)}>
            返回列表
          </Button>
        }
      >
        <iframe
          title="评估报告"
          src={`${ASSESS_PATH}?admin-view=${open.id}`}
          className="w-full rounded-2xl border border-brand-stone"
          style={{ height: '80vh' }}
        />
      </Panel>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <Panel
      title="受评者列表"
      description="每一行是一次完成的评估（走到结果报告的那一份）。点「查看报告」看受评者当时看到的同一份报告。"
      action={
        <Button onClick={runExport} busy={exporting} disabled={!data || data.total === 0}>
          导出 Excel
        </Button>
      }
    >
      {loading && <Spinner />}
      {failure && <ErrorNote message={failure} onRetry={reload} />}
      {data && data.rows.length === 0 && <EmptyState title="还没有完成的评估" />}
      {data && data.rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-brand-charcoal/50">
                <tr>
                  <th className="py-2 pr-3">姓名</th>
                  <th className="py-2 pr-3">手机</th>
                  <th className="py-2 pr-3">单位</th>
                  <th className="py-2 pr-3">评估时间</th>
                  <th className="py-2 pr-3">主要结论</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-stone/50">
                {data.rows.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-bold text-brand-forest">{r.subjectName}</td>
                    <td className="py-2 pr-3">{r.phone ?? ''}</td>
                    <td className="py-2 pr-3">{r.companyName ?? '未归属'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{when(r.createdAt)}</td>
                    <td className="py-2 pr-3">{r.conclusionTitle}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setOpen(r)} className="font-bold text-brand-forest hover:underline">
                        查看报告
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <Button variant="ghost" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                上一页
              </Button>
              <span>
                {data.page} / {pages}（共 {data.total} 笔）
              </span>
              <Button variant="ghost" disabled={data.page >= pages} onClick={() => setPage(data.page + 1)}>
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

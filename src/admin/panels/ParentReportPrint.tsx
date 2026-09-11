/**
 * 列印用的一頁：只有報告本體，載入完成就叫出列印對話框（ADR-0007）。
 *
 * 【為什麼不是伺服器端產生 HTML】
 * 舊的 `/parents/:id/export` 是伺服器拼字串出的純 HTML，沒有 React、沒有 Tailwind。
 * 要讓它「長得跟家長看到的一樣」，等於用字串再實作一次整份報告（雷達圖、儀表、
 * 軌跡圖全部），而且之後每次改報告都要改兩處。改成在瀏覽器裡開同一個元件之後，
 * 紙上的樣子與螢幕上必然一致，也與家長端的「打印报告」走同一條路。
 *
 * 【資料仍然只有一條路】
 * 這一頁呼叫的是 `/api/admin/parents/:id`，與抽屜完全相同的那一支。issue #8 當初
 * 不讓匯出自己去查資料庫的理由（那會成為繞過公司範圍的第二條路）原封不動成立 ——
 * 新分頁只是再呼叫一次同一支端點，範圍條件仍在後端的 token 裡。
 */
import { useCallback, useEffect, useRef } from 'react';
import { adminApi } from '../adminApi';
import { useAsyncData } from '../ui';
import { latestReportOf } from '../../utils/reportHistory';
import ReportBody from '../../components/ReportBody';

export default function ParentReportPrint({ id }: { id: number }) {
  const load = useCallback(() => adminApi.parent(id), [id]);
  // 錯誤在這一頁自己顯示：這裡沒有管理中心的殼可以把 401／503 丟上去。
  const { data, loading, failure } = useAsyncData(load, [id], () => {});
  const printed = useRef(false);

  const report = data ? latestReportOf(data.parent.reportHistory) : null;

  useEffect(() => {
    document.title = data?.parent.childName
      ? `${data.parent.childName} 的发展报告`
      : '发展报告';
  }, [data]);

  useEffect(() => {
    if (!report || printed.current) return;
    // 等這一輪畫完（圖表是 SVG，同步渲染）再叫列印，否則紙上是一張空白頁。
    const timer = window.setTimeout(() => {
      // **旗標在計時器真的響了才立起來。** 寫在排程的當下會被 StrictMode 反殺：
      // 開發模式下 effect 跑兩遍（跑 → 清理 → 再跑），第一輪排的計時器被清理
      // 取消掉，第二輪卻因為旗標已經是 true 而直接 return —— 列印對話框永遠
      // 不會出現，而正式建置又是好的，於是這條路看起來只在本機壞掉。
      printed.current = true;
      window.print();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [report]);

  if (loading) {
    return <Message text="正在载入报告…" />;
  }
  if (failure) {
    return <Message text={failure} />;
  }
  if (!data) {
    return <Message text="找不到这位家长。" />;
  }
  if (!report?.aiReport) {
    return <Message text="这位家长还没有产生过发展报告，没有可以列印的内容。" />;
  }

  return (
    <div className="mx-auto max-w-4xl bg-brand-cream/20 p-4 sm:p-8 print:p-0">
      <ReportBody
        childName={report.childName}
        scores={report.scores}
        aiReport={report.aiReport}
        isAiGenerated={report.isAiGenerated}
        reportId={report.id}
      />
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-brand-charcoal/70">{text}</p>
    </div>
  );
}

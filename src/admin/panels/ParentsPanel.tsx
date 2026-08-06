/**
 * 家長列表、單筆詳情與匯出（issues #6 / #7 / #8）。
 *
 * 三者共用同一條取資料的路：後端的 `getParentDetail` 同時服務詳情與匯出，
 * 而列表與它們都經過同一個公司條件。前端這邊沒有任何「公司」的參數可以傳 ——
 * 視野在 token 裡，換視野要走 `/select-company`。
 */
import { useCallback, useState } from 'react';
import { Calendar, Download, FileText, Phone, Printer, User, X } from 'lucide-react';
import {
  adminApi,
  fetchParentExport,
  type AdminParentDetail,
  type AdminParentListItem,
} from '../adminApi';
import { formatDateTime, genderLabel, statusLabel, type AdminErrorView } from '../adminView';
import {
  Button,
  EmptyState,
  ErrorNote,
  Panel,
  Select,
  Spinner,
  StatusBadge,
  toErrorView,
  useAsyncData,
} from '../ui';

type Sort = 'newest' | 'oldest';
type Booked = 'all' | 'booked' | 'not_booked';

export default function ParentsPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const [sort, setSort] = useState<Sort>('newest');
  const [booked, setBooked] = useState<Booked>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => adminApi.parents(sort, booked), [sort, booked]);
  const { data, loading, failure, reload } = useAsyncData(load, [sort, booked], onError);
  const parents = data?.parents ?? [];

  return (
    <>
      <Panel
        title="家长列表"
        description="只包含当前视野内的家长。月龄与被标记的维度直接列出，让电话打得出去之前就知道该先联系谁。"
        action={
          <div className="flex gap-2">
            <Select value={sort} onChange={e => setSort(e.target.value as Sort)} className="w-auto">
              <option value="newest">最近筛查在前</option>
              <option value="oldest">最早筛查在前</option>
            </Select>
            <Select value={booked} onChange={e => setBooked(e.target.value as Booked)} className="w-auto">
              <option value="all">全部</option>
              <option value="booked">已预约专家</option>
              <option value="not_booked">尚未预约</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : failure ? (
          <ErrorNote message={failure} onRetry={reload} />
        ) : parents.length === 0 ? (
          <EmptyState
            title="这个视野里还没有家长"
            hint="家长要从这家公司的进站连结（带 ?c= 识别码）注册，才会归属到这里。既有家长不会被批次指派。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                  <th className="py-2 pr-3 font-bold">孩子</th>
                  <th className="py-2 pr-3 font-bold">月龄</th>
                  <th className="py-2 pr-3 font-bold">被标记的维度</th>
                  <th className="py-2 pr-3 font-bold">最近筛查</th>
                  <th className="py-2 pr-3 font-bold">预约</th>
                  <th className="py-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {parents.map(p => (
                  <ParentRow key={p.id} parent={p} onOpen={() => setOpenId(p.id)} />
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-brand-charcoal/40">
              共 {parents.length} 位家长。后端一次最多回 500 笔。
            </p>
          </div>
        )}
      </Panel>

      {openId !== null && (
        <ParentDetailModal id={openId} onClose={() => setOpenId(null)} onError={onError} />
      )}
    </>
  );
}

function ParentRow({ parent, onOpen }: { parent: AdminParentListItem; onOpen: () => void }) {
  return (
    <tr className="border-b border-brand-stone/60 last:border-0">
      <td className="py-2.5 pr-3">
        <span className="font-bold text-brand-forest">{parent.childName || '未填姓名'}</span>
        <span className="ml-1.5 text-brand-charcoal/40">{genderLabel(parent.childGender)}</span>
      </td>
      <td className="py-2.5 pr-3 text-brand-charcoal/70">
        {parent.childAgeMonth === null ? '—' : `${parent.childAgeMonth} 个月`}
      </td>
      <td className="py-2.5 pr-3">
        {parent.flaggedDimensions.length === 0 ? (
          <span className="text-brand-charcoal/40">无</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {parent.flaggedDimensions.map(d => (
              <StatusBadge key={d.dimensionId} status={d.status}>
                {d.dimensionName}
              </StatusBadge>
            ))}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-brand-charcoal/60">{formatDateTime(parent.screenedAt)}</td>
      <td className="py-2.5 pr-3">
        {parent.hasBooking ? (
          <span className="font-bold text-brand-moss">已预约</span>
        ) : (
          <span className="text-brand-charcoal/40">—</span>
        )}
      </td>
      <td className="py-2.5 text-right">
        <Button variant="ghost" onClick={onOpen}>
          查看
        </Button>
      </td>
    </tr>
  );
}

function ParentDetailModal({
  id,
  onClose,
  onError,
}: {
  id: number;
  onClose: () => void;
  onError: (view: AdminErrorView) => void;
}) {
  const load = useCallback(() => adminApi.parent(id), [id]);
  const { data, loading, failure, reload } = useAsyncData(load, [id], onError);
  const [exportFailure, setExportFailure] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  function reportExportError(err: unknown) {
    const view = toErrorView(err);
    if (view.action === 'none') setExportFailure(view.message);
    else onError(view);
  }

  function openExport() {
    setExportFailure(null);
    setPopupBlocked(false);
    // window.open 必須在點擊的當下同步呼叫，否則會被弹出視窗封鎖擋下。
    // 因此先開一個空白視窗，再把抓回來的內容填進去。
    const win = window.open('', '_blank');
    if (!win) {
      setPopupBlocked(true);
      return;
    }
    win.document.write('<p style="font-family:sans-serif;padding:24px">正在准备汇出内容…</p>');

    fetchParentExport(id)
      .then(html => {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        // 匯出的是一頁可列印的 HTML，由浏览器「列印 → 另存为 PDF」。
        // 直接叫出列印对话框，省掉一步找选单。
        if (win.document.readyState === 'complete') win.print();
        else win.addEventListener('load', () => win.print(), { once: true });
      })
      .catch(err => {
        win.close();
        reportExportError(err);
      });
  }

  /**
   * 彈出視窗被擋掉時的備援：把同一份 HTML 存成檔案。
   *
   * 沒有這條路的話，一個把弹出視窗全部封鎖的浏览器（企業環境很常見）會讓匯出
   * 變成一顆按了沒反應的按鈕 —— 而使用者不會知道要去改浏览器設定。
   * 存下來的是同一份可列印的 HTML，開啟後一樣「列印 → 另存为 PDF」。
   */
  async function downloadExport() {
    setExportFailure(null);
    try {
      const html = await fetchParentExport(id);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `筛查资料-${data?.parent.childName || id}.html`;
      // 掛進 document 再點，而且**不要同步 revoke**：部分瀏覽器在 click() 回傳
      // 之後才非同步啟動下載，此時 object URL 已被撤銷，結果是按鈕按了沒反應也
      // 沒有錯誤訊息 —— 而這條路本身就是彈出視窗被擋掉後的最後一條路。
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 0);
      setPopupBlocked(false);
    } catch (err) {
      reportExportError(err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-charcoal/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-brand-stone bg-white"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-brand-stone px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-brand-forest">
              {data?.parent.childName || (loading ? '载入中…' : '家长资料')}
            </h3>
            {data && (
              <p className="mt-0.5 text-[11px] text-brand-charcoal/50">
                {data.parent.childAgeMonth === null ? '月龄未填' : `${data.parent.childAgeMonth} 个月`}
                　{genderLabel(data.parent.childGender)}
                　注册于 {formatDateTime(data.parent.registeredAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <Button variant="ghost" onClick={openExport}>
                <Printer size={12} />
                汇出
              </Button>
            )}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="rounded-lg p-1.5 text-brand-charcoal/50 transition hover:bg-brand-sage"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5">
          {exportFailure && <ErrorNote message={exportFailure} />}
          {popupBlocked && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs leading-relaxed text-amber-900">
                浏览器拦截了新视窗。可以允许本站开启弹出视窗后重试，或直接把汇出内容存成档案。
              </p>
              <Button variant="ghost" onClick={() => void downloadExport()}>
                <Download size={12} />
                改为下载
              </Button>
            </div>
          )}
          {loading ? (
            <Spinner />
          ) : failure ? (
            <ErrorNote message={failure} onRetry={reload} />
          ) : data ? (
            <ParentDetailBody parent={data.parent} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ParentDetailBody({ parent }: { parent: AdminParentDetail }) {
  const latestReport = parent.reportHistory
    .filter(r => r.aiReport)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const ai = latestReport?.aiReport;

  return (
    <>
      <Section icon={<Phone size={12} />} title="联络方式">
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <Row label="帐号信箱" value={parent.email || '—'} />
          <Row label="注册手机" value={parent.phone || '—'} />
          {parent.bookings[0] && (
            <>
              <Row label="预约联络人" value={parent.bookings[0].parentName} />
              <Row label="预约联络手机" value={parent.bookings[0].parentPhone} />
            </>
          )}
        </dl>
      </Section>

      <Section icon={<FileText size={12} />} title="九维筛查结果">
        {parent.scores.length === 0 ? (
          <p className="text-xs text-brand-charcoal/50">尚未完成筛查。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                  <th className="py-1.5 pr-3 font-bold">维度</th>
                  <th className="py-1.5 pr-3 font-bold">层级</th>
                  <th className="py-1.5 pr-3 font-bold">得分</th>
                  <th className="py-1.5 font-bold">判定</th>
                </tr>
              </thead>
              <tbody>
                {parent.scores.map(s => (
                  <tr key={`${s.dimensionId}-${s.tierId}`} className="border-b border-brand-stone/60 last:border-0">
                    <td className="py-1.5 pr-3 text-brand-forest">{s.dimensionName}</td>
                    <td className="py-1.5 pr-3 text-brand-charcoal/60">{s.tierId}</td>
                    <td className="py-1.5 pr-3 text-brand-charcoal/70">
                      {s.score} / {s.maxScore}
                    </td>
                    <td className="py-1.5">
                      <StatusBadge status={s.status}>{statusLabel(s.status)}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={<Calendar size={12} />} title="专家预约">
        {parent.bookings.length === 0 ? (
          <p className="text-xs text-brand-charcoal/50">尚未送出预约。</p>
        ) : (
          <div className="space-y-2">
            {parent.bookings.map(b => (
              <div key={b.id} className="rounded-2xl border border-brand-stone bg-brand-cream/40 px-4 py-3">
                <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <Row label="指定专家" value={b.specialistName || `#${b.specialistId}`} />
                  <Row label="希望时段" value={b.preferredSlot || '未指定'} />
                  <Row label="状态" value={b.status} />
                  <Row label="送出时间" value={formatDateTime(b.createdAt)} />
                </dl>
                {b.reportSummary && (
                  <p className="mt-2 border-t border-brand-stone pt-2 text-[11px] leading-relaxed text-brand-charcoal/60">
                    {b.reportSummary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<User size={12} />} title="AI 发展报告">
        {!ai ? (
          <p className="text-xs text-brand-charcoal/50">尚未产生 AI 发展报告。</p>
        ) : (
          <div className="space-y-3 text-xs leading-relaxed text-brand-charcoal/80">
            <Para label="总结" text={ai.summary} />
            <Para label="神经环路分析" text={ai.neuralPathwayAnalysis} />
            <Bullets label="康复建议" items={ai.rehabSuggestions} />
            <Bullets label="家庭指导" items={ai.homeGuidance} />
            <Para label="预后预判" text={ai.prognosisPrediction} />
            <p className="text-[10px] text-brand-charcoal/40">
              报告来源：
              {latestReport?.isAiGenerated === true
                ? 'AI 生成'
                : latestReport?.isAiGenerated === false
                  ? '本地模板'
                  : '未记录'}
              　产生时间：{formatDateTime(latestReport?.createdAt ?? null)}
            </p>
          </div>
        )}
      </Section>
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-brand-forest">
        <span className="text-brand-moss">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-brand-charcoal/45">{label}</dt>
      <dd className="text-brand-charcoal/80">{value}</dd>
    </div>
  );
}

function Para({ label, text }: { label: string; text: string }) {
  return (
    <p>
      <span className="font-bold text-brand-forest">{label}：</span>
      {text}
    </p>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="font-bold text-brand-forest">{label}：</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

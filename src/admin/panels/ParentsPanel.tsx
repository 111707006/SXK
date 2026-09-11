/**
 * 家長列表、單筆詳情與列印（issues #6 / #7 / #8、ADR-0007）。
 *
 * 三者共用同一條取資料的路：後端的 `getParentDetail` 同時服務詳情與列印頁，
 * 而列表與它們都經過同一個公司條件。前端這邊沒有任何「公司」的參數可以傳 ——
 * 視野在 token 裡，換視野要走 `/select-company`。
 *
 * 【詳情裡的報告就是家長看到的那一份】（ADR-0007）
 * 客服接的是家長的電話。家長說「我看到那個儀表 72%」，客服得看得到同一個 72%，
 * 所以這裡嵌的是家長端那個 `ReportBody`，不是另做一份給專家判讀的版本。
 * 裡頭有幾張圖是裝飾性的（發育軌跡的四個數字每個孩子都一樣、百分位沒有常模）——
 * **不要只在後台把它們修掉**，那會讓兩邊分岔。要改就改共用元件。
 *
 * 【列表看現況、詳情看快照】
 * 列表的燈號來自篩查結果（現況），詳情的報告是快照。家長重測而沒有再生成報告時
 * 兩者分岔，此時詳情頂端會說出來，底下的「九维筛查结果」表就是現況那一份。
 */
import { useCallback, useState } from 'react';
import { AlertTriangle, Calendar, FileText, Phone, Printer, User, X } from 'lucide-react';
import {
  adminApi,
  type AdminParentDetail,
  type AdminParentListItem,
} from '../adminApi';
import {
  formatDateTime,
  genderLabel,
  screeningNewerThanReport,
  statusLabel,
  type AdminErrorView,
} from '../adminView';
import { ageBandDrift } from '../../utils/ageBandDrift';
import { latestReportOf, screeningReportCount } from '../../utils/reportHistory';
import { isOfflineService, serviceTypeLabel } from '../../utils/serviceTypes';
import ReportBody from '../../components/ReportBody';
import {
  Button,
  EmptyState,
  ErrorNote,
  LinkButton,
  Panel,
  Select,
  Spinner,
  StatusBadge,
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

  return (
    <>
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
              {/*
                列印開的是同一份報告本體的另一個分頁（ADR-0007）。做成**連結**而不是
                `onClick` 裡的 `window.open`：腳本開的視窗會被彈出視窗封鎖擋掉，
                而被擋掉的樣子是一顆按了沒反應的按鈕，使用者不會知道要去改瀏覽器設定。
              */}
              {data && (
                <LinkButton href={`/admin/parents/${id}/print`} target="_blank" rel="noopener">
                  <Printer size={12} />
                  打印报告
                </LinkButton>
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
    </>
  );
}


function ParentDetailBody({ parent }: { parent: AdminParentDetail }) {
  const latestReport = latestReportOf(parent.reportHistory);
  // 只算篩查報告：整串 `reportHistory` 還包含深度評估與沒生成過報告的篩查紀錄，
  // 拿它的長度去說「共 N 份」會報一個與畫面上那一份對不起來的數字。
  const reportCount = screeningReportCount(parent.reportHistory);
  const crossBand = ageBandDrift(parent.childAgeMonth, parent.assessedAgeMonth);
  // 報告是快照、下面那張表是現況。分岔時必須說出來，不能只挑一邊顯示。
  const newerScreeningAt = screeningNewerThanReport(parent.scores, latestReport?.createdAt ?? null);

  return (
    <>
      {newerScreeningAt && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            下方这份报告产生于 {formatDateTime(latestReport?.createdAt ?? null)}，之后这位家长在{' '}
            {formatDateTime(newerScreeningAt)} 又做了一次筛查，没有再生成报告。
            <span className="font-bold">家长现在看到的灯号是下面「九维筛查结果」那一张表</span>
            ，与这份报告不一定相同。
          </p>
        </div>
      )}

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

      <Section icon={<FileText size={12} />} title="九维筛查结果（现况）">
        {/*
          测评月龄与年龄段必须写在分数**上面**。分数是照当时那一段的题目与判准算出来的，
          而标头那个月龄是照今天算的 —— 孩子跨段之后两者会分岔，此时照今天的年龄段去
          读下面这张表就会读错，而画面上看不出任何异状。

          没有分数就不写这一行：那时没有一张要读的表，一句「未记录测评月龄」只是杂讯。
        */}
        {parent.scores.length > 0 && (
          <p className="mb-2 text-[11px] text-brand-charcoal/60">
            筛查当时：
            {parent.assessedAgeMonth === null
              ? '未记录测评月龄（本栏位之前存下的旧资料）'
              : `${parent.assessedAgeMonth} 个月・${parent.assessedBandName}`}
            {crossBand && (
              <span className="ml-1 font-bold text-amber-700">
                （孩子现在已进入「{crossBand.currentBand.name}」，与下表不同段）
              </span>
            )}
          </p>
        )}
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
                {/*
                  服務類型放在最前面（issue #21）。四種預約共用這一個區塊，
                  而客服要照類型分工 —— 線上的排連線、線下的排時間與地點。
                  說法與通知、家長端共用同一份（`serviceTypeLabel`），三處各寫
                  一份的話，同一筆預約在後台與在通知裡會有兩種名字。
                */}
                <p className="mb-2 inline-flex items-center rounded-full border border-brand-moss/30 bg-brand-sage/20 px-2.5 py-0.5 text-[10px] font-bold text-brand-forest">
                  {serviceTypeLabel(b.serviceType)}
                </p>
                <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <Row label="指定专家" value={b.specialistName || `#${b.specialistId}`} />
                  <Row label="希望时段" value={b.preferredSlot || '未指定'} />
                  <Row label="状态" value={b.status} />
                  <Row label="送出时间" value={formatDateTime(b.createdAt)} />
                </dl>
                {/*
                  線下的地點**不在系統裡**（本 issue 的取捨：據點資訊常變）。
                  在這裡說出來，後台成員才不會去找一個從來不存在的地址欄位，
                  而既有的狀態流轉就是承接它的地方。
                */}
                {isOfflineService(b.serviceType) && (
                  <p className="mt-2 text-[10px] leading-relaxed text-brand-clay">
                    线下地点不在系统内 —— 请致电与家长约定后，把状态改为 scheduled。
                  </p>
                )}
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

      <Section icon={<User size={12} />} title="家长看到的报告">
        {!latestReport?.aiReport ? (
          <p className="text-xs text-brand-charcoal/50">尚未产生 AI 发展报告。</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-brand-charcoal/40">
              报告来源：
              {latestReport.isAiGenerated === true
                ? 'AI 生成'
                : latestReport.isAiGenerated === false
                  ? '本地模板'
                  : '未记录'}
              　产生时间：{formatDateTime(latestReport.createdAt)}
              {reportCount > 1 && `　共 ${reportCount} 份，此为最近一份`}
            </p>
            {/*
              抽屜比家長的手機窄，而報告本體是照手機排的。`-mx-2` 把它撐回卡片邊緣，
              讓九宮格在這個寬度下仍排得成三欄。
            */}
            <div className="-mx-2">
              <ReportBody
                childName={latestReport.childName}
                scores={latestReport.scores}
                aiReport={latestReport.aiReport}
                isAiGenerated={latestReport.isAiGenerated}
                reportId={latestReport.id}
              />
            </div>
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

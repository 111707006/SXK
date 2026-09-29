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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, FileText, MessageSquare, Phone, Printer, Trash2, User, X } from 'lucide-react';
import {
  adminApi,
  type AdminInviteConfig,
  type AdminInviteReport,
  type AdminParentDetail,
  type AdminParentListItem,
} from '../adminApi';
import {
  INVITE_COOLDOWN_DAYS,
  INVITE_STATUS_LABEL,
  inviteBatches,
  inviteStatus,
  type InviteStatus,
} from '../../handoff/invite';
import {
  byScreeningTotalAsc,
  deletionChallenge,
  formatDateTime,
  formatScore,
  genderLabel,
  isBookingInProgress,
  matchesChallenge,
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
  Field,
  LinkButton,
  Panel,
  Select,
  Spinner,
  StatusBadge,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

/**
 * `score_low`（总分低的在前）是**畫面上**排的：後端照最近篩查取回最多 500 筆，這裡再照得分率
 * 重排。超過 500 位家長時排的只是最近那 500 位 —— 與「被標記的維度」一樣，清單本來就只看這一批。
 */
type Sort = 'newest' | 'oldest' | 'score_low';
type Booked = 'all' | 'booked' | 'not_booked';

/**
 * @param canInvite 這位後台成員能不能發 B→A 的邀請簡訊（ADR-0009：只有專案 B 的全域管理員）。
 *   能的話再問伺服器交接開了沒（`/handoff-invites/config`），開了才出現勾選欄與「发送邀请简讯」。
 * @param showSource 列「来源」欄（ADR-0009：專案 A 看得出誰是從篩查系統轉進來的、那時是哪一家合作公司）。
 */
export default function ParentsPanel({
  onError,
  canInvite = false,
  showSource = false,
}: {
  onError: (view: AdminErrorView) => void;
  canInvite?: boolean;
  showSource?: boolean;
}) {
  const [sort, setSort] = useState<Sort>('newest');
  const [booked, setBooked] = useState<Booked>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const serverSort = sort === 'oldest' ? 'oldest' : 'newest';
  const load = useCallback(() => adminApi.parents(serverSort, booked), [serverSort, booked]);
  const { data, loading, failure, reload } = useAsyncData(load, [serverSort, booked], onError);
  const loaded = data?.parents ?? [];
  const parents = sort === 'score_low' ? [...loaded].sort(byScreeningTotalAsc) : loaded;

  const [inviteConfig, setInviteConfig] = useState<AdminInviteConfig | null>(null);
  useEffect(() => {
    if (!canInvite) return;
    let cancelled = false;
    adminApi
      .inviteConfig()
      .then(config => {
        if (!cancelled) setInviteConfig(config);
      })
      .catch(() => {
        // 問不到就當作沒開：少一欄，不是一個錯誤。
      });
    return () => {
      cancelled = true;
    };
  }, [canInvite]);
  const inviting = inviteConfig?.enabled === true;

  // 每一列的邀請狀態算一次：列表、勾選、「全选可邀请」都看同一份。
  const statuses = useMemo(() => {
    const now = new Date();
    return new Map(
      parents.map(p => [
        p.id,
        inviteStatus(
          { phone: p.phone, hasScreening: p.screeningTotal !== null, lastInvitedAt: p.lastInvitedAt, handoffUsedAt: p.handoffUsedAt },
          now,
        ),
      ]),
    );
  }, [parents]);
  const eligibleIds = parents.filter(p => statuses.get(p.id) === 'eligible').map(p => p.id);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every(id => selected.has(id));

  return (
    <>
      <Panel
        title="家长列表"
        description="只包含当前视野内的家长。月龄、筛查总分与被标记的维度（附该维度得分）直接列出，让电话打得出去之前就知道该先联系谁。"
        action={
          <div className="flex gap-2">
            <Select value={sort} onChange={e => setSort(e.target.value as Sort)} className="w-auto">
              <option value="newest">最近筛查在前</option>
              <option value="oldest">最早筛查在前</option>
              <option value="score_low">总分低的在前</option>
            </Select>
            <Select value={booked} onChange={e => setBooked(e.target.value as Booked)} className="w-auto">
              <option value="all">全部</option>
              <option value="booked">已预约专家</option>
              <option value="not_booked">尚未预约</option>
            </Select>
          </div>
        }
      >
        {/* 不跟著列表的載入狀態開關：送完會重讀列表，這一條要是跟著卸掉，送出的結果就跟著不見了。 */}
        {inviting && (
          <InviteBar
            config={inviteConfig!}
            selectedIds={[...selected].filter(id => statuses.get(id) === 'eligible')}
            eligibleCount={eligibleIds.length}
            onDone={() => {
              setSelected(new Set());
              reload();
            }}
          />
        )}
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
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead>
                <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                  {inviting && (
                    <th className="py-2 pr-2 font-bold">
                      <input
                        type="checkbox"
                        aria-label="全选可邀请的家长"
                        title="全选可邀请的家长"
                        checked={allEligibleSelected}
                        disabled={eligibleIds.length === 0}
                        onChange={() => setSelected(allEligibleSelected ? new Set() : new Set(eligibleIds))}
                      />
                    </th>
                  )}
                  <th className="py-2 pr-3 font-bold">孩子</th>
                  <th className="py-2 pr-3 font-bold">月龄</th>
                  <th className="py-2 pr-3 font-bold">筛查总分</th>
                  <th className="py-2 pr-3 font-bold">被标记的维度</th>
                  <th className="py-2 pr-3 font-bold">最近筛查</th>
                  <th className="py-2 pr-3 font-bold">预约</th>
                  {inviting && <th className="py-2 pr-3 font-bold">深度评估邀请</th>}
                  {showSource && <th className="py-2 pr-3 font-bold">来源</th>}
                  <th className="py-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {parents.map(p => (
                  <ParentRow
                    key={p.id}
                    parent={p}
                    onOpen={() => setOpenId(p.id)}
                    showSource={showSource}
                    invite={
                      inviting
                        ? { status: statuses.get(p.id)!, selected: selected.has(p.id), onToggle: () => toggle(p.id) }
                        : undefined
                    }
                  />
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
        <ParentDetailModal
          id={openId}
          onClose={() => setOpenId(null)}
          onError={onError}
          onDeleted={() => {
            // 先關抽屜再重抓列表：那位家長已經不存在了，抽屜開著只會在下一次
            // 重新整理時撞上 404。
            setOpenId(null);
            reload();
          }}
        />
      )}
    </>
  );
}

/**
 * 「发送邀请简讯」那一條（ADR-0009；使用者 2026-09-28：後台一次發送）。按下先確認一次（會真的發簡訊、
 * 要付費），確認後把勾選的人切成一批一批送，最後說清楚送了幾位、跳過幾位（為什麼）、失敗幾位。
 */
function InviteBar({
  config,
  selectedIds,
  eligibleCount,
  onDone,
}: {
  config: AdminInviteConfig;
  selectedIds: number[];
  eligibleCount: number;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AdminInviteReport | null>(null);
  const [error, setError] = useState('');

  const send = async () => {
    setSending(true);
    setError('');
    const total: AdminInviteReport = { sent: [], skipped: [], failed: [] };
    try {
      for (const batch of inviteBatches(selectedIds)) {
        const report = await adminApi.sendInvites(batch);
        total.sent.push(...report.sent);
        total.skipped.push(...report.skipped);
        total.failed.push(...report.failed);
      }
    } catch (err: any) {
      setError(err?.message || '发送失败。');
    }
    setResult(total);
    setSending(false);
    setConfirming(false);
    onDone();
  };

  const skippedReasons = result
    ? Object.entries(
        result.skipped.reduce<Record<string, number>>((acc, s) => {
          acc[s.reason] = (acc[s.reason] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([reason, n]) => `${INVITE_STATUS_LABEL[reason as InviteStatus] ?? '不在这个视野'} ${n} 位`)
        .join('、')
    : '';

  return (
    <div className="mb-4 rounded-2xl border border-brand-stone bg-brand-cream/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-brand-charcoal/70">
          <MessageSquare size={12} className="mr-1 inline text-brand-moss" />
          勾选家长后发一则简讯，邀请到深度评估（连结点开就登入、带着筛查结果，不过期）。可邀请 {eligibleCount} 位；
          同一位家长 {INVITE_COOLDOWN_DAYS} 天内只发一封，已经去过的不再发。
        </p>
        <Button
          variant="primary"
          disabled={!config.ready || selectedIds.length === 0 || sending}
          onClick={() => setConfirming(true)}
        >
          发送邀请简讯（{selectedIds.length} 位）
        </Button>
      </div>
      {!config.ready && (
        <p className="mt-2 font-bold text-amber-800">
          邀请简讯还不能发：缺少 {(config.missing ?? []).join('、')}。范本要先在阿里云审核通过，再设进伺服器的 .env。
        </p>
      )}
      {confirming && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="font-bold text-amber-900">
            确定要发 {selectedIds.length} 则简讯吗？简讯会真的送出、按条计费，送出后收不回来。
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" busy={sending} disabled={sending} onClick={send}>
              确定发送
            </Button>
            <Button variant="ghost" disabled={sending} onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        </div>
      )}
      {result && (
        <p className="mt-2 text-brand-charcoal/80" role="status">
          已送出 {result.sent.length} 位
          {result.skipped.length > 0 && `；跳过 ${result.skipped.length} 位（${skippedReasons}）`}
          {result.failed.length > 0 && `；失败 ${result.failed.length} 位（${result.failed[0].detail}）`}。
        </p>
      )}
      {error && <p className="mt-2 font-bold text-amber-800">{error}</p>}
    </div>
  );
}

function ParentRow({
  parent,
  onOpen,
  showSource,
  invite,
}: {
  parent: AdminParentListItem;
  onOpen: () => void;
  showSource: boolean;
  invite?: { status: InviteStatus; selected: boolean; onToggle: () => void };
}) {
  return (
    <tr className="border-b border-brand-stone/60 last:border-0">
      {invite && (
        <td className="py-2.5 pr-2">
          <input
            type="checkbox"
            aria-label="选取这位家长"
            checked={invite.selected}
            disabled={invite.status !== 'eligible'}
            onChange={invite.onToggle}
          />
        </td>
      )}
      <td className="py-2.5 pr-3">
        <span className="font-bold text-brand-forest">{parent.childName || '未填姓名'}</span>
        <span className="ml-1.5 text-brand-charcoal/40">{genderLabel(parent.childGender)}</span>
      </td>
      <td className="py-2.5 pr-3 text-brand-charcoal/70">
        {parent.childAgeMonth === null ? '—' : `${parent.childAgeMonth} 个月`}
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap">
        {parent.screeningTotal === null ? (
          <span className="text-brand-charcoal/40">未筛查</span>
        ) : (
          <span className="font-bold text-brand-forest">{formatScore(parent.screeningTotal)}</span>
        )}
      </td>
      <td className="py-2.5 pr-3">
        {parent.flaggedDimensions.length === 0 ? (
          <span className="text-brand-charcoal/40">无</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {parent.flaggedDimensions.map(d => (
              <StatusBadge key={d.dimensionId} status={d.status}>
                {d.dimensionName} {formatScore(d)}
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
      {invite && (
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <span className={invite.status === 'eligible' ? 'font-bold text-brand-moss' : 'text-brand-charcoal/50'}>
            {INVITE_STATUS_LABEL[invite.status]}
          </span>
          {parent.lastInvitedAt && (
            <span className="ml-1 text-[10px] text-brand-charcoal/40">上次 {formatDateTime(parent.lastInvitedAt)}</span>
          )}
        </td>
      )}
      {showSource && (
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <SourceCell source={parent.handoffSource} />
        </td>
      )}
      <td className="py-2.5 text-right">
        <Button variant="ghost" onClick={onOpen}>
          查看
        </Button>
      </td>
    </tr>
  );
}

/**
 * 「来源」一格（ADR-0009）：從篩查系統轉進來的，寫那時的合作公司與第一次轉入的時間；
 * 那邊的家長沒有合作公司就只寫「从筛查系统转入」。自己在這裡登入註冊的寫「直接注册」。
 */
function SourceCell({ source }: { source: AdminParentListItem['handoffSource'] }) {
  if (!source) return <span className="text-brand-charcoal/40">直接注册</span>;
  return (
    <span className="flex flex-col">
      <span className="font-bold text-brand-moss">从筛查系统转入</span>
      <span className="text-[10px] text-brand-charcoal/50">
        {source.companyName ? `${source.companyName} · ` : ''}
        {formatDateTime(source.at)}
      </span>
    </span>
  );
}

function ParentDetailModal({
  id,
  onClose,
  onError,
  onDeleted,
}: {
  id: number;
  onClose: () => void;
  onError: (view: AdminErrorView) => void;
  onDeleted: () => void;
}) {
  const load = useCallback(() => adminApi.parent(id), [id]);
  const { data, loading, failure, reload } = useAsyncData(load, [id], onError);
  const [confirming, setConfirming] = useState(false);

  return (
    /*
      確認框是這個抽屜的**兄弟，不是子孫**。
      放進下面那層 `onClick={onClose}` 的遮罩裡的話，點確認框自己的遮罩想反悔時，
      那一次點擊會先觸發 onCancel、再往上冒泡撞到 onClose —— 抽屜跟著一起關掉，
      使用者被丟回列表，還得重新找一次剛剛那一列。
    */
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
              {data && (
                <>
                  {/*
                    列印開的是同一份報告本體的另一個分頁（ADR-0007）。做成**連結**而不是
                    `onClick` 裡的 `window.open`：腳本開的視窗會被彈出視窗封鎖擋掉，
                    而被擋掉的樣子是一顆按了沒反應的按鈕，使用者不會知道要去改瀏覽器設定。
                  */}
                  <LinkButton href={`/admin/parents/${id}/print`} target="_blank" rel="noopener">
                    <Printer size={12} />
                    打印报告
                  </LinkButton>
                  {/*
                    刪除是硬刪、不留紀錄（ADR-0006）。這顆按鈕只負責打開確認框 ——
                    真正的動作在那裡，而那裡會要求照著這位家長的資料打一段字。
                  */}
                  <Button variant="danger" onClick={() => setConfirming(true)}>
                    <Trash2 size={12} />
                    删除家长
                  </Button>
                </>
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

      {confirming && data && (
        <DeleteParentModal
          parent={data.parent}
          onCancel={() => setConfirming(false)}
          onDeleted={onDeleted}
          onError={onError}
        />
      )}
    </>
  );
}


/**
 * 刪除家長的確認框（ADR-0006）。
 *
 * 【為什麼要打字，不是「確定嗎？」】
 * 刪除是硬刪：`users` 那一列不見，外鍵連帶刪掉孩子檔案、篩查結果、報告、掃碼
 * 連結與解鎖權益，而且**不留紀錄**。列表上兩位家長的「查看」按鈕只差幾個像素，
 * 點錯的成本是另一位家長的全部資料。要求照著這位家長的資料打一段字，打錯的
 * 就是打錯的那一位。
 *
 * 【為什麼要把會刪掉什麼列出來】
 * 後台成員的心智模型多半是「刪掉這筆列表項目」。掃碼帶走的報告連結從此 404、
 * 付費解鎖的權益一併消失 —— 這兩件事不寫出來沒有人會想到。
 */
function DeleteParentModal({
  parent,
  onCancel,
  onDeleted,
  onError,
}: {
  parent: AdminParentDetail;
  onCancel: () => void;
  onDeleted: () => void;
  onError: (view: AdminErrorView) => void;
}) {
  const challenge = deletionChallenge(parent);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const activeBookings = parent.bookings.filter(b => isBookingInProgress(b.status));
  const reportCount = screeningReportCount(parent.reportHistory);
  const ready = matchesChallenge(challenge, typed);

  async function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await adminApi.deleteParent(parent.id);
      onDeleted();
    } catch (err) {
      const view = toErrorView(err);
      // 「有付款紀錄」是這個畫面自己要說的話：使用者的下一步是去找對帳的人，
      // 不是重新登入或換公司。只有處理不了的錯誤才丟給管理中心的殼。
      if (view.action === 'none') setFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-brand-charcoal/60 p-4 sm:p-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-red-200 bg-white"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-brand-stone px-5 py-4">
          <Trash2 size={14} className="text-red-600" />
          <h3 className="text-sm font-bold text-red-700">
            删除「{parent.childName || '未填姓名'}」的家长帐号
          </h3>
        </header>

        <div className="space-y-4 px-5 py-5">
          <p className="text-xs font-bold leading-relaxed text-brand-charcoal">
            这个动作无法复原，系统也不会留下删除纪录。以下资料会一并永久删除：
          </p>

          <ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-brand-charcoal/75">
            <li>孩子档案与九维筛查结果</li>
            <li>{reportCount === 0 ? '发展报告（目前没有）' : `${reportCount} 份发展报告`}</li>
            <li>扫码带走报告的连结 —— 家长手机上收藏的那一页从此打不开</li>
            <li>已付费解锁的深度评估权益</li>
            <li>{parent.bookings.length === 0 ? '专家预约（目前没有）' : `${parent.bookings.length} 笔专家预约`}</li>
          </ul>

          {activeBookings.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="text-[11px] leading-relaxed text-amber-900">
                <p className="font-bold">这位家长有 {activeBookings.length} 笔预约还在进行中：</p>
                <ul className="mt-1 space-y-0.5">
                  {activeBookings.map(b => (
                    <li key={b.id}>
                      {serviceTypeLabel(b.serviceType)}　{b.preferredSlot || '未指定时段'}　（{b.status}）
                    </li>
                  ))}
                </ul>
                <p className="mt-1">删除之后这几笔会一起消失，负责跟进的客服不会收到任何通知。</p>
              </div>
            </div>
          )}

          {/*
            這一行是給人比對用的，不是裝飾。確認框蓋住了抽屜裡的「聯絡方式」——
            也就是手機號唯一出現的地方 —— 沒有它，後台成員得先取消、看一眼、
            再打開一次。露出來的那一段刻意遮掉答案（見 `deletionChallenge`）。
          */}
          {challenge.identity && (
            <p className="rounded-xl border border-brand-stone bg-brand-cream/40 px-3 py-2 font-mono text-xs text-brand-charcoal">
              {challenge.identity}
            </p>
          )}

          <Field label="确认" hint={challenge.prompt}>
            <TextInput
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={challenge.kind === 'phone' ? '末四码' : ''}
              autoFocus
            />
          </Field>

          {failure && <ErrorNote message={failure} />}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              取消
            </Button>
            <Button variant="danger" busy={busy} disabled={!ready} onClick={() => void confirm()}>
              永久删除
            </Button>
          </div>
        </div>
      </div>
    </div>
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
              {parent.screeningTotal && (
                <tfoot>
                  <tr className="border-t-2 border-brand-stone">
                    <td className="py-1.5 pr-3 font-bold text-brand-forest">T1 总分</td>
                    <td className="py-1.5 pr-3" />
                    <td className="py-1.5 pr-3 font-bold text-brand-forest">{formatScore(parent.screeningTotal)}</td>
                    <td className="py-1.5" />
                  </tr>
                </tfoot>
              )}
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

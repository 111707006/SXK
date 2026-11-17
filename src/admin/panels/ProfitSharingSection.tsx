/**
 * 後台「清分」分頁裡的「微信分账」區塊（ADR-0017，開關 `PROFIT_SHARING`）：只有全域管理員、只有專案 A。
 *
 * 上半：分账接收方。每個對方（合作公司、推薦人）登記一個微信商戶號或個人 openid；存檔時伺服器向微信添加，沒加成功的不能分。
 * 下半：分账單。到期的（付款超過退款期）按「执行分账」才送 —— 這是真的把錢轉出去。超過微信最高分账比例、
 * 對方沒有接收方的部分寫「线下结」。伺服器開關關著（404）時整塊只說一句。
 */
import { useCallback, useState, type ReactNode } from 'react';
import { adminApi, AdminApiError, type AdminProfitSharing, type AdminSplitSettings } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { percentLabel } from '../../revenueSplit/split';
import { yuan } from '../../revenueSplit/ledger';
import { keyOf, type PartyKind, type PlanLine, type ReceiverType } from '../../profitSharing/plan';
import { Button, EmptyState, ErrorNote, Field, Spinner, TextInput, useAsyncData } from '../ui';

type Receiver = AdminProfitSharing['receivers'][number];
type Record_ = AdminProfitSharing['records'][number];

const STATE: Record<Record_['state'], string> = {
  awaiting: '等待中',
  created: '待送出',
  processing: '微信处理中',
  finished: '已完成',
  failed: '失败',
};
const REASON: Record<NonNullable<PlanLine['offlineReason']>, string> = { no_receiver: '没有可用的接收方', over_cap: '超过最高分账比例' };

function ReceiverRow({ kind, refId, label, current, onSaved }: { kind: PartyKind; refId: number; label: string; current: Receiver | undefined; onSaved: () => void }) {
  const [type, setType] = useState<ReceiverType>(current?.type ?? (kind === 'company' ? 'MERCHANT_ID' : 'PERSONAL_OPENID'));
  const [account, setAccount] = useState(current?.account ?? '');
  const [name, setName] = useState(current?.name ?? '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
    } catch (err) {
      setNote(err instanceof Error ? err.message : '操作失败。');
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const r = await adminApi.saveProfitSharingReceiver({ partyKind: kind, refId, type, account: account.trim(), name: type === 'MERCHANT_ID' ? name.trim() : null });
      onSaved();
      return r.registered ? '已保存，微信那边也添加成功。' : `已保存，但微信那边没有添加成功：${r.wechatError ?? '原因不明'}。改好后再按一次保存。`;
    });
  const lookup = () =>
    run(async () => {
      const r = await adminApi.profitSharingOpenid(phone.trim());
      if (!r.openid) return '查不到：请对方先用微信打开本站、登录，并在付款页点一次「立即开通」（不必真的付款）。';
      setAccount(r.openid);
      return '已填入 openid，按保存。';
    });
  const toggle = (active: boolean) =>
    run(async () => {
      await adminApi.setProfitSharingReceiverActive(kind, refId, active);
      onSaved();
      return active ? '已启用。' : '已停用，之后的订单不再分给这一方。';
    });

  const status = !current ? '未登记' : !current.active ? '已停用' : current.registered ? '可分账' : '微信未添加成功';
  return (
    <li className="space-y-2 rounded-lg border border-brand-stone/20 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-[10rem] flex-1 text-xs font-bold text-brand-forest">{label}</p>
        <span className="text-[11px] font-bold text-brand-stone">{status}</span>
        {current && <Button variant="ghost" busy={busy} onClick={() => void toggle(!current.active)}>{current.active ? '停用' : '启用'}</Button>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="收款方式">
          <select value={type} onChange={e => setType(e.target.value as ReceiverType)} className="rounded-lg border border-brand-stone/30 bg-white px-2 py-1.5 text-xs">
            <option value="MERCHANT_ID">微信支付商户号</option>
            <option value="PERSONAL_OPENID">个人微信零钱</option>
          </select>
        </Field>
        <Field label={type === 'MERCHANT_ID' ? '商户号' : 'openid'}>
          <TextInput value={account} onChange={e => setAccount(e.target.value)} className="w-64" />
        </Field>
        {type === 'MERCHANT_ID' ? (
          <Field label="商户全称（要一字不差）">
            <TextInput value={name} onChange={e => setName(e.target.value)} className="w-64" />
          </Field>
        ) : (
          <Field label="用手机号查 openid">
            <span className="flex gap-1">
              <TextInput value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-32" />
              <Button variant="ghost" busy={busy} disabled={phone.length !== 11} onClick={() => void lookup()}>查</Button>
            </span>
          </Field>
        )}
        <Button busy={busy} disabled={!account.trim() || (type === 'MERCHANT_ID' && !name.trim())} onClick={() => void save()}>保存</Button>
      </div>
      {note && <p className="text-[11px] font-bold text-brand-forest">{note}</p>}
    </li>
  );
}

function RecordsTable({ data, partyLabel, onChanged }: { data: AdminProfitSharing; partyLabel: (kind: PartyKind, refId: number) => string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const delayMs = data.config.delayDays * 86400_000;
  const isDue = (r: Record_) => r.state === 'awaiting' && r.paymentStatus === 'success' && r.paidAt !== null && Date.parse(r.paidAt) <= Date.now() - delayMs;
  const dueCount = data.records.filter(r => isDue(r) || r.state === 'created' || r.state === 'processing').length;

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '操作失败。');
    } finally {
      setBusy(false);
    }
  }
  const run = () => {
    if (!window.confirm(`现在向微信送出 ${dueCount} 笔到期的分账？送出后钱会真的转给对方，不能在这里撤回。`)) return;
    void act(async () => {
      const r = await adminApi.runProfitSharing();
      return `本轮：新算 ${r.started} 笔、送出 ${r.requested} 笔、完成 ${r.finished} 笔、失败 ${r.failed} 笔${r.retryLater ? `、${r.retryLater} 笔微信暂时没回应（下一轮再送）` : ''}。微信是异步处理的，过一两分钟再按一次可以看到最终结果。`;
    });
  };
  const retry = (id: number, mode: 'share' | 'unfreeze') =>
    void act(async () => {
      await adminApi.retryProfitSharing(id, mode);
      return mode === 'share' ? '已重新排入，按「执行分账」送出。' : '已改成只解冻（该给对方的线下结），按「执行分账」送出。';
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button busy={busy} disabled={!data.ready || dueCount === 0} onClick={run}>执行分账（{dueCount} 笔）</Button>
        <p className="text-[11px] text-brand-stone">
          付款满 {data.config.delayDays} 天（退款期）才会送；{data.config.autoMinutes ? `伺服器也会每 ${data.config.autoMinutes} 分钟自动送一轮。` : '目前只有按这个按钮才送。'}
        </p>
      </div>
      {note && <p className="text-[11px] font-bold text-brand-forest">{note}</p>}
      {data.records.length === 0 ? (
        <EmptyState title="还没有带分账标记的订单" hint="对方登记好接收方之后的新订单才会带分账标记。" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead className="text-[11px] text-brand-stone">
              <tr><th className="py-1 pr-2">订单</th><th className="pr-2">金额</th><th className="pr-2">状态</th><th className="pr-2">各方</th><th className="pr-2">微信分出</th><th className="pr-2">线下结</th><th /></tr>
            </thead>
            <tbody>
              {data.records.map(r => (
                <tr key={r.id} className="border-t border-brand-stone/15 align-top">
                  <td className="py-1.5 pr-2 font-mono text-[11px]">{r.outTradeNo}<br /><span className="text-brand-stone">{r.paidAt ? r.paidAt.slice(0, 10) : ''}{r.paymentStatus === 'refunded' ? ' · 已退款' : ''}</span></td>
                  <td className="pr-2">¥{yuan(r.amountFen)}</td>
                  <td className="pr-2 font-bold">{r.paymentStatus === 'refunded' && r.state === 'awaiting' ? '不分（已退款）' : isDue(r) ? '到期待送' : STATE[r.state]}{r.kind === 'unfreeze' ? '（只解冻）' : ''}</td>
                  <td className="pr-2">
                    {r.detail.map(l => (
                      <p key={keyOf(l.partyKind, l.refId)}>
                        {partyLabel(l.partyKind, l.refId)}：应得 ¥{yuan(l.dueFen)}，分 ¥{yuan(l.shareFen)}{l.offlineReason ? `（${REASON[l.offlineReason]}）` : ''}
                      </p>
                    ))}
                    {r.error && <p className="text-red-700">{r.error}</p>}
                  </td>
                  <td className="pr-2">¥{yuan(r.sharedFen)}</td>
                  <td className="pr-2">¥{yuan(r.offlineFen)}</td>
                  <td className="whitespace-nowrap">
                    {r.state === 'failed' && !r.wxOrderId && (
                      <>
                        <Button variant="ghost" busy={busy} onClick={() => retry(r.id, 'share')}>重试</Button>
                        <Button variant="ghost" busy={busy} onClick={() => retry(r.id, 'unfreeze')}>只解冻</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProfitSharingSection({ settings, onError }: { settings: AdminSplitSettings; onError: (view: AdminErrorView) => void }) {
  const load = useCallback(
    () =>
      adminApi.profitSharing().then(
        data => ({ data, off: false }),
        err => {
          // 伺服器開關 PROFIT_SHARING 關著：那幾支不註冊（404）。
          if (err instanceof AdminApiError && err.status === 404) return { data: null, off: true };
          throw err;
        }
      ),
    []
  );
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  let body: ReactNode;
  if (loading) body = <Spinner />;
  else if (failure) body = <ErrorNote message={failure} onRetry={reload} />;
  else if (data?.off || !data?.data) {
    body = <p className="text-[11px] text-brand-stone">微信分账还没开启（伺服器开关 PROFIT_SHARING）。开启之前这一页只算、不出钱，各方的钱照上面的对帐线下结。</p>;
  } else {
    const d = data.data;
    const find = (kind: PartyKind, refId: number) => d.receivers.find(r => r.partyKind === kind && r.refId === refId);
    const partyLabel = (kind: PartyKind, refId: number) =>
      (kind === 'company' ? settings.companies.find(c => c.id === refId)?.name : settings.referrers.find(r => r.id === refId)?.name) ?? `${kind === 'company' ? '公司' : '推荐人'} #${refId}`;
    body = (
      <div className="space-y-4">
        <p className="text-[11px] text-brand-stone">
          微信规定一笔订单最多分出订单金额的 {percentLabel(d.config.maxBp)}（商户平台「分账管理比例」设的，伺服器的 PROFIT_SHARING_MAX_BP 要跟它一样）。
          清分算出来对方该拿的超过这个上限时，超过的部分微信不让分，记成「线下结」。带了分账标记的订单，款项会先冻结在商户号，分完才进可用余额。
          {!d.ready && ' 微信支付尚未配置，现在只能看。'}
        </p>
        <section>
          <h4 className="mb-2 text-xs font-bold text-brand-forest">分账接收方</h4>
          {settings.companies.length + settings.referrers.length === 0 ? <EmptyState title="还没有合作公司或推荐人" /> : (
            <ul className="space-y-2">
              {settings.companies.map(c => {
                const cur = find('company', c.id);
                return <ReceiverRow key={`c-${c.id}-${cur?.account}-${cur?.active}-${cur?.registered}`} kind="company" refId={c.id} label={`合作公司 · ${c.name}`} current={cur} onSaved={reload} />;
              })}
              {settings.referrers.map(r => {
                const cur = find('referrer', r.id);
                return <ReceiverRow key={`r-${r.id}-${cur?.account}-${cur?.active}-${cur?.registered}`} kind="referrer" refId={r.id} label={`推荐人 · ${r.name}${r.companyName ? `（${r.companyName}）` : ''}`} current={cur} onSaved={reload} />;
              })}
            </ul>
          )}
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold text-brand-forest">分账单</h4>
          <RecordsTable data={d} partyLabel={partyLabel} onChanged={reload} />
        </section>
      </div>
    );
  }
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold text-brand-forest">微信分账</h3>
      {body}
    </section>
  );
}

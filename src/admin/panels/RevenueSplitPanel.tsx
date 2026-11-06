/**
 * 後台「清分」（客戶 11/03〈清分〉，ADR-0016，開關 `REVENUE_SPLIT`）：只有全域管理員、只有專案 A。
 *
 * 上半：比例。一個預設＋每家合作公司、每位推薦人的覆寫；留空＝沿用上一層。改了只對之後的新訂單生效（訂單成立時記在訂單上），不留修改紀錄。
 * 下半：對帳。選一段日期，看每筆付款各方的金額（扣掉微信手續費之後分）、依對方合計，匯出 .xlsx。
 * 微信分賬的介面還沒接（商戶號沒開通）：這一頁只算，不出錢。伺服器開關關著時整頁說一句「還沒開」。
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { adminApi, AdminApiError, type AdminSplitOrders, type AdminSplitRate, type AdminSplitSettings } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { percentLabel } from '../../revenueSplit/split';
import { yuan } from '../../revenueSplit/ledger';
import { Button, EmptyState, ErrorNote, Field, Panel, Spinner, TextInput, dateBounds, useAsyncData } from '../ui';

const KIND = { channel: '渠道商', therapist: '治疗师' } as const;

const inputOf = (bp: number | null): string => (bp === null ? '' : String(bp / 100));

/** 今天（中國時間）所在月份的第一天到今天。 */
function thisMonth(now = new Date()): { from: string; to: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function RateRow({
  label,
  hint,
  scope,
  refId,
  current,
  platform,
  company,
  onSaved,
}: {
  label: ReactNode;
  hint?: string;
  scope: AdminSplitRate['scope'];
  refId: number;
  current: AdminSplitRate | undefined;
  /** 這一列能不能設平台比例；能的話，沒設時顯示的是沿用到的值。 */
  platform: { inherited: number } | null;
  company: { inherited: number } | null;
  onSaved: () => void;
}) {
  const [p, setP] = useState(inputOf(current?.platformBp ?? null));
  const [c, setC] = useState(inputOf(current?.companyBp ?? null));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dirty = p !== inputOf(current?.platformBp ?? null) || c !== inputOf(current?.companyBp ?? null);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await adminApi.setSplitRate({ scope, refId, platformPercent: platform ? p.trim() || null : null, companyPercent: company ? c.trim() || null : null });
      setNote('已保存，之后的新订单照这个分。');
      onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-end gap-2 rounded-lg border border-brand-stone/20 bg-white px-3 py-2">
      <div className="min-w-[10rem] flex-1">
        <p className="text-xs font-bold text-brand-forest">{label}</p>
        {hint && <p className="text-[11px] text-brand-stone">{hint}</p>}
      </div>
      {platform && (
        <Field label="平台拿几 %">
          <TextInput value={p} placeholder={`沿用 ${percentLabel(platform.inherited)}`} onChange={e => setP(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="w-28" />
        </Field>
      )}
      {company && (
        <Field label="公司拿几 %（其余给治疗师）">
          <TextInput value={c} placeholder={`沿用 ${percentLabel(company.inherited)}`} onChange={e => setC(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="w-28" />
        </Field>
      )}
      <Button busy={busy} disabled={!dirty} onClick={() => void save()}>保存</Button>
      {note && <p className="w-full text-[11px] font-bold text-brand-forest">{note}</p>}
    </li>
  );
}

function RatesSection({ settings, onSaved }: { settings: AdminSplitSettings; onSaved: () => void }) {
  const find = (scope: AdminSplitRate['scope'], refId: number) => settings.rates.find(r => r.scope === scope && r.refId === refId);
  const dflt = find('default', 0);
  const dPlatform = dflt?.platformBp ?? settings.fallback.platformBp;
  const dCompany = dflt?.companyBp ?? settings.fallback.companyBp;
  const companyPlatform = (id: number) => find('company', id)?.platformBp ?? dPlatform;
  const companyCompany = (id: number) => find('company', id)?.companyBp ?? dCompany;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-brand-stone">
        分的是扣掉微信手续费（目前按 {percentLabel(settings.feeBp)} 估）之后的金额。留空＝沿用上一层：推荐人 → 合作公司 → 预设。改了只对之后的新订单生效。
      </p>
      <section>
        <h3 className="mb-2 text-xs font-bold text-brand-forest">预设</h3>
        <ul>
          <RateRow
            key={`d-${dflt?.platformBp}-${dflt?.companyBp}`}
            label="所有合作方"
            hint="平台与对方（合作公司或推荐人）怎么分；三方时公司与旗下治疗师怎么再分。"
            scope="default"
            refId={0}
            current={dflt}
            platform={{ inherited: settings.fallback.platformBp }}
            company={{ inherited: settings.fallback.companyBp }}
            onSaved={onSaved}
          />
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold text-brand-forest">合作公司</h3>
        {settings.companies.length === 0 ? <EmptyState title="还没有合作公司" /> : (
          <ul className="space-y-2">
            {settings.companies.map(co => {
              const cur = find('company', co.id);
              return (
                <RateRow
                  key={`c-${co.id}-${cur?.platformBp}-${cur?.companyBp}`}
                  label={`${co.name}${co.active ? '' : '（已停用）'}`}
                  scope="company"
                  refId={co.id}
                  current={cur}
                  platform={{ inherited: dPlatform }}
                  company={{ inherited: dCompany }}
                  onSaved={onSaved}
                />
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold text-brand-forest">推荐人</h3>
        {settings.referrers.length === 0 ? <EmptyState title="还没有推荐人" /> : (
          <ul className="space-y-2">
            {settings.referrers.map(r => {
              const cur = find('referrer', r.id);
              const label = `${r.name}（${KIND[r.kind]}${r.companyName ? ` · ${r.companyName}` : ''}）${r.active ? '' : '（已停用）'}`;
              return r.companyId !== null ? (
                <RateRow
                  key={`r-${r.id}-${cur?.platformBp}-${cur?.companyBp}`}
                  label={label}
                  hint={`隶属合作公司：平台拿几 % 看「${r.companyName}」的设定；这里只调公司与这位之间怎么分。`}
                  scope="referrer"
                  refId={r.id}
                  current={cur}
                  platform={null}
                  company={{ inherited: companyCompany(r.companyId) }}
                  onSaved={onSaved}
                />
              ) : (
                <RateRow
                  key={`r-${r.id}-${cur?.platformBp}-${cur?.companyBp}`}
                  label={label}
                  hint="没有隶属合作公司：平台以外的都给这位。"
                  scope="referrer"
                  refId={r.id}
                  current={cur}
                  platform={{ inherited: dPlatform }}
                  company={null}
                  onSaved={onSaved}
                />
              );
            })}
          </ul>
        )}
        {settings.companies.length > 0 && (
          <p className="mt-1 text-[11px] text-brand-stone">隶属公司的推荐人，平台比例沿用那家公司（{settings.companies.map(c => `${c.name} ${percentLabel(companyPlatform(c.id))}`).join('、')}）。</p>
        )}
      </section>
    </div>
  );
}

function LedgerSection({ onError }: { onError: (v: AdminErrorView) => void }) {
  const initial = useMemo(() => thisMonth(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [query, setQuery] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => adminApi.splitOrders(query.from, query.to), [query]);
  const { data, loading, failure, reload } = useAsyncData<AdminSplitOrders>(load, [query], onError);

  async function exportXlsx() {
    setBusy(true);
    setNote(null);
    try {
      await adminApi.exportSplit(query.from, query.to);
    } catch (err) {
      setNote(err instanceof Error ? err.message : '导出失败。');
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (loading) body = <Spinner />;
  else if (failure) body = <ErrorNote message={failure} onRetry={reload} />;
  else if (!data || data.rows.length === 0) body = <EmptyState title="这段日期没有付款" />;
  else {
    const t = data.totals;
    body = (
      <div className="space-y-3">
        <p className="text-xs text-brand-forest">
          已付款 {t.orders} 笔：实付 ¥{yuan(t.amountFen)}，手续费 ¥{yuan(t.feeFen)}，可分 ¥{yuan(t.netFen)} —— 平台 ¥{yuan(t.platformFen)}、合作公司 ¥{yuan(t.companyFen)}、推荐人／治疗师 ¥{yuan(t.referrerFen)}。
          {t.unrecorded > 0 && ` 另有 ${t.unrecorded} 笔是开关打开之前的订单，没有记录比例，不在合计里。`}
        </p>
        {data.byParty.length > 0 && (
          <table className="w-full text-left text-[11px]">
            <thead><tr className="text-brand-stone"><th>对方</th><th>笔数</th><th>合作公司</th><th>推荐人／治疗师</th><th>平台</th></tr></thead>
            <tbody>
              {data.byParty.map(p => (
                <tr key={p.party} className="border-t border-brand-stone/10"><td>{p.party}</td><td>{p.orders}</td><td>¥{yuan(p.companyFen)}</td><td>¥{yuan(p.referrerFen)}</td><td>¥{yuan(p.platformFen)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-[11px]">
            <thead><tr className="text-brand-stone"><th>付款时间</th><th>项目</th><th>状态</th><th>对方</th><th>比例</th><th>实付</th><th>可分</th><th>平台</th><th>公司</th><th>推荐人</th></tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} className="border-t border-brand-stone/10">
                  <td>{r.paidAt ? r.paidAt.slice(0, 10) : ''}</td>
                  <td>{r.product}</td>
                  <td>{r.status === 'refunded' ? '已退款' : '已付款'}</td>
                  <td>{r.party}</td>
                  <td>{r.rates}</td>
                  <td>{r.amounts ? `¥${yuan(r.amounts.amountFen)}` : ''}</td>
                  <td>{r.amounts ? `¥${yuan(r.amounts.netFen)}` : ''}</td>
                  <td>{r.amounts ? `¥${yuan(r.amounts.platformFen)}` : ''}</td>
                  <td>{r.amounts ? `¥${yuan(r.amounts.companyFen)}` : ''}</td>
                  <td>{r.amounts ? `¥${yuan(r.amounts.referrerFen)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="起日"><TextInput type="date" min={dateBounds(5, 0).min} max={dateBounds(5, 0).max} value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></Field>
        <Field label="迄日"><TextInput type="date" min={dateBounds(5, 0).min} max={dateBounds(5, 0).max} value={to} onChange={e => setTo(e.target.value)} className="w-40" /></Field>
        <Button disabled={!from || !to || from > to} onClick={() => setQuery({ from, to })}>查询</Button>
        <Button variant="ghost" busy={busy} disabled={!data || data.rows.length === 0} onClick={() => void exportXlsx()}>
          <Download size={14} /> 导出对帐 .xlsx
        </Button>
      </div>
      {note && <p className="text-[11px] font-bold text-brand-forest">{note}</p>}
      {body}
    </div>
  );
}

export default function RevenueSplitPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(
    () =>
      adminApi.splitSettings().then(
        settings => ({ settings, off: false }),
        err => {
          // 伺服器開關 REVENUE_SPLIT 關著：那幾支不註冊（404）。
          if (err instanceof AdminApiError && err.status === 404) return { settings: null, off: true };
          throw err;
        }
      ),
    []
  );
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const description =
    '每笔订单成立时记下对方（合作公司、推荐人）与比例，这里算出各方该分多少、导出对帐。微信分账还没接（商户号开通后才接），这一页只算，不出钱。';

  let body: ReactNode;
  if (loading) body = <Spinner />;
  else if (failure) body = <ErrorNote message={failure} onRetry={reload} />;
  else if (data?.off || !data?.settings) body = <EmptyState title="清分还没开启" hint="伺服器开关 REVENUE_SPLIT 打开后，这里可以设定比例、看对帐。" />;
  else {
    body = (
      <div className="space-y-6">
        <RatesSection settings={data.settings} onSaved={reload} />
        <section>
          <h3 className="mb-2 text-xs font-bold text-brand-forest">对帐</h3>
          <LedgerSection onError={onError} />
        </section>
      </div>
    );
  }
  return <Panel title="清分" description={description}>{body}</Panel>;
}

/**
 * 後台「推荐人与兑换码」（客戶 10/22，#93；兌換碼由 #110 接上）：全域管理員開推薦人帳號（渠道商、治療師）、停用。
 * 推薦人用信箱與密碼登入同一個管理中心，只看得到「我的家长」「我的兑换码」「代填」。
 *
 * 專案 A 有合作單位時（`units`，#117，ADR-0020）：新建的推薦人一定要選屬於哪個機構（個人治療師單位在「合作单位」
 * 那一頁連帳號一起建，這裡不能選）、填一個單位內唯一的代號；每位推薦人旁邊有個人連結 `?c=<單位>&t=<代號>` 與二維碼。
 * 不再分渠道商／治療師。B 與沒開合作公司的 A 照舊。
 *
 * 「后台帐号」併進「合作单位」時（`showCreate=false`，使用者 2026-11-23）：開推薦人只在合作單位那一頁（新增单位→个人治疗师、
 * 機構展開後「新增推荐人」，同一個 `CreateReferrerForm`），這一頁只剩推薦人清單與每位推薦人的兌換碼、優惠券
 * （`renderCoupons`，使用者 2026-11-24：優惠券併進推薦人清單）。
 */
import { useCallback, useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { adminApi, type AdminCompany, type AdminReferrer } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import EntryLinkQr from '../EntryLinkQr';
import { referrerEntryUrl } from '../units';
import { Button, EmptyState, ErrorNote, Field, Panel, Select, Spinner, StatusBadge, TextInput, useAsyncData } from '../ui';

const KIND_LABEL = { channel: '渠道商', therapist: '治疗师' } as const;

export default function ReferrersPanel({
  onError,
  companies,
  units = false,
  serviceRelations = false,
  renderCodes,
  renderCoupons,
  showCreate = true,
}: {
  onError: (view: AdminErrorView) => void;
  companies: AdminCompany[];
  /** 專案 A 的合作單位（#117）：單位必選、代號、個人連結。 */
  units?: boolean;
  /** 服務關係開關開著（ADR-0020）：推薦人看的是標注給他的家長，不是綁定。 */
  serviceRelations?: boolean;
  /** 每位推薦人底下的兌換碼區塊（#110）；沒給就不畫。 */
  renderCodes?: (referrer: AdminReferrer) => React.ReactNode;
  /** 每位推薦人底下的優惠券區塊（2026-11-24）；沒給（或伺服器沒開優惠券）就不畫那顆按鈕。與兌換碼各自展開。 */
  renderCoupons?: (referrer: AdminReferrer) => React.ReactNode;
  /** 畫不畫「开设推荐人」（合併進合作單位時 false，在那一頁開）。 */
  showCreate?: boolean;
}) {
  const load = useCallback(() => adminApi.referrers(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const origin = window.location.origin;
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openCouponsId, setOpenCouponsId] = useState<number | null>(null);

  // 對帳匯出（#113）：推薦人、碼、方案、狀態、使用家長手機號、使用時間、使用權到期日。每次都記一筆。
  async function exportLedger() {
    try {
      const { blob, fileName } = await adminApi.exportRedeemLedger();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败。');
    }
  }

  async function toggle(r: AdminReferrer) {
    try {
      await adminApi.setReferrerActive(r.id, !r.active);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新推荐人失败。');
    }
  }

  return (
    <div className="space-y-4">
      {showCreate && <CreateReferrerForm companies={companies} units={units} serviceRelations={serviceRelations} onCreated={reload} />}

      <Panel
        title="推荐人"
        action={
          <Button variant="ghost" onClick={() => void exportLedger()}>
            <Download size={12} />导出兑换码对帐
          </Button>
        }
      >
        {error && <p className="mb-3 text-[11px] font-bold text-red-700">{error}</p>}
        {loading ? <Spinner /> : failure ? <ErrorNote message={failure} onRetry={reload} /> : (data?.referrers.length ?? 0) === 0 ? (
          <EmptyState title="还没有推荐人" />
        ) : (
          <ul className="divide-y divide-brand-stone/60">
            {data!.referrers.map(r => {
              const link = units ? referrerEntryUrl(origin, { companySlug: r.companySlug ?? null, companyKind: r.companyKind ?? null, code: r.code ?? null }) : null;
              return (
              <li key={r.id} id={`referrer-${r.id}`} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-forest">
                      {r.name}　<span className="font-normal text-brand-charcoal/60">{units ? '' : `${KIND_LABEL[r.kind]} · `}{r.phone} · {r.email}{r.companyName ? ` · ${r.companyName}` : units ? ' · 还没有单位' : ''}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.active ? 'normal' : 'borderline'}>{r.active ? '启用中' : '已停用'}</StatusBadge>
                    {renderCodes && (
                      <Button variant="ghost" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? '收起兑换码' : '兑换码'}</Button>
                    )}
                    {renderCoupons && (
                      <Button variant="ghost" onClick={() => setOpenCouponsId(openCouponsId === r.id ? null : r.id)}>{openCouponsId === r.id ? '收起优惠券' : '优惠券'}</Button>
                    )}
                    <Button variant={r.active ? 'danger' : 'ghost'} onClick={() => void toggle(r)}>{r.active ? '停用' : '重新启用'}</Button>
                  </div>
                </div>
                {link && <EntryLinkQr url={link} code={r.companyKind === 'therapist' ? (r.companySlug ?? `r${r.id}`) : `${r.companySlug}-${r.code}`} />}
                {renderCodes && openId === r.id && renderCodes(r)}
                {renderCoupons && openCouponsId === r.id && renderCoupons(r)}
              </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * 開一位推薦人（全域管理員）。`fixedUnit`：在合作單位那一頁某個機構底下開，單位固定、不出選單。
 * 失敗訊息畫在表單裡，不丟給上層。
 */
export function CreateReferrerForm({
  companies,
  units,
  serviceRelations = false,
  fixedUnit,
  onCreated,
  onCancel,
}: {
  companies: AdminCompany[];
  units: boolean;
  serviceRelations?: boolean;
  fixedUnit?: AdminCompany;
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const emptyForm = { email: '', password: '', name: '', phone: '', kind: 'channel' as 'channel' | 'therapist', companyId: fixedUnit ? String(fixedUnit.id) : '', code: '' };
  const [form, setForm] = useState(emptyForm);
  // 個人治療師單位恰好一位推薦人（建單位時就建好了），這裡只列機構。
  const institutions = companies.filter(c => (c.kind ?? 'institution') === 'institution');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (units && !form.companyId) {
        setError('请选择推荐人属于哪个合作单位。');
        return;
      }
      await adminApi.createReferrer({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(units ? { code: form.code.trim().toLowerCase() } : { kind: form.kind }),
        companyId: form.companyId ? Number(form.companyId) : null,
      });
      setForm(emptyForm);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '开设推荐人失败。');
    } finally {
      setBusy(false);
    }
  }

  const description = serviceRelations
    ? '推荐人用信箱与密码登入同一个管理中心，只看得到现在由他服务的家长：用了他的连结、兑换码或优惠券、由他代填，或由单位管理者改派给他。家长换了老师就不在他的名单上。'
    : '推荐人用信箱与密码登入同一个管理中心，只看得到用了自己兑换码、或由自己代填的家长。';
  const form_ = (
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <Field label="名称"><TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={50} /></Field>
        <Field label="手机号"><TextInput value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} inputMode="numeric" maxLength={11} /></Field>
        {units ? (
          <>
            {!fixedUnit && <Field label="所属合作单位" hint="只能选机构；个人治疗师单位在「合作单位」那一页连帐号一起建。">
              <Select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                <option value="">请选择</option>
                {institutions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>}
            <Field label="推荐人代号" hint="个人连结 ?c=单位&t=代号 用。小写英数与连字号，长度 2–64，同一个单位里不能重复；发出去之后不要改。">
              <TextInput value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} maxLength={64} placeholder="wang" className="font-mono" />
            </Field>
          </>
        ) : (
          <>
            <Field label="类型">
              <Select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as 'channel' | 'therapist' })}>
                <option value="channel">渠道商</option>
                <option value="therapist">治疗师</option>
              </Select>
            </Field>
            <Field label="隶属合作公司（选填）" hint="代填时新建的家长帐号归属这一家；不选就是森心康直属。">
              <Select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                <option value="">不隶属任何一家</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </>
        )}
        <Field label="登入信箱"><TextInput value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" autoComplete="off" /></Field>
        <Field label="初始密码" hint="至少 8 个字元，交给推荐人后请他自己保管。"><TextInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" autoComplete="new-password" /></Field>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" busy={busy}><UserPlus size={12} />开设推荐人</Button>
          {onCancel && <Button variant="ghost" onClick={onCancel}>取消</Button>}
          {error && <span className="text-[11px] font-bold text-red-700">{error}</span>}
        </div>
      </form>
  );
  // 在合作單位某個機構展開的那一塊裡：不再套一層 Panel。
  if (fixedUnit) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-stone/60 bg-white p-4">
        <div>
          <p className="text-xs font-bold text-brand-forest">新增推荐人</p>
          <p className="mt-1 text-[11px] text-brand-charcoal/60">{description}</p>
        </div>
        {form_}
      </div>
    );
  }
  return <Panel title="开设推荐人" description={description}>{form_}</Panel>;
}

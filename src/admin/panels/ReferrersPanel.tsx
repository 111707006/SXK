/**
 * 後台「推荐人与兑换码」（客戶 10/22，#93；兌換碼由 #110 接上）：全域管理員開推薦人帳號（渠道商、治療師）、停用。
 * 推薦人用信箱與密碼登入同一個管理中心，只看得到「我的家长」「我的兑换码」「代填」。
 */
import { useCallback, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { adminApi, type AdminCompany, type AdminReferrer } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { Button, EmptyState, ErrorNote, Field, Panel, Select, Spinner, StatusBadge, TextInput, useAsyncData } from '../ui';

const KIND_LABEL = { channel: '渠道商', therapist: '治疗师' } as const;

export default function ReferrersPanel({
  onError,
  companies,
  renderCodes,
}: {
  onError: (view: AdminErrorView) => void;
  companies: AdminCompany[];
  /** 每位推薦人底下的兌換碼區塊（#110）；沒給就不畫。 */
  renderCodes?: (referrer: AdminReferrer) => React.ReactNode;
}) {
  const load = useCallback(() => adminApi.referrers(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', kind: 'channel' as 'channel' | 'therapist', companyId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.createReferrer({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        kind: form.kind,
        companyId: form.companyId ? Number(form.companyId) : null,
      });
      setForm({ email: '', password: '', name: '', phone: '', kind: 'channel', companyId: '' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '开设推荐人失败。');
    } finally {
      setBusy(false);
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
      <Panel title="开设推荐人" description="推荐人用信箱与密码登入同一个管理中心，只看得到用了自己兑换码、或由自己代填的家长。">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="名称"><TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={50} /></Field>
          <Field label="手机号"><TextInput value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} inputMode="numeric" maxLength={11} /></Field>
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
          <Field label="登入信箱"><TextInput value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" /></Field>
          <Field label="初始密码" hint="至少 8 个字元，交给推荐人后请他自己保管。"><TextInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" /></Field>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" busy={busy}><UserPlus size={12} />开设推荐人</Button>
            {error && <span className="text-[11px] font-bold text-red-700">{error}</span>}
          </div>
        </form>
      </Panel>

      <Panel title="推荐人">
        {loading ? <Spinner /> : failure ? <ErrorNote message={failure} onRetry={reload} /> : (data?.referrers.length ?? 0) === 0 ? (
          <EmptyState title="还没有推荐人" />
        ) : (
          <ul className="divide-y divide-brand-stone/60">
            {data!.referrers.map(r => (
              <li key={r.id} id={`referrer-${r.id}`} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-forest">
                      {r.name}　<span className="font-normal text-brand-charcoal/60">{KIND_LABEL[r.kind]} · {r.phone} · {r.email}{r.companyName ? ` · ${r.companyName}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.active ? 'normal' : 'borderline'}>{r.active ? '启用中' : '已停用'}</StatusBadge>
                    {renderCodes && (
                      <Button variant="ghost" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? '收起兑换码' : '兑换码'}</Button>
                    )}
                    <Button variant={r.active ? 'danger' : 'ghost'} onClick={() => void toggle(r)}>{r.active ? '停用' : '重新启用'}</Button>
                  </div>
                </div>
                {renderCodes && openId === r.id && renderCodes(r)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

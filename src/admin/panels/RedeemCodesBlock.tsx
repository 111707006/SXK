/**
 * 兌換碼清單（客戶 10/22，#110）：全域管理員在「推荐人与兑换码」每位推薦人底下用（可產、可作廢）；
 * 推薦人在「我的兑换码」用（只看、複製、匯出未用的）。碼顯示成 `XXXX-XXXX-XX`。
 */
import { useCallback, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { adminApi, type AdminRedeemCode } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { formatCode } from '../../redeem/codes';
import { Button, EmptyState, ErrorNote, Field, Panel, Select, Spinner, TextInput, useAsyncData } from '../ui';

const STATUS_LABEL = { unused: '未用', used: '已用', void: '已作废' } as const;

export default function RedeemCodesBlock({
  referrerId,
  onError,
}: {
  /** 全域管理員看某一位推薦人；`null`＝推薦人看自己的。 */
  referrerId: number | null;
  onError: (view: AdminErrorView) => void;
}) {
  const asAdmin = referrerId !== null;
  const load = useCallback(() => (asAdmin ? adminApi.referrerCodes(referrerId!) : adminApi.myCodes()), [asAdmin, referrerId]);
  const { data, loading, failure, reload } = useAsyncData(load, [referrerId], onError);
  const [months, setMonths] = useState<1 | 3 | 6>(1);
  const [quantity, setQuantity] = useState('10');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const codes = data?.codes ?? [];
  const unused = codes.filter(c => c.status === 'unused');

  async function generate() {
    setBusy(true);
    setNote(null);
    try {
      await adminApi.createCodes(referrerId!, months, Number(quantity));
      reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '产生兑换码失败。');
    } finally {
      setBusy(false);
    }
  }

  async function voidOne(c: AdminRedeemCode) {
    try {
      await adminApi.voidCode(c.id);
      reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '作废失败。');
    }
  }

  async function copyUnused() {
    try {
      await navigator.clipboard.writeText(unused.map(c => formatCode(c.code)).join('\n'));
      setNote(`已复制 ${unused.length} 组未用的码。`);
    } catch {
      setNote('浏览器不让复制，请用「导出」。');
    }
  }

  async function exportCsv() {
    try {
      const { blob, fileName } = await adminApi.codesCsv(referrerId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNote(err instanceof Error ? err.message : '导出失败。');
    }
  }

  const body = loading ? <Spinner /> : failure ? <ErrorNote message={failure} onRetry={reload} /> : (
    <div className="space-y-3">
      {asAdmin && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="方案">
            <Select value={months} onChange={e => setMonths(Number(e.target.value) as 1 | 3 | 6)} className="w-auto">
              <option value={1}>一个月</option>
              <option value={3}>三个月</option>
              <option value={6}>六个月</option>
            </Select>
          </Field>
          <Field label="张数（1–500）">
            <TextInput value={quantity} onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-24" />
          </Field>
          <Button busy={busy} onClick={() => void generate()} disabled={!(Number(quantity) >= 1 && Number(quantity) <= 500)}>产生兑换码</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-brand-charcoal/60">共 {codes.length} 组，未用 {unused.length} 组</span>
        <Button variant="ghost" onClick={() => void copyUnused()} disabled={unused.length === 0}><Copy size={12} />复制未用的码</Button>
        <Button variant="ghost" onClick={() => void exportCsv()} disabled={unused.length === 0}><Download size={12} />导出未用的码</Button>
        {note && <span className="text-[11px] font-bold text-brand-forest">{note}</span>}
      </div>
      {codes.length === 0 ? <EmptyState title="还没有兑换码" /> : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-brand-stone/50 rounded-xl border border-brand-stone/60">
          {codes.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="font-mono font-bold tracking-wider text-brand-forest">{formatCode(c.code)}</span>
              <span className="text-brand-charcoal/60">{c.months} 个月 · {STATUS_LABEL[c.status]}{c.usedAt ? ` · ${c.usedAt.slice(0, 10)}` : ''}</span>
              {asAdmin && c.status === 'unused' && <Button variant="ghost" onClick={() => void voidOne(c)}>作废</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return asAdmin ? body : <Panel title="我的兑换码" description="森心康发给你的码。家长在「线上家庭个性化训练」输入后就开通居家训练，第一次用你的码就绑到你名下。">{body}</Panel>;
}

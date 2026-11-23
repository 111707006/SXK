/**
 * 推薦人與單位管理者自己的 T2 優惠券（2026-11-25，使用者 2026-11-23：優惠券綁推薦人，推薦人與單位管理者看得到自己的）。
 * 只讀：看、複製、匯出未用的；產券、改折扣、作廢只有全域管理員（「兑换码与优惠券」分頁）。伺服器開關 `T2_COUPON` 關著（404）整塊不畫。
 */
import { useCallback, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { adminApi, AdminApiError, type AdminCouponBatch, type AdminCouponCode } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { formatCode } from '../../redeem/codes';
import { couponDiscountLabel } from '../../t2/coupon';
import { Button, EmptyState, ErrorNote, Panel, Spinner, useAsyncData } from '../ui';

const STATUS_LABEL = { unused: '未用', used: '已用', void: '已作废' } as const;

export default function MyCouponsBlock({ unit, onError }: { /** 單位管理者看本單位推薦人的；推薦人看自己的。只影響說明文字（範圍由伺服器照身分決定）。 */ unit: boolean; onError: (view: AdminErrorView) => void }) {
  const load = useCallback(
    () =>
      adminApi.myCoupons().then(
        r => ({ ...r, off: false }),
        err => {
          if (err instanceof AdminApiError && err.status === 404) return { batches: [] as AdminCouponBatch[], codes: [] as AdminCouponCode[], off: true };
          throw err;
        }
      ),
    []
  );
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [note, setNote] = useState<string | null>(null);
  if (data?.off) return null;

  const batches = data?.batches ?? [];
  const codes = data?.codes ?? [];
  const unused = codes.filter(c => c.status === 'unused');

  async function copyUnused() {
    try {
      await navigator.clipboard.writeText(unused.map(c => formatCode(c.code)).join('\n'));
      setNote(`已复制 ${unused.length} 张未用的码。`);
    } catch {
      setNote('浏览器不让复制，请用「导出」。');
    }
  }

  async function exportCsv() {
    try {
      const { blob, fileName } = await adminApi.myCouponsCsv();
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-brand-charcoal/60">共 {codes.length} 张，未用 {unused.length} 张</span>
        <Button variant="ghost" onClick={() => void copyUnused()} disabled={unused.length === 0}><Copy size={12} />复制未用的码</Button>
        <Button variant="ghost" onClick={() => void exportCsv()} disabled={unused.length === 0}><Download size={12} />导出未用的码</Button>
        {note && <span className="text-[11px] font-bold text-brand-forest">{note}</span>}
      </div>
      {batches.length === 0 ? <EmptyState title="还没有优惠券" /> : (
        <ul className="space-y-2">
          {batches.map(b => (
            <li key={b.id} className="rounded-xl border border-brand-stone/60 px-3 py-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-brand-forest">第 {b.id} 批</span>
                <span className="rounded-full bg-brand-cream px-2 py-0.5 font-bold text-brand-clay">{couponDiscountLabel(b.discount)}</span>
                {unit && b.referrerName && <span className="rounded-full bg-brand-stone/40 px-2 py-0.5 font-bold text-brand-forest">{b.referrerName}</span>}
                <span className="text-brand-charcoal/60">
                  未用 {b.unused} · 已用 {b.used} · 作废 {b.void}{` · ${b.expiresOn ? `${b.expiresOn} 到期` : '不过期'}`}
                </span>
              </div>
              <ul className="max-h-60 overflow-y-auto divide-y divide-brand-stone/50 rounded-xl border border-brand-stone/60">
                {codes.filter(c => c.batchId === b.id).map(c => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                    <span className="font-mono font-bold tracking-wider text-brand-forest">{formatCode(c.code)}</span>
                    <span className="text-brand-charcoal/60">{STATUS_LABEL[c.status]}{c.usedAt ? ` · ${c.usedAt.slice(0, 10)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Panel
      title={unit ? '本单位优惠券' : '我的优惠券'}
      description={
        (unit ? '森心康发给本单位推荐人的 T2 优惠券。' : '森心康发给你的 T2 优惠券。') +
        '家长在报告上「T2 深度评估」价钱下面输入，T2 照折后价付款；每位家长只能用一张。家长第一次用券就挂到这位推荐人名下（已经由别人服务时先问家长）。'
      }
    >
      {body}
    </Panel>
  );
}

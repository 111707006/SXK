/**
 * 後台「优惠券」（客戶 11/03 簡報第 21、29 頁，開關 `T2_COUPON`）：T1 轉 T2 的折扣碼。只有全域管理員、只有專案 A。
 * 與「推荐人与兑换码」（VIP 兌換，換線上家庭訓練的使用期）是兩條線。
 *
 * 一批一種折法（預設五折＝半價），產完還能改折法與到期日（之後開的訂單照新的收）；每位家長只能用一張、不綁渠道。
 * 每一批看得到未用／已用／作廢幾張，展開看每一張是誰（家長編號）、哪天用的（付款看對帳；這裡不讀訂單）。
 *
 * 2026-11-24（使用者）：不再是獨立一塊面板。「兑换码与优惠券」分頁的推薦人清單每一列有「优惠券」按鈕，展開
 * `ReferrerCouponsBlock`（產券直接用那一列的推薦人）；沒有推薦人的舊批次另外一小塊 `LegacyCouponBatches`。
 * 全部批次由 `useCouponBatches` 整頁讀一次。伺服器開關 `T2_COUPON` 關著（404）時按鈕與區塊都不畫。
 */
import { useCallback, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Copy, Download } from 'lucide-react';
import { adminApi, AdminApiError, type AdminCouponBatch, type AdminReferrer } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { formatCode } from '../../redeem/codes';
import { couponDiscountLabel, DEFAULT_COUPON_DISCOUNT, MAX_COUPON_BATCH, type CouponDiscount, type CouponDiscountKind } from '../../t2/coupon';
import { Button, EmptyState, ErrorNote, Field, Panel, Select, Spinner, TextInput, dateBounds, useAsyncData } from '../ui';

const STATUS_LABEL = { unused: '未用', used: '已用', void: '已作废' } as const;

/** 畫面上的輸入（打折填「几折」、減額填元）→ 存的折扣；不對回 null。 */
export function discountFromInput(kind: CouponDiscountKind, raw: string): CouponDiscount | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n)) return null;
  if (kind === 'percent') {
    const value = Math.round(n * 10);
    return value >= 1 && value <= 99 && Math.abs(n * 10 - value) < 1e-9 ? { kind, value } : null;
  }
  const value = Math.round(n * 100);
  return value >= 1 && value <= 100000 && Math.abs(n * 100 - value) < 1e-6 ? { kind, value } : null;
}

/** 存的折扣 → 畫面上的輸入。 */
export function inputFromDiscount(d: CouponDiscount): string {
  return d.kind === 'percent' ? String(d.value / 10) : String(d.value / 100);
}

function DiscountInputs({ kind, value, onKind, onValue }: { kind: CouponDiscountKind; value: string; onKind: (k: CouponDiscountKind) => void; onValue: (v: string) => void }) {
  return (
    <>
      <Field label="折扣方式">
        <Select value={kind} onChange={e => onKind(e.target.value as CouponDiscountKind)} className="w-auto">
          <option value="percent">打折</option>
          <option value="amount">减固定金额</option>
        </Select>
      </Field>
      <Field label={kind === 'percent' ? '几折（5＝半价，8.5＝八五折）' : '减多少元'}>
        <TextInput value={value} onChange={e => onValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="w-28" />
      </Field>
    </>
  );
}

function BatchRow({ batch, canVoid, onChanged, onError }: { batch: AdminCouponBatch; canVoid: boolean; onChanged: () => void; onError: (v: AdminErrorView) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<CouponDiscountKind>(batch.discount.kind);
  const [value, setValue] = useState(inputFromDiscount(batch.discount));
  const [expiresOn, setExpiresOn] = useState(batch.expiresOn ?? '');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => (open ? adminApi.couponCodes(batch.id) : Promise.resolve({ codes: [] })), [open, batch.id]);
  const { data, loading, failure, reload } = useAsyncData(load, [open, batch.id], onError);
  const codes = data?.codes ?? [];
  const unused = codes.filter(c => c.status === 'unused');
  const discount = discountFromInput(kind, value);

  async function save() {
    if (!discount) return;
    setBusy(true);
    setNote(null);
    try {
      await adminApi.updateCouponBatch(batch.id, { discountKind: discount.kind, discountValue: discount.value, expiresOn: expiresOn || null });
      setEditing(false);
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '更新失败。');
    } finally {
      setBusy(false);
    }
  }

  async function voidOne(id: number) {
    try {
      await adminApi.voidCoupon(id);
      reload();
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '作废失败。');
    }
  }

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
      const { blob, fileName } = await adminApi.couponCodesCsv(batch.id);
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

  return (
    <li className="rounded-xl border border-brand-stone/60 px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-bold text-brand-forest">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          第 {batch.id} 批{batch.note ? ` · ${batch.note}` : ''}
        </button>
        <span className="rounded-full bg-brand-cream px-2 py-0.5 font-bold text-brand-clay">{couponDiscountLabel(batch.discount)}</span>
        <span className="text-brand-charcoal/60">
          共 {batch.quantity} 张 · 未用 {batch.unused} · 已用 {batch.used} · 作废 {batch.void}
          {` · ${batch.expiresOn ? `${batch.expiresOn} 到期` : '不过期'}`}
          {batch.createdAt ? ` · ${batch.createdAt.slice(0, 10)} 产生` : ''}
        </span>
        <Button variant="ghost" onClick={() => setEditing(e => !e)}>{editing ? '取消' : '改折扣／到期日'}</Button>
      </div>
      {editing && (
        <div className="flex flex-wrap items-end gap-2">
          <DiscountInputs kind={kind} value={value} onKind={setKind} onValue={setValue} />
          <Field label="到期日（空白＝不过期）">
            <TextInput type="date" min={dateBounds(0, 5).min} max={dateBounds(0, 5).max} value={expiresOn} onChange={e => setExpiresOn(e.target.value)} className="w-40" />
          </Field>
          <Button busy={busy} disabled={!discount} onClick={() => void save()}>存档</Button>
        </div>
      )}
      {note && <p className="text-[11px] font-bold text-brand-forest">{note}</p>}
      {open && (loading ? <Spinner /> : failure ? <ErrorNote message={failure} onRetry={reload} /> : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void copyUnused()} disabled={unused.length === 0}><Copy size={12} />复制未用的码</Button>
            <Button variant="ghost" onClick={() => void exportCsv()} disabled={unused.length === 0}><Download size={12} />导出未用的码</Button>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-brand-stone/50 rounded-xl border border-brand-stone/60">
            {codes.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                <span className="font-mono font-bold tracking-wider text-brand-forest">{formatCode(c.code)}</span>
                <span className="text-brand-charcoal/60">
                  {STATUS_LABEL[c.status]}
                  {c.usedBy !== null ? ` · 家长编号 ${c.usedBy}` : ''}
                  {c.usedAt ? ` · ${c.usedAt.slice(0, 10)}` : ''}
                </span>
                {canVoid && c.status === 'unused' && <Button variant="ghost" onClick={() => void voidOne(c.id)}>作废</Button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  );
}

export interface CouponBatchesState {
  /** 伺服器開關 `T2_COUPON` 關著（那幾支 404）：優惠券的按鈕與區塊都不畫。 */
  off: boolean;
  batches: AdminCouponBatch[];
  loading: boolean;
  failure: string | null;
  reload: () => void;
}

/**
 * 全部批次只讀一次（推薦人清單每一列依 `referrerId` 分，不每列各打一次）。`enabled` 是 false 時不打網路
 * （不在「兑换码与优惠券」分頁、或不是全域管理員）。
 */
export function useCouponBatches(enabled: boolean, onError: (view: AdminErrorView) => void): CouponBatchesState {
  const load = useCallback(
    () =>
      !enabled
        ? Promise.resolve({ batches: [] as AdminCouponBatch[], off: true })
        : adminApi.couponBatches().then(
            r => ({ batches: r.batches, off: false }),
            err => {
              // 伺服器開關 T2_COUPON 關著：那幾支不註冊（404）。
              if (err instanceof AdminApiError && err.status === 404) return { batches: [] as AdminCouponBatch[], off: true };
              throw err;
            }
          ),
    [enabled]
  );
  const { data, loading, failure, reload } = useAsyncData(load, [enabled], onError);
  // 還沒讀到先當關著；讀失敗（不是 404）不算關著：按鈕照出，展開看得到錯誤與重試。
  return { off: data?.off ?? failure === null, batches: data?.batches ?? [], loading, failure, reload };
}

function BatchList({ batches, canVoid = true, onChanged, onError }: { batches: AdminCouponBatch[]; canVoid?: boolean; onChanged: () => void; onError: (v: AdminErrorView) => void }) {
  return (
    <ul className="space-y-2">
      {batches.map(b => <BatchRow key={`${b.id}-${b.discount.kind}-${b.discount.value}-${b.expiresOn}`} batch={b} canVoid={canVoid} onChanged={onChanged} onError={onError} />)}
    </ul>
  );
}

/**
 * 推薦人清單某一列展開的「优惠券」（使用者 2026-11-24：優惠券併進推薦人清單）：產券表單直接用這一列的推薦人，
 * 底下是他的批次。停用的推薦人看得到舊批次、不能產新的（伺服器也回 404）。
 */
export function ReferrerCouponsBlock({
  referrer,
  state,
  onError,
}: {
  referrer: Pick<AdminReferrer, 'id' | 'name' | 'active'>;
  state: CouponBatchesState;
  onError: (view: AdminErrorView) => void;
}) {
  const [kind, setKind] = useState<CouponDiscountKind>(DEFAULT_COUPON_DISCOUNT.kind);
  const [value, setValue] = useState(inputFromDiscount(DEFAULT_COUPON_DISCOUNT));
  const [quantity, setQuantity] = useState('20');
  const [expiresOn, setExpiresOn] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const discount = discountFromInput(kind, value);
  const qty = Number(quantity);
  const mine = state.batches.filter(b => b.referrerId === referrer.id);

  async function generate() {
    if (!discount || !referrer.active) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await adminApi.createCoupons({
        referrerId: referrer.id,
        note: batchNote.trim() || null,
        discountKind: discount.kind,
        discountValue: discount.value,
        quantity: qty,
        expiresOn: expiresOn || null,
      });
      setNote(`已产生 ${r.codes.length} 张（第 ${r.batchId} 批）。`);
      state.reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : '产生优惠券失败。');
    } finally {
      setBusy(false);
    }
  }

  let list: ReactNode;
  if (state.loading && state.batches.length === 0) list = <Spinner />;
  else if (state.failure) list = <ErrorNote message={state.failure} onRetry={state.reload} />;
  else if (mine.length === 0) list = <EmptyState title="还没有优惠券" />;
  else list = <BatchList batches={mine} onChanged={state.reload} onError={onError} />;

  return (
    <div className="space-y-3 rounded-xl border border-brand-stone/60 bg-brand-cream/40 p-3">
      <p className="text-[11px] text-brand-charcoal/60">
        T2 折扣码：家长在报告上「T2 深度评估」价钱下面输入，T2 照折后价付款；每位家长只能用一张。家长用了{referrer.name}的券，就跟兑换码一样挂到{referrer.name}名下。
      </p>
      {referrer.active ? (
        <div className="flex flex-wrap items-end gap-2">
          <DiscountInputs kind={kind} value={value} onKind={setKind} onValue={setValue} />
          <Field label={`张数（1–${MAX_COUPON_BATCH}）`}>
            <TextInput value={quantity} onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-24" />
          </Field>
          <Field label="到期日（空白＝不过期）">
            <TextInput type="date" min={dateBounds(0, 5).min} max={dateBounds(0, 5).max} value={expiresOn} onChange={e => setExpiresOn(e.target.value)} className="w-40" />
          </Field>
          <Field label="备注（自己认批次用）">
            <TextInput value={batchNote} maxLength={40} onChange={e => setBatchNote(e.target.value)} className="w-40" />
          </Field>
          <Button busy={busy} disabled={!discount || !(qty >= 1 && qty <= MAX_COUPON_BATCH)} onClick={() => void generate()}>产生优惠券</Button>
        </div>
      ) : (
        <p className="text-[11px] font-bold text-brand-clay">这位推荐人已停用，不能再产生优惠券；以前的批次照样看得到。</p>
      )}
      {note && <p className="text-[11px] font-bold text-brand-forest">{note}</p>}
      {list}
    </div>
  );
}

/** 沒有推薦人的舊批次（2026-11-25 之前產的、測試優惠碼那一批）：有才畫；只能看與改折扣／到期日，不能產新的。 */
export function LegacyCouponBatches({ state, onError }: { state: CouponBatchesState; onError: (view: AdminErrorView) => void }) {
  const legacy = state.batches.filter(b => b.referrerId === null);
  if (state.off || legacy.length === 0) return null;
  return (
    <Panel title="未指定推荐人的旧批次" description="优惠券改成每一批发给一位推荐人之前产的批次。这里只能看与改折扣、到期日；新的优惠券在上面每位推荐人那一列产生。">
      <BatchList batches={legacy} canVoid={false} onChanged={state.reload} onError={onError} />
    </Panel>
  );
}

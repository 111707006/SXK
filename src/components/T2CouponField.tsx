/**
 * T2 價錢下面的「优惠码兑换」（客戶 11/03 簡報第 21 頁，開關 `T2_COUPON`，`src/t2/coupon.ts`）。
 * 獨立一塊，插在 T2 卡（`T2PromoCard`）與解鎖頁（`Paywall`）的價錢下面；卡的其他部分不碰。
 *
 * 一進來先問 `GET /api/coupon`：404（開關關著）或讀不到 → 整塊不出現；用過一張 → 寫用了哪一張與折後價；
 * 還沒用 → 輸入欄＋「兑换」。兌到就算用掉（伺服器記下），之後 T2 的訂單照折後價收。專案 B 沒有 T2，不問、不畫。
 */
import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { PRODUCT } from '../productConfig';
import { authFetch } from '../utils/api';
import { formatFen } from '../utils/price';
import {
  applyCouponDiscount,
  couponAppliedLine,
  COUPON_FIELD_LABEL,
  COUPON_FIELD_PLACEHOLDER,
  COUPON_FIELD_SUBMIT,
  COUPON_INVALID,
  COUPON_PRICE_LABEL,
  type ParentCoupon,
} from '../t2/coupon';

type State = { kind: 'hidden' } | { kind: 'open' } | { kind: 'applied'; coupon: ParentCoupon };

/** `onApplied`：讀到或兌到一張時告訴外層（付款鈕要寫折後價，與伺服器收的一致）。 */
export default function T2CouponField({ priceFen, onApplied }: { priceFen: number; onApplied?: (coupon: ParentCoupon) => void }) {
  const [state, setState] = useState<State>({ kind: 'hidden' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!PRODUCT.features.tier2And3) return;
    let cancelled = false;
    authFetch('/api/coupon')
      .then(async resp => {
        if (cancelled || !resp.ok) return;
        const body = await resp.json();
        if (cancelled) return;
        setState(body?.coupon ? { kind: 'applied', coupon: body.coupon } : { kind: 'open' });
        if (body?.coupon) onApplied?.(body.coupon);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // 只在掛上時問一次；onApplied 換了不重問
  }, []);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'applied') {
    return (
      <div id="t2-coupon-applied" className="rounded-xl bg-brand-cream/50 px-3.5 py-2.5 text-xs md:text-sm text-brand-forest space-y-0.5">
        <div className="flex items-center gap-1.5 font-bold"><Ticket size={14} />{couponAppliedLine(state.coupon)}</div>
        <div>
          {COUPON_PRICE_LABEL} <span className="text-base font-extrabold">¥{formatFen(applyCouponDiscount(priceFen, state.coupon.discount))}</span>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await authFetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok && body?.coupon) {
        setState({ kind: 'applied', coupon: body.coupon });
        onApplied?.(body.coupon);
      }
      else setError(typeof body?.error === 'string' ? body.error : COUPON_INVALID);
    } catch {
      setError('暂时无法兑换，请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="t2-coupon-field"
      className="space-y-1"
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="t2-coupon-input" className="text-xs font-bold text-brand-forest">{COUPON_FIELD_LABEL}</label>
      <div className="flex gap-2">
        <input
          id="t2-coupon-input"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={COUPON_FIELD_PLACEHOLDER}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          className="min-w-0 flex-1 rounded-xl border border-brand-stone bg-white px-3 py-2 text-sm font-mono tracking-wider text-brand-forest outline-none focus:border-brand-moss"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="shrink-0 rounded-xl border border-brand-moss px-4 py-2 text-sm font-extrabold text-brand-moss hover:bg-brand-moss/5 disabled:opacity-50 cursor-pointer"
        >
          {COUPON_FIELD_SUBMIT}
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-brand-clay">{error}</p>}
    </form>
  );
}

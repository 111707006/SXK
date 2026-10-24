import { X } from 'lucide-react';
import { PRODUCT } from '../productConfig';
import { WORDING_1022 } from '../wording1022';

/**
 * 1022（使用者 2026-10-24）：「预约 1 对 1 专家」一律改成企業微信二維碼 —— 家長掃碼加客服，
 * 不在系統裡選專家、選時段。只在專案 A、`VITE_UI_1022` 開著時用（`expertBookingIsQr`）；
 * 關著時照舊開預約表。二維碼沿用 `PRODUCT.expertBooking.wechatQrSrc`（企業微信客服）。
 */
export const expertBookingIsQr = (): boolean => PRODUCT.features.ui1022 && Boolean(PRODUCT.expertBooking.wechatQrSrc);

export function WecomQrBlock({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const src = PRODUCT.expertBooking.wechatQrSrc;
  if (!src) return null;
  return (
    <div id="wecom-qr" className="flex flex-col items-center gap-2 text-center">
      <img src={src} alt={WORDING_1022.expertQr.alt} className="w-44 h-44 rounded-2xl bg-white p-2 border border-brand-stone/60" />
      <p className={`text-sm font-bold ${tone === 'dark' ? 'text-white' : 'text-brand-forest'}`}>{WORDING_1022.expertQr.scan}</p>
      <p className={`text-xs leading-relaxed ${tone === 'dark' ? 'text-white/80' : 'text-brand-charcoal/80'}`}>{WORDING_1022.expertQr.hint}</p>
    </div>
  );
}

export function WecomQrModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      id="wecom-qr-modal"
      role="dialog"
      aria-modal="true"
      aria-label={WORDING_1022.expertQr.title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[rgba(36,51,44,0.35)] animate-fade-in"
      onClick={onClose}
    >
      <div className="bg-white rounded-t-[28px] sm:rounded-[28px] max-w-sm w-full shadow-2xl p-5 pb-7 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-black text-brand-forest">{WORDING_1022.expertQr.title}</h3>
            <p className="text-xs leading-relaxed text-brand-charcoal/80">{WORDING_1022.expertQr.sub}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="p-1.5 rounded-full hover:bg-brand-cream cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <WecomQrBlock />
      </div>
    </div>
  );
}

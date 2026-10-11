import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatFen } from '../utils/price';
import {
  PROMO_FREE_NOTE,
  PROMO_GUIDE_LABEL,
  PROMO_PRICE_LABEL,
  PROMO_START,
  PROMO_TITLE,
  PROMO_UNLOCK,
  T2_GUIDE_PRICE_FEN,
  promoCountLabel,
  promoSentence,
  type EntrancePromo,
} from '../t2/entrancePromo';

interface T2PromoCardProps {
  promo: EntrancePromo;
  /** 未解鎖（`locked`／`demo`）：價錢＋解鎖鈕。已解鎖：「开始」鈕；真的買過的不再出價錢。 */
  locked: boolean;
  /** 免費期間（`PAYWALL_FREE`）：已解鎖，但價錢照畫當參考，旁邊註明現在免費（使用者 2026-10-11）。 */
  freePeriod?: boolean;
  priceFen: number;
  onUnlock: () => void;
  onStart: () => void;
  /** 卡底下的附加區（安全提示、這個年齡沒有問卷的方面）；沒有就不出。 */
  children?: React.ReactNode;
}

/**
 * T1 報告上的 T2 入口卡（使用者 2026-10-11 的版面，照網站的配色與字級改畫）：標題、哪幾個方面、幾項、特惠價與劃掉的指導價、一顆按鈕。
 * 逐份問卷的清單不在這裡 —— 按下去之後的作答頁才列（理由見 `src/t2/entrancePromo.ts` 檔頭）。
 * 字都在 `entrancePromo.ts`；這一檔只排版。
 */
export default function T2PromoCard({ promo, locked, freePeriod = false, priceFen, onUnlock, onStart, children }: T2PromoCardProps) {
  const sentence = promoSentence(promo.dimensions);
  const [lead, tail] = PROMO_TITLE.split('T2');
  const showPrice = locked || freePeriod;
  return (
    <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 md:p-6 shadow-sm text-left space-y-4" id="t2-promo-card">
      <div className="space-y-2">
        <h3 className="text-lg md:text-xl font-extrabold text-brand-forest tracking-tight">
          {lead}<span className="text-brand-clay">T2{tail}</span>
        </h3>
        <p className="text-xs md:text-sm text-brand-charcoal/80 leading-relaxed max-w-2xl">
          {sentence.before}
          {sentence.highlight && <strong className="font-extrabold text-brand-clay">{sentence.highlight}</strong>}
          {sentence.after}
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pt-3 border-t border-brand-cream/80">
        {showPrice ? (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="leading-tight">
              <div className="text-sm font-bold text-brand-forest">{promoCountLabel(promo.count)}</div>
              <div className="text-[11px] text-brand-charcoal/60">{PROMO_PRICE_LABEL}</div>
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-brand-forest leading-none">
              <span className="text-lg align-top mr-0.5">¥</span>{formatFen(priceFen)}
            </div>
            <div className="text-[11px] text-brand-charcoal/50 line-through pb-0.5">
              {PROMO_GUIDE_LABEL} ¥{formatFen(T2_GUIDE_PRICE_FEN)}
            </div>
            {!locked && <div className="basis-full text-[11px] font-semibold text-brand-moss">{PROMO_FREE_NOTE}</div>}
          </div>
        ) : (
          <div className="text-sm font-bold text-brand-forest">{promoCountLabel(promo.count)}</div>
        )}

        <button
          type="button"
          id={locked ? 't2-promo-unlock-btn' : 't2-promo-start-btn'}
          onClick={locked ? onUnlock : onStart}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-sm font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
        >
          {locked ? PROMO_UNLOCK : PROMO_START}
          <ChevronRight size={15} />
        </button>
      </div>

      {children}
    </div>
  );
}

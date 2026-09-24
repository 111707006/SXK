/**
 * 家庭訓練那幾層共用的小零件：底部抽屜、導覽列、標籤、封面、步驟圖。
 *
 * 版面與互動照 Keep 式樣品的 `ui.tsx` 搬來；顏色對回品牌令牌（AGENTS.md「代碼規範」）：
 * 樣品的近黑字 → `brand-forest`／`brand-charcoal`，淺灰底 → `brand-cream`／`brand-sage`，
 * 深綠頭 `#27302B` → `brand-forest`，Keep 的亮綠 → `brand-moss`（只當填色，不當小字的字色：
 * 白底上對比不夠）。圖一律來自活動庫（`posterUrl`、步驟的 `imageUrl`），**不用樣品的配圖**
 *（§3 共同規則、§9 第 4 題）；沒有圖就是無圖的版面。
 */
import type { ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { COMMON } from '../../t2/trainingCopy';

/**
 * 底部抽屜（樣品的 `Sheet`）。它是堆疊裡的一層：關掉＝`nav.back()`，與返回鍵同一個出口
 *（`layerStack.ts`）。遮罩是 `fixed`，桌機上整個畫面都暗下來；抽屜本身在報告那一欄的寬度裡。
 */
export function Sheet({ onClose, children, tall = false }: { onClose: () => void; children: ReactNode; tall?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end">
      <button type="button" aria-label={COMMON.close} className="fixed inset-0 bg-black/45 training-fade cursor-default" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`relative bg-white rounded-t-[22px] training-up flex flex-col ${tall ? 'h-[94%]' : 'max-h-[86%]'}`}>
        <button
          type="button"
          aria-label={COMMON.close}
          onClick={onClose}
          className="absolute right-4 top-4 z-10 w-10 h-10 rounded-full bg-brand-cream grid place-items-center text-brand-charcoal cursor-pointer"
        >
          <X size={20} />
        </button>
        <div className="overflow-y-auto training-no-scrollbar px-5 pt-7 pb-[calc(24px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** 白底導覽列：左邊返回，中間標題。 */
export function LightNav({ title, onBack, right }: { title?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="h-12 shrink-0 px-2 flex items-center bg-white relative z-10">
      <button type="button" aria-label={COMMON.back} onClick={onBack} className="w-10 h-10 grid place-items-center text-brand-forest cursor-pointer">
        <ChevronLeft size={26} />
      </button>
      {title && <p className="absolute left-1/2 -translate-x-1/2 max-w-[60%] truncate text-[17px] font-bold text-brand-forest">{title}</p>}
      <div className="ml-auto flex items-center gap-1 pr-1">{right}</div>
    </div>
  );
}

/** 計劃頁的深色導覽列：左邊返回、中間標題、右邊一個字按鈕（沒有就不出）。 */
export function DarkNav({ title, onBack, right, onRight }: { title: string; onBack: () => void; right?: string; onRight?: () => void }) {
  return (
    <div className="h-12 shrink-0 px-2 flex items-center bg-brand-forest text-white relative z-10">
      <button type="button" aria-label={COMMON.back} onClick={onBack} className="w-10 h-10 grid place-items-center cursor-pointer">
        <ChevronLeft size={26} />
      </button>
      <p className="absolute left-1/2 -translate-x-1/2 max-w-[56%] truncate text-[17px] font-bold">{title}</p>
      {right && onRight && (
        <button type="button" onClick={onRight} className="ml-auto pr-3 text-[15px] cursor-pointer">
          {right}
        </button>
      )}
    </div>
  );
}

type TagTone = 'custom' | 'hot' | 'dark' | 'soft';

const TAG_TONE: Record<TagTone, string> = {
  custom: 'bg-brand-sand text-brand-forest',
  hot: 'bg-brand-clay text-brand-forest',
  dark: 'bg-black/60 text-white',
  soft: 'bg-white text-brand-forest border border-brand-stone',
};

export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={`text-[12px] leading-none font-bold px-1.5 py-[5px] rounded-[4px] ${TAG_TONE[tone]}`}>{children}</span>;
}

/**
 * 活動的封面：活動庫有 `posterUrl` 就放，沒有就是一塊淡綠底（不拿別的活動或樣品的圖來充）。
 * `children` 疊在上面（角標、字）。
 */
export function Cover({ src, className, children }: { src: string | null; className: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden ${src ? 'bg-brand-forest' : 'bg-gradient-to-br from-brand-sage to-brand-cream'} ${className}`}>
      {src && <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
      {children}
    </div>
  );
}

/**
 * 步驟圖（ADR-0008：圖選填）。有圖放圖；沒有就是寫著序號的色塊，不放破圖、不留空白。
 */
export function StepImage({ src, className, n }: { src: string | null; className: string; n: number }) {
  if (src) return <img src={src} alt="" loading="lazy" className={`object-cover ${className}`} />;
  return (
    <div aria-hidden="true" className={`bg-gradient-to-br from-brand-sage to-brand-cream text-brand-forest grid place-items-center ${className}`}>
      <span className="text-[22px] font-black tabular-nums leading-none">{n}</span>
    </div>
  );
}

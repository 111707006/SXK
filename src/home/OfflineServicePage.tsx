import { ArrowLeft, Building2 } from 'lucide-react';
import { HOME_COPY } from './homeNav';

/**
 * 線下服務點介紹頁（首頁第三張卡，D16、Q-8）：只放醫院名稱、照片、「即将开放」；預約先不開。
 * 醫院照片先放佔位 —— 從客戶示意圖裁切的那一張進來時換掉 `data-placeholder` 那一格。
 */
export default function OfflineServicePage({ onBack }: { onBack: () => void }) {
  return (
    <div id="offline-service-page" className="w-full max-w-2xl mx-auto space-y-4 animate-fade-in text-left">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-bold text-brand-moss hover:text-brand-forest cursor-pointer"
      >
        <ArrowLeft size={12} />
        {HOME_COPY.offline.back}
      </button>
      <div className="overflow-hidden rounded-3xl border border-brand-stone/50 bg-white shadow-sm">
        <div
          data-placeholder="offline-hospital"
          className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-brand-stone/60 to-brand-beige"
        >
          <Building2 size={56} className="text-brand-forest/40" aria-hidden="true" />
        </div>
        <div className="space-y-2 p-5">
          <p className="text-xs font-bold text-brand-charcoal/80">{HOME_COPY.offline.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-brand-forest">{HOME_COPY.offline.hospital}</h2>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {HOME_COPY.offline.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

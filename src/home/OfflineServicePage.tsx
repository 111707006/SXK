import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { PRODUCT } from '../productConfig';
import { serviceTypeDescriptors } from '../utils/serviceTypes';
import { Chip, Greeting, Tile } from '../components/ledo/ui';
import { HOME_COPY } from './homeNav';
import { HOSPITAL_PHOTO, Photo } from './HomePage';

/**
 * 線下服務點介紹頁（首頁第三張卡，D16、Q-8）：只放醫院名稱、照片、「即将开放」；預約先不開。
 * 醫院照片與首頁那張卡同一張（`HOSPITAL_PHOTO`，從客戶示意圖裁切）。
 */
export default function OfflineServicePage({ onBack }: { onBack: () => void }) {
  if (PRODUCT.features.ledo) return <LedoOffline onBack={onBack} />;
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
        <Photo photo={HOSPITAL_PHOTO} className="aspect-video w-full bg-brand-stone/40" />
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

/**
 * Ledo 版（設計稿第 18 頁）：照片大卡上放「即将开放」、醫院名稱、開放後有哪幾種服務（就是四種服務裡線下那兩種，
 * 不另寫還沒定的細節）。設計稿的「开放时通知我」是新功能、要客戶點頭，先不做。
 */
function LedoOffline({ onBack }: { onBack: () => void }) {
  const offline = serviceTypeDescriptors().filter(d => d.venue === 'offline');
  return (
    <div id="offline-service-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2">
        <button type="button" aria-label={HOME_COPY.offline.back} onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full border border-ledo-line text-ledo-ink cursor-pointer">
          <ChevronLeft size={16} />
        </button>
        <b className="text-center text-base font-black text-ledo-ink">{HOME_COPY.offline.title}</b>
        <span />
      </div>
      <div className="relative overflow-hidden rounded-[28px]">
        <Photo photo={HOSPITAL_PHOTO} className="aspect-[4/3] w-full bg-ledo-ok" />
        <span className="absolute left-3 bottom-3"><Chip tone="mild">{HOME_COPY.offline.status}</Chip></span>
      </div>
      <Greeting small={HOME_COPY.offline.title} title={HOME_COPY.offline.hospital} />
      <div className="grid grid-cols-2 gap-2">
        {offline.map((d, i) => (
          <Tile key={d.type} tone={i === 0 ? 'acc' : 'ok'} label={d.label} note="开放后提供" />
        ))}
      </div>
      <p className="text-[13px] leading-relaxed text-ledo-ink-2">开放时间与做法确定后会在这里公布；现在可以先约线上咨询。</p>
    </div>
  );
}

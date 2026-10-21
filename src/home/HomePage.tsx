import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { HOME_CARDS, type HomeCard, type HomeTarget } from './homeNav';

/**
 * 新版首頁（開關 `HOME_V2`，issue #72，規格 docs/specs/client-changes-2026-10-17.md §5.1）：
 * banner（現有示範片一支）＋三張卡（左一張大卡、右兩張小卡）。登入前後同一個版面；
 * 點卡要不要先登入由 `App.tsx` 照 `openHomeCard` 決定，這裡只回報點了哪一張。
 */

/**
 * banner 用的示範片（Q-7，實作時挑）：A012「小推车」—— 17 支裡唯一一支大人與孩子一起做、
 * 大人在畫面裡扶著孩子的（最像「家長陪孩子玩」）。片子與封面在 `/media`（`src/t2/activityMedia.ts`）。
 */
export const BANNER = {
  video: '/media/activities/A012.mp4',
  poster: '/media/activities/A012.jpg',
} as const;

/**
 * 醫院照（D17）：從客戶 10/17 示意圖裁切（使用者已確認可用），避開示意圖上壓的字與「了解更多」；
 * 檔案在 `public/home/`，WebP＋JPG 備援。首頁卡與線下服務點頁用同一張。
 */
export interface CardPhoto {
  webp: string;
  jpg: string;
  alt: string;
}

export const HOSPITAL_PHOTO: CardPhoto = {
  webp: '/home/offline-hospital.webp',
  jpg: '/home/offline-hospital.jpg',
  alt: '上海禾新医院外观',
};

/** 照片的一格；`object-cover` 填滿，卡的大小不跟著照片走。 */
export function Photo({ photo, className = '' }: { photo: CardPhoto; className?: string }) {
  return (
    <picture className={`block overflow-hidden ${className}`}>
      <source srcSet={photo.webp} type="image/webp" />
      <img src={photo.jpg} alt={photo.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
    </picture>
  );
}

/**
 * 兩張人物照（D17）：OpenAI `gpt-image-1` 生成（可靈 0 點數），提示詞使用者 2026-10-18 確認過，
 * 原文與確認紀錄在 `docs/reference/home-photo-prompts-2026-10-18.md`。
 */
const CARD_ART: Record<HomeCard['id'], CardPhoto> = {
  training: { webp: '/home/home-training.webp', jpg: '/home/home-training.jpg', alt: '一家人在客厅里陪孩子玩' },
  t1: { webp: '/home/home-t1.webp', jpg: '/home/home-t1.jpg', alt: '医师与家长一起看孩子搭积木' },
  offline: HOSPITAL_PHOTO,
};

export default function HomePage({ onOpen }: { onOpen: (target: HomeTarget) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // React 不保證把 `muted` 寫成 DOM 屬性，而 iOS 看的是屬性：沒有它就不肯自動播放。再設一次、再叫一次播放；
    // 播不了（省電模式、微信擋掉）就停在封面，不報錯。
    v.muted = true;
    v.defaultMuted = true;
    v.play()?.catch(() => {});
  }, []);

  const [big, ...small] = HOME_CARDS;

  return (
    <div id="home-page" className="w-full space-y-5 sm:space-y-6 animate-fade-in text-left">
      <div className="relative w-full overflow-hidden rounded-3xl bg-brand-forest shadow-lg aspect-video max-h-[60vh]">
        <video
          ref={videoRef}
          id="home-banner-video"
          className="absolute inset-0 h-full w-full object-cover"
          src={BANNER.video}
          poster={BANNER.poster}
          muted
          autoPlay
          loop
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="metadata"
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:grid-rows-2">
        <CardButton card={big} onOpen={onOpen} large />
        {small.map(card => (
          <CardButton key={card.id} card={card} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function CardButton({ card, onOpen, large = false }: { card: HomeCard; onOpen: (target: HomeTarget) => void; large?: boolean }) {
  const art = large ? 'min-h-40 md:min-h-64' : 'min-h-24 md:min-h-28';
  return (
    <button
      type="button"
      id={`home-card-${card.id}`}
      onClick={() => onOpen(card.target)}
      className={`group flex flex-col overflow-hidden rounded-3xl border border-brand-stone/50 bg-white text-left shadow-sm transition hover:shadow-md active:scale-[0.99] cursor-pointer ${
        large ? 'col-span-2 md:row-span-2' : ''
      }`}
    >
      <Photo photo={CARD_ART[card.id]} className={`relative w-full flex-1 ${art} [&>img]:absolute [&>img]:inset-0`} />
      {/* 手機上小卡只有半寬：標題與「了解更多」上下排，標題不從中間斷行。 */}
      <div className={`flex gap-1 px-4 py-3 ${large ? 'items-center justify-between' : 'flex-col items-start sm:flex-row sm:items-center sm:justify-between'}`}>
        <span className={`font-extrabold text-brand-forest whitespace-nowrap ${large ? 'text-lg' : 'text-sm'}`}>{card.title}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-brand-moss group-hover:text-brand-forest">
          {card.more}
          <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

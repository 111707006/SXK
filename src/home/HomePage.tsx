import { useEffect, useRef } from 'react';
import { ArrowRight, Building2, ClipboardCheck, HeartHandshake } from 'lucide-react';
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

/** 人物照與醫院照先放佔位（D17：生成前要先給使用者看提示詞，不在這張做）。換圖時換掉這三格。 */
const CARD_ART: Record<HomeCard['id'], { icon: typeof HeartHandshake; tint: string }> = {
  training: { icon: HeartHandshake, tint: 'from-brand-sage/50 to-brand-moss/30' },
  t1: { icon: ClipboardCheck, tint: 'from-brand-beige to-brand-sand/60' },
  offline: { icon: Building2, tint: 'from-brand-stone/60 to-brand-beige' },
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
  const { icon: Icon, tint } = CARD_ART[card.id];
  return (
    <button
      type="button"
      id={`home-card-${card.id}`}
      onClick={() => onOpen(card.target)}
      className={`group flex flex-col overflow-hidden rounded-3xl border border-brand-stone/50 bg-white text-left shadow-sm transition hover:shadow-md active:scale-[0.99] cursor-pointer ${
        large ? 'col-span-2 md:row-span-2' : ''
      }`}
    >
      <div
        data-placeholder={`home-card-${card.id}`}
        className={`flex w-full flex-1 items-center justify-center bg-gradient-to-br ${tint} ${large ? 'min-h-40 md:min-h-64' : 'min-h-24 md:min-h-28'}`}
      >
        <Icon size={large ? 48 : 32} className="text-brand-forest/40" aria-hidden="true" />
      </div>
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

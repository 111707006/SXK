import { useEffect, useRef, useState } from 'react';
import type { HomeMediaItem } from '../homeMedia/shape';
import { openMediaLink } from './homeMediaClient';

/**
 * 首頁輪播（#87，`HOME_MEDIA`）：取代 Ledo 首頁那張固定示範片。
 * - 手指左右滑：原生橫向捲動＋scroll-snap（不自己算手勢）
 * - 自己換：5 秒一張（暫採），手指碰過之後停 5 秒再繼續；捲出畫面就不換
 * - 點點指示目前第幾張；短片靜音 `playsInline`，只有正在看的那一張播，換走就停
 * - 點一張去它的連結（沒設連結就不動）
 */
export const CAROUSEL_INTERVAL_MS = 5000;

export default function HomeCarousel({ items }: { items: HomeMediaItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const [at, setAt] = useState(0);
  const [visible, setVisible] = useState(true);
  const touchedAt = useRef(0);

  // 目前第幾張：看捲到哪裡。
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setAt(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };

  // 捲出畫面就不換、短片也停。
  useEffect(() => {
    const el = track.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 自己換。
  useEffect(() => {
    if (items.length < 2 || !visible) return;
    const timer = setInterval(() => {
      if (Date.now() - touchedAt.current < CAROUSEL_INTERVAL_MS) return;
      const el = track.current;
      if (!el || el.clientWidth === 0) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % items.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length, visible]);

  // 只播正在看的那一支短片（iOS 看的是 DOM 屬性，再設一次 muted）。
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === at && visible) {
        v.muted = true;
        v.play()?.catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [at, visible]);

  const go = (i: number) => {
    const el = track.current;
    touchedAt.current = Date.now();
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div id="home-carousel" className="relative">
      <div
        ref={track}
        onScroll={onScroll}
        onTouchStart={() => {
          touchedAt.current = Date.now();
        }}
        className="flex aspect-video w-full snap-x snap-mandatory overflow-x-auto rounded-[28px] bg-ledo-accent-soft [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            id={`home-carousel-${item.id}`}
            aria-label={`第 ${i + 1} 张，共 ${items.length} 张`}
            onClick={() => openMediaLink(item.link)}
            className={`relative h-full w-full shrink-0 snap-center overflow-hidden ${item.link ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {item.kind === 'video' ? (
              <video
                ref={el => {
                  videos.current[i] = el;
                }}
                className="absolute inset-0 h-full w-full object-cover"
                src={item.url}
                poster={item.posterUrl ?? undefined}
                muted
                loop
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                preload="metadata"
                aria-hidden="true"
              />
            ) : (
              <img src={item.url} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" role="tablist" aria-label="轮播">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-label={`看第 ${i + 1} 张`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${i === at ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

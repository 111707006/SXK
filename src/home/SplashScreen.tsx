import { useEffect, useRef, useState } from 'react';
import { PRODUCT } from '../productConfig';
import type { HomeMediaItem } from '../homeMedia/shape';
import { loadHomeMedia, openMediaLink } from './homeMediaClient';
import { readSplashSeen, sessionStorageOrNull, shouldShowSplash, splashPossible, SPLASH_SECONDS, writeSplashSeen } from './splash';

/**
 * 開屏（#88，`HOME_MEDIA`）：蓋在整個家長端上面。圖片停 3 秒、短片靜音播到 3 秒（播不了停在封面，一樣 3 秒），
 * 右上角「跳过」，點畫面去連結（站內路徑與 https 都整頁換過去）。同一個分頁工作階段只出現一次；
 * 素材讀不到或逾時（`loadHomeMedia` 1.5 秒）就不出現，家長直接看到首頁。
 */
export default function SplashScreen() {
  const [splash, setSplash] = useState<HomeMediaItem | null>(null);
  const [left, setLeft] = useState(SPLASH_SECONDS);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const storage = sessionStorageOrNull();
    const base = { hasHome: PRODUCT.features.home, pathname: window.location.pathname, seen: readSplashSeen(storage) };
    // 先擋掉不必問的情況，連端點都不打。
    if (!splashPossible(base)) return;
    let alive = true;
    void loadHomeMedia().then(media => {
      if (!alive || !shouldShowSplash({ ...base, splash: media.splash })) return;
      writeSplashSeen(storage);
      setSplash(media.splash);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 倒數；到 0 就收起來。
  useEffect(() => {
    if (!splash) return;
    if (left <= 0) {
      setSplash(null);
      return;
    }
    const t = setTimeout(() => setLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [splash, left]);

  // 短片：iOS 看的是 DOM 屬性，再設一次 muted、再叫一次播放；播不了就停在封面。
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play()?.catch(() => {});
  }, [splash]);

  if (!splash) return null;

  return (
    <div id="splash-screen" className="fixed inset-0 z-[100] bg-black animate-fade-in" role="dialog" aria-label="活动">
      <button
        type="button"
        id="splash-open"
        onClick={() => openMediaLink(splash.link)}
        className={`absolute inset-0 h-full w-full ${splash.link ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={splash.link ? '看活动' : '活动'}
      >
        {splash.kind === 'video' ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={splash.url}
            poster={splash.posterUrl ?? undefined}
            muted
            autoPlay
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="auto"
          />
        ) : (
          <img src={splash.url} alt="" className="h-full w-full object-cover" />
        )}
      </button>
      <button
        type="button"
        id="splash-skip"
        onClick={() => setSplash(null)}
        className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] rounded-full bg-black/45 px-3.5 py-1.5 text-sm font-bold text-white backdrop-blur cursor-pointer"
      >
        跳过 {left}
      </button>
    </div>
  );
}

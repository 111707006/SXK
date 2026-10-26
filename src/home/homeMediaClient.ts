/**
 * 家長端讀首頁素材（公開端點 `GET /api/home/media`，#87／#88）。整頁只問一次（開屏與輪播共用同一次），
 * 讀失敗＝沒有素材：首頁照舊是固定示範片、開屏不出現；開屏另外只等 1.5 秒（暫採），輪播讀到了才換上。
 * 只有專案 A 有首頁（`PRODUCT.features.home`）；B 不問。
 */
import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { EMPTY_HOME_MEDIA, readPublicHomeMedia, type PublicHomeMedia } from '../homeMedia/shape';

export const HOME_MEDIA_TIMEOUT_MS = 1500;

let pending: Promise<PublicHomeMedia> | null = null;

/** 整頁只問一次；不設逾時（讀失敗＝沒有素材）。 */
function fetchHomeMedia(): Promise<PublicHomeMedia> {
  if (!PRODUCT.features.home) return Promise.resolve(EMPTY_HOME_MEDIA);
  if (!pending) {
    pending = fetch('/api/home/media')
      .then(resp => (resp.ok ? resp.json() : null))
      .then(body => readPublicHomeMedia(body))
      .catch(() => EMPTY_HOME_MEDIA);
  }
  return pending;
}

/**
 * 開屏用：1.5 秒內沒讀到就當沒有（開屏晚好幾秒才跳出來，比沒有更擾人）。
 * 輪播不走這一支（`useHomeMedia`）：網路慢時先畫固定示範片，讀到了再換成輪播（使用者 2026-10-27 在正式站看到慢的那一次整頁停在示範片）。
 */
export function loadHomeMedia(): Promise<PublicHomeMedia> {
  return Promise.race([
    fetchHomeMedia(),
    new Promise<PublicHomeMedia>(resolve => setTimeout(() => resolve(EMPTY_HOME_MEDIA), HOME_MEDIA_TIMEOUT_MS)),
  ]);
}

/** 讀到之前是 null（首頁先畫固定示範片的位置，不閃空白）；讀到了才換成輪播，多慢都等。 */
export function useHomeMedia(): PublicHomeMedia | null {
  const [media, setMedia] = useState<PublicHomeMedia | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchHomeMedia().then(m => {
      if (alive) setMedia(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return media;
}

/** 點素材：站內路徑與 https 網址都整頁換過去（SPA 只認 `/`、`/r/…`、`/handoff`，換頁由伺服器的兜底接）。 */
export function openMediaLink(link: string | null): void {
  if (!link) return;
  window.location.assign(link);
}

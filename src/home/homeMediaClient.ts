/**
 * 家長端讀首頁素材（公開端點 `GET /api/home/media`，#87／#88）。整頁只問一次（開屏與輪播共用同一次），
 * 逾時 1.5 秒（暫採）或讀失敗＝沒有素材：首頁照舊是固定示範片、開屏不出現，不擋家長。
 * 只有專案 A 有首頁（`PRODUCT.features.home`）；B 不問。
 */
import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { EMPTY_HOME_MEDIA, readPublicHomeMedia, type PublicHomeMedia } from '../homeMedia/shape';

export const HOME_MEDIA_TIMEOUT_MS = 1500;

let pending: Promise<PublicHomeMedia> | null = null;

export function loadHomeMedia(): Promise<PublicHomeMedia> {
  if (!PRODUCT.features.home) return Promise.resolve(EMPTY_HOME_MEDIA);
  if (!pending) {
    pending = new Promise<PublicHomeMedia>(resolve => {
      const timer = setTimeout(() => resolve(EMPTY_HOME_MEDIA), HOME_MEDIA_TIMEOUT_MS);
      fetch('/api/home/media')
        .then(resp => (resp.ok ? resp.json() : null))
        .then(body => resolve(readPublicHomeMedia(body)))
        .catch(() => resolve(EMPTY_HOME_MEDIA))
        .finally(() => clearTimeout(timer));
    });
  }
  return pending;
}

/** 讀到之前是 null（首頁先畫固定示範片的位置，不閃空白）。 */
export function useHomeMedia(): PublicHomeMedia | null {
  const [media, setMedia] = useState<PublicHomeMedia | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHomeMedia().then(m => {
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

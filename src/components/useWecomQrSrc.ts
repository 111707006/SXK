import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { authFetch } from '../utils/api';
import { peekCompanySlug } from '../utils/attribution';

/**
 * 「1 对 1 专家咨询」那張企業微信客服二維碼的網址（使用者 2026-11-10：後台「合作公司」分頁可以換）。
 *
 * 只有專案 A 問伺服器（`GET /api/wecom-qr`：家長歸屬那家公司自己的 → 預設那張 → `null`）；
 * 回 `null`、讀不到、或 B，都用建置內建的 `PRODUCT.expertBooking.wechatQrSrc`。
 * 回 `undefined` ＝ 還在問（別先畫內建那張再換掉，家長可能剛好掃到舊的）。
 */
/**
 * 同一個網址只問一次（比照 `homeMediaClient` 的 pending）：報告頁同時掛著兩三個用到二維碼的元件，
 * 以前各打一次。記 60 秒就丟，後台換圖後家長重新進頁面看得到新的。
 */
const pending = new Map<string, { at: number; result: Promise<string | null> }>();
const SHARE_MS = 60_000;

function askWecomQr(url: string): Promise<string | null> {
  const hit = pending.get(url);
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.result;
  const result = authFetch(url)
    .then(resp => (resp.ok ? resp.json() : null))
    .then(body => (body && typeof body.url === 'string' && body.url.startsWith('/media/wecom/') ? (body.url as string) : null))
    .catch(() => null);
  pending.set(url, { at: Date.now(), result });
  return result;
}

export function useWecomQrSrc(): string | null | undefined {
  const builtIn = PRODUCT.expertBooking.wechatQrSrc;
  const ask = PRODUCT.features.tier2And3 && builtIn !== null;
  const [src, setSrc] = useState<string | null | undefined>(ask ? undefined : builtIn);

  useEffect(() => {
    if (!ask) return;
    let alive = true;
    const slug = peekCompanySlug();
    const url = slug ? `/api/wecom-qr?c=${encodeURIComponent(slug)}` : '/api/wecom-qr';
    void askWecomQr(url).then(u => {
      if (alive) setSrc(u ?? builtIn);
    });
    return () => {
      alive = false;
    };
  }, [ask, builtIn]);

  return src;
}

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
export function useWecomQrSrc(): string | null | undefined {
  const builtIn = PRODUCT.expertBooking.wechatQrSrc;
  const ask = PRODUCT.features.tier2And3 && builtIn !== null;
  const [src, setSrc] = useState<string | null | undefined>(ask ? undefined : builtIn);

  useEffect(() => {
    if (!ask) return;
    let alive = true;
    const slug = peekCompanySlug();
    const url = slug ? `/api/wecom-qr?c=${encodeURIComponent(slug)}` : '/api/wecom-qr';
    authFetch(url)
      .then(resp => (resp.ok ? resp.json() : null))
      .then(body => {
        const u = body && typeof body.url === 'string' && body.url.startsWith('/media/wecom/') ? body.url : null;
        if (alive) setSrc(u ?? builtIn);
      })
      .catch(() => {
        if (alive) setSrc(builtIn);
      });
    return () => {
      alive = false;
    };
  }, [ask, builtIn]);

  return src;
}

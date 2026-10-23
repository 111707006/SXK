import { useEffect, useState } from 'react';
import { authFetch } from '../utils/api';
import { peekCompanySlug } from '../utils/attribution';
import { isAllowedAssetUrl } from '../utils/assetUrl';

/**
 * 專案 A 頁首的合作公司徽章（`A_COMPANIES`，客戶 10/22，#90）：家長歸屬某家合作公司（例如醫院）時，在平台名稱旁畫
 * 那家的 LOGO 與名稱 —— 家長知道這是醫院推薦的。沒有歸屬、開關關著、讀不到都不畫（頁首照規格一）。
 *
 * 誰屬於哪一家由伺服器說（`GET /api/company-badge`）：登入了看帳號上的歸屬，還沒登入看進站代號。
 * `identity` 換了（登入、登出）就再問一次。
 */
export interface CompanyBadgeData {
  name: string;
  logoUrl: string | null;
}

/** 讀伺服器回的東西：名字要是非空字串，LOGO 網址要過 `isAllowedAssetUrl`（會進 `<img src>`）。 */
export function readCompanyBadge(body: unknown): CompanyBadgeData | null {
  const company = typeof body === 'object' && body !== null ? (body as { company?: unknown }).company : null;
  if (typeof company !== 'object' || company === null) return null;
  const c = company as Record<string, unknown>;
  if (typeof c.name !== 'string' || c.name.trim() === '') return null;
  const logo = typeof c.logoUrl === 'string' && isAllowedAssetUrl(c.logoUrl) ? c.logoUrl : null;
  return { name: c.name.trim(), logoUrl: logo };
}

export default function CompanyBadge({ enabled, identity }: { enabled: boolean; identity: string | null }) {
  const [badge, setBadge] = useState<CompanyBadgeData | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setBadge(null);
      return;
    }
    let alive = true;
    const slug = identity ? null : peekCompanySlug();
    const url = slug ? `/api/company-badge?c=${encodeURIComponent(slug)}` : '/api/company-badge';
    (identity ? authFetch(url) : fetch(url))
      .then(resp => (resp.ok ? resp.json() : null))
      .then(body => {
        if (alive) {
          setBadge(readCompanyBadge(body));
          setBroken(false);
        }
      })
      .catch(() => {
        if (alive) setBadge(null);
      });
    return () => {
      alive = false;
    };
  }, [enabled, identity]);

  if (!badge) return null;
  return (
    <span id="company-badge" className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-brand-stone/60 bg-white py-0.5 pl-0.5 pr-2.5">
      {badge.logoUrl && !broken && (
        <img src={badge.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full bg-white object-contain" onError={() => setBroken(true)} />
      )}
      <span className="truncate text-xs font-bold text-brand-forest">{badge.name}</span>
    </span>
  );
}

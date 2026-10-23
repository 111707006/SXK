/**
 * 首頁素材（客戶 10/22，規格 `docs/specs/client-changes-2026-10-22-2-media.md`，issue #87／#88，開關 `HOME_MEDIA`）：
 * 開屏一張、首頁輪播多張，後台上傳，家長端讀公開端點。前端與伺服器共用這一檔（純資料與純函式）。
 */

export type HomeMediaSlot = 'splash' | 'banner';
export type HomeMediaKind = 'image' | 'video';

export interface HomeMediaItem {
  id: number;
  slot: HomeMediaSlot;
  kind: HomeMediaKind;
  /** `/media/home/<檔名>?v=<時間>` */
  url: string;
  /** 短片的封面（後台瀏覽器抽的一格）；圖片是 null。 */
  posterUrl: string | null;
  /** 點下去去哪裡：站內路徑或 https 網址（`isSafeMediaLink`）；null＝不連。 */
  link: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string | null;
}

/** 公開端點回的：啟用中的開屏（排序最前的一張）與輪播（依排序）。 */
export interface PublicHomeMedia {
  splash: HomeMediaItem | null;
  banners: HomeMediaItem[];
}

export const EMPTY_HOME_MEDIA: PublicHomeMedia = { splash: null, banners: [] };

/** 上限（暫採，規格 Further Notes）：圖片 2 MB、短片 30 MB。 */
export const MAX_HOME_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_HOME_VIDEO_BYTES = 30 * 1024 * 1024;
export const HOME_MEDIA_TYPES: Record<HomeMediaKind, ReadonlyArray<string>> = {
  image: ['image/jpeg', 'image/png'],
  video: ['video/mp4'],
};
/** 連結的長度上限（同資料庫欄位）。 */
export const MAX_LINK_LENGTH = 500;

/**
 * 連結只收兩種（伺服器與後台畫面共用）：
 * - 站內路徑：`/` 開頭、不是 `//`（`//evil.com` 是協定相對網址，會跳到別的網站）、沒有反斜線與控制字元
 * - `https://` 網址：解析得出主機
 * 其他（`http:`、`javascript:`、`data:`、相對路徑、空白）一律不收。
 */
export function isSafeMediaLink(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const s = raw;
  if (s.length === 0 || s.length > MAX_LINK_LENGTH) return false;
  if (s.trim() !== s) return false;
  // 控制字元與反斜線（瀏覽器把 `/\evil.com` 當成 `//evil.com`）
  if (/[\u0000-\u001f\u007f\\]/.test(s)) return false;
  if (s.startsWith('/')) return !s.startsWith('//');
  if (!s.toLowerCase().startsWith('https://')) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && u.hostname.length > 0 && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** 站內路徑在 SPA 裡換頁；https 網址整頁開。 */
export function isInternalLink(link: string): boolean {
  return link.startsWith('/') && !link.startsWith('//');
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 一列 `home_media` → 素材。認不得的列回 null（不畫一張壞掉的素材）。 */
export function homeMediaFromRow(row: Record<string, unknown>): HomeMediaItem | null {
  const slot = row.slot;
  const kind = row.kind;
  const id = Number(row.id);
  if ((slot !== 'splash' && slot !== 'banner') || (kind !== 'image' && kind !== 'video')) return null;
  if (!Number.isInteger(id) || typeof row.url !== 'string' || row.url === '') return null;
  const link = typeof row.link === 'string' && isSafeMediaLink(row.link) ? row.link : null;
  const created = row.created_at instanceof Date ? row.created_at.toISOString() : typeof row.created_at === 'string' ? row.created_at : null;
  return {
    id,
    slot,
    kind,
    url: row.url,
    posterUrl: typeof row.poster_url === 'string' && row.poster_url !== '' ? row.poster_url : null,
    link,
    sortOrder: finite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    active: Number(row.active) === 1 || row.active === true,
    createdAt: created,
  };
}

/** 全部素材 → 家長端看得到的那一份：啟用中、依排序（同排序依編號）。 */
export function publicHomeMedia(items: ReadonlyArray<HomeMediaItem>): PublicHomeMedia {
  const active = items.filter(i => i.active).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return {
    splash: active.find(i => i.slot === 'splash') ?? null,
    banners: active.filter(i => i.slot === 'banner'),
  };
}

/** 讀公開端點回來的東西（前端用）：形狀不對的一律當成沒有素材。 */
export function readPublicHomeMedia(body: unknown): PublicHomeMedia {
  if (typeof body !== 'object' || body === null) return EMPTY_HOME_MEDIA;
  const b = body as Record<string, unknown>;
  const ok = (v: unknown): v is HomeMediaItem =>
    typeof v === 'object' && v !== null &&
    typeof (v as HomeMediaItem).url === 'string' &&
    ((v as HomeMediaItem).kind === 'image' || (v as HomeMediaItem).kind === 'video');
  return {
    splash: ok(b.splash) ? b.splash : null,
    banners: Array.isArray(b.banners) ? b.banners.filter(ok) : [],
  };
}

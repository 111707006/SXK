/**
 * 家長端讀首頁素材（公開端點 `GET /api/home/media`，issue #87）。後台的增改在 `src/admin/adminStore.ts`。
 * 沒有資料庫（記憶體模式）或讀失敗：回沒有素材 —— 首頁照舊是固定示範片，不擋路。
 */
import { getPool } from './mysql';
import { EMPTY_HOME_MEDIA, homeMediaFromRow, publicHomeMedia, type HomeMediaItem, type PublicHomeMedia } from '../homeMedia/shape';

export async function loadPublicHomeMedia(): Promise<PublicHomeMedia> {
  const p = getPool();
  if (!p) return EMPTY_HOME_MEDIA;
  const [rows] = await p.execute('SELECT * FROM home_media WHERE active = 1 ORDER BY sort_order ASC, id ASC', []);
  const items = (rows as Record<string, unknown>[]).map(homeMediaFromRow).filter((i): i is HomeMediaItem => i !== null);
  return publicHomeMedia(items);
}

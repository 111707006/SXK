/**
 * 示範片清單 → 遷移檔裡的 UPDATE（Keep 規格 K05、§6）。
 *
 * 遷移檔 `deploy/migrations/2026-09-24-activity-media.sql` 的說明是手寫的，只有兩個標記之間的
 * UPDATE 與驗證句由這裡印出來：`ACTIVITY_MEDIA`（`src/t2/activityMedia.ts`，準備腳本從 zip 產的）
 * 是唯一的來源，SQL 是它的投影。`test/activityMedia.test.ts` 會重印一次比對（CI 不需要 zip）。
 * 與活動內容的 `activityContentSql.ts` 同一種做法、同一套字串跳脫（`str()`）。
 *
 * 【重跑不蓋掉後台填過的、也不把後台清掉的填回來】
 * `deploy/migrate.mjs --confirm` 每一次都把每一份遷移從頭跑一遍。規則與手冊文字相同：
 * **`NULL` 是「從沒設過」，空字串是後台刻意清掉的**（`src/admin/adminStore.ts` 的 `ACTIVITY_COLUMNS`）。
 * 所以網址只在 `NULL` 時才寫：內容團隊換成別的網址（例如日後搬到物件儲存的 `https://…`）不會被蓋回來，
 * 下架的片（清掉＝空字串）也不會在下一次部署自己回來。
 *
 * 片長清掉存的是 `NULL`，所以它另外要「那支片還是清單上這一支」（或也還沒設）才補 —— 片被清掉或換掉時
 * 不補，免得活動庫裡有片長卻沒有片。這個條件在 `video_url` 改寫前後都成立（`NULL` → 這一支），
 * 不依賴 MySQL 由左往右求值 SET 的順序。
 *
 * 【驗證句也印在標記之間】
 * 它要列出清單上的每一支；手寫的話，清單多一支、驗證句就少驗一支，而不會有人發現。
 */

import { isAllowedAssetUrl } from '../../src/utils/assetUrl';
import { str } from './activitySql';

export const MEDIA_MIGRATION = 'deploy/migrations/2026-09-24-activity-media.sql';
export const MEDIA_BEGIN = '-- ── 示範片 BEGIN（scripts/t2-prepare-media.ts 產生，請勿手改）';
export const MEDIA_END = '-- ── 示範片 END';

/** SQL 用得到的那幾欄（清單的 `sha256` 只給準備腳本比對檔案）。 */
export interface MediaSqlEntry {
  id: string;
  videoUrl: string;
  posterUrl: string;
  videoSeconds: number;
}

function checked(entries: ReadonlyArray<MediaSqlEntry>): ReadonlyArray<MediaSqlEntry> {
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`示範片清單裡 ${e.id} 出現兩次`);
    ids.add(e.id);
    for (const url of [e.videoUrl, e.posterUrl]) {
      if (!isAllowedAssetUrl(url)) throw new Error(`${e.id} 的網址「${url}」不是 https:// 或站內 / 路徑（src/utils/assetUrl.ts）`);
    }
    if (!Number.isInteger(e.videoSeconds) || e.videoSeconds <= 0) {
      throw new Error(`${e.id} 的片長 ${e.videoSeconds} 不是正整數（秒）`);
    }
  }
  return entries;
}

function updateFor(e: MediaSqlEntry): string {
  const url = (column: string, v: string) => `  \`${column}\` = IF(\`${column}\` IS NULL, ${str(v)}, \`${column}\`)`;
  const ourClip = `(\`video_url\` IS NULL OR \`video_url\` = ${str(e.videoUrl)})`;
  return [
    'UPDATE `activities` SET',
    [
      url('video_url', e.videoUrl),
      url('poster_url', e.posterUrl),
      `  \`video_seconds\` = IF(\`video_seconds\` IS NULL AND ${ourClip}, ${e.videoSeconds}, \`video_seconds\`)`,
    ].join(',\n'),
    `WHERE \`id\` = ${str(e.id)};`,
  ].join('\n');
}

function checkFor(entries: ReadonlyArray<MediaSqlEntry>): string {
  return [
    '-- 清單上的每一支都填過了（後台清掉的空字串也算，那是刻意的）。_gone 必須回 0（migrate.mjs 的命名約定）。',
    `SELECT ${entries.length} - COUNT(*) AS activity_media_missing_gone`,
    '  FROM `activities`',
    ` WHERE \`id\` IN (${entries.map(e => str(e.id)).join(', ')})`,
    '   AND `video_url` IS NOT NULL',
    '   AND `poster_url` IS NOT NULL;',
  ].join('\n');
}

export function renderActivityMediaSql(entries: ReadonlyArray<MediaSqlEntry>): string {
  const list = checked(entries);
  return [...list.map(updateFor), checkFor(list)].join('\n\n') + '\n';
}

/**
 * 把遷移檔裡兩個標記之間的區段換成重印的 SQL。標記不在就丟例外 —— 靜靜地接在檔尾，
 * 會讓遷移檔有兩份 UPDATE。
 */
export function replaceMediaBlock(migration: string, sql: string): string {
  const begin = migration.indexOf(MEDIA_BEGIN);
  const end = migration.indexOf(MEDIA_END);
  if (begin < 0 || end < 0 || end < begin) throw new Error(`${MEDIA_MIGRATION} 缺少示範片區段的標記`);
  return migration.slice(0, begin + MEDIA_BEGIN.length) + '\n' + sql + migration.slice(end);
}

/** 遷移檔裡兩個標記之間的那一段（不含標記）。標記不在回 null。 */
export function mediaBlockOf(migration: string): string | null {
  const text = migration.replace(/\r\n/g, '\n');
  const begin = text.indexOf(MEDIA_BEGIN);
  const end = text.indexOf(MEDIA_END);
  if (begin < 0 || end < 0 || end < begin) return null;
  return text.slice(begin + MEDIA_BEGIN.length, end);
}

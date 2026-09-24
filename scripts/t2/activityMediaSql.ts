/**
 * 示範片清單 → 遷移檔裡的 UPDATE（Keep 規格 K05、§6）。
 *
 * 遷移檔 `deploy/migrations/2026-09-24-activity-media.sql` 的說明是手寫的，只有兩個標記之間的
 * UPDATE 與驗證句由這裡印出來：`ACTIVITY_MEDIA`（`src/t2/activityMedia.ts`，準備腳本從 zip 產的）
 * 是唯一的來源，SQL 是它的投影。`test/activityMedia.test.ts` 會重印一次比對（CI 不需要 zip）。
 * 與活動內容的 `activityContentSql.ts` 同一種做法、同一套字串跳脫（`str()`）。
 *
 * 【重跑不蓋掉後台填過的東西】
 * `deploy/migrate.mjs --confirm` 每一次都把每一份遷移從頭跑一遍，所以三格都只在「還沒填」時才寫：
 * 網址是 `NULL` 或空字串、片長是 `NULL` 或不是正數（`activityFromRow` 把它讀成沒有）。
 * 內容團隊在後台換成別的網址（例如日後搬到物件儲存的 `https://…`）不會被蓋回來。
 *
 * 反過來說：後台把一支的示範片**清掉**（存的是 `NULL`，`activityAdmin.ts` 的 `readUrl`），下一次跑遷移
 * 會把它填回來。要下架一支片，得同時讓它離開清單（重跑準備腳本）——或者停用那支活動。
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
  const url = (column: string, v: string) =>
    `  \`${column}\` = IF(\`${column}\` IS NULL OR TRIM(\`${column}\`) = '', ${str(v)}, \`${column}\`)`;
  return [
    'UPDATE `activities` SET',
    [
      url('video_url', e.videoUrl),
      url('poster_url', e.posterUrl),
      `  \`video_seconds\` = IF(\`video_seconds\` IS NULL OR \`video_seconds\` <= 0, ${e.videoSeconds}, \`video_seconds\`)`,
    ].join(',\n'),
    `WHERE \`id\` = ${str(e.id)};`,
  ].join('\n');
}

function checkFor(entries: ReadonlyArray<MediaSqlEntry>): string {
  return [
    '-- 清單上的每一支三格都有值（_gone 必須回 0，migrate.mjs 的命名約定）。',
    `SELECT ${entries.length} - COUNT(*) AS activity_media_missing_gone`,
    '  FROM `activities`',
    ` WHERE \`id\` IN (${entries.map(e => str(e.id)).join(', ')})`,
    "   AND `video_url` IS NOT NULL AND TRIM(`video_url`) <> ''",
    "   AND `poster_url` IS NOT NULL AND TRIM(`poster_url`) <> ''",
    '   AND `video_seconds` > 0;',
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

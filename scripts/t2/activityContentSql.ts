/**
 * 活動內容 → 遷移檔裡的 UPDATE（Keep 規格 K02／K03，§4.1）。
 *
 * 遷移檔 `deploy/migrations/2026-09-23-activity-content.sql` 的加欄位與說明是手寫的，只有
 * 兩個標記之間的 UPDATE 由這裡印出來：`ACTIVITY_CONTENT`（`src/t2/activityContent.ts`，
 * 腳本從 docx 抽的）是唯一的來源，SQL 是它的投影。`test/activityContent.test.ts` 會重印一次比對。
 *
 * 【重跑不蓋掉後台填過的東西】
 * `deploy/migrate.mjs --confirm` 每一次都把**每一份**遷移從頭跑一遍（它靠每一句自己可以重跑，
 * 不記哪一份跑過）。所以這裡的每一格都只在「還沒填」時才寫：
 *
 * - 文字欄位用 `COALESCE(欄位, '原文')`：只填 `NULL`。後台清掉一格存的是空字串（不是 `NULL`，
 *   見 `src/admin/adminStore.ts`），重跑不會把它填回來。
 * - `steps` 只填**還是空陣列**的（規格 §4.1）：內容團隊在後台已經寫過步驟的那幾支不動。
 * - `guide` 同文字欄位，只填 `NULL`；後台不提供「整份刪掉腳本」（`readActivityPatch`），
 *   所以不會有「刪掉了又被填回來」這回事。
 *
 * 內容相同的 UPDATE 在 InnoDB 是「符合 1 列、改動 0 列」，`updated_at` 也不會跟著變。
 *
 * 【為什麼一支一句】
 * 300 句，每句只碰自己那一列（主鍵）。一句失敗，錯誤訊息直接指到哪一支；也方便人讀 diff ——
 * 客戶改了某張卡的一個字，重印之後 diff 就只有那一句。
 */

import { str } from './activitySql';
import type { ActivityContentEntry } from './activityContent';

export const CONTENT_MIGRATION = 'deploy/migrations/2026-09-23-activity-content.sql';
export const CONTENT_BEGIN = '-- ── 內容 BEGIN（scripts/t2-extract-activity-content.ts 產生，請勿手改）';
export const CONTENT_END = '-- ── 內容 END';

function jsonLiteral(value: unknown): string {
  return `CAST(${str(JSON.stringify(value))} AS JSON)`;
}

function updateFor(e: ActivityContentEntry): string {
  const text = (column: string, v: string) => `  \`${column}\` = COALESCE(\`${column}\`, ${str(v)})`;
  const steps = e.steps.map(instruction => ({ imageUrl: null, instruction }));
  const sets = [
    text('age_label', e.ageLabel),
    text('people', e.people),
    text('need', e.need),
    text('trains', e.trains),
    `  \`steps\` = IF(JSON_LENGTH(\`steps\`) = 0, ${jsonLiteral(steps)}, \`steps\`)`,
    text('easier', e.easier),
    text('harder', e.harder),
    text('tip', e.tip),
    text('deeper', e.deeper),
    ...(e.guide ? [`  \`guide\` = COALESCE(\`guide\`, ${jsonLiteral(e.guide)})`] : []),
  ];
  return ['UPDATE `activities` SET', sets.join(',\n'), `WHERE \`id\` = ${str(e.id)};`].join('\n');
}

export function renderActivityContentSql(entries: ReadonlyArray<ActivityContentEntry>): string {
  return entries.map(updateFor).join('\n\n') + '\n';
}

/**
 * 把遷移檔裡兩個標記之間的區段換成重印的 UPDATE。標記不在就丟例外 —— 靜靜地接在檔尾，
 * 會讓驗證句跑在 UPDATE 前面。
 */
export function replaceContentBlock(migration: string, sql: string): string {
  const begin = migration.indexOf(CONTENT_BEGIN);
  const end = migration.indexOf(CONTENT_END);
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error(`${CONTENT_MIGRATION} 缺少內容區段的標記`);
  }
  return migration.slice(0, begin + CONTENT_BEGIN.length) + '\n' + sql + migration.slice(end);
}

/** 遷移檔裡兩個標記之間的那一段（不含標記）。標記不在回 null。 */
export function contentBlockOf(migration: string): string | null {
  const text = migration.replace(/\r\n/g, '\n');
  const begin = text.indexOf(CONTENT_BEGIN);
  const end = text.indexOf(CONTENT_END);
  if (begin < 0 || end < 0 || end < begin) return null;
  return text.slice(begin + CONTENT_BEGIN.length, end);
}

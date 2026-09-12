/**
 * 活動種子 → 遷移檔裡的那一句 INSERT（#44，規格 v2 §9.1）。
 *
 * 遷移檔 `deploy/migrations/2026-09-11-activities.sql` 的建表與說明是手寫的，只有
 * 兩個標記之間的種子區段由這裡印出來：`ACTIVITY_SEED`（TypeScript）是唯一的來源，
 * SQL 是它的投影。`test/activitySeed.test.ts` 會重印一次比對，兩邊不可能各自漂移。
 *
 * 【為什麼是一句、不是 300 句】
 * InnoDB 一句 INSERT 是一個原子操作：中途失敗一列都不會進去，不會停在「進了 137 支」
 * 的狀態。`ON DUPLICATE KEY UPDATE id = id` 讓重跑成為 no-op —— 而且**只有**主鍵撞到
 * 才是 no-op，其他錯誤（JSON 壞掉、欄位不存在）照樣報錯；`INSERT IGNORE` 會把那些也吞掉。
 * 重跑不覆蓋任何欄位：內容團隊填過的 `target_month`、`targets` 要留著。
 *
 * 【分號】
 * `deploy/migrate.mjs` 用分號切句，字串裡的分號會把這一句切成兩句半。活動名稱裡
 * 現在沒有分號，這裡仍然檢查 —— 哪天種子改了，紅的是這裡不是正式站的遷移。
 */

import type { Activity } from '../../src/t2/types';

export const ACTIVITIES_MIGRATION = 'deploy/migrations/2026-09-11-activities.sql';
export const SEED_BEGIN = '-- ── 種子 BEGIN（scripts/t2-activity-seed-sql.ts 產生，請勿手改）';
export const SEED_END = '-- ── 種子 END';

const COLUMNS = [
  'id', 'title', 'module_no', 'target_month', 'age_min_month', 'age_max_month',
  'dimensions', 'targets', 'avoid_if', 'duration_min', 'equipment', 'steps', 'video_url', 'active',
];

export function renderActivitySeedSql(seed: ReadonlyArray<Activity>): string {
  const rows = seed.map(a => '  ' + tuple([
    str(a.id),
    str(a.title),
    int(a.moduleNo),
    a.targetMonth === null ? 'NULL' : int(a.targetMonth),
    int(a.ageMonths.min),
    int(a.ageMonths.max),
    json(a.dimensions),
    json(a.targets),
    json(a.avoidIf),
    int(a.durationMin),
    json(a.equipment),
    json(a.steps),
    a.videoUrl === null ? 'NULL' : str(a.videoUrl),
    a.active ? '1' : '0',
  ]));
  return [
    'INSERT INTO `activities`',
    `  (${COLUMNS.map(c => `\`${c}\``).join(', ')})`,
    'VALUES',
    rows.join(',\n'),
    'ON DUPLICATE KEY UPDATE `id` = `id`;',
    '',
  ].join('\n');
}

function tuple(values: string[]): string {
  return `(${values.join(', ')})`;
}

function int(n: number): string {
  if (!Number.isInteger(n)) throw new Error(`種子裡有非整數：${n}`);
  return String(n);
}

function json(value: unknown): string {
  return str(JSON.stringify(value));
}

/** MySQL 字串字面量：反斜線與單引號要跳脫；分號不准出現（見檔頭）。 */
function str(s: string): string {
  if (s.includes(';')) throw new Error(`種子的字串裡不能有分號（migrate.mjs 會在那裡切句）：${s}`);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/**
 * 把遷移檔裡兩個標記之間的區段換成重印的種子。標記不在就丟例外 —— 靜靜地把整份
 * 種子接在檔尾，會讓遷移檔有兩份 INSERT。
 */
export function replaceSeedBlock(migration: string, seedSql: string): string {
  const begin = migration.indexOf(SEED_BEGIN);
  const end = migration.indexOf(SEED_END);
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error(`${ACTIVITIES_MIGRATION} 缺少種子區段的標記`);
  }
  return migration.slice(0, begin + SEED_BEGIN.length) + '\n' + seedSql + migration.slice(end);
}

/**
 * 從一份 .sql 裡取出 `CREATE TABLE IF NOT EXISTS \`<table>\` (…) ENGINE=…;` 整段，
 * 供「schema.sql 與遷移檔一字不差」的測試用。只折掉 CRLF 與行尾空白，其餘一個字都不動。
 */
export function extractCreateTable(sql: string, table: string): string | null {
  const text = sql.replace(/\r\n/g, '\n');
  const head = `CREATE TABLE IF NOT EXISTS \`${table}\` (`;
  const start = text.indexOf(head);
  if (start < 0) return null;
  // 結尾找的是 `) ENGINE=…;` 那一句的分號，不是第一個分號 —— 欄位註解裡可能有分號。
  const engine = text.indexOf(') ENGINE=', start);
  if (engine < 0) return null;
  const end = text.indexOf(';', engine);
  if (end < 0) return null;
  return text.slice(start, end + 1).split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
}

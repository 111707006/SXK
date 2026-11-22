/**
 * 合併專案 A 重複的手機號帳號，最後加上 A 的手機號唯一鍵（#116，ADR-0020）。**只在專案 A 跑。**
 *
 * 用法（在 A 的專案目錄，例：/var/www/sxk）：
 *
 *   node deploy/merge-duplicate-phones.mjs             ← 預演：只讀，逐組印出保留哪個、搬哪些列
 *   node deploy/merge-duplicate-phones.mjs --execute   ← 真的合併，合併完加唯一鍵
 *
 * 規則與讀寫在 deploy/userMerge.mjs。連線資訊從環境變數 MYSQL_* 讀，讀不到才退回 .env（同 migrate.mjs）。
 * 先跑 2026-11-23-users-merged.sql（node deploy/migrate.mjs --confirm），再跑這支；先備份資料庫。
 *
 * 【為什麼看 APP_MODE】B 的身分是（歸屬，手機號）：同一支手機號在兩家公司本來就是兩位家長，
 * 在 B 跑這支會把別人的帳號停用。A 的 .env 是 APP_MODE=full；不是就不跑。
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { runMergeDuplicatePhones } from './userMerge.mjs';

dotenv.config();

const execute = process.argv.includes('--execute');

if (process.env.APP_MODE !== 'full') {
  console.error(`✗ 这支只在专案 A 跑（APP_MODE=full），现在是 APP_MODE=${JSON.stringify(process.env.APP_MODE ?? '')}。`);
  console.error('  专案 B 的身分是（归属，手机号），同一支手机号在两家公司本来就是两位家长。');
  process.exit(1);
}

const cfg = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: false,
};
if (!cfg.host || !cfg.user || !cfg.password || !cfg.database) {
  console.error('✗ 找不到完整的 MYSQL_* 连线资讯（需要 HOST / USER / PASSWORD / DATABASE）。');
  process.exit(1);
}

console.log('');
console.log(`  目标资料库　${cfg.host}:${cfg.port} / ${cfg.database}（${cfg.user}）`);
console.log(`  模式　　　　${execute ? '执行（会写入）' : '预演（只读）'}`);
console.log('');

const conn = await mysql.createConnection(cfg);
try {
  const result = await runMergeDuplicatePhones(conn, { execute, log: line => console.log(`  ${line}`) });
  console.log('');
  if (!execute) {
    console.log('  这是预演，没有改动任何东西。备份资料库、确认上面的主机与每一组都对之后，加 --execute 再跑一次。');
  } else {
    console.log(`  合并 ${result.merged} 组；要人决定 ${result.manual} 组；资料变了没做 ${result.skipped} 组。`);
  }
  process.exitCode = execute && (result.manual > 0 || result.skipped > 0) ? 2 : 0;
} finally {
  await conn.end();
}

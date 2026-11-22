/**
 * 舊資料轉成服務關係（#123，ADR-0020）。**只在專案 A 跑。**
 *
 * 用法（在 A 的專案目錄，例：/var/www/sxk）：
 *
 *   node deploy/migrate-service-relations.mjs                          ← 預演：只讀，逐位家長印轉換結果
 *   node deploy/migrate-service-relations.mjs --therapist-unit 6       ← 預演，另外把合作單位 #6 當成個人治療師（可給多次）
 *   node deploy/migrate-service-relations.mjs --execute [--therapist-unit 6 ...]   ← 真的寫入
 *
 * 規則與讀寫在 deploy/serviceRelationsMigration.mjs。連線資訊從環境變數 MYSQL_* 讀，讀不到才退回 .env（同 migrate.mjs）。
 * 上線順序見 deploy/README.md「服務關係」：合併重複帳號 → 本遷移預演 → 執行 → 開 SERVICE_RELATIONS。先備份資料庫。
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { runServiceRelationsMigration } from './serviceRelationsMigration.mjs';

dotenv.config();

const args = process.argv.slice(2);
const execute = args.includes('--execute');
/** @type {number[]} */
const therapistUnitIds = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--therapist-unit') continue;
  const id = Number(args[i + 1]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    console.error(`✗ --therapist-unit 后面要接合作单位的编号，现在是 ${JSON.stringify(args[i + 1] ?? '')}。`);
    process.exit(1);
  }
  therapistUnitIds.push(id);
}

if (process.env.APP_MODE !== 'full') {
  console.error(`✗ 这支只在专案 A 跑（APP_MODE=full），现在是 APP_MODE=${JSON.stringify(process.env.APP_MODE ?? '')}。`);
  console.error('  服务关系只在专案 A；专案 B 照旧看归属。');
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
console.log(`  改为个人治疗师的单位　${therapistUnitIds.length ? therapistUnitIds.map(id => `#${id}`).join('、') : '（没有指定）'}`);
console.log('');

const conn = await mysql.createConnection(cfg);
try {
  await runServiceRelationsMigration(conn, { execute, therapistUnitIds, log: line => console.log(`  ${line}`) });
  console.log('');
  if (!execute) console.log('  这是预演，没有改动任何东西。备份资料库、确认上面的主机与每一位都对之后，加 --execute 再跑一次。');
} finally {
  await conn.end();
}

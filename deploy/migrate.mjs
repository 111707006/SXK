/**
 * 跑 deploy/migrations/ 底下的遷移，不需要安裝 mysql 指令。
 *
 * 用法（在專案根目錄）：
 *
 *   node deploy/migrate.mjs                 ← 只檢查，不改任何東西
 *   node deploy/migrate.mjs --confirm       ← 真的執行
 *
 * 連線資訊從環境變數 MYSQL_* 讀取，讀不到才退回 .env。
 * 要對另一個資料庫執行時，在指令前面帶環境變數即可，例如：
 *
 *   MYSQL_HOST=xxx MYSQL_USER=xxx MYSQL_PASSWORD=xxx MYSQL_DATABASE=xxx \
 *     node deploy/migrate.mjs --confirm
 *
 * 【為什麼預設是「只檢查」】
 * 這支腳本會改動正式資料庫的結構。預設就執行的工具遲早會有人在錯的資料庫上
 * 按到 Enter，而資料庫沒有 Ctrl+Z。要動手就必須多打一個 --confirm。
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const MIGRATION = path.join(HERE, 'migrations', '2026-08-06-project-b-multi-company.sql');

const confirm = process.argv.includes('--confirm');

const cfg = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: false,
};

if (!cfg.host || !cfg.user || !cfg.password || !cfg.database) {
  console.error('✗ 找不到完整的 MYSQL_* 連線資訊（需要 HOST / USER / PASSWORD / DATABASE）。');
  process.exit(1);
}

/**
 * 把 .sql 切成一句一句。
 *
 * 先去掉 `--` 開頭的整行註解再切分號 —— 註解裡有中文與網址，留著會讓
 * 「這一句是什麼」在錯誤訊息裡看不出來。
 */
function statementsFrom(sqlText) {
  return sqlText
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

/** 「已經跑過了」的錯誤碼。重跑不該是一件會爆炸的事。 */
const ALREADY_DONE = new Set([
  'ER_DUP_FIELDNAME',  // 欄位已存在
  'ER_DUP_KEYNAME',    // 索引或外鍵名稱已存在
  'ER_FK_DUP_NAME',    // 外鍵名稱已存在
  'ER_TABLE_EXISTS_ERROR',
]);

function short(sql) {
  return sql.replace(/\s+/g, ' ').slice(0, 72);
}

async function main() {
  console.log('');
  console.log('  目標資料庫');
  console.log(`    主機　　 ${cfg.host}:${cfg.port}`);
  console.log(`    資料庫　 ${cfg.database}`);
  console.log(`    使用者　 ${cfg.user}`);
  console.log('');

  const conn = await mysql.createConnection(cfg);

  // ── 先報告現況 ──
  const [[col]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id'`,
    [cfg.database]
  );
  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('companies','admin_users','admin_company_switches','specialists')`,
    [cfg.database]
  );
  const present = tables.map(r => r.TABLE_NAME ?? r.table_name);

  console.log('  現況');
  console.log(`    users.company_id　 ${col.n === 1 ? '已存在' : '不存在'}`);
  console.log(`    四張新表　　　　　 ${present.length}/4 ${present.length ? `(${present.join(', ')})` : ''}`);
  console.log('');

  if (!confirm) {
    const done = col.n === 1 && present.length === 4;
    console.log(done
      ? '  ✓ 這個資料庫已經遷移過了，不需要再做任何事。'
      : '  這是檢查模式，沒有改動任何東西。\n  確認上面的主機與資料庫是對的之後，加上 --confirm 再跑一次：\n\n      node deploy/migrate.mjs --confirm\n');
    await conn.end();
    return;
  }

  // ── 執行 ──
  console.log('  開始執行……');
  const statements = statementsFrom(fs.readFileSync(MIGRATION, 'utf8'));
  for (const sql of statements) {
    if (/^SELECT/i.test(sql)) continue; // 結尾的驗證查詢，下面統一做
    try {
      await conn.query(sql);
      console.log(`    ✓ ${short(sql)}`);
    } catch (err) {
      if (ALREADY_DONE.has(err.code)) {
        console.log(`    · 已存在，略過：${short(sql)}`);
        continue;
      }
      console.error(`\n  ✗ 這一句失敗了：\n    ${short(sql)}\n    ${err.code}: ${err.message}\n`);
      console.error('  遷移中止。資料庫可能停在做了一半的狀態，請看上面成功了哪幾句。');
      await conn.end();
      process.exit(1);
    }
  }

  // ── 驗證 ──
  const [[col2]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id'`,
    [cfg.database]
  );
  const [tables2] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('companies','admin_users','admin_company_switches','specialists')`,
    [cfg.database]
  );
  await conn.end();

  const ok = col2.n === 1 && tables2[0].n === 4;
  console.log('');
  console.log('  驗證');
  console.log(`    users.company_id　 ${col2.n === 1 ? '✓' : '✗'}`);
  console.log(`    四張新表　　　　　 ${tables2[0].n}/4 ${tables2[0].n === 4 ? '✓' : '✗'}`);
  console.log('');
  console.log(ok
    ? '  ✓ 遷移完成，可以部署新版程式碼了。'
    : '  ✗ 沒有全部通過。**先不要部署** —— 家長的註冊會靜默寫不進資料庫。');
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error(`\n  ✗ 連不上資料庫：${err.code || ''} ${err.message}`);
  console.error('  常見原因：RDS 白名單沒有放行你目前的 IP、或連線資訊打錯。\n');
  process.exit(1);
});

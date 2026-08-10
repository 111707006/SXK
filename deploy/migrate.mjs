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
 *
 * 【它跑哪幾份】
 * `deploy/migrations/` 底下**全部**，依檔名（日期開頭）排序。這支腳本曾經只跑
 * 一份寫死的 2026-08-06 —— 而說明寫的是「跑 deploy/migrations/ 底下的遷移」。
 * 那個落差不會有人發現，直到 #20 與 #25 的兩份遷移沒跑就部署：`sms_codes`
 * 不存在，`/api/auth/sms/request` 回 500，而電子郵件登入已經在 #27 下線 ——
 * 沒有人登得進來。
 *
 * 【它怎麼知道跑完了沒有】
 * 不自己另外寫一套檢查，而是跑**每一份遷移自己結尾的那幾句驗證 SELECT**。
 * 約定寫在欄位別名上（遷移作者本來就是這樣命名的）：
 *
 *   - `..._ok`   → 必須回 1
 *   - `..._gone` → 必須回 0
 *   - 其餘       → 印出來給人看，不當作閘門
 *
 * 新增一份遷移時照這個命名寫驗證句，這支腳本就會自動把它算進去。
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, 'migrations');

/** 全部的遷移，依檔名排序 —— 檔名以日期開頭，所以那就是時間順序。 */
function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => ({ name, full: path.join(MIGRATIONS_DIR, name) }));
}

const confirm = process.argv.includes('--confirm');
const listOnly = process.argv.includes('--list');

const cfg = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: false,
};

if (!cfg.host || !cfg.user || !cfg.password || (!cfg.database && !listOnly)) {
  console.error('✗ 找不到完整的 MYSQL_* 連線資訊（需要 HOST / USER / PASSWORD / DATABASE）。');
  process.exit(1);
}

/**
 * `--list`：這個帳號看得到哪些資料庫。
 *
 * 存在的理由是 ER_DBACCESS_DENIED_ERROR 分不出「不存在」與「沒權限」。
 * `SHOW DATABASES` 只列出這個帳號有權限的庫，所以名字在清單裡就是權限問題、
 * 不在就是還沒建立（或連看的權限都沒有）。**刻意不指定 database 就連線**，
 * 否則會在同一個地方以同一個錯誤失敗。
 */
async function listDatabases() {
  const { database, ...noDb } = cfg;
  const conn = await mysql.createConnection(noDb);
  const [rows] = await conn.query('SHOW DATABASES');
  await conn.end();

  const names = rows.map(r => Object.values(r)[0]);
  const system = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);
  const own = names.filter(n => !system.has(n));

  console.log('');
  console.log(`  ${cfg.user}@${cfg.host} 看得到的資料庫`);
  console.log('');
  if (own.length === 0) console.log('    （一個都沒有）');
  else for (const n of own) console.log(`    ${n}`);
  console.log('');
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
  // 要拿掉的索引不在。**全新的資料庫一定會撞到這一個** ——
  // 2026-08-10 那份要 `DROP INDEX phone`（早期 schema 把它建成全域唯一），
  // 而新庫從來沒有過那個索引。少了這一行，乾淨的資料庫每一次都會在那句停下來，
  // 而訊息是「遷移中止，資料庫可能停在做了一半的狀態」—— 那份遷移的註解
  // 早就寫了「這一句會報 1091，那是正常的，繼續往下跑」。
  'ER_CANT_DROP_FIELD_OR_KEY',
]);

/**
 * 把一份遷移拆成「要執行的」與「驗證用的」。
 *
 * 驗證句一律是唯讀的 `SELECT`，兩種模式都跑得；只檢查模式跑的就只有它們。
 */
function splitMigration(sqlText) {
  const all = statementsFrom(sqlText);
  return {
    ddl: all.filter(s => !/^SELECT/i.test(s)),
    checks: all.filter(s => /^SELECT/i.test(s)),
  };
}

/**
 * 需要「剛好等於某個數字」的驗證句。
 *
 * 預設 `_ok` 只要求「大於 0」，因為多數是在數一個欄位或一張表在不在（答案是
 * 1）。但 2026-08-06 的 `new_tables_ok` 數的是**四張**表 —— 用「大於 0」去驗它，
 * 只建好一張表的半套遷移會被判成通過，而這道閘門存在的唯一理由就是攔住那個。
 *
 * 數的東西不只一個時，就在這裡寫明幾個。
 */
const EXACT_EXPECTED = {
  new_tables_ok: 4,
};

/**
 * 跑一份遷移的驗證句，回報過了沒有。
 *
 * 判準取自欄位別名（見檔頭）：`_gone` 要 0、`_ok` 要大於 0（需要精確值的
 * 列在 `EXACT_EXPECTED`），其餘只印不擋。這樣新的遷移不必回來改這支腳本，
 * 只要驗證句照著命名寫。
 */
async function runChecks(conn, checks, indent = '    ') {
  let failed = 0;
  let gated = 0;

  for (const sql of checks) {
    let rows;
    try {
      [rows] = await conn.query(sql);
    } catch (err) {
      console.log(`${indent}✗ 驗證查詢本身失敗：${err.code}: ${err.message}`);
      gated++;
      failed++;
      continue;
    }

    const [first] = rows;
    if (!first) {
      console.log(`${indent}· ${short(sql)} → （沒有任何一列）`);
      continue;
    }

    let gatedHere = false;
    for (const [column, value] of Object.entries(first)) {
      const isGone = column.endsWith('_gone');
      const isOk = column.endsWith('_ok');
      if (!isGone && !isOk) continue;

      gated++;
      gatedHere = true;
      const exact = isGone ? 0 : EXACT_EXPECTED[column] ?? null;
      const passed = exact === null ? Number(value) > 0 : Number(value) === exact;
      if (!passed) failed++;
      const want = exact === null ? '應大於 0' : `應為 ${exact}`;
      console.log(`${indent}${passed ? '✓' : '✗'} ${column} = ${value}（${want}）`);
    }

    // 沒有走命名約定的那幾句 —— 印出來給人看，不當作閘門。
    if (!gatedHere) {
      console.log(`${indent}· ${short(sql)}`);
      for (const row of rows) console.log(`${indent}    ${JSON.stringify(row)}`);
    }
  }

  // 一句都沒驗到**不算通過**。那代表這份遷移的驗證句沒照命名約定寫，
  // 而「沒有人在看」與「看過了沒問題」必須是兩個不同的答案。
  return { gated, failed, passed: gated > 0 && failed === 0 };
}

function short(sql) {
  return sql.replace(/\s+/g, ' ').slice(0, 72);
}

async function main() {
  if (listOnly) {
    await listDatabases();
    return;
  }

  console.log('');
  console.log('  目標資料庫');
  console.log(`    主機　　 ${cfg.host}:${cfg.port}`);
  console.log(`    資料庫　 ${cfg.database}`);
  console.log(`    使用者　 ${cfg.user}`);
  console.log('');

  const files = migrationFiles();
  console.log(`  找到 ${files.length} 份遷移（依日期順序）`);
  for (const { name } of files) console.log(`    ${name}`);
  console.log('');

  const conn = await mysql.createConnection(cfg);
  const loaded = files.map(f => ({ ...f, ...splitMigration(fs.readFileSync(f.full, 'utf8')) }));

  // ── 先報告現況 ──
  //
  // 用的是每一份遷移自己的驗證句 —— 那些查詢本來就是為了回答「這一份跑完了
  // 沒有」而寫的，再自己另外寫一套只會多一個會走樣的地方。
  console.log('  現況');
  const before = [];
  for (const m of loaded) {
    console.log(`    ${m.name}`);
    before.push(await runChecks(conn, m.checks, '      '));
  }
  console.log('');

  if (!confirm) {
    const pending = loaded.filter((_, i) => !before[i].passed);
    if (pending.length === 0) {
      console.log('  ✓ 這個資料庫已經全部遷移過了，不需要再做任何事。');
    } else {
      console.log(`  還沒跑完的：${pending.map(m => m.name).join('、')}`);
      console.log('');
      console.log('  這是檢查模式，沒有改動任何東西。');
      console.log('  **先備份資料庫。**確認上面的主機與資料庫是對的之後，加上 --confirm 再跑一次：');
      console.log('');
      console.log('      node deploy/migrate.mjs --confirm');
      console.log('');
    }
    await conn.end();
    return;
  }

  // ── 執行 ──
  //
  // 一份一份照順序跑，中間有一句真的失敗就整個停下來 —— 後面那幾份可能依賴
  // 這一份的結果，硬跑下去只會把「壞在哪裡」變得更難查。
  for (const m of loaded) {
    console.log(`  ${m.name}`);
    for (const sql of m.ddl) {
      try {
        await conn.query(sql);
        console.log(`    ✓ ${short(sql)}`);
      } catch (err) {
        if (ALREADY_DONE.has(err.code)) {
          console.log(`    · 已存在，略過：${short(sql)}`);
          continue;
        }
        console.error(`\n  ✗ 這一句失敗了（${m.name}）：\n    ${short(sql)}\n    ${err.code}: ${err.message}\n`);
        console.error('  遷移中止。資料庫可能停在做了一半的狀態，請看上面成功了哪幾句。');
        await conn.end();
        process.exit(1);
      }
    }
  }
  console.log('');

  // ── 驗證 ──
  console.log('  驗證');
  let ok = true;
  let gatedTotal = 0;
  for (const m of loaded) {
    console.log(`    ${m.name}`);
    const result = await runChecks(conn, m.checks, '      ');
    if (!result.passed) ok = false;
    gatedTotal += result.gated;
    if (result.gated === 0) {
      console.log(`      ✗ 這一份沒有任何一句符合 \`_ok\` / \`_gone\` 的驗證 —— 等於沒有驗證。`);
    }
  }
  await conn.end();

  console.log('');
  console.log(ok
    ? `  ✓ ${gatedTotal} 項驗證全數通過，可以部署新版程式碼了。`
    : '  ✗ 沒有全部通過。**先不要部署** —— 沒有 sms_codes 的話家長一個都登不進來。');
  process.exit(ok ? 0 : 1);
}

/**
 * 失敗的原因分開講。
 *
 * 原本這裡不管什麼錯都印「白名單沒放行你的 IP」，而 ER_DBACCESS_DENIED_ERROR
 * 其實代表連線與帳密都成功了 —— 把人送去查防火牆，問題卻在權限。
 * 一個猜錯方向的錯誤訊息比沒有訊息更花時間。
 */
function explain(err) {
  switch (err.code) {
    case 'ER_DBACCESS_DENIED_ERROR':
      return [
        '連線與帳號密碼都是對的，但這個帳號用不了那個資料庫。',
        'MySQL 對「資料庫不存在」與「沒有權限」刻意回同一個錯誤（不讓人探測有哪些庫），',
        '所以這兩種可能現在分不出來。跑這行看這個帳號看得到哪些資料庫：',
        '',
        '    node deploy/migrate.mjs --list',
      ];
    case 'ER_ACCESS_DENIED_ERROR':
      return ['帳號或密碼不對。檢查 MYSQL_USER / MYSQL_PASSWORD。'];
    case 'ER_BAD_DB_ERROR':
      return ['這個資料庫不存在，需要先建立。'];
    case 'ETIMEDOUT':
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
      return [
        '連不上主機。常見原因：RDS 白名單沒有放行你目前的公網 IP、',
        'MYSQL_HOST 打錯，或這台機器連不到外網。',
      ];
    default:
      return [];
  }
}

main().catch(err => {
  console.error(`\n  ✗ ${err.code || ''} ${err.message}\n`);
  for (const line of explain(err)) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
});

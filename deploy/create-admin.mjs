/**
 * 建立第一個全域管理員帳號。
 *
 * 用法（在專案根目錄）：
 *
 *   node deploy/create-admin.mjs          ← 互動式建立
 *   node deploy/create-admin.mjs --list   ← 只列出現有帳號，不改任何東西
 *
 * 連線資訊從 MYSQL_* 讀取（同 deploy/migrate.mjs）。
 *
 * 【為什麼需要這支腳本】
 * 後台刻意沒有預設帳號、也沒有自助註冊 —— 一個有預設密碼的後台等於沒有後台。
 * 代價是第一個帳號必須手動建立，而「手動」通常意味著有人會在某個 SQL 檔案裡
 * 留下一行明碼密碼，或是在 shell history 裡留下 bcrypt 指令的參數。
 * 這支腳本讓密碼只存在於一次不回顯的輸入裡。
 *
 * 之後開設其他帳號請走後台的「後台帳號」分頁，不必再回來碰資料庫。
 */
import readline from 'readline';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config();

/** 與 src/admin/routes.ts 的 BCRYPT_ROUNDS 相同。不一致不會壞，但沒有理由不一致。 */
const BCRYPT_ROUNDS = 10;

const listOnly = process.argv.includes('--list');

const cfg = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

if (!cfg.host || !cfg.user || !cfg.password || !cfg.database) {
  console.error('✗ 找不到完整的 MYSQL_* 連線資訊（需要 HOST / USER / PASSWORD / DATABASE）。');
  process.exit(1);
}

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, v => { rl.close(); resolve(v.trim()); }));
}

/** 不回顯的輸入。密碼不該出現在終端機畫面上，更不該被截圖帶走。 */
function askHidden(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = str => { if (!muted) rl.output.write(str); };
    rl.question(prompt, value => {
      rl.output.write('\n');
      rl.close();
      resolve(value);
    });
    muted = true;
  });
}

async function main() {
  const conn = await mysql.createConnection(cfg);

  console.log('');
  console.log(`  資料庫　 ${cfg.database} @ ${cfg.host}`);
  console.log('');

  const [tbl] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_users'`,
    [cfg.database]
  );
  if (tbl[0].n === 0) {
    console.error('  ✗ 這個資料庫沒有 admin_users 表。請先跑遷移：\n');
    console.error('      node deploy/migrate.mjs --confirm\n');
    await conn.end();
    process.exit(1);
  }

  const [existing] = await conn.query(
    'SELECT id, email, role, company_id, active FROM admin_users ORDER BY id ASC'
  );

  console.log(`  現有後台帳號：${existing.length} 個`);
  for (const a of existing) {
    const scope = a.role === 'global_admin' ? '全域' : `公司 #${a.company_id}`;
    console.log(`    #${a.id}  ${a.email}  ${scope}  ${a.active ? '啟用中' : '已停用'}`);
  }
  console.log('');

  if (listOnly) {
    await conn.end();
    return;
  }

  if (existing.some(a => a.role === 'global_admin' && a.active)) {
    console.log('  已經有一個啟用中的全域管理員了。');
    console.log('  要再開帳號，請登入後台走「後台帳號」分頁 —— 那裡開的帳號會留下紀錄。');
    console.log('  真的要再從這裡開一個的話，繼續往下即可。');
    console.log('');
  }

  const email = await ask('  信箱：');
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
    console.error('\n  ✗ 信箱格式不對。\n');
    await conn.end();
    process.exit(1);
  }

  // 不回顯，所以要打兩次 —— 打錯的密碼會變成一個登不進去而且看不出原因的帳號。
  const pw = await askHidden('  密碼（不會顯示）：');
  const pw2 = await askHidden('  再打一次：');

  if (pw !== pw2) {
    console.error('\n  ✗ 兩次輸入不一樣。\n');
    await conn.end();
    process.exit(1);
  }
  if (pw.length < 8) {
    console.error('\n  ✗ 密碼至少 8 個字元（與後端的規則相同）。\n');
    await conn.end();
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
    await conn.execute(
      'INSERT INTO admin_users (email, password, role, company_id, active) VALUES (?, ?, ?, NULL, 1)',
      [email, hash, 'global_admin']
    );
    console.log('');
    console.log(`  ✓ 已建立全域管理員：${email}`);
    console.log('    現在可以到 /admin 登入了。');
    console.log('');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error(`\n  ✗ ${email} 已經有後台帳號了。\n`);
    } else {
      console.error(`\n  ✗ ${err.code || ''} ${err.message}\n`);
    }
    await conn.end();
    process.exit(1);
  }

  await conn.end();
}

main().catch(err => {
  console.error(`\n  ✗ ${err.code || ''} ${err.message}\n`);
  process.exit(1);
});

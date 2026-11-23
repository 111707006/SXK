/**
 * 成人 ADHD（`APP_MODE=adhd`）的本機／展示假資料：只建後台全域管理員與一家合作單位（進站連結 `?c=demo-unit`）。
 * 受評者的資料不預先灌：登入（固定展示碼 `DEMO_LOGIN_CODE`）後自己作答。
 *
 * 由 `deploy/demo/Dockerfile.adhd` 的建置跑（bake.sh 把 seed.ts 換成這一支）。
 */
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const BASE = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:5000';
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'demo@sxkscreen.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD?.trim();
if (!ADMIN_PASSWORD) throw new Error('seed-adhd：缺少环境变数 DEMO_ADMIN_PASSWORD');

async function main() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  try {
    await db.execute(
      `INSERT INTO admin_users (email, password, role, company_id, active)
       VALUES (?, ?, 'global_admin', NULL, 1)
       ON DUPLICATE KEY UPDATE password = VALUES(password), active = 1`,
      [ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD!, 10)],
    );
  } finally {
    await db.end();
  }
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!login.ok) throw new Error(`admin login → ${login.status} ${await login.text()}`);
  const { token } = await login.json();
  const company = await fetch(`${BASE}/api/admin/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '示范合作单位', slug: 'demo-unit' }),
  });
  if (!company.ok) throw new Error(`create company → ${company.status} ${await company.text()}`);
  console.log(`[seed-adhd] 后台帐号 ${ADMIN_EMAIL}；合作单位 ?c=demo-unit`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

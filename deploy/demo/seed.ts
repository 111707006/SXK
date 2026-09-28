/**
 * Render 展示環境（`sxk-demo`）的假資料：在 Docker 建置時對著**真的伺服器**跑一次（`deploy/demo/bake.sh`），
 * 結果烤進映像檔。每次服務重啟都回到這一份。
 *
 * 【為什麼走 HTTP 而不是直接寫 SQL】
 * 展示的是正式那一套程式：登入、存檔、交卷、生成報告、配每週活動，每一步都走家長實際會打的端點。
 * 直接塞 SQL 的話，展示環境看到的是「我們以為資料長這樣」，不是「系統真的做得出來的樣子」。
 * 只有後台帳號是直接寫的（後台刻意沒有註冊入口，見 `deploy/create-admin.mjs`）。
 *
 * 寫進去的東西：
 * - 後台全域管理員 `DEMO_ADMIN_EMAIL`／`DEMO_ADMIN_PASSWORD`（展示用，資料是假的、重啟就回原樣）
 * - 17 支示範片的目標月齡與標籤：用後台的批量匯入端點匯 `deploy/activity-tags/2026-09-27-module1-videos.json`
 * - 一位展示家長 `DEMO_PARENT_PHONE`：30 個月的「小安」，T1 動作發展需關注，T2 粗大動作量表做完
 *   （走跑跳、平衡偏弱），報告已生成，本週活動已配好 —— 登入後直接看得到 T2 報告與居家訓練
 *
 * 用法（bake.sh 會帶好環境變數）：`npx tsx deploy/demo/seed.ts`
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { askedItems } from '../../src/t2/scoring';
import { DIMENSIONS_DATA } from '../../src/data';

const BASE = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:5000';
const CODE = must('DEMO_LOGIN_CODE');
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'demo@sxkscreen.com';
const ADMIN_PASSWORD = must('DEMO_ADMIN_PASSWORD');
const PARENT_PHONE = process.env.DEMO_PARENT_PHONE ?? '13900000000';
const CHILD_AGE_MONTH = 30;

function must(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`seed：缺少环境变数 ${name}`);
  return value;
}

async function call(method: string, url: string, body?: unknown, token?: string): Promise<any> {
  const resp = await fetch(BASE + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* 不是 JSON 就留 text */ }
  if (!resp.ok) throw new Error(`${method} ${url} → ${resp.status} ${text.slice(0, 300)}`);
  return json;
}

/** 今天往前推 n 個月的出生日期（YYYY-MM-DD）。 */
function birthDateMonthsAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

async function seedAdmin(): Promise<string> {
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
      [ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD, 10)],
    );
  } finally {
    await db.end();
  }
  const { token } = await call('POST', '/api/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log(`[seed] 后台帐号 ${ADMIN_EMAIL}`);
  return token;
}

async function importTags(adminToken: string): Promise<void> {
  const file = path.resolve(__dirname, '../activity-tags/2026-09-27-module1-videos.json');
  const { rows } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = await call('POST', '/api/admin/activities/import', { rows, dryRun: false }, adminToken);
  if (report.failed.length || report.warnings.length) {
    throw new Error(`标签汇入有退回或忽略：${JSON.stringify(report)}`);
  }
  console.log(`[seed] 示范片标签汇入 ${report.imported} 支`);
}

async function parentLogin(): Promise<string> {
  await call('POST', '/api/auth/sms/request', { phone: PARENT_PHONE });
  const { token } = await call('POST', '/api/auth/sms/verify', { phone: PARENT_PHONE, code: CODE });
  return token;
}

/** T1：只有動作發展需關注，其餘都正常 —— 展示一條乾淨的「T1 紅 → T2 粗大動作 → 居家訓練」。 */
function t1Scores() {
  const completedAt = new Date().toISOString();
  return DIMENSIONS_DATA.map(d => {
    const score = d.id === 'gross_motor' ? 4 : 8;
    return {
      dimensionId: d.id,
      dimensionName: d.name,
      tierId: 'T1',
      score,
      maxScore: 8,
      status: score <= 5 ? 'delay' : 'normal',
      completedAt,
      assessedAgeMonth: CHILD_AGE_MONTH,
    };
  });
}

/** 粗大動作量表：臥、坐、爬站都會（2），走跑跳、平衡偏弱 —— 報告會帶出「移動」「平衡」兩個標籤。 */
function gmAnswers(): Record<string, number> {
  const weak: Record<string, number[]> = { P4: [1, 1, 0, 2, 1], P5: [1, 0, 1, 2] };
  const out: Record<string, number> = {};
  const seen: Record<string, number> = {};
  for (const a of askedItems('sxk-gm', CHILD_AGE_MONTH)) {
    const i = (seen[a.sectionKey] = (seen[a.sectionKey] ?? -1) + 1);
    out[a.key] = weak[a.sectionKey]?.[i] ?? 2;
  }
  return out;
}

async function seedParent(): Promise<void> {
  const token = await parentLogin();
  await call('POST', '/api/db/save', {
    child: { name: '小安', gender: 'girl', birthDate: birthDateMonthsAgo(CHILD_AGE_MONTH), ageMonth: CHILD_AGE_MONTH },
    completedScores: t1Scores(),
    orders: [],
    reportHistory: [],
  }, token);

  const submitted = await call('POST', '/api/t2/tool-results', {
    toolId: 'sxk-gm',
    assessedAgeMonth: CHILD_AGE_MONTH,
    rater: 'mother',
    pre: {},
    answers: gmAnswers(),
  }, token);
  console.log(`[seed] T2 粗大动作量表：${JSON.stringify(submitted.bands)}`);

  await call('POST', '/api/t2/findings', {}, token);
  const plan = await call('GET', '/api/t2/weekly-plan', undefined, token);
  const picks = (plan?.activities?.picks ?? plan?.picks ?? []).map((p: any) => p.id ?? p.activity?.id);
  console.log(`[seed] 展示家长 ${PARENT_PHONE}：报告已生成，本周活动 ${JSON.stringify(picks)}`);
  if (picks.length === 0) throw new Error('本周活动是空的 —— 标签没汇进去，或配对没吃到');
}

async function main() {
  const adminToken = await seedAdmin();
  await importTags(adminToken);
  await seedParent();
  console.log('[seed] 完成');
}

main().catch(err => {
  console.error('[seed] 失败：', err.message);
  process.exit(1);
});

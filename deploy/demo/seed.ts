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
 * - 一位展示家長 `DEMO_PARENT_PHONE`：30 個月的「小安」，T1 動作發展需關注、T1 報告已生成，T2 粗大動作量表做完
 *   （爬站不穩、走跑跳與平衡偏弱），報告已生成，本週活動已配好 —— 登入後直接看得到 T2 報告與居家訓練
 *
 * 專案 B 的展示站（`sxk-demo-b`，`APP_MODE=t1only`，2026-09-28）另一份：一家示範合作機構、同一組後台帳號，
 * 三位家長 —— `DEMO_PARENT_PHONE`（T1 做完、報告生成了：報告頁那張「到森心康做深度评估」的卡按下去就到 sxk-demo）、
 * 再一位做完 T1 的（後台「发送邀请简讯」勾得到）、一位還沒做篩查的（勾不到）。
 *
 * 用法（bake.sh 會帶好環境變數）：`npx tsx deploy/demo/seed.ts`
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { askedItems } from '../../src/t2/scoring';
import { DIMENSIONS_DATA } from '../../src/data';
import { KITV3_BANKS } from '../../src/t2/kitv3';
import { askedItems as askedV3, formFor } from '../../src/t2/kitv3/score';

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
  const file = fileURLToPath(new URL('../activity-tags/2026-09-27-module1-videos.json', import.meta.url));
  const { rows } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = await call('POST', '/api/admin/activities/import', { rows, dryRun: false }, adminToken);
  if (report.failed.length || report.warnings.length) {
    throw new Error(`标签汇入有退回或忽略：${JSON.stringify(report)}`);
  }
  console.log(`[seed] 示范片标签汇入 ${report.imported} 支`);
}

async function parentLogin(phone = PARENT_PHONE, companySlug?: string): Promise<string> {
  await call('POST', '/api/auth/sms/request', { phone, ...(companySlug ? { companySlug } : {}) });
  const { token } = await call('POST', '/api/auth/sms/verify', { phone, code: CODE, ...(companySlug ? { companySlug } : {}) });
  return token;
}

/** T1：只有動作發展需關注，其餘都正常 —— 展示一條乾淨的「T1 紅 → T2 粗大動作 → 居家訓練」。 */
function t1Scores() {
  const completedAt = new Date().toISOString();
  // 逐題作答（2 做到／1 有時／0 還不能），新版 T1 報告（`T1_REPORT_REAL`）與 v3 推薦讀它；分數＝四題加總
  const ITEMS: Record<string, number[]> = { gross_motor: [2, 1, 1, 0], language: [2, 2, 2, 1] };
  return DIMENSIONS_DATA.map(d => {
    const items = ITEMS[d.id] ?? [2, 2, 2, 2];
    const score = items.reduce((a, b) => a + b, 0);
    return {
      dimensionId: d.id,
      dimensionName: d.name,
      tierId: 'T1',
      score,
      maxScore: 8,
      items,
      status: score <= 5 ? 'delay' : score <= 7 ? 'borderline' : 'normal',
      completedAt,
      assessedAgeMonth: CHILD_AGE_MONTH,
    };
  });
}

/**
 * 粗大動作量表：臥、坐都會（2）；爬與站有一半還不穩；走跑跳、平衡大多還不會。
 * 算出來是動作發展**需關注**，帶「姿勢控制」「移動」「平衡」標籤 —— 30 個月需關注往前取 6–12 個月，
 * 正好落在 17 支示範片裡 18–24 個月的那幾支。只弱走跑跳與平衡兩段的話，總分仍在「沒事」（2026-09-28 試過）。
 */
function gmAnswers(): Record<string, number> {
  const weak: Record<string, number[]> = {
    P3: [2, 1, 2, 1, 1, 1, 2, 1],
    P4: [0, 0, 0, 1, 0],
    P5: [0, 0, 1, 0],
  };
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
  const child = { name: '小安', gender: 'girl', birthDate: birthDateMonthsAgo(CHILD_AGE_MONTH), ageMonth: CHILD_AGE_MONTH };
  const scores = t1Scores();

  // T1 的 AI 報告：家長按「一键生成 AI 发展报告」打的就是這一支（展示站沒有 AI 金鑰，回本地模板）。
  // T2 入口掛在這份報告裡面（ReportBody 的 t2Slot），沒有它就看不到 T2。紀錄的形狀照
  // AnalysisReport 的 handleGenerateReport；分數要是**同一份**，App 才認得它是「現在這份結果」的報告。
  const generated = await call('POST', '/api/report', { child, scores });
  const t1Report = {
    id: `rec_${Date.now()}`,
    type: 'T1_SCREENING',
    child,
    scores,
    aiReport: generated.report,
    isAiGenerated: generated.isAiGenerated === true,
    createdAt: new Date().toISOString(),
  };
  await call('POST', '/api/db/save', { child, completedScores: scores, orders: [], reportHistory: [t1Report] }, token);

  if (process.env.T2_RECOMMEND_V3 === '1') {
    // v3：完整版題庫的粗大動作（前半做到、後半還不穩），伺服器重算
    const bank = KITV3_BANKS['SXK-GM'];
    const form = formFor(bank, CHILD_AGE_MONTH);
    const asked = askedV3(bank, { ageM: CHILD_AGE_MONTH, inSchool: false });
    const answers: Record<string, number | null> = {};
    asked.forEach((a, i) => {
      const opts = bank.options[form.sections.find(s => s.key === a.section)!.options].filter(o => o.value !== null);
      const values = opts.map(o => o.value as number).sort((x, y) => x - y);
      answers[a.item.key] = i < asked.length / 2 ? values[values.length - 1] : values[0];
    });
    const submitted = await call('POST', '/api/t2/tool-results', {
      toolkitVersion: 'kit-20260923', toolId: 'SXK-GM', assessedAgeMonth: CHILD_AGE_MONTH, rater: 'mother', answers,
    }, token);
    console.log(`[seed] T2 v3 粗大动作：${JSON.stringify(submitted.result?.grade03 ?? submitted.result)}`);
  } else {
    const submitted = await call('POST', '/api/t2/tool-results', {
      toolId: 'sxk-gm',
      assessedAgeMonth: CHILD_AGE_MONTH,
      rater: 'mother',
      pre: {},
      answers: gmAnswers(),
    }, token);
    console.log(`[seed] T2 粗大动作量表：${JSON.stringify(submitted.bands)}`);
  }

  await call('POST', '/api/t2/findings', {}, token);
  const plan = await call('GET', '/api/t2/weekly-plan', undefined, token);
  // 回應是 `{ activities: [{ activity, dimension, reason }], preparing, alternates? }`（server.ts 的 weeklyPlanResponse）。
  const picks = (plan?.activities ?? []).map((p: any) => p.activity.id);
  console.log(`[seed] 展示家长 ${PARENT_PHONE}：报告已生成，本周活动 ${JSON.stringify(picks)}`);
  if (picks.length === 0) throw new Error('本周活动是空的 —— 标签没汇进去，或配对没吃到');
}

/** 一位 B 的家長：從合作機構的進站連結登入、存孩子檔案；`withT1` 再做完 T1 並生成報告（同 seedParent 的前半）。 */
async function seedBParent(phone: string, name: string, companySlug: string, withT1: boolean): Promise<void> {
  const token = await parentLogin(phone, companySlug);
  const child = { name, gender: 'girl', birthDate: birthDateMonthsAgo(CHILD_AGE_MONTH), ageMonth: CHILD_AGE_MONTH };
  if (!withT1) {
    await call('POST', '/api/db/save', { child, completedScores: [], orders: [], reportHistory: [] }, token);
    console.log(`[seed] B 家长 ${phone}「${name}」：还没做筛查`);
    return;
  }
  const scores = t1Scores();
  const generated = await call('POST', '/api/report', { child, scores });
  const t1Report = {
    id: `rec_${Date.now()}_${phone}`,
    type: 'T1_SCREENING',
    child,
    scores,
    aiReport: generated.report,
    isAiGenerated: generated.isAiGenerated === true,
    createdAt: new Date().toISOString(),
  };
  await call('POST', '/api/db/save', { child, completedScores: scores, orders: [], reportHistory: [t1Report] }, token);
  console.log(`[seed] B 家长 ${phone}「${name}」：T1 做完、报告已生成`);
}

/** 專案 B（`sxk-demo-b`）：示範合作機構＋三位家長。沒有活動庫標籤、沒有 T2（B 沒有這些）。 */
async function seedB(adminToken: string): Promise<void> {
  const slug = 'demo';
  await call('POST', '/api/admin/companies', { name: '示范合作机构', slug }, adminToken);
  const base = Number(PARENT_PHONE);
  await seedBParent(PARENT_PHONE, '小安', slug, true);
  await seedBParent(String(base + 1), '小乐', slug, true);
  await seedBParent(String(base + 2), '小宁', slug, false);
}

async function main() {
  const adminToken = await seedAdmin();
  if (process.env.APP_MODE === 't1only') {
    await seedB(adminToken);
  } else {
    await importTags(adminToken);
    await seedParent();
  }
  console.log('[seed] 完成');
}

main().catch(err => {
  console.error('[seed] 失败：', err.message);
  process.exit(1);
});

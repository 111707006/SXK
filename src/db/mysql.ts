import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function getConfig(): MySQLConfig | null {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !password || !database) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user,
    password,
    database,
  };
}

export function getPool(): mysql.Pool | null {
  if (pool) return pool;

  const config = getConfig();
  if (!config) {
    console.log('[MySQL] Credentials not configured. Running in offline/memory mode.');
    return null;
  }

  try {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 5000,
    });
    console.log(`[MySQL] Connected to ${config.host}:${config.port}/${config.database}`);
    return pool;
  } catch (err: any) {
    console.error('[MySQL] Connection error:', err.message);
    pool = null;
    return null;
  }
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}

// ---- User operations ----

/**
 * 依使用者 id 取帳號。**這是身分被驗證之後唯一該走的查法。**
 *
 * 其他 `findUserBy*` 是登入那一刻把外部憑據換成帳號用的，一次登入只走一次；
 * 通行證發出去之後帶的是使用者 id，所以此後的每一次查詢都從這裡進來 ——
 * 換掉登入方式（電子郵件 → 手機號）時，動的是那一族函式，這一個不動。
 */
export async function findUserById(id: number): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return (rows as any[])[0] || null;
}

/** 登入用：把電子郵件換成帳號。手機號登入上線後，這裡會多一個同族的兄弟。 */
export async function findUserByEmail(email: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return (rows as any[])[0] || null;
}

/**
 * 建立家長帳號，並在此刻**一次性**寫入歸屬。
 *
 * `companyId` 只在這裡寫得進去。歸屬「註冊時綁定、此後不變」不是靠一條紀律
 * 維持的，而是靠沒有第二個地方改得到它 —— 已註冊的家長再從別家公司的連結
 * 進站時，`createUser` 根本不會被呼叫，於是歸屬自然不動。
 */
export async function createUser(
  email: string,
  password: string,
  companyId: number | null = null
): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  // 回傳新帳號的 id：呼叫端**當場**就要用它簽通行證，再回頭用電子郵件查一次
  // 等於讓「剛註冊的人是誰」這件事有第二條可能答錯的路。
  const [result] = await p.execute(
    'INSERT INTO users (email, password, company_id) VALUES (?, ?, ?)',
    [email, password, companyId]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

// ---- Partner company (project B multi-company) ----

export interface CompanyRow {
  id: number;
  name: string;
  slug: string;
  wecomWebhookUrl: string | null;
  active: boolean;
}

function toCompanyRow(row: any): CompanyRow {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    wecomWebhookUrl: row.wecom_webhook_url ?? null,
    active: Number(row.active) === 1,
  };
}

/**
 * 依進站識別碼找合作公司。找不到或已停用一律回 `null`。
 *
 * 呼叫端拿到 `null` 時**必須讓歸屬留空**，不可退回任何預設公司 ——
 * 打錯一個字元就把一位家長的孩子的健康資料送給錯的機構。
 */
export async function findCompanyBySlug(slug: string): Promise<CompanyRow | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM companies WHERE slug = ? AND active = 1 LIMIT 1', [slug]);
  const row = (rows as any[])[0];
  return row ? toCompanyRow(row) : null;
}

/** 家長所屬公司（含通知位置）。未歸屬回 `null`。 */
export async function findCompanyByUserId(userId: number): Promise<CompanyRow | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    `SELECT c.* FROM companies c JOIN users u ON u.company_id = c.id WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  const row = (rows as any[])[0];
  return row ? toCompanyRow(row) : null;
}

// ---- Specialists (project B multi-company) ----

export interface SpecialistRow {
  id: number;
  name: string;
  title: string | null;
  specialty: string | null;
  experience: string | null;
  avatarUrl: string | null;
  slots: string[];
}

/**
 * 某家公司**啟用中**的專家。家長端只走這一條路。
 *
 * `company_id` 是必要參數而非選填：沒有公司就沒有專家可看，而一個「不帶公司
 * 就回全部」的預設值會讓未歸屬的家長看到別家公司的醫師名單。
 */
export async function listActiveSpecialists(companyId: number): Promise<SpecialistRow[]> {
  const p = getPool();
  if (!p) return [];
  const [rows] = await p.execute(
    'SELECT * FROM specialists WHERE company_id = ? AND active = 1 ORDER BY id ASC',
    [companyId]
  );
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    name: r.name,
    title: r.title ?? null,
    specialty: r.specialty ?? null,
    experience: r.experience ?? null,
    avatarUrl: r.avatar_url ?? null,
    slots: typeof r.slots === 'string' ? safeJsonArray(r.slots) : Array.isArray(r.slots) ? r.slots : [],
  }));
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export async function updateUserPassword(userId: number, password: string): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  await p.execute('UPDATE users SET password = ? WHERE id = ?', [password, userId]);
}

// ---- User data operations ----
//
// 孩子檔案、篩查分數與報告歷史一律以**使用者 id** 為鍵。這一族函式收不到電子
// 郵件，也就不會在電子郵件下線的那一天跟著壞掉 —— 那時要換的只有「外部憑據
// 換成帳號」的那一步（見 findUserByEmail 一族），資料層一個字都不必動。

export async function getUserDataByUserId(userId: number): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    'SELECT * FROM user_data WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return (rows as any[])[0] || null;
}

export async function getUserDataByDevice(deviceId: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    'SELECT * FROM user_data WHERE device_id = ? LIMIT 1',
    [deviceId]
  );
  return (rows as any[])[0] || null;
}

export async function saveUserData(
  userId: number,
  deviceId: string | null,
  child: any,
  completedScores: any[],
  orders: any[],
  reportHistory: any[]
): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');

  const childJson = JSON.stringify(child);
  const scoresJson = JSON.stringify(completedScores);
  const ordersJson = JSON.stringify(orders);
  const historyJson = JSON.stringify(reportHistory);

  await p.execute(
    `INSERT INTO user_data (user_id, device_id, child, completed_scores, orders, report_history)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       device_id = VALUES(device_id),
       child = VALUES(child),
       completed_scores = VALUES(completed_scores),
       orders = VALUES(orders),
       report_history = VALUES(report_history)`,
    [userId, deviceId, childJson, scoresJson, ordersJson, historyJson]
  );
}

// ---- Payment / unlock operations ----
//
// Payment and Unlock are separate tables on purpose (see the type comments in
// src/types.ts). The short version: the WeChat callback is delivered more than
// once, refunds must revoke access while keeping the transaction record, and
// goodwill grants create access with no transaction behind them.

/** Creates a pending payment row and returns its id. */
export async function createPayment(
  userId: number,
  outTradeNo: string,
  amountFen: number,
  dimensionId: string
): Promise<number | null> {
  const p = getPool();
  if (!p) return null;
  const [result] = await p.execute(
    `INSERT INTO payments (user_id, out_trade_no, amount_fen, status, dimension_id)
     VALUES (?, ?, ?, 'pending', ?)`,
    [userId, outTradeNo, amountFen, dimensionId]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function findPaymentByOutTradeNo(outTradeNo: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM payments WHERE out_trade_no = ? LIMIT 1', [outTradeNo]);
  return (rows as any[])[0] || null;
}

/**
 * Moves a payment pending → success. Returns true only for the call that
 * actually performed the transition.
 *
 * This is the idempotency gate for the whole paid flow. WeChat resends the
 * callback up to 15 times, and the redirect-back page also triggers a
 * query-order check, so several code paths race to settle the same order. The
 * `AND status = 'pending'` clause means exactly one of them wins; everyone else
 * sees affectedRows = 0 and must not re-grant anything.
 */
export async function markPaymentSuccess(
  outTradeNo: string,
  transactionId: string | null
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const [result] = await p.execute(
    `UPDATE payments
        SET status = 'success', transaction_id = ?, paid_at = NOW()
      WHERE out_trade_no = ? AND status = 'pending'`,
    [transactionId, outTradeNo]
  );
  return (result as mysql.ResultSetHeader).affectedRows === 1;
}

export async function markPaymentRefunded(outTradeNo: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const [result] = await p.execute(
    `UPDATE payments SET status = 'refunded' WHERE out_trade_no = ? AND status = 'success'`,
    [outTradeNo]
  );
  return (result as mysql.ResultSetHeader).affectedRows === 1;
}

/**
 * Grants permanent access to one dimension's deep assessment.
 *
 * Upsert rather than insert: `unlocks` has UNIQUE(user_id, dimension_id), so a
 * parent who refunded and later bought again must reuse the existing row with
 * revoked_at cleared. A plain INSERT would just fail on the unique key and the
 * parent would have paid for nothing.
 */
export async function grantUnlock(
  userId: number,
  dimensionId: string,
  source: 'payment' | 'grant',
  paymentId: number | null
): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute(
    `INSERT INTO unlocks (user_id, dimension_id, source, payment_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       source = VALUES(source),
       payment_id = VALUES(payment_id),
       revoked_at = NULL`,
    [userId, dimensionId, source, paymentId]
  );
}

/** Revokes access (refund or manual reversal). Keeps the row for audit. */
export async function revokeUnlock(userId: number, dimensionId: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute(
    'UPDATE unlocks SET revoked_at = NOW() WHERE user_id = ? AND dimension_id = ? AND revoked_at IS NULL',
    [userId, dimensionId]
  );
}

/** Dimension ids this user currently has access to. Revoked rows excluded. */
export async function listUnlockedDimensions(userId: number): Promise<string[]> {
  const p = getPool();
  if (!p) return [];
  const [rows] = await p.execute(
    'SELECT dimension_id FROM unlocks WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
  return (rows as any[]).map(r => r.dimension_id);
}

// ---- Expert booking operations ----

export interface ExpertBookingInput {
  /** Set when the parent is signed in; project B is anonymous and leaves this null. */
  userId: number | null;
  deviceId: string | null;
  specialistId: string;
  parentName: string;
  parentPhone: string;
  childAgeMonth: number | null;
  childGender: string | null;
  /** Flagged-dimension digest handed to the specialist before the call. */
  reportSummary: string | null;
  preferredSlot: string | null;
}

/** Inserts a booking and returns its id, or null when running without MySQL. */
export async function createExpertBooking(input: ExpertBookingInput): Promise<number | null> {
  const p = getPool();
  if (!p) return null;
  const [result] = await p.execute(
    `INSERT INTO expert_bookings
       (user_id, device_id, specialist_id, parent_name, parent_phone,
        child_age_month, child_gender, report_summary, preferred_slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.deviceId,
      input.specialistId,
      input.parentName,
      input.parentPhone,
      input.childAgeMonth,
      input.childGender,
      input.reportSummary,
      input.preferredSlot,
    ]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

/**
 * Stamps notified_at once at least one notification channel succeeded.
 * Failure here must not fail the booking — the row is already saved and staff
 * can work the queue by created_at, so this is best-effort bookkeeping.
 */
export async function markBookingNotified(id: number): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute('UPDATE expert_bookings SET notified_at = NOW() WHERE id = ?', [id]);
}

// Parse JSON fields from MySQL row
export function parseUserDataRow(row: any): any {
  if (!row) return null;
  return {
    child: typeof row.child === 'string' ? JSON.parse(row.child) : row.child,
    completedScores: typeof row.completed_scores === 'string' ? JSON.parse(row.completed_scores) : (row.completed_scores || []),
    orders: typeof row.orders === 'string' ? JSON.parse(row.orders) : (row.orders || []),
    reportHistory: typeof row.report_history === 'string' ? JSON.parse(row.report_history) : (row.report_history || []),
  };
}

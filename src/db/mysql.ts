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
 * `findUserByPhone` 是登入那一刻把外部憑據換成帳號用的，一次登入只走一次；
 * 通行證發出去之後帶的是使用者 id，所以此後的每一次查詢都從這裡進來 ——
 * 換掉登入方式（電子郵件 → 手機號，#27）時動的是那一族，這一個一個字都沒改。
 */
export async function findUserById(id: number): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return (rows as any[])[0] || null;
}

// 電子郵件那一族（`findUserByEmail` / `createUser` / `updateUserPassword`）已於
// #27 移除 —— 電子郵件登入下線之後，沒有任何一條路會用電子郵件去換帳號。
//
// **欄位與既有資料列都留在原地**：`users.email` / `users.password` 照舊，那些家長
// 的孩子檔案與篩查結果一列都沒動。少的只是走回去的那條路，見
// `docs/adr/0002-parent-identity-is-company-plus-phone.md`。

/**
 * 未歸屬併成的那一個值。與資料庫的 `users.company_key` 生成欄位
 * （`COALESCE(company_id, 0)`）**必須是同一個約定** —— 兩邊分岔的話，
 * 應用層查不到的帳號資料庫查得到，於是同一支手機號在未歸屬範圍內建出第二個帳號。
 */
function toCompanyKey(companyId: number | null): number {
  return companyId ?? 0;
}

/**
 * 登入用：把（歸屬，手機號）換成帳號。
 *
 * `companyId` 是必要參數而非選填。手機號**不是**全域唯一的識別鍵 ——
 * 同一支手機號在兩家合作公司是兩位家長（見 `docs/adr/0002-...`），
 * 一個「不帶公司就查全部」的預設值會讓在乙公司登入的家長進到甲公司的帳號，
 * 然後把小明在甲公司的檔案與分數覆蓋掉。
 *
 * 查的是生成欄位 `company_key` 而不是 `company_id`：未歸屬在 `company_id` 是
 * NULL，而 `NULL = NULL` 在 SQL 裡不成立，用 `company_id` 查永遠查不到未歸屬的
 * 家長 —— 而專案 A 的家長全部都是未歸屬。
 */
export async function findUserByPhone(companyId: number | null, phone: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    'SELECT * FROM users WHERE company_key = ? AND phone = ? LIMIT 1',
    [toCompanyKey(companyId), phone]
  );
  return (rows as any[])[0] || null;
}

/**
 * 建立家長帳號，並在此刻**一次性**寫入歸屬。#27 之後這是唯一建帳號的地方。
 *
 * `companyId` 只在這裡寫得進去。歸屬「建立時綁定、此後不變」不是靠一條紀律
 * 維持的，而是靠沒有第二個地方改得到它 —— 已有帳號的家長再從別家公司的連結
 * 進站時，這個函式根本不會被呼叫，於是歸屬自然不動。
 *
 * 電子郵件與密碼兩欄留空 —— 純驗證碼登入沒有密碼，補一個假的進去只會讓
 * 「這個帳號能不能用密碼登入」變成一個要靠讀程式碼才答得出來的問題。
 *
 * 唯一鍵 `uk_company_phone` 撞上時**丟例外**，呼叫端不得吞掉：兩個同時進來的
 * 請求裡，先寫進去的那一個是帳號，另一個必須重查而不是再建一個。
 */
export async function createPhoneUser(phone: string, companyId: number | null = null): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  const [result] = await p.execute(
    'INSERT INTO users (phone, company_id) VALUES (?, ?)',
    [phone, companyId]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

// ---- SMS verification codes ----
//
// 只存雜湊。這張表裡的一列若是明碼，任何一份資料庫備份、任何一次慢查詢日誌
// 都等同一把可以登入任何帳號的鑰匙 —— 而驗證碼只有六位數，看到就是看到了。

export interface SmsCodeInput {
  phone: string;
  /** bcrypt 雜湊，不是驗證碼本身。 */
  codeHash: string;
  expiresAt: Date;
  requestIp: string | null;
}

export async function createSmsCode(input: SmsCodeInput): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  const [result] = await p.execute(
    'INSERT INTO sms_codes (phone, code_hash, expires_at, request_ip) VALUES (?, ?, ?, ?)',
    [input.phone, input.codeHash, input.expiresAt, input.requestIp]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

/**
 * 收回一筆從來沒送出去的驗證碼。
 *
 * 簡訊送失敗時呼叫。留著的話，那一列會讓冷卻期把家長擋在門外一分鐘，
 * 而他手上並沒有任何一組可以輸入的驗證碼。
 */
export async function deleteSmsCode(id: number): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute('DELETE FROM sms_codes WHERE id = ?', [id]);
}

/** 這支手機號最近索取的那一筆。冷卻期與核對都認這一筆，舊的一律作廢。 */
export async function findLatestSmsCode(phone: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    'SELECT * FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1',
    [phone]
  );
  return (rows as any[])[0] || null;
}

/** 防刷：這支手機號在某個時間點之後索取了幾次。 */
export async function countSmsCodesSince(phone: string, since: Date): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  const [rows] = await p.execute(
    'SELECT COUNT(*) AS n FROM sms_codes WHERE phone = ? AND created_at >= ?',
    [phone, since]
  );
  return Number((rows as any[])[0]?.n ?? 0);
}

/**
 * 累加錯誤次數。在資料庫裡做加法而不是「讀出來加一再寫回去」——
 * 後者在兩個請求同時猜的時候會把其中一次的計數蓋掉，於是上限形同虛設。
 */
export async function incrementSmsCodeAttempts(id: number): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute('UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?', [id]);
}

/**
 * 把驗證碼標記為已用。**只有真的完成這次轉換的那一個呼叫回 true。**
 *
 * `AND consumed_at IS NULL` 是這裡的整個重點：同一組驗證碼被送兩次時，
 * 只有一個請求拿得到 true，另一個看到 false 就必須當作驗證失敗。
 * 少了它，一組被側錄到的驗證碼可以重複登入直到過期。
 */
export async function consumeSmsCode(id: number): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const [result] = await p.execute(
    'UPDATE sms_codes SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL',
    [id]
  );
  return (result as mysql.ResultSetHeader).affectedRows === 1;
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

// ---- User data operations ----
//
// 孩子檔案、篩查分數與報告歷史一律以**使用者 id** 為鍵。這一族函式收不到電子
// 郵件，所以電子郵件下線的那一天（#27）它們一個字都不必改 —— 換掉的只有
// 「外部憑據換成帳號」的那一步。這是當初把鍵換成使用者 id 的整個理由。

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

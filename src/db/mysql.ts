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

export async function findUserByEmail(email: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return (rows as any[])[0] || null;
}

export async function createUser(email: string, password: string): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  await p.execute('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);
}

export async function updateUserPassword(email: string, password: string): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  await p.execute('UPDATE users SET password = ? WHERE email = ?', [password, email]);
}

// ---- User data operations ----

export async function getUserData(email: string): Promise<any | null> {
  const p = getPool();
  if (!p) return null;
  const [rows] = await p.execute(
    `SELECT ud.* FROM user_data ud
     JOIN users u ON ud.user_id = u.id
     WHERE u.email = ? LIMIT 1`,
    [email]
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
  email: string,
  deviceId: string | null,
  child: any,
  completedScores: any[],
  orders: any[],
  reportHistory: any[]
): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');

  // Get user_id from email
  const user = await findUserByEmail(email);
  if (!user) throw new Error('User not found');

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
    [user.id, deviceId, childJson, scoresJson, ordersJson, historyJson]
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

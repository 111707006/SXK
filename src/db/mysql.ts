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

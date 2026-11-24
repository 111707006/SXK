/**
 * 代填簡訊的發送紀錄（`proxy_sms`，`deploy/migrations/2026-11-26-proxy-sms.sql`）。
 * 先佔一列再送：鎖住家長那一列，兩個同時進來的請求只有一個佔得到。程式中斷留下的 pending 當作送過（寧可少寄）。
 */
import type { ResultSetHeader } from 'mysql2/promise';
import { getPool } from './mysql';
import { PROXY_SMS_COOLDOWN_HOURS, PROXY_SMS_MAX_ATTEMPTS } from '../serviceRelations/proxySms';

/** 佔到回紀錄 id；這段時間內送過、或試太多次回 null。 */
export async function reserveProxySms(userId: number, adminUserId: number): Promise<number | null> {
  const p = getPool();
  if (!p) throw new Error('database is not configured');
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS attempts, COALESCE(SUM(status <> 'failed'), 0) AS delivered
         FROM proxy_sms WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ${PROXY_SMS_COOLDOWN_HOURS} HOUR)`,
      [userId]
    );
    const row = (rows as any[])[0];
    if (Number(row.delivered) > 0 || Number(row.attempts) >= PROXY_SMS_MAX_ATTEMPTS) {
      await conn.rollback();
      return null;
    }
    const [result] = await conn.execute("INSERT INTO proxy_sms (user_id, admin_user_id, status) VALUES (?, ?, 'pending')", [userId, adminUserId]);
    await conn.commit();
    return (result as ResultSetHeader).insertId;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export async function finishProxySms(id: number, ok: boolean, detail: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.execute('UPDATE proxy_sms SET status = ?, detail = ? WHERE id = ?', [ok ? 'sent' : 'failed', ok ? null : detail.slice(0, 200), id]);
}

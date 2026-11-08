/**
 * `wechat_openids` 的資料層：家長在服務號底下的 openid（JSAPI 支付的付款人，2026-11-08）。
 * 只在付款時用，不是登入身分。讀寫都帶 user_id 與 appid。
 */
import { getPool } from './mysql';

function pool() {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  return p;
}

/** 這位家長在這個服務號底下的 openid；還沒授權過回 `null`。 */
export async function findOpenid(userId: number, appid: string): Promise<string | null> {
  const [rows] = await pool().execute(
    'SELECT openid FROM wechat_openids WHERE user_id = ? AND appid = ? LIMIT 1',
    [userId, appid],
  );
  const row = (rows as any[])[0];
  return row && typeof row.openid === 'string' && row.openid !== '' ? row.openid : null;
}

/** 存（有就覆蓋：同一位家長換了微信帳號，以最後一次授權為準）。 */
export async function saveOpenid(userId: number, appid: string, openid: string): Promise<void> {
  await pool().execute(
    `INSERT INTO wechat_openids (user_id, appid, openid) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE openid = VALUES(openid)`,
    [userId, appid, openid],
  );
}

/**
 * 家長兌換一組碼（客戶 10/22，#110，開關 `TRAINING_PLAN`）。一個交易裡做完四件事：
 *   1. 原子地把那一組從「未用」改「已用」（`WHERE status = 'unused'`）—— 兩人同時兌只有一人改得到
 *   2. 讀那一組的月數與推薦人
 *   3. 發一段 `code` 使用權（接在這位家長既有的使用權後面；`unique_key = code:<碼編號>`）
 *   4. 家長還沒綁推薦人就綁到這一組的推薦人（`INSERT IGNORE`：第一次就固定，之後不改）
 * 任何一步失敗整個退回，碼還是未用。後台的產碼、列碼、作廢在 `src/admin/adminStore.ts`。
 */
import { getPool } from './mysql';
import { isPassMonths, nextPassRange, type PassMonths, type TrainingPass } from '../t2/trainingPass';

export type RedeemOutcome =
  | { ok: true; months: PassMonths; startsOn: string; endsOn: string; boundReferrerId: number | null }
  | { ok: false };

export async function redeemCodeForUser(userId: number, code: string, today: string): Promise<RedeemOutcome> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.execute(
      "UPDATE redeem_codes SET status = 'used', used_by = ?, used_at = NOW() WHERE code = ? AND status = 'unused'",
      [userId, code],
    );
    if ((upd as { affectedRows: number }).affectedRows !== 1) {
      await conn.rollback();
      return { ok: false };
    }
    const [rows] = await conn.execute(
      'SELECT c.id, b.months, b.referrer_id FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id WHERE c.code = ? LIMIT 1',
      [code],
    );
    const row = (rows as any[])[0];
    const months = Number(row?.months);
    if (!row || !isPassMonths(months)) {
      await conn.rollback();
      return { ok: false };
    }
    // 鎖住這位家長的使用權再算起訖：同一位家長同時兌兩組，第二組要接在第一組後面，不是重疊。
    const [passRows] = await conn.execute(
      `SELECT DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on
         FROM training_passes WHERE user_id = ? FOR UPDATE`,
      [userId],
    );
    const passes: TrainingPass[] = (passRows as any[]).map(r => ({ startsOn: String(r.starts_on), endsOn: String(r.ends_on), months: 1, source: 'code' }));
    const range = nextPassRange(passes, today, months);
    await conn.execute(
      "INSERT INTO training_passes (user_id, starts_on, ends_on, months, source, ref_id, unique_key) VALUES (?, ?, ?, ?, 'code', ?, ?)",
      [userId, range.startsOn, range.endsOn, months, Number(row.id), `code:${Number(row.id)}`],
    );
    const [bind] = await conn.execute(
      "INSERT IGNORE INTO referrer_bindings (user_id, referrer_id, source, ref_id) VALUES (?, ?, 'code', ?)",
      [userId, Number(row.referrer_id), Number(row.id)],
    );
    await conn.commit();
    const bound = (bind as { affectedRows: number }).affectedRows === 1 ? Number(row.referrer_id) : null;
    return { ok: true, months, ...range, boundReferrerId: bound };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

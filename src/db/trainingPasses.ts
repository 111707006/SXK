/**
 * `training_passes` 的資料層（居家訓練使用權，客戶 10/22，#91，開關 `TRAINING_PLAN`）。規則在 `src/t2/trainingPass.ts`。
 *
 * 只有 INSERT 與「這位家長的全部」：使用權寫下後不改（續買是新的一段，不是把舊的那段拉長）。
 * `unique_key` 擋同一件事發兩段（T2 附送、同一筆付款、同一組碼），撞到時 `insertTrainingPass` 回 false、不丟錯。
 */
import { getPool } from './mysql';
import { isPassMonths, PASS_SOURCES, type PassSource, type TrainingPass } from '../t2/trainingPass';

export interface TrainingPassInsert extends TrainingPass {
  refId: number | null;
  uniqueKey: string | null;
}

function requirePool() {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  return p;
}

export async function listTrainingPasses(userId: number): Promise<TrainingPass[]> {
  const [rows] = await requirePool().execute(
    `SELECT DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on, months, source
       FROM training_passes WHERE user_id = ? ORDER BY id ASC`,
    [userId],
  );
  const out: TrainingPass[] = [];
  for (const r of rows as any[]) {
    const months = Number(r.months);
    if (!isPassMonths(months) || !(PASS_SOURCES as readonly string[]).includes(r.source)) continue;
    out.push({ startsOn: String(r.starts_on), endsOn: String(r.ends_on), months, source: r.source as PassSource });
  }
  return out;
}

/** 寫一段。`unique_key` 撞到（這件事已經發過一段）回 false。 */
export async function insertTrainingPass(userId: number, pass: TrainingPassInsert): Promise<boolean> {
  try {
    await requirePool().execute(
      `INSERT INTO training_passes (user_id, starts_on, ends_on, months, source, ref_id, unique_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, pass.startsOn, pass.endsOn, pass.months, pass.source, pass.refId, pass.uniqueKey],
    );
    return true;
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
}

/**
 * 這位家長有沒有一份**量表交卷生成的** T2 報告（附送一個月的條件）。「只有 T1」與「代填」兩種快照（#92、#112）
 * 不算 —— 那不是家長買 T2 做出來的報告。
 */
export async function hasScaleT2Findings(userId: number, excludeToolkits: readonly string[]): Promise<boolean> {
  const placeholders = excludeToolkits.map(() => '?').join(', ');
  const [rows] = await requirePool().execute(
    `SELECT 1 FROM t2_findings WHERE user_id = ?${excludeToolkits.length ? ` AND toolkit_version NOT IN (${placeholders})` : ''} LIMIT 1`,
    [userId, ...excludeToolkits],
  );
  return (rows as any[]).length > 0;
}

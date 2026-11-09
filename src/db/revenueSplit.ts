/**
 * 清分（ADR-0016，開關 `REVENUE_SPLIT`）的資料層：開單時讀比例與這位家長的歸屬、把快照寫回那一筆訂單。
 * 後台改比例、看對帳走 `src/admin/adminStore.ts`（路由層不得直接匯入這裡的 mysql）。
 */
import type mysql from 'mysql2/promise';
import { getPool } from './mysql';
import type { RateRow, SplitAttribution, SplitRates, SplitSnapshot } from '../revenueSplit/split';

function pool(): mysql.Pool {
  const p = getPool();
  if (!p) throw new Error('revenueSplit：資料庫沒有設定');
  return p;
}

const bpOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** `revenue_split_rates` 每一列 → 一組設定。 */
export function ratesFromRows(rows: ReadonlyArray<{ scope: string; ref_id: unknown; platform_bp: unknown; company_bp: unknown }>): SplitRates {
  let dflt: RateRow = { platformBp: null, companyBp: null };
  const company = new Map<number, RateRow>();
  const referrer = new Map<number, RateRow>();
  for (const r of rows) {
    const row = { platformBp: bpOrNull(r.platform_bp), companyBp: bpOrNull(r.company_bp) };
    if (r.scope === 'default') dflt = row;
    else if (r.scope === 'company') company.set(Number(r.ref_id), row);
    else if (r.scope === 'referrer') referrer.set(Number(r.ref_id), row);
  }
  return { default: dflt, company, referrer };
}

export async function loadSplitRates(): Promise<SplitRates> {
  const [rows] = await pool().execute('SELECT scope, ref_id, platform_bp, company_bp FROM revenue_split_rates');
  return ratesFromRows(rows as any[]);
}

/**
 * 這位家長現在的歸屬：帳號上的合作公司、綁定的推薦人（與推薦人隸屬的公司）。
 * 停用的不算（後台停用了就不該再替新訂單分一份）：推薦人停用＝當成沒綁，有歸屬公司就照公司分；公司停用＝那一方不存在。
 */
export async function loadSplitAttribution(userId: number): Promise<SplitAttribution> {
  const [rows] = await pool().execute(
    `SELECT c.id AS company_id, c.name AS company_name,
            r.id AS referrer_id, r.name AS referrer_name, r.kind AS referrer_kind,
            rc.id AS referrer_company_id, rc.name AS referrer_company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id AND c.active = 1
       LEFT JOIN referrer_bindings rb ON rb.user_id = u.id
       LEFT JOIN referrers r ON r.id = rb.referrer_id AND r.active = 1
       LEFT JOIN companies rc ON rc.id = r.company_id AND rc.active = 1
      WHERE u.id = ?
      LIMIT 1`,
    [userId]
  );
  const row = (rows as any[])[0];
  if (!row) return { company: null, referrer: null };
  return {
    company: row.company_id ? { id: Number(row.company_id), name: String(row.company_name) } : null,
    referrer: row.referrer_id
      ? {
          id: Number(row.referrer_id),
          name: String(row.referrer_name),
          kind: row.referrer_kind === 'therapist' ? 'therapist' : 'channel',
          company: row.referrer_company_id ? { id: Number(row.referrer_company_id), name: String(row.referrer_company_name) } : null,
        }
      : null,
  };
}

/** 開單之後寫上快照；只寫還沒有快照的（同一筆不會被改第二次）。 */
export async function saveSplitSnapshot(paymentId: number, snapshot: SplitSnapshot): Promise<void> {
  await pool().execute('UPDATE payments SET split_snapshot = ? WHERE id = ? AND split_snapshot IS NULL', [JSON.stringify(snapshot), paymentId]);
}

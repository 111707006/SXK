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

/**
 * `revenue_split_rates` 每一列 → 一組設定。篩查渠道比例（#122）只讀單位那幾列，而且只在那一列帶了 `screening_bp` 時
 * （服務關係關著不 SELECT 這一欄，設定裡就沒有 `screeningBp`）。
 */
export function ratesFromRows(
  rows: ReadonlyArray<{ scope: string; ref_id: unknown; platform_bp: unknown; company_bp: unknown; screening_bp?: unknown }>
): SplitRates {
  let dflt: RateRow = { platformBp: null, companyBp: null };
  const company = new Map<number, RateRow>();
  const referrer = new Map<number, RateRow>();
  for (const r of rows) {
    const row = { platformBp: bpOrNull(r.platform_bp), companyBp: bpOrNull(r.company_bp) };
    if (r.scope === 'default') dflt = row;
    else if (r.scope === 'company') company.set(Number(r.ref_id), 'screening_bp' in r ? { ...row, screeningBp: bpOrNull(r.screening_bp) } : row);
    else if (r.scope === 'referrer') referrer.set(Number(r.ref_id), row);
  }
  return { default: dflt, company, referrer };
}

/** 服務關係開著（#122）多讀篩查渠道比例；關著與 #122 之前同一句（還沒跑 `2026-11-24-split-screening.sql` 也讀得到）。 */
export async function loadSplitRates(opts: { screening?: boolean } = {}): Promise<SplitRates> {
  const [rows] = await pool().execute(
    opts.screening
      ? 'SELECT scope, ref_id, platform_bp, company_bp, screening_bp FROM revenue_split_rates'
      : 'SELECT scope, ref_id, platform_bp, company_bp FROM revenue_split_rates'
  );
  return ratesFromRows(rows as any[]);
}

/**
 * 這位家長現在的歸屬：帳號上的合作公司、綁定的推薦人（與推薦人隸屬的公司）。
 * 停用的不算（後台停用了就不該再替新訂單分一份）：推薦人停用＝當成沒綁，有歸屬公司就照公司分；公司停用＝那一方不存在。
 */
export async function loadSplitAttribution(userId: number, opts: { serviceRelations?: boolean } = {}): Promise<SplitAttribution> {
  if (opts.serviceRelations) return loadServiceAttribution(userId);
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

/**
 * 服務關係開著（#122，ADR-0020 第 3、8 點）：對方看 `service_relations`（現在的服務單位與推薦人），篩查渠道看 `users.company_id`
 * （家長最早進來的單位）。停用的同上不算：
 * - 服務單位停用＝沒有單位那一方；推薦人停用＝當成還沒標注（只到單位）。
 * - 推薦人照服務關係算在**服務單位**底下（不看 `referrers.company_id`）；服務單位停用、推薦人還在＝推薦人一方（同舊規則）。
 * - 篩查渠道：帳號上的單位、啟用中才算；B 轉入與直屬的家長 `company_id` 是 NULL ＝ 沒有。
 */
async function loadServiceAttribution(userId: number): Promise<SplitAttribution> {
  const [rows] = await pool().execute(
    `SELECT sc.id AS screening_id, sc.name AS screening_name,
            c.id AS company_id, c.name AS company_name,
            r.id AS referrer_id, r.name AS referrer_name, r.kind AS referrer_kind
       FROM users u
       LEFT JOIN companies sc ON sc.id = u.company_id AND sc.active = 1
       LEFT JOIN service_relations sr ON sr.user_id = u.id
       LEFT JOIN companies c ON c.id = sr.company_id AND c.active = 1
       LEFT JOIN referrers r ON r.id = sr.referrer_id AND r.active = 1
      WHERE u.id = ?
      LIMIT 1`,
    [userId]
  );
  return attributionFromServiceRow((rows as any[])[0]);
}

/** 上面那一句的一列 → 歸屬（純函式，測試用）。沒有這位家長＝沒有任何一方，但服務關係開著，所以帶 `screening: null`。 */
export function attributionFromServiceRow(row: any): SplitAttribution {
  if (!row) return { company: null, referrer: null, screening: null };
  const company = row.company_id ? { id: Number(row.company_id), name: String(row.company_name) } : null;
  return {
    company,
    referrer: row.referrer_id
      ? { id: Number(row.referrer_id), name: String(row.referrer_name), kind: row.referrer_kind === 'therapist' ? 'therapist' : 'channel', company }
      : null,
    screening: row.screening_id ? { id: Number(row.screening_id), name: String(row.screening_name) } : null,
  };
}

/** 開單之後寫上快照；只寫還沒有快照的（同一筆不會被改第二次）。 */
export async function saveSplitSnapshot(paymentId: number, snapshot: SplitSnapshot): Promise<void> {
  await pool().execute('UPDATE payments SET split_snapshot = ? WHERE id = ? AND split_snapshot IS NULL', [JSON.stringify(snapshot), paymentId]);
}

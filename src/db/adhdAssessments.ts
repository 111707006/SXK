/**
 * `adhd_assessments` 的受評者端資料層（成人 ADHD，`APP_MODE=adhd`，設計第 4 節）。
 *
 * 每一句都帶 `user_id`：讀一筆是 `WHERE id = ? AND user_id = ?`，別人的那一筆換個 id 也讀不到。
 * 後台的查詢不在這裡 —— 那些要帶公司條件，走 `src/admin/adminStore.ts`（`test/adminScope.structure.test.ts`）。
 */
import { getPool } from './mysql';
import type { AdhdConclusionStatus } from '../adhd/payload';

export interface AdhdAssessmentUpsert {
  clientCaseId: string;
  pageVersion: string;
  payload: unknown;
  subjectName: string;
  conclusionStatus: AdhdConclusionStatus;
  conclusionTitle: string;
}

export interface AdhdAssessmentListItem {
  id: number;
  subjectName: string;
  conclusionStatus: string;
  conclusionTitle: string;
  createdAt: string;
  updatedAt: string;
}

function pool() {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  return p;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** 同一位、同一份個案只有一列：有就更新，沒有就新增。回那一列的 id。 */
export async function upsertAdhdAssessment(userId: number, input: AdhdAssessmentUpsert): Promise<number> {
  const [res] = await pool().execute(
    `INSERT INTO adhd_assessments
       (user_id, client_case_id, page_version, payload, subject_name, conclusion_status, conclusion_title)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id), page_version = VALUES(page_version), payload = VALUES(payload),
       subject_name = VALUES(subject_name), conclusion_status = VALUES(conclusion_status),
       conclusion_title = VALUES(conclusion_title)`,
    [
      userId,
      input.clientCaseId,
      input.pageVersion,
      JSON.stringify(input.payload),
      input.subjectName,
      input.conclusionStatus,
      input.conclusionTitle,
    ],
  );
  return Number((res as { insertId: number }).insertId);
}

/** 自己的歷次，新到舊。 */
export async function listAdhdAssessments(userId: number): Promise<AdhdAssessmentListItem[]> {
  const [rows] = await pool().execute(
    `SELECT id, subject_name, conclusion_status, conclusion_title, created_at, updated_at
       FROM adhd_assessments WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 200`,
    [userId],
  );
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    subjectName: String(r.subject_name),
    conclusionStatus: String(r.conclusion_status),
    conclusionTitle: String(r.conclusion_title),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }));
}

/** 自己的一筆（別人的回 null）。 */
export async function findAdhdAssessmentPayload(userId: number, id: number): Promise<unknown | null> {
  const [rows] = await pool().execute('SELECT payload FROM adhd_assessments WHERE id = ? AND user_id = ?', [id, userId]);
  const row = (rows as { payload: unknown }[])[0];
  if (!row) return null;
  return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
}

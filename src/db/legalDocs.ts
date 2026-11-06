/**
 * 後台可編輯的條款（客戶 11/03 第 14 頁，開關 `LEGAL_DOCS`，只在專案 A）：`legal_documents` 一份一列。
 * 家長端讀（公開端點 `GET /api/legal`）與後台存檔（`PUT /api/admin/legal/:doc`）共用這一檔。
 * 全站一套，不屬於任何一家合作公司、不含任何一位家長的資料（同 `home_media`）。
 * 沒有資料庫（記憶體模式）：讀回沒存過（家長端畫內建條款）、存檔回 null（後台 503）。
 */
import { getPool } from './mysql';
import { EMPTY_LEGAL_DOCS, legalDocFromRow, legalDocsFromRows, type LegalDoc, type LegalDocKey, type LegalDocs } from '../legal/shape';

export async function loadLegalDocs(): Promise<LegalDocs> {
  const p = getPool();
  if (!p) return EMPTY_LEGAL_DOCS;
  const [rows] = await p.execute(SELECT, []);
  return legalDocsFromRows(rows as Record<string, unknown>[]);
}

/**
 * `updated_at` 一律存 **UTC**（`UTC_TIMESTAMP()`）、讀回時由資料庫格式化成帶 `Z` 的字串 —— 不經 mysql2 把 DATETIME
 * 當 Node 的本地時間解讀（RDS 在 +08:00、容器在 UTC 時會差八小時，落款的日期在半夜前後就差一天）。
 */
const SELECT = "SELECT doc_key, markdown, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at FROM legal_documents";

/** 存一份：「最后更新日期」由資料庫填當下，不收前端的。 */
export async function saveLegalDoc(key: LegalDocKey, markdown: string, adminId: number | null): Promise<LegalDoc | null> {
  const p = getPool();
  if (!p) return null;
  await p.execute(
    `INSERT INTO legal_documents (doc_key, markdown, updated_at, updated_by) VALUES (?, ?, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE markdown = VALUES(markdown), updated_by = VALUES(updated_by), updated_at = UTC_TIMESTAMP()`,
    [key, markdown, adminId],
  );
  const [rows] = await p.execute(`${SELECT} WHERE doc_key = ? LIMIT 1`, [key]);
  const row = (rows as Record<string, unknown>[])[0];
  return row ? legalDocFromRow(row)?.doc ?? null : null;
}

/**
 * `handoff_codes`（發出端 B）與 `handoff_imports`（接收端 A）的資料層（ADR-0009）。
 *
 * 到期與「已用」都交給資料庫的時鐘（`NOW()`），不拿 Node 的時間去比 —— 與 `sms_codes` 同一個理由：
 * 兩個時鐘不保證對得上。兌換是一句條件式 UPDATE：兩個請求同時拿同一個碼來，只有一個改得到那一列。
 */
import type { ResultSetHeader } from 'mysql2/promise';
import { getPool } from './mysql';
import type { HandoffKind } from '../handoff/core';

function pool() {
  const p = getPool();
  if (!p) throw new Error('MySQL not configured');
  return p;
}

export async function createHandoffCode(input: {
  userId: number;
  codeHash: string;
  kind: HandoffKind;
  ttlSec: number;
  consentVersion: string | null;
}): Promise<number> {
  const [result] = await pool().execute(
    `INSERT INTO handoff_codes (code_hash, user_id, kind, consent_version, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [input.codeHash, input.userId, input.kind, input.consentVersion, input.ttlSec],
  );
  return (result as ResultSetHeader).insertId;
}

export interface ConsumedHandoff {
  userId: number;
  kind: HandoffKind;
  consentVersion: string | null;
}

/** 兌換：沒用過、沒過期才標成已用並回那一列；其餘一律 `null`（不分辨是哪一種不成立）。 */
export async function consumeHandoffCode(codeHash: string): Promise<ConsumedHandoff | null> {
  const p = pool();
  const [result] = await p.execute(
    `UPDATE handoff_codes SET redeemed_at = NOW()
      WHERE code_hash = ? AND redeemed_at IS NULL AND expires_at > NOW()`,
    [codeHash],
  );
  if ((result as ResultSetHeader).affectedRows !== 1) return null;
  const [rows] = await p.execute(
    'SELECT user_id, kind, consent_version FROM handoff_codes WHERE code_hash = ? LIMIT 1',
    [codeHash],
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  return { userId: Number(row.user_id), kind: row.kind, consentVersion: row.consent_version ?? null };
}

export async function recordHandoffImport(input: {
  userId: number;
  sourceUserId: number;
  source: { companyId: number; slug: string; name: string } | null;
  kind: HandoffKind;
  consentVersion: string | null;
  imported: boolean;
}): Promise<void> {
  await pool().execute(
    `INSERT INTO handoff_imports
       (user_id, source_user_id, source_company_id, source_company_slug, source_company_name, kind, consent_version, imported)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.sourceUserId,
      input.source?.companyId ?? null,
      input.source?.slug ?? null,
      input.source?.name ?? null,
      input.kind,
      input.consentVersion,
      input.imported ? 1 : 0,
    ],
  );
}

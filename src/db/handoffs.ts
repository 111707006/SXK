/**
 * `handoff_codes`（發出端 B）與 `handoff_imports`（接收端 A）的資料層（ADR-0009）。
 *
 * 交接碼**不過期、可以重複用**（使用者 2026-09-28）：`expires_at` 一律 NULL，每兌換一次記次數與最後一次的時間
 * （後台據此知道這位家長已經到過 A）。欄位留著：哪天要加時效，只改寫入的那一句。
 * 時間一律交給資料庫的時鐘（`NOW()`），同 `sms_codes`。
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
  consentVersion: string | null;
}): Promise<number> {
  const [result] = await pool().execute(
    `INSERT INTO handoff_codes (code_hash, user_id, kind, consent_version) VALUES (?, ?, ?, ?)`,
    [input.codeHash, input.userId, input.kind, input.consentVersion],
  );
  return (result as ResultSetHeader).insertId;
}

export interface RedeemedHandoff {
  userId: number;
  kind: HandoffKind;
  consentVersion: string | null;
}

/**
 * 兌換：碼存在（而且沒設到期、或還沒到）就記一次使用並回那一列；其餘一律 `null`（不分辨原因）。
 * 可以重複兌換 —— 同一條連結再點一次，A 再登入一次同一個帳號。
 */
export async function redeemHandoffCode(codeHash: string): Promise<RedeemedHandoff | null> {
  const p = pool();
  const [result] = await p.execute(
    `UPDATE handoff_codes SET use_count = use_count + 1, last_used_at = NOW()
      WHERE code_hash = ? AND (expires_at IS NULL OR expires_at > NOW())`,
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

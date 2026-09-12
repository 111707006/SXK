/**
 * `t2_findings` 的資料層（票 #59，規格 v2 §9.1）。
 *
 * 【這張表的規矩】
 * 家長按「生成」時的快照，**寫下後不改**：只有 INSERT 與「這位家長最新的一筆」。
 * 沒有 UPDATE、沒有重算 —— 門檻改版之後回頭看半年前那份報告，讀到的仍是當時那一份
 *（§9.1「與 T1 報告同一個哲學」）。
 *
 * 【為什麼獨立一檔】
 * 與 `t2ToolResults.ts`、`activities.ts` 同一個理由：每一支替換掉 `src/db/mysql` 的 HTTP
 * 測試都得把那個檔案的匯出一個個補齊。這裡只從 `mysql.ts` 拿連線池，其餘自己來。
 *
 * 【壞資料的處置】
 * `findings` 讀不成 `T2Findings` 的那一列**當成沒有**（`latestFindings` 回 `null`，
 * 家長看到的是「還沒有報告」）。挑法比 `t2ToolResults` 嚴一格：那裡壞一列丟一列、其餘照讀，
 * 因為清單少一支還是一份清單；這裡整份報告只有一列，端出半份比說「還沒有」糟得多。
 * `prose` 壞掉只讓那一格變 `null`（畫面退成「未記錄」那一態），findings 照回 ——
 * 判定是規則引擎算的，文字只是它的包裝，不該因為包裝破了就把判定也丟掉。
 */

import { getPool } from './mysql';
import { DIMENSION_CODES } from '../t2/types';
import type { T2Findings } from '../t2/types';
import type { T2ReportProse } from '../t2/report';

/** 表裡的一列，讀出來的形狀。 */
export interface FindingsRecord {
  id: number;
  createdAt: string;
  findings: T2Findings;
  /** 模板退路也是一份完整的 prose；`null` 只在「連模板都沒存成」時出現。 */
  prose: T2ReportProse | null;
  isAiGenerated: boolean;
  /** 產出這份文字的引擎，或退路的來源。見遷移檔檔頭。 */
  aiEngine: string | null;
}

export interface FindingsInsert {
  findings: T2Findings;
  prose: T2ReportProse | null;
  isAiGenerated: boolean;
  aiEngine: string | null;
}

export async function insertFindings(userId: number, input: FindingsInsert): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [res] = await p.execute(
    `INSERT INTO t2_findings
       (user_id, rules_version, toolkit_version, findings, prose, is_ai_generated, ai_engine)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.findings.rulesVersion,
      input.findings.toolkitVersion,
      JSON.stringify(input.findings),
      input.prose === null ? null : JSON.stringify(input.prose),
      input.isAiGenerated ? 1 : 0,
      input.aiEngine,
    ],
  );
  return Number((res as { insertId: number }).insertId);
}

/**
 * 這位家長最新的一筆快照；一筆都沒有、或最新那一列讀不成 `T2Findings` 時回 `null`。
 *
 * 「最新」看 `id` 不看 `created_at`：同一秒生成兩份（家長連按兩下）時 `created_at` 一樣，
 * 而 `id` 永遠分得出先後。
 */
export async function latestFindings(userId: number): Promise<FindingsRecord | null> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT id, findings, prose, is_ai_generated, ai_engine, created_at
       FROM t2_findings
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [userId],
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  const record = findingsFromRow(row);
  if (!record) console.warn(`[T2] t2_findings 第 ${row?.id} 列讀不成 T2Findings，當成沒有報告`);
  return record;
}

/** mysql2 對 JSON 欄位會先解析成物件；手動下 SQL 或替身給的可能還是字串。兩種都收；壞的回 `undefined`。 */
function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * 一列讀成 `T2Findings` 的最低要求：九個維度都在、版本三件都在、`toolResults` 是陣列。
 * 不逐欄驗到底 —— 那是彙整層的輸出，這裡只擋「根本不是一份 findings」的東西。
 * 九個維度是驗得最緊的一項：`matchWeeklyActivities` 對「不是剛好九個」會丟錯，
 * 在那裡炸掉只看得到一句沒有上下文的例外。
 */
function isFindingsShaped(x: unknown): x is T2Findings {
  if (!isObject(x)) return false;
  if (typeof x.rulesVersion !== 'string' || typeof x.toolkitVersion !== 'string') return false;
  if (typeof x.computedAt !== 'string' || Number.isNaN(Date.parse(x.computedAt))) return false;
  if (!isObject(x.child) || typeof (x.child as any).assessedAgeMonth !== 'number') return false;
  if (!Array.isArray(x.toolResults)) return false;
  if (!Array.isArray(x.dimensions) || x.dimensions.length !== DIMENSION_CODES.length) return false;
  const ids = new Set(x.dimensions.map((d: any) => d?.dimensionId));
  return DIMENSION_CODES.every(d => ids.has(d));
}

/** `prose` 的最低要求：是物件、有 `perDimension` 陣列。不過就當「未記錄」（檔頭）。 */
function proseFrom(raw: unknown): T2ReportProse | null {
  const parsed = parseJson(raw);
  if (!isObject(parsed) || !Array.isArray(parsed.perDimension)) return null;
  return parsed as unknown as T2ReportProse;
}

/** mysql2 預設回 Date；開了 `dateStrings` 回 `'2026-09-12 01:00:05'`。讀不成時間回 `null`（那一列算壞的）。 */
function isoOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function findingsFromRow(row: any): FindingsRecord | null {
  const findings = parseJson(row?.findings);
  if (!isFindingsShaped(findings)) return null;
  const createdAt = isoOf(row.created_at);
  if (createdAt === null) return null;
  return {
    id: Number(row.id),
    createdAt,
    findings,
    prose: proseFrom(row.prose),
    isAiGenerated: Number(row.is_ai_generated) === 1,
    aiEngine: typeof row.ai_engine === 'string' && row.ai_engine !== '' ? row.ai_engine : null,
  };
}

/**
 * `t2_tool_results` 的資料層（票 #57，規格 v2 §9.1）。
 *
 * 【這張表的規矩】
 * 每次交卷一筆，**不覆蓋**：同一支工具重做就多一列。「每支最新且完整的一筆」是讀的時候挑
 * （`src/t2/findings.ts` 的 `latestCompleteResults`），不是寫的時候蓋 —— #59 生成報告要看
 * 「同一支 30 天內重做」，覆蓋掉就看不到了。所以這裡只有 INSERT 與「這位家長的全部」。
 *
 * 【為什麼獨立一檔、不進 `mysql.ts`】
 * 與 `activities.ts` 同一個理由：每一支替換掉 `src/db/mysql` 的 HTTP 測試都得把那個檔案的匯出
 * 一個個補齊。這裡只從 `mysql.ts` 拿連線池，其餘自己來；測試要替身這一層就替身這一檔。
 *
 * 【壞資料的處置】
 * `result` 是伺服器算的 JSON，正常路徑寫不出壞的；但手動下 SQL、題庫改版把一支工具拿掉、
 * `ToolResult` 的形狀變過，都會讓一列讀不成 `ToolResult`。壞列**丟掉、其餘照讀**：一列壞不該
 * 讓整份清單 500，但也不能端出去 —— 一筆形狀不全的結果在清單上長得跟「做完了」一樣。
 * `child_snapshot` 壞掉只讓那一格變 `null`，結果本身照回。
 */

import { getPool } from './mysql';
import { TOOLKIT } from '../t2/toolkit';
import type { ToolResult } from '../t2/types';

/** 交卷當下孩子檔案的快照。欄位照 `Child`（`src/types.ts`），`ageMonth` 是交卷當天算的實足月齡。 */
export interface ChildSnapshot {
  name: string;
  birthDate: string | null;
  gender: string | null;
  ageMonth: number | null;
}

/** 表裡的一列，讀出來的形狀。 */
export interface ToolResultRecord {
  id: number;
  createdAt: string;
  childSnapshot: ChildSnapshot | null;
  result: ToolResult;
}

export async function insertToolResult(userId: number, childSnapshot: ChildSnapshot, result: ToolResult): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [res] = await p.execute(
    `INSERT INTO t2_tool_results
       (user_id, child_snapshot, tool_id, toolkit_version, assessed_age_month, rater, pre, answers, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      JSON.stringify(childSnapshot),
      result.toolId,
      result.toolkitVersion,
      result.assessedAgeMonth,
      result.rater,
      JSON.stringify(result.pre),
      JSON.stringify(result.answers),
      JSON.stringify(result),
    ],
  );
  return Number((res as { insertId: number }).insertId);
}

/** 這位家長的全部交卷，依寫入順序。壞列丟掉（檔頭）。 */
export async function listToolResults(userId: number): Promise<ToolResultRecord[]> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT id, child_snapshot, result, created_at
       FROM t2_tool_results
      WHERE user_id = ?
      ORDER BY id ASC`,
    [userId],
  );
  const out: ToolResultRecord[] = [];
  for (const row of rows as any[]) {
    const record = toolResultFromRow(row);
    if (record) out.push(record);
    else console.warn(`[T2] t2_tool_results 第 ${row?.id} 列讀不成 ToolResult，略過`);
  }
  return out;
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
 * 一列讀成 `ToolResult` 的最低要求：工具還在題庫裡、有計數與時間、五個物件欄位都在
 * （規則表的 `tags()` 會讀 `native`，缺了會讓整份清單 500）。不逐欄驗到底 —— 那是計分層的
 * 輸出，這裡只擋「根本不是一筆結果」的東西。
 */
function isToolResultShaped(x: unknown): x is ToolResult {
  if (!isObject(x)) return false;
  return typeof x.toolId === 'string'
    && Object.prototype.hasOwnProperty.call(TOOLKIT, x.toolId)
    && typeof x.askedCount === 'number'
    && typeof x.answeredCount === 'number'
    && typeof x.computedAt === 'string'
    && !Number.isNaN(Date.parse(x.computedAt))
    && isObject(x.sections)
    && isObject(x.overall)
    && isObject(x.native)
    && isObject(x.pre)
    && isObject(x.answers);
}

function snapshotFrom(raw: unknown): ChildSnapshot | null {
  const parsed = parseJson(raw);
  if (!isObject(parsed)) return null;
  return {
    name: typeof parsed.name === 'string' ? parsed.name : '',
    birthDate: typeof parsed.birthDate === 'string' ? parsed.birthDate : null,
    gender: typeof parsed.gender === 'string' ? parsed.gender : null,
    ageMonth: typeof parsed.ageMonth === 'number' ? parsed.ageMonth : null,
  };
}

/** mysql2 預設回 Date；開了 `dateStrings` 回 `'2026-09-12 01:00:05'`。讀不成時間回 `null`（那一列算壞的）。 */
function isoOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function toolResultFromRow(row: any): ToolResultRecord | null {
  const result = parseJson(row?.result);
  if (!isToolResultShaped(result)) return null;
  const createdAt = isoOf(row.created_at);
  if (createdAt === null) return null;
  return {
    id: Number(row.id),
    createdAt,
    childSnapshot: snapshotFrom(row.child_snapshot),
    result,
  };
}

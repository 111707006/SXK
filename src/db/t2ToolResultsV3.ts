/**
 * `t2_tool_results` 裡完整版題庫（`kit-20260923`）的那幾列（T2 v3 題庫規格 §6、§8 R3g）。
 *
 * 同一張表、不遷移（`toolkit_version` 本來就有、`tool_id` 放得下客規代碼）。規矩同 9/08 那一套（`t2ToolResults.ts` 檔頭）：
 * 每次交卷一筆、不覆蓋；讀的時候只讀這位家長、**只讀這個版本**；壞列丟掉、其餘照讀。
 * 兩套互不認得對方的列：舊的讀法看到這一版的列安靜略過，這裡只 SELECT 這一版。
 *
 * 欄位：`rater` 沿用五種填表人；`pre` 存作答情境（月齡、年級、上學、性別）—— 完整版沒有前置題。
 */

import { getPool } from './mysql';
import { isoOf, parseJson, snapshotFrom, type ChildSnapshot } from './t2ToolResults';
import { isKitV3Tool } from '../t2/kitv3';
import { TOOLKIT_VERSION_V3 } from '../t2/kitv3/types';
import type { ToolResultV3 } from '../t2/kitv3/submit';

export interface ToolResultRecordV3 {
  id: number;
  createdAt: string;
  childSnapshot: ChildSnapshot | null;
  result: ToolResultV3;
}

export async function insertToolResultV3(userId: number, childSnapshot: ChildSnapshot, result: ToolResultV3): Promise<number> {
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
      JSON.stringify(result.context),
      JSON.stringify(result.answers),
      JSON.stringify(result),
    ],
  );
  return Number((res as { insertId: number }).insertId);
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** 一列讀成 `ToolResultV3` 的最低要求：版本對、工具還在登錄表上、計分結果與作答都在、時間讀得成。 */
function isToolResultV3Shaped(x: unknown): x is ToolResultV3 {
  if (!isObject(x)) return false;
  return x.toolkitVersion === TOOLKIT_VERSION_V3
    && isKitV3Tool(x.toolId)
    && typeof x.assessedAgeMonth === 'number'
    && typeof x.computedAt === 'string'
    && !Number.isNaN(Date.parse(x.computedAt))
    && isObject(x.context)
    && isObject(x.answers)
    && isObject(x.score)
    && isObject(x.score.grade03)
    && Array.isArray(x.score.facets);
}

export function toolResultV3FromRow(row: any): ToolResultRecordV3 | null {
  const result = parseJson(row?.result);
  if (!isToolResultV3Shaped(result)) return null;
  const createdAt = isoOf(row.created_at);
  if (createdAt === null) return null;
  return { id: Number(row.id), createdAt, childSnapshot: snapshotFrom(row.child_snapshot), result };
}

/** 這位家長完整版的全部交卷，依寫入順序。 */
export async function listToolResultsV3(userId: number): Promise<ToolResultRecordV3[]> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT id, child_snapshot, result, created_at
       FROM t2_tool_results
      WHERE user_id = ? AND toolkit_version = ?
      ORDER BY id ASC`,
    [userId, TOOLKIT_VERSION_V3],
  );
  const out: ToolResultRecordV3[] = [];
  for (const row of rows as any[]) {
    const record = toolResultV3FromRow(row);
    if (record) out.push(record);
    else console.warn(`[T2] t2_tool_results 第 ${row?.id} 列讀不成完整版的結果，略過`);
  }
  return out;
}

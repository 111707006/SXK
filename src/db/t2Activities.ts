/**
 * 家長端讀活動庫（票 #59、#60，規格 v2 §7.1）。
 *
 * 【為什麼不直接用 `adminStore.listActivities`】
 * 形狀是同一個（兩邊都走 `activityFromRow`，那正是 `src/db/activities.ts` 存在的理由），
 * 但**取得連線的方式**不同：後台那一支在記憶體模式會丟「後台需要資料庫」，而家長端的
 * 每週活動在記憶體模式要能走完 —— 展示站沒有資料庫，配不到活動就是每個維度「準備中」，
 * 那是規格寫好的行為（§7.4），不是錯誤。
 *
 * 另一半理由與 `t2ToolResults.ts`、`t2Findings.ts` 相同：每一支替換掉資料層的 HTTP 測試
 * 都得把被替身的那個模組的匯出補齊。家長端的路徑不該因為後台多了一支函式而要跟著改替身。
 *
 * 【回的是整份，含停用與沒填 `targetMonth` 的】
 * 過濾是配對函式的事（`matchWeeklyActivities` 自己挑啟用中、`targetMonth` 非 null、
 * `avoidIf` 沒對上的）。在這裡先篩掉的話，配對就分不出「這個維度沒有活動」與
 * 「有活動但都被擋掉了」—— 而那兩件事在畫面上是同一句「準備中」、在後台是兩種待辦。
 */

import { getPool } from './mysql';
import { activityFromRow } from './activities';
import type { Activity } from '../t2/types';

/** 整份活動庫，含已停用的，依編號排序（A001 → A300）。沒有連線池時回空陣列（檔頭）。 */
export async function listActivityLibrary(): Promise<Activity[]> {
  const p = getPool();
  if (!p) return [];
  const [rows] = await p.execute('SELECT * FROM activities ORDER BY id ASC', []);
  return (rows as any[]).map(row => activityFromRow(row));
}

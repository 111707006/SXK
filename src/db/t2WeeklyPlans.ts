/**
 * `t2_weekly_plans` 的資料層（票 #60，規格 v2 §9.1）。
 *
 * 【這張表的規矩】
 * **一週一筆**：查的那週沒有就算一份存起來，之後同一週回同一份。所以這裡只有三支
 * ——「這一週有沒有」、「存一份」、「前 N 週派過哪些編號」—— 沒有 UPDATE。
 * 重算一次就可能換掉一支活動（配對對「前四週派過的」會扣分），而家長在同一週裡重整
 * 兩次頁面必須看到同一份。
 *
 * 【存的是編號，不是活動內容】
 * 那一列記的是 `{ picks: [{ id, dimension, reason }], preparing: [...] }`（見遷移檔檔頭）。
 * 標題、時長、器材、圖文步驟都留在活動庫 —— 內容團隊改完一支活動的步驟，家長這一週打開
 * 看到的就該是改好的版本。存進來等於給每一週複製一份活動庫。
 *
 * 【為什麼獨立一檔】
 * 與 `t2Findings.ts`、`t2ToolResults.ts` 同一個理由：每一支替換掉資料層的 HTTP 測試都得把
 * 被替身的模組的匯出補齊。
 *
 * 【壞資料的處置】
 * 那一列的 `activities` 讀不成形狀時，回**空的一份**（`picks: []`、`preparing: []`）而不是
 * `null`：`null` 會讓端點以為「這一週還沒算」而重算一份存進去，而唯一索引會擋下那次寫入 ——
 * 家長於是每次重整都拿到一個 500。空的一份在畫面上是「這一週還沒有安排」，可以自己過去。
 * 認不得的維度碼（詞彙改名後的舊列）只丟掉那一個，不丟整份。
 *
 * 每一支的 `reason` **驗到底**（`reasonFrom`）：畫面上那句「因為……所以練……」是它的四個欄位
 * 直接展開的，少一個欄位會在渲染時丟 TypeError，而 React 渲染丟出例外是整頁空白，不是少一支活動。
 */

import { getPool } from './mysql';
import { DIMENSION_CODES } from '../t2/types';
import type { DimensionCode } from '../t2/types';
import type { PickReason } from '../t2/activityMatch';

/** 存下來的一支：活動編號、為哪個維度挑的、為什麼。 */
export interface StoredPick {
  id: string;
  dimension: DimensionCode;
  reason: PickReason;
}

/** 一列的 `activities` 欄位。 */
export interface StoredWeeklyActivities {
  picks: StoredPick[];
  /** 有標記、但模組群裡連一支拿得到的活動都沒有的維度。畫面上是「準備中」。 */
  preparing: DimensionCode[];
}

/** 表裡的一列，讀出來的形狀。 */
export interface WeeklyPlanRecord {
  id: number;
  /** 這一週的星期一，`YYYY-MM-DD`。 */
  weekStart: string;
  findingsId: number;
  activities: StoredWeeklyActivities;
  /** 這一週是什麼時候算出來的。讀不成時間時是 `null`（不編一個日期）。 */
  createdAt: string | null;
}

export interface WeeklyPlanInsert {
  weekStart: string;
  findingsId: number;
  activities: StoredWeeklyActivities;
}

export async function insertWeeklyPlan(userId: number, input: WeeklyPlanInsert): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [res] = await p.execute(
    `INSERT INTO t2_weekly_plans (user_id, findings_id, week_start, activities)
     VALUES (?, ?, ?, ?)`,
    [userId, input.findingsId, input.weekStart, JSON.stringify(input.activities)],
  );
  return Number((res as { insertId: number }).insertId);
}

/** 這位家長這一週的那一筆；沒有回 `null`。 */
export async function findWeeklyPlan(userId: number, weekStart: string): Promise<WeeklyPlanRecord | null> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT id, findings_id, week_start, activities, created_at
       FROM t2_weekly_plans
      WHERE user_id = ? AND week_start = ?
      LIMIT 1`,
    [userId, weekStart],
  );
  const row = (rows as any[])[0];
  return row ? weeklyPlanFromRow(row) : null;
}

/**
 * 這一週**之前**最近的 N 週（新的在前）。配對拿它們的活動編號扣分（§7.3 第 2 條「四週內派過 −2」）。
 * 嚴格小於 `weekStart`：這一週自己不算「派過」—— 算的就是它。
 */
export async function recentWeeklyPlans(userId: number, weekStart: string, limit: number): Promise<WeeklyPlanRecord[]> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  // LIMIT 不能用預備語句的參數（MySQL 對 LIMIT ? 的支援視驅動設定而定），所以先轉成整數再內插。
  const take = Math.max(0, Math.floor(limit));
  const [rows] = await p.execute(
    `SELECT id, findings_id, week_start, activities, created_at
       FROM t2_weekly_plans
      WHERE user_id = ? AND week_start < ?
      ORDER BY week_start DESC
      LIMIT ${take}`,
    [userId, weekStart],
  );
  return (rows as any[]).map(weeklyPlanFromRow);
}

/** mysql2 對 JSON 欄位會先解析成物件；手動下 SQL 或替身給的可能還是字串。兩種都收。 */
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

const DIMENSION_SET: ReadonlySet<string> = new Set<string>(DIMENSION_CODES);

const BANDS: ReadonlySet<string> = new Set<string>(['clear', 'watch', 'refer']);

/**
 * `reason` 的四個欄位都要在、型別都要對。
 *
 * 【為什麼驗到底，不只驗「是個物件」】
 * 畫面上那句「因為……所以練……」是 `reason.band` 與 `reason.matchedTags[0]` 直接展開的
 *（`src/t2/weeklyCopy.ts`）。少一個欄位不會在這裡出事，會在**渲染時**丟 TypeError ——
 * 而 React 的渲染丟出例外會讓整個報告頁變成空白，不是少一支活動。
 * 這一層是唯一知道「這是從資料庫讀回來的、可能是舊形狀」的地方。
 */
function reasonFrom(raw: unknown): PickReason | null {
  if (!isObject(raw)) return null;
  if (typeof raw.band !== 'string' || !BANDS.has(raw.band)) return null;
  if (!isObject(raw.window) || typeof raw.window.lo !== 'number' || typeof raw.window.hi !== 'number') return null;
  if (!Array.isArray(raw.matchedTags) || raw.matchedTags.some(t => typeof t !== 'string')) return null;
  if (typeof raw.belowWindow !== 'boolean') return null;
  return {
    band: raw.band as PickReason['band'],
    window: { lo: raw.window.lo as number, hi: raw.window.hi as number },
    matchedTags: [...raw.matchedTags] as PickReason['matchedTags'],
    belowWindow: raw.belowWindow,
  };
}

/** 一筆 pick 的最低要求：有編號、維度認得、`reason` 四個欄位齊全（`reasonFrom`）。 */
function pickFrom(raw: unknown): StoredPick | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id === '') return null;
  if (typeof raw.dimension !== 'string' || !DIMENSION_SET.has(raw.dimension)) return null;
  const reason = reasonFrom(raw.reason);
  if (reason === null) return null;
  return { id: raw.id, dimension: raw.dimension as DimensionCode, reason };
}

function activitiesFrom(raw: unknown): StoredWeeklyActivities {
  const parsed = parseJson(raw);
  if (!isObject(parsed)) return { picks: [], preparing: [] };
  const picks = Array.isArray(parsed.picks)
    ? parsed.picks.map(pickFrom).filter((p): p is StoredPick => p !== null)
    : [];
  const preparing = Array.isArray(parsed.preparing)
    ? parsed.preparing.filter((d): d is DimensionCode => typeof d === 'string' && DIMENSION_SET.has(d))
    : [];
  return { picks, preparing };
}

/** `week_start` 是 DATE 欄位：mysql2 回 Date 或 `'2026-09-07'`。兩種都讀成 `YYYY-MM-DD`。 */
function dateOnly(raw: unknown): string {
  if (raw instanceof Date) {
    // DATE 欄位沒有時間，mysql2 以本地午夜組出 Date；用本地欄位取回日曆日，不經 UTC。
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw ?? '').slice(0, 10);
}

/**
 * `created_at` 讀不成時間時回 `null`，**不編一個日期**。
 * 這一欄只是「這一週是什麼時候算出來的」，讀不出來不影響這一週的活動；而編一個
 * （紀元、今天）會在畫面上變成一個看起來像真的、其實沒有來源的時間。
 */
function isoOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function weeklyPlanFromRow(row: any): WeeklyPlanRecord {
  return {
    id: Number(row.id),
    weekStart: dateOnly(row.week_start),
    findingsId: Number(row.findings_id),
    activities: activitiesFrom(row.activities),
    createdAt: isoOf(row.created_at),
  };
}

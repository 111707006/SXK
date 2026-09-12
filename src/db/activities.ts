/**
 * 一列 `activities` 讀成一支活動（#44，規格 v2 §7.1）。
 *
 * 【為什麼獨立一檔】
 * 後台（`src/admin/adminStore.ts`）與家長端的每週配對（#53／#60）都要讀這張表，
 * 而且必須讀成**同一種形狀** —— 各寫一份的話，兩邊對「這一列的 JSON 壞掉了」會有
 * 兩種處置，於是維護的人看著一支「0 步」的活動、家長那邊卻是一句讀取失敗。
 * 素材庫（`materialFromRow`）當初就是為了這件事放在 `mysql.ts` 共用的。
 *
 * 不放進 `mysql.ts`：這裡不碰連線池，只是純函式；而每一支替換掉 `src/db/mysql`
 * 的測試都得把那個檔案的匯出一個個補齊，純函式沒有理由跟著連線池一起被替身掉。
 * 也不從 `mysql.ts` 匯入任何東西，理由相同。
 *
 * 【壞資料的處置，與素材庫同一條規則】
 * 壞掉的 JSON 退回空陣列而不是拋例外：一支活動存壞不該讓整個活動庫讀不出來。
 * 標籤與維度**只留受控詞彙裡有的**：詞彙改名之後舊列帶著的舊字，讀出來就是不存在 ——
 * 配對永遠只看得到現行的字，後台重存一次就乾淨了。步驟是**全有或全無**：混進一則
 * 讀不成步驟的東西就整份退成空陣列，家長不會拿到一份少了中間某一步的訓練。
 */

import { ACTIVITY_TAGS, FINDING_TAGS } from '../t2/findingTags';
import type { ActivityTag, FindingTag } from '../t2/findingTags';
import { DIMENSION_CODES } from '../t2/types';
import type { Activity, ActivityStep, DimensionCode, ModuleNo } from '../t2/types';

export function activityFromRow(row: any): Activity {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    moduleNo: Number(row.module_no) as ModuleNo,
    targetMonth: row.target_month === null || row.target_month === undefined ? null : Number(row.target_month),
    ageMonths: { min: Number(row.age_min_month), max: Number(row.age_max_month) },
    dimensions: stringsIn(row.dimensions, DIMENSION_CODES as ReadonlyArray<string>) as DimensionCode[],
    targets: stringsIn(row.targets, ACTIVITY_TAGS as ReadonlyArray<string>) as ActivityTag[],
    avoidIf: stringsIn(row.avoid_if, FINDING_TAGS as ReadonlyArray<string>) as FindingTag[],
    durationMin: Number(row.duration_min ?? 0),
    equipment: toArray(row.equipment).filter((x): x is string => typeof x === 'string' && x !== ''),
    steps: parseSteps(row.steps),
    videoUrl: row.video_url ?? null,
    active: Number(row.active) === 1,
  };
}

/** JSON 陣列裡的字串，只留 `allowed` 裡有的，順序照原列、不重複。 */
function stringsIn(raw: unknown, allowed: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  for (const x of toArray(raw)) {
    if (typeof x === 'string' && allowed.includes(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

function parseSteps(raw: unknown): ActivityStep[] {
  const parsed = toArray(raw);
  return parsed.every(isStepShaped) ? (parsed as ActivityStep[]) : [];
}

/** mysql2 對 JSON 欄位會先解析成物件；手動下 SQL 或替身給的可能還是字串。兩種都收。 */
function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isStepShaped(step: unknown): boolean {
  if (!step || typeof step !== 'object') return false;
  const { imageUrl, instruction } = step as Record<string, unknown>;
  return typeof imageUrl === 'string' && imageUrl !== ''
    && typeof instruction === 'string' && instruction !== '';
}

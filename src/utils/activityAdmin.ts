/**
 * 活動庫標記頁的純函式（#62，規格 v2 §7.4）—— 不碰 React、不碰資料庫。
 *
 * 【這一頁在做什麼】
 * 活動庫的 300 支種子全部 `targetMonth = null`（§7.4 的內容缺口）。沒填的活動**配不到**
 * （`activityMatch.ts`），所以上線當天每個維度都是「準備中」。這一頁讓內容團隊一支一支填：
 * `targetMonth`、`targets`、`dimensions`、`avoidIf`、啟用，加上圖文步驟與示範連結。
 *
 * 【三件事】
 * - `activityCoverage`：四個進度數字（沿用退場的素材庫分頁的作法）。總數／已填 targetMonth／
 *   已填 targets／已啟用 —— 四個各自代表一件事，混在一起就沒有一個是可信的。
 * - `filterActivities`：模組、維度、「還沒填 targetMonth」三個篩選。第三個是這一頁存在的理由。
 * - `readActivityPatch`：把 PATCH 的內容讀成一筆局部更新，讀不出來就說是哪裡不對。
 *
 * 【為什麼是 PATCH 不是 PUT】
 * 退場的素材庫一格是整筆覆寫 —— 一格素材是一次建好的。活動不是：300 支已經在
 * 表裡，內容團隊今天填 targetMonth、下週貼標籤、圖文可能永遠不補。整筆覆寫等於每次儲存都要把
 * 十個欄位一起送回來，前端漏送一個就悄悄清掉一個。局部更新：**帶了才改，沒帶不動**。
 *
 * 【`targets` 只認 ★】
 * `Activity.targets` 的型別是 `ActivityTag`（§5.5 的 ★）。貼一個只進報告的標籤（「慢熱型」）
 * 進去，型別擋不住 JSON，配對拿它去對孩子的 ★ 標籤永遠對不上，而畫面上看不出來。這裡整筆退回，
 * 錯誤訊息點名是哪個字。`avoidIf` 對的是孩子的全部標籤，所以認全部 57 個。
 */

import { ACTIVITY_TAGS, FINDING_TAGS } from '../t2/findingTags';
import type { ActivityTag, FindingTag } from '../t2/findingTags';
import { DIMENSION_CODES } from '../t2/types';
import type { Activity, ActivityStep, DimensionCode, ModuleNo } from '../t2/types';
import { isAllowedAssetUrl, assetUrlError } from './assetUrl';
import { readSteps } from './activitySteps';

// ══════════════════════════════════════════════
// 進度與篩選
// ══════════════════════════════════════════════

export interface ActivityCoverage {
  total: number;
  /** `targetMonth !== null` 的支數。這是配對真正吃的欄位，沒填就配不到。 */
  targetMonthFilled: number;
  /** `targets` 非空的支數。沒貼標籤的活動仍配得到（只靠模組對維度），只是拿不到 ★ 加分。 */
  targetsFilled: number;
  active: number;
}

export function activityCoverage(activities: ReadonlyArray<Activity>): ActivityCoverage {
  return {
    total: activities.length,
    targetMonthFilled: activities.filter(a => a.targetMonth !== null).length,
    targetsFilled: activities.filter(a => a.targets.length > 0).length,
    active: activities.filter(a => a.active).length,
  };
}

export interface ActivityFilter {
  moduleNo: ModuleNo | null;
  dimension: DimensionCode | null;
  missingTargetMonth: boolean;
}

export function filterActivities(activities: ReadonlyArray<Activity>, filter: ActivityFilter): Activity[] {
  return activities.filter(
    a =>
      (filter.moduleNo === null || a.moduleNo === filter.moduleNo)
      && (filter.dimension === null || a.dimensions.includes(filter.dimension))
      && (!filter.missingTargetMonth || a.targetMonth === null)
  );
}

// ══════════════════════════════════════════════
// 收下一筆局部更新
// ══════════════════════════════════════════════

/**
 * 可以填的欄位。`id`、`moduleNo`、`ageMonths` **不在其中**：編號是主鍵；模組由編號算出
 * （`ceil(編號 / 20)`，§7.2），改了它等於把活動搬到別的模組群而編號還留在原處；
 * `ageMonths` 是原型解析出來的硬閘，不是要人填的。
 */
export interface ActivityPatch {
  title?: string;
  targetMonth?: number | null;
  dimensions?: DimensionCode[];
  targets?: ActivityTag[];
  avoidIf?: FindingTag[];
  durationMin?: number;
  equipment?: string[];
  steps?: ActivityStep[];
  videoUrl?: string | null;
  active?: boolean;
}

export type ActivityPatchResult =
  | { ok: true; patch: ActivityPatch }
  | { ok: false; error: string };

/**
 * `targetMonth` 的上限：18 歲。原型的適齡最寬到「6岁以上」，`ALL_AGES.max` 是 216；
 * 填一個超過它的數字多半是把「歲」打成「月」了。
 */
export const MAX_TARGET_MONTH = 216;

const MAX_TITLE = 128;
const MAX_URL = 512;
const MAX_EQUIPMENT_ITEM = 64;
const MAX_EQUIPMENT_ITEMS = 20;
/** 一支活動不會用到幾個小時；超過這個數多半是把秒打成分。 */
const MAX_DURATION_MIN = 180;

function fail(error: string): ActivityPatchResult {
  return { ok: false, error };
}

/**
 * 從請求的一串字裡，只留 `allowed` 裡有的，**照 `allowed` 的順序**、不重複。
 * 有任何一個不在裡面就整筆退回，並把那個字說出來 —— 靜靜丟掉的話，維護的人以為貼上了。
 */
function readTagList<T extends string>(
  raw: unknown,
  allowed: ReadonlyArray<T>,
  what: string,
  hint: string
): { ok: true; list: T[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: `${what}必须是一个阵列。` };
  const set = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string' || !(allowed as ReadonlyArray<string>).includes(x)) {
      return { ok: false, error: `${what}里的「${String(x)}」${hint}` };
    }
    set.add(x);
  }
  return { ok: true, list: allowed.filter(t => set.has(t)) };
}

function isNonNegativeInt(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

export function readActivityPatch(body: unknown): ActivityPatchResult {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const patch: ActivityPatch = {};

  if ('title' in raw) {
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : '';
    if (!title) return fail('请填写活动标题。');
    patch.title = title;
  }

  if ('targetMonth' in raw) {
    if (raw.targetMonth === null) patch.targetMonth = null;
    else if (isNonNegativeInt(raw.targetMonth, MAX_TARGET_MONTH)) patch.targetMonth = raw.targetMonth;
    else return fail(`目标月龄必须是 0 到 ${MAX_TARGET_MONTH} 的整数（单位是月，不是岁），或留空。`);
  }

  if ('dimensions' in raw) {
    const r = readTagList(raw.dimensions, DIMENSION_CODES, '维度', '不是九个维度代码之一。');
    if (!r.ok) return fail(r.error);
    if (r.list.length === 0) return fail('至少要选一个维度。');
    patch.dimensions = r.list;
  }

  if ('targets' in raw) {
    const r = readTagList(raw.targets, ACTIVITY_TAGS, '练什么（targets）', '不是可配活动的 ★ 标签。只进报告的标签不能贴在活动上。');
    if (!r.ok) return fail(r.error);
    patch.targets = r.list;
  }

  if ('avoidIf' in raw) {
    const r = readTagList(raw.avoidIf, FINDING_TAGS, '回避条件（avoidIf）', '不是登录过的发现标签。');
    if (!r.ok) return fail(r.error);
    patch.avoidIf = r.list;
  }

  if ('durationMin' in raw) {
    if (!isNonNegativeInt(raw.durationMin, MAX_DURATION_MIN)) {
      return fail(`时长必须是 0 到 ${MAX_DURATION_MIN} 的整数（分钟）。`);
    }
    patch.durationMin = raw.durationMin;
  }

  if ('equipment' in raw) {
    if (!Array.isArray(raw.equipment) || raw.equipment.some(x => typeof x !== 'string')) {
      return fail('器材必须是字串阵列。');
    }
    const items = (raw.equipment as string[]).map(x => x.trim().slice(0, MAX_EQUIPMENT_ITEM)).filter(Boolean);
    if (items.length > MAX_EQUIPMENT_ITEMS) return fail(`器材最多 ${MAX_EQUIPMENT_ITEMS} 项。`);
    patch.equipment = items;
  }

  if ('steps' in raw) {
    // 圖的網址、上限、每步有圖有字，見 `activitySteps.ts`；零步是合法的 —— 種子就是零步。
    const r = readSteps(raw.steps);
    if (!r.ok) return fail(r.error);
    patch.steps = r.steps;
  }

  if ('videoUrl' in raw) {
    if (raw.videoUrl === null) patch.videoUrl = null;
    else if (typeof raw.videoUrl !== 'string') return fail(assetUrlError('示范链接'));
    else {
      const url = raw.videoUrl.trim().slice(0, MAX_URL);
      if (!url) patch.videoUrl = null;
      else if (!isAllowedAssetUrl(url)) return fail(assetUrlError('示范链接'));
      else patch.videoUrl = url;
    }
  }

  if ('active' in raw) {
    if (typeof raw.active !== 'boolean') return fail('启用状态必须是 true 或 false。');
    patch.active = raw.active;
  }

  if (Object.keys(patch).length === 0) return fail('没有要更新的栏位。');
  return { ok: true, patch };
}

// ══════════════════════════════════════════════
// 畫面：只送改過的欄位
// ══════════════════════════════════════════════

const PATCH_KEYS: ReadonlyArray<keyof ActivityPatch> = [
  'title', 'targetMonth', 'dimensions', 'targets', 'avoidIf',
  'durationMin', 'equipment', 'steps', 'videoUrl', 'active',
];

/**
 * 編輯畫面存檔時，`edited` 與 `original` 之間**改過的欄位**。一個都沒改回空物件（畫面據此
 * 不送請求）。陣列與步驟用 JSON 比較 —— 順序也是資料的一部分（步驟的順序就是做的順序）。
 *
 * 為什麼不整筆送：PATCH 的意義是「帶了才改」，畫面若把十個欄位全送回去，那意義就只剩形式；
 * 而且 300 支裡多半只填一格月齡，送整筆等於每一次都把種子的空陣列再寫一遍。
 */
export function changedFields(original: Activity, edited: Activity): ActivityPatch {
  const patch: ActivityPatch = {};
  for (const key of PATCH_KEYS) {
    const a = original[key];
    const b = edited[key];
    const same = Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
    if (!same) (patch as Record<string, unknown>)[key] = b;
  }
  return patch;
}

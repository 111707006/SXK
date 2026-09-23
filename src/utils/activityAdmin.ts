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
 *
 * 【內容欄位（Keep 規格 K17，2026-09-23）】
 * 手冊那張卡的原文（適齡、人物配置、需要什么、练什么、简单／难一点、小提醒、想深入练）、
 * 模組一的腳本、示範片的封面與片長，一樣「帶了才改」。三條不一樣的規則：
 * - **適齡改了連帶改硬閘**：`ageMonths` 由適齡原文解析（規格 §4.1），不能直接送。只改字不改硬閘，
 *   家長看到「适合 3–6岁」而七歲的孩子照樣配得到。
 * - **文字清掉存空字串**，不是 `NULL`：遷移重跑只填 `NULL`（`2026-09-23-activity-content.sql`），
 *   清掉的不會被客戶原文填回來。
 * - **腳本不能整份刪掉**，同一個理由：刪掉就是 `NULL`，下一次跑遷移又回來了。要改哪一段就改哪一段。
 */

import { ACTIVITY_TAGS, FINDING_TAGS } from '../t2/findingTags';
import type { ActivityTag, FindingTag } from '../t2/findingTags';
import { DIMENSION_CODES } from '../t2/types';
import type { Activity, ActivityStep, DimensionCode, ModuleNo } from '../t2/types';
import type { ActivityGuide } from '../t2/types';
import { parseAgeRange } from '../t2/activitySeed';
import { isAllowedAssetUrl, assetUrlError } from './assetUrl';
import { readSteps } from './activitySteps';
import { readGuide } from './activityGuide';

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
 * 可以填的欄位。`id`、`moduleNo` **不在其中**：編號是主鍵；模組由編號算出
 * （`ceil(編號 / 20)`，§7.2），改了它等於把活動搬到別的模組群而編號還留在原處。
 * `ageMonths` 在這裡，但**不收請求送來的**：它是適齡原文解析出來的硬閘，只跟著 `ageLabel` 一起出現。
 */
export interface ActivityPatch {
  title?: string;
  targetMonth?: number | null;
  ageLabel?: string;
  /** 只由 `ageLabel` 解析而來（檔頭）。 */
  ageMonths?: { min: number; max: number };
  people?: string;
  dimensions?: DimensionCode[];
  targets?: ActivityTag[];
  avoidIf?: FindingTag[];
  durationMin?: number;
  equipment?: string[];
  need?: string;
  trains?: string;
  steps?: ActivityStep[];
  easier?: string;
  harder?: string;
  tip?: string;
  deeper?: string;
  guide?: ActivityGuide;
  videoUrl?: string | null;
  posterUrl?: string | null;
  videoSeconds?: number | null;
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

/** 示範片最長一小時。客戶的片子十秒、腳本寫的成片兩三分鐘；超過多半是把毫秒打成秒。 */
export const MAX_VIDEO_SECONDS = 3600;

/** 適齡原文的上限＝`age_label` 的欄寬。匯出給編輯畫面，兩邊說同一個數。 */
export const MAX_AGE_LABEL = 32;

/**
 * 手冊文字欄位的上限，也是它在畫面上的名稱。上限＝資料表的欄寬（VARCHAR 以字元計；
 * TEXT 那三欄給一千字，客戶最長的一段不到八十字）。**超過整筆退回，不截斷**：截掉的是客戶的原文。
 */
export const CONTENT_TEXT_FIELDS: ReadonlyArray<{
  key: 'people' | 'need' | 'trains' | 'easier' | 'harder' | 'tip' | 'deeper';
  name: string;
  max: number;
}> = [
  { key: 'people', name: '人物配置', max: 16 },
  { key: 'need', name: '需要什么', max: 255 },
  { key: 'trains', name: '练什么', max: 255 },
  { key: 'easier', name: '简单', max: 1000 },
  { key: 'harder', name: '难一点', max: 1000 },
  { key: 'tip', name: '小提醒', max: 1000 },
  { key: 'deeper', name: '想深入练', max: 255 },
];

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
    // 指令必填、圖選填（ADR-0008）、有圖時驗網址、上限，見 `activitySteps.ts`；零步是合法的 —— 種子就是零步。
    const r = readSteps(raw.steps);
    if (!r.ok) return fail(r.error);
    patch.steps = r.steps;
  }

  if ('videoUrl' in raw) {
    const r = readUrl(raw.videoUrl, '示范链接');
    if (!r.ok) return fail(r.error);
    patch.videoUrl = r.url;
  }

  if ('posterUrl' in raw) {
    const r = readUrl(raw.posterUrl, '示范片封面');
    if (!r.ok) return fail(r.error);
    patch.posterUrl = r.url;
  }

  if ('videoSeconds' in raw) {
    if (raw.videoSeconds === null) patch.videoSeconds = null;
    else if (isNonNegativeInt(raw.videoSeconds, MAX_VIDEO_SECONDS) && raw.videoSeconds > 0) patch.videoSeconds = raw.videoSeconds;
    else return fail(`示范片长度必须是 1 到 ${MAX_VIDEO_SECONDS} 的整数（秒），或留空。`);
  }

  if ('ageLabel' in raw) {
    const label = typeof raw.ageLabel === 'string' ? raw.ageLabel.trim() : '';
    if (!label) return fail('请填写适龄（例：「3–8岁」「6个月–3岁」「全龄」）。');
    if (label.length > MAX_AGE_LABEL) return fail(`适龄最多 ${MAX_AGE_LABEL} 字。`);
    try {
      patch.ageMonths = parseAgeRange(label);
    } catch {
      return fail(`看不懂适龄「${label}」。写法：「3–8岁」「6个月–3岁」「全龄」。`);
    }
    patch.ageLabel = label;
  }

  for (const { key, name, max } of CONTENT_TEXT_FIELDS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (value !== null && typeof value !== 'string') return fail(`「${name}」必须是文字。`);
    const text = (value ?? '').trim();
    if (text.length > max) return fail(`「${name}」最多 ${max} 字，目前有 ${text.length} 字。`);
    patch[key] = text;
  }

  if ('guide' in raw) {
    // 不能整份刪掉：刪掉就是 NULL，而遷移重跑會把 NULL 的腳本填回客戶原文（檔頭）。
    if (raw.guide === null) return fail('脚本不能整份删除；要改哪一段就改哪一段。');
    const r = readGuide(raw.guide);
    if (!r.ok) return fail(r.error);
    patch.guide = r.guide;
  }

  if ('active' in raw) {
    if (typeof raw.active !== 'boolean') return fail('启用状态必须是 true 或 false。');
    patch.active = raw.active;
  }

  if (Object.keys(patch).length === 0) return fail('没有要更新的栏位。');
  return { ok: true, patch };
}

/** 示範連結與封面共用：`null` 與空字串是清掉；其餘必須是 `https://` 或站內 `/…`。 */
function readUrl(raw: unknown, what: string): { ok: true; url: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, url: null };
  if (typeof raw !== 'string') return { ok: false, error: assetUrlError(what) };
  const url = raw.trim().slice(0, MAX_URL);
  if (!url) return { ok: true, url: null };
  if (!isAllowedAssetUrl(url)) return { ok: false, error: assetUrlError(what) };
  return { ok: true, url };
}

// ══════════════════════════════════════════════
// 畫面：只送改過的欄位
// ══════════════════════════════════════════════

/** 畫面可以送的欄位。`ageMonths` 不在其中：它由伺服器從 `ageLabel` 解析（`readActivityPatch`）。 */
const PATCH_KEYS: ReadonlyArray<Exclude<keyof ActivityPatch, 'ageMonths'>> = [
  'title', 'targetMonth', 'ageLabel', 'people', 'dimensions', 'targets', 'avoidIf',
  'durationMin', 'equipment', 'need', 'trains', 'steps', 'easier', 'harder', 'tip', 'deeper', 'guide',
  'videoUrl', 'posterUrl', 'videoSeconds', 'active',
];

/**
 * 編輯畫面存檔時，`edited` 與 `original` 之間**改過的欄位**。一個都沒改回空物件（畫面據此
 * 不送請求）。陣列、步驟與腳本用 JSON 比較 —— 順序也是資料的一部分（步驟的順序就是做的順序）；
 * 腳本兩邊都經過 `normalizeGuide`（讀進來時與畫面組回去時），鍵的順序相同才比得準。
 *
 * 為什麼不整筆送：PATCH 的意義是「帶了才改」，畫面若把十個欄位全送回去，那意義就只剩形式；
 * 而且 300 支裡多半只填一格月齡，送整筆等於每一次都把種子的空陣列再寫一遍。
 */
export function changedFields(original: Activity, edited: Activity): ActivityPatch {
  const patch: ActivityPatch = {};
  for (const key of PATCH_KEYS) {
    const a = original[key];
    const b = edited[key];
    const structured = (v: unknown) => v !== null && typeof v === 'object';
    const same = structured(a) || structured(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
    if (!same) (patch as Record<string, unknown>)[key] = b;
  }
  return patch;
}

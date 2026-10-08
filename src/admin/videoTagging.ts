/**
 * 後台「示范片与标签」分頁的純函式（使用者 2026-10-08：客戶自己在後台傳 300 支片、給片子下標籤；
 * 「不要用 JSON，要給非技術人員用」）。標籤＝現有那套「练什么」（★ 可配活動的標籤）＋目標月齡；
 * 有後台帳號就能標，不另設審核。
 *
 * 畫面在 `panels/VideoTaggingPanel.tsx`；這裡只有算的部分，測試在 `test/videoTagging.test.ts`。
 */

import type { Activity } from '../t2/types';
import { MAX_TARGET_MONTH } from '../utils/activityAdmin';

/**
 * 從檔名認活動編號。客戶的檔名可能是 `A001.mp4`、`a1.mp4`、`A001-我们来爬行.mp4`、`001 我们来爬行.mp4`。
 * 認的是「A 加 1–3 位數字」或「開頭 1–3 位數字」，補成三位；認不出、或超過 300 的回 null（畫面列出來請人改檔名）。
 */
export function activityIdFromFileName(name: string, maxId = 300): string | null {
  const base = name.replace(/\.[^.]+$/, '');
  const m = /(?:^|[^A-Za-z])[Aa](\d{1,3})(?!\d)/.exec(base) ?? /^\s*(\d{1,3})(?!\d)/.exec(base);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > maxId) return null;
  return `A${String(n).padStart(3, '0')}`;
}

/** 月齡 → 「1 岁 6 个月」這種給人看的說法。 */
export function monthText(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} 个月`;
  return m === 0 ? `${y} 岁` : `${y} 岁 ${m} 个月`;
}

/** 下拉選單的選項：0–216 個月，每一個都附「幾歲幾個月」。 */
export function monthOptions(): Array<{ value: number; label: string }> {
  return Array.from({ length: MAX_TARGET_MONTH + 1 }, (_, m) => ({ value: m, label: `${m} 个月（${monthText(m)}）` }));
}

/**
 * 手冊適齡給的建議目標月齡：適齡區間（`ageMonths`，由手冊適齡原文解析）的中間，取整數。
 * 只是建議 —— 存進去的永遠是人選的那一個。
 */
export function suggestedTargetMonth(ageMonths: { min: number; max: number }): number {
  return Math.min(MAX_TARGET_MONTH, Math.round((ageMonths.min + Math.min(ageMonths.max, MAX_TARGET_MONTH)) / 2));
}

/** 手冊適齡的說法：有原文用原文，沒有（種子還沒填內容）就用解析出來的區間。 */
export function ageRangeText(a: Pick<Activity, 'ageLabel' | 'ageMonths'>): string {
  return a.ageLabel || `${monthText(a.ageMonths.min)}–${monthText(a.ageMonths.max)}`;
}

/** 一支活動標到哪裡了。 */
export type TaggingState = 'no_video' | 'untagged' | 'done';

/** 有片才談得上標；月齡與「练什么」都填了才算標好。 */
export function taggingState(a: Pick<Activity, 'videoUrl' | 'targetMonth' | 'targets'>): TaggingState {
  if (!a.videoUrl) return 'no_video';
  return a.targetMonth !== null && a.targets.length > 0 ? 'done' : 'untagged';
}

export const TAGGING_STATE_LABEL: Record<TaggingState, string> = {
  no_video: '还没有片',
  untagged: '有片，还没标好',
  done: '已标好',
};

export type TaggingFilter = 'all' | TaggingState;

export interface TaggingProgress {
  total: number;
  withVideo: number;
  done: number;
}

export function taggingProgress(activities: ReadonlyArray<Activity>): TaggingProgress {
  return {
    total: activities.length,
    withVideo: activities.filter(a => a.videoUrl).length,
    done: activities.filter(a => taggingState(a) === 'done').length,
  };
}

/** 篩選＋搜尋（編號或名稱，不分大小寫）。順序照編號。 */
export function filterForTagging(activities: ReadonlyArray<Activity>, filter: TaggingFilter, query: string): Activity[] {
  const q = query.trim().toLowerCase();
  return activities
    .filter(a => filter === 'all' || taggingState(a) === filter)
    .filter(a => !q || a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q))
    .sort((x, y) => x.id.localeCompare(y.id));
}

/** 存完之後跳到哪一支：清單裡這一支的下一支；沒有了回 null。 */
export function nextActivityId(list: ReadonlyArray<Pick<Activity, 'id'>>, currentId: string): string | null {
  const i = list.findIndex(a => a.id === currentId);
  return i >= 0 && i + 1 < list.length ? list[i + 1].id : null;
}

/** 一批上傳裡的一個檔案。 */
export interface UploadItem {
  file: File;
  activityId: string | null;
  status: 'waiting' | 'uploading' | 'done' | 'failed' | 'skipped';
  progress: number;
  message: string | null;
}

/**
 * 一批檔案 → 上傳清單。認不出編號的、活動庫沒有的、同一批裡同一個編號第二次出現的，標 `skipped` 並說明，不上傳。
 * 不是 mp4 的也不上傳（伺服器只收 mp4）。
 */
export function planUploads(files: ReadonlyArray<File>, existingIds: ReadonlySet<string>): UploadItem[] {
  const seen = new Set<string>();
  return files.map(file => {
    const activityId = activityIdFromFileName(file.name);
    const skip = (message: string): UploadItem => ({ file, activityId, status: 'skipped', progress: 0, message });
    if (!/\.mp4$/i.test(file.name)) return skip('只收 mp4 档');
    if (!activityId) return skip('档名里认不出活动编号（请改成 A001.mp4 这样）');
    if (!existingIds.has(activityId)) return skip(`活动库里没有 ${activityId}`);
    if (seen.has(activityId)) return skip(`同一批里 ${activityId} 出现了两次，只传第一个`);
    seen.add(activityId);
    return { file, activityId, status: 'waiting', progress: 0, message: null };
  });
}

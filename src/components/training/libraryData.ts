/**
 * 示範片庫的資料整形（Keep 規格 §3.9）。純函式，不碰 fetch、不碰 React。
 *
 * 片庫裡有哪幾支是伺服器挑的（`GET /api/t2/library`：有示範片的啟用活動、依編號排，
 * `src/t2/libraryRoutes.ts` 的 `libraryEntries`）；這一檔只分組、篩選、標出本週與換著玩。
 *
 * 【孩子的月齡】篩選用的是每週活動回應的 `ageMonth`——配對用的實足月齡，與「每周排进计划的，只会是
 * 适合{孩子名}现在月龄的活动」那一句講的是同一個月齡（報告的測評月齡可能比它小）。
 */

import type { LibraryEntry } from '../../t2/libraryRoutes';
import type { ModuleNo } from '../../t2/types';
import { ageFit, findInPlan, type WeeklyPlanResponse } from './trainingData';

/** 三個篩選：全部／適合{孩子名}現在／再大一點。 */
export const LIBRARY_FILTERS = ['all', 'fit', 'later'] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/**
 * 適合孩子現在：適齡區間含孩子的實足月齡（頭尾都算）。與詳情的年齡提醒同一個比法（`ageFit`，票 7）。
 */
export function fitsNow(entry: Pick<LibraryEntry, 'ageMonths'>, ageMonth: number): boolean {
  return ageFit(entry.ageMonths, ageMonth) === 'fits';
}

/**
 * 再大一點：適齡從孩子現在的月齡以後才開始的（`ageFit` 的 `tooYoung`）。**比孩子小的不算**（§3.9 寫的是
 * 「再大一點」，不是「不適合現在」）——那幾支只在「全部」裡。
 */
function forLater(entry: Pick<LibraryEntry, 'ageMonths'>, ageMonth: number): boolean {
  return ageFit(entry.ageMonths, ageMonth) === 'tooYoung';
}

export function filterLibrary<T extends Pick<LibraryEntry, 'ageMonths'>>(
  entries: ReadonlyArray<T>,
  filter: LibraryFilter,
  ageMonth: number,
): T[] {
  if (filter === 'fit') return entries.filter(e => fitsNow(e, ageMonth));
  if (filter === 'later') return entries.filter(e => forLater(e, ageMonth));
  return [...entries];
}

export interface ModuleGroup<T> {
  moduleNo: ModuleNo;
  entries: T[];
}

/** 依模組分組：模組由小到大，組內照原本的順序（伺服器依編號排好的）。 */
export function groupByModule<T extends Pick<LibraryEntry, 'moduleNo'>>(entries: ReadonlyArray<T>): Array<ModuleGroup<T>> {
  const groups = new Map<ModuleNo, T[]>();
  for (const e of entries) groups.set(e.moduleNo, [...(groups.get(e.moduleNo) ?? []), e]);
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([moduleNo, list]) => ({ moduleNo, entries: list }));
}

/**
 * 這一支在不在本週的四支（`plan`）或換著玩（`swap`）裡；都不在、或沒有每週活動是 `null`。
 * 與詳情「为什么这周排这一个」同一個認法（`findInPlan`，票 7）。
 */
export function libraryMark(id: string, plan: WeeklyPlanResponse | null): 'plan' | 'swap' | null {
  const place = findInPlan(plan, id);
  if (place.pick) return 'plan';
  if (place.swapDimension) return 'swap';
  return null;
}

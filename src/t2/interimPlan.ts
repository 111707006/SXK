/**
 * T2 題量的**暫行規則**（使用者 2026-09-29）：「補測與加測先隱藏起來，之後會給一個表單，每個維度每個年齡只測一個；
 * 表單還沒給之前先放一個，必做就好，其他不用。」
 *
 * 所以在那份表來之前，家長看到的安排是：**每個被 T1 標記（紅或黃）、這個月齡有評的維度，只做一份** —— 就是規則表裡
 * 那個維度的星號工具（`routeFor(...).star`），一律列為必做。選做、之後可能加測、補充問卷（只出標籤的）、
 * 診斷方向多加的工具都先不出。
 *
 * 規則引擎本身（`planT2`，規格 v2.1 §4.2）**一行不改**：它的測試逐格對著客戶的規格，表來了要改的也是它。
 * 這一層只在 `GET /api/t2/plan` 回給畫面之前套上去（兩個畫面 —— 入口與逐份作答 —— 都只讀那一支）。
 * 表來了之後：照新表改 `routing.ts` 的路由表，並把 `SINGLE_FORM_PER_DIMENSION` 設成 `false`（或整檔刪掉）。
 *
 * 判定不受影響：報告的維度狀態看 T1 標記與星號工具有沒有做完（`findings.ts`），與這裡列不列選做無關；
 * 黃燈維度那一份沒做，報告照舊寫「沒做」而不是「沒事」。
 */
import { notScreened, routeFor } from './routing';
import { DIMENSION_CODES, type DimensionCode, type PlanItem, type T1Flag, type T2Plan, type ToolId } from './types';

export const SINGLE_FORM_PER_DIMENSION = true;

/** 把 `planT2` 的結果收成「每個被標記的維度一份、全部必做」。回傳新物件，不改傳進來的那一份。 */
export function singleFormPlan(plan: T2Plan, t1Flags: Readonly<Record<DimensionCode, T1Flag>>): T2Plan {
  const starFor = new Map<ToolId, DimensionCode[]>();
  for (const d of DIMENSION_CODES) {
    if (t1Flags[d] === 0 || notScreened(d, plan.ageMonth)) continue;
    const { star } = routeFor(d, plan.ageMonth);
    if (star === null) continue;
    const dims = starFor.get(star) ?? [];
    dims.push(d);
    starFor.set(star, dims);
  }

  // 保留 planT2 的先後（必做在前、選做在後）；一支工具是好幾個維度的星號時仍是一份
  const required: PlanItem[] = [...plan.required, ...plan.optional]
    .filter(item => starFor.has(item.toolId))
    .map(item => ({ ...item, role: 'required', forDimensions: [...starFor.get(item.toolId)!] }));

  return {
    ageMonth: plan.ageMonth,
    required,
    optional: [],
    followup: [],
    extras: [],
    noTool: [...plan.noTool],
    estimatedItems: { required: required.reduce((n, i) => n + i.askedCount, 0), optional: 0, followup: 0 },
    functionOrder: plan.functionOrder ? [...plan.functionOrder] : null,
  };
}

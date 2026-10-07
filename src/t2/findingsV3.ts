/**
 * 完整版題庫的報告快照 `T2FindingsV3`（T2 v3 題庫規格 §5.2）。純函式。
 *
 * 與 9/08 的 `T2Findings`（`findings.ts`）是兩個形狀，靠 `toolkitVersion` 分流：舊快照照存的樣子讀，新的走這一個。
 * 同一個哲學：家長按「生成」時拍一張，寫下後不改；報告、活動、目標只讀它，不回頭讀原始答案。
 *
 * 多記兩樣舊的沒有的：
 * - `recommended`：這一次推薦引擎推了哪些（§5.1「判定讀快照，不讀當下重算的推薦」）；
 * - `notices`：報告最上方要出一句的情形（TIC 的轉介旗標、EMO 功能影響高、ASQ3 轉介……），照工具給的旗標收集。
 *
 * 「近 3 個月」＝ 90 天（R-29 暫採）：引擎的「做過了」與報告收哪幾筆用同一個。
 */

import { judgeDimensionsV3, type DimensionFindingV3 } from './judgeV3';
import type { ToolResultV3 } from './kitv3/submit';
import { TOOLKIT_VERSION_V3, type ToolkitVersionV3 } from './kitv3/types';
import type { DimensionCode, T1Flag } from './types';

export const RULES_VERSION_V3 = 'v3-2026-10-07' as const;
export const RECENT_DAYS = 90;

export interface T2FindingsV3 {
  version: 4;
  toolkitVersion: ToolkitVersionV3;
  rulesVersion: typeof RULES_VERSION_V3;
  child: { assessedAgeMonth: number; sex?: 'boy' | 'girl' };
  t1: Record<DimensionCode, T1Flag>;
  /** 這一次推薦引擎推的量表（客規代碼）。 */
  recommended: string[];
  /** 九個都在，順序照 `DIMENSION_CODES`。 */
  dimensions: DimensionFindingV3[];
  /** 算進來的結果：每支最新一筆、近 90 天內，依交卷順序。 */
  toolResults: ToolResultV3[];
  /** 報告最上方要出一句的情形：哪一支、哪一個旗標。 */
  notices: Array<{ toolId: string; flag: string }>;
  computedAt: string;
}

/** 報告最上方要講的旗標（其餘旗標只進後台）。 */
export const NOTICE_FLAGS: ReadonlyArray<string> = ['refer', 'priority', 'regression', 'impact_high', 'insufficient', 'too_many_na'];

/** 每支工具最新的一筆，只收 `now` 往前 90 天內交的；依交卷順序。 */
export function recentResultsV3<T extends { createdAt: string; result: ToolResultV3 }>(records: ReadonlyArray<T>, now: Date): T[] {
  const since = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const latest = new Map<string, T>();
  for (const r of records) {
    const t = Date.parse(r.createdAt);
    if (Number.isNaN(t) || t < since || t > now.getTime()) continue;
    latest.set(r.result.toolId, r);
  }
  return [...latest.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export interface BuildFindingsV3Input {
  t1: Record<DimensionCode, T1Flag>;
  recommended: ReadonlyArray<string>;
  /** 這位家長完整版的全部交卷（`listToolResultsV3`），這裡挑近 90 天每支最新。 */
  records: ReadonlyArray<{ createdAt: string; result: ToolResultV3 }>;
  sex?: 'boy' | 'girl';
  /** 沒有任何結果時的測評月齡（報告講「那時候」的月齡；有結果就取最新那一筆的）。 */
  fallbackAgeMonth: number;
  now: Date;
}

export function buildFindingsV3(input: BuildFindingsV3Input): T2FindingsV3 {
  const picked = recentResultsV3(input.records, input.now).map(r => r.result);
  const assessedAgeMonth = picked.length ? picked[picked.length - 1].assessedAgeMonth : input.fallbackAgeMonth;
  return {
    version: 4,
    toolkitVersion: TOOLKIT_VERSION_V3,
    rulesVersion: RULES_VERSION_V3,
    child: { assessedAgeMonth, ...(input.sex ? { sex: input.sex } : {}) },
    t1: { ...input.t1 },
    recommended: [...input.recommended],
    dimensions: judgeDimensionsV3({ ageMonth: assessedAgeMonth, t1: input.t1, recommended: input.recommended, results: picked }),
    toolResults: picked,
    notices: picked.flatMap(r => (r.score.flags ?? []).filter(f => NOTICE_FLAGS.includes(f)).map(flag => ({ toolId: r.toolId, flag }))),
    computedAt: input.now.toISOString(),
  };
}

/**
 * 開關組合（server.ts 啟動時呼叫）：完整版的快照只有維度判定、沒有舊配對要的標籤，每週活動只能走 v3 推送規則 ——
 * 開了 `T2_RECOMMEND_V3` 卻沒開 `TRAINING_PUSH_V3`，丟錯讓程序起不來，不要等第一位家長打開線上干預才 500。
 */
export function assertV3Switches(recommendV3: boolean, trainingPushV3: boolean): void {
  if (recommendV3 && !trainingPushV3) {
    throw new Error('T2_RECOMMEND_V3=1 需要同時設 TRAINING_PUSH_V3=1（完整版的報告只能用 v3 推送規則排活動）');
  }
}

/** 讀回來的快照是哪一套（`toolkitVersion` 分流）。 */
export function isFindingsV3(x: { toolkitVersion?: unknown }): boolean {
  return x.toolkitVersion === TOOLKIT_VERSION_V3;
}

/**
 * 評估結果快照（`t2_findings`）的三種來源（客戶 10/22，規格三「評估結果快照的三種來源」，#92、#112）：
 * 量表交卷生成的（既有的兩個題庫版本）、「只有 T1」（訓練計劃的家長做完 T1、還沒做 T2）、「代填」（推薦人在後台給的紅黃綠）。
 * 三種存在同一張表，用題庫版本欄（`toolkit_version`）區分；推送規則與每週活動一行不動。
 */
export const T1_ONLY_TOOLKIT = 't1-only-20261023' as const;
export const PROXY_TOOLKIT = 'proxy-20261023' as const;

/** 不是量表交卷生成的那兩種（附送一個月、作答回顧、AI 敘述都不看它們）。 */
export const NON_SCALE_TOOLKITS: readonly string[] = [T1_ONLY_TOOLKIT, PROXY_TOOLKIT];

export function isNonScaleSnapshot(toolkitVersion: unknown): boolean {
  return typeof toolkitVersion === 'string' && NON_SCALE_TOOLKITS.includes(toolkitVersion);
}

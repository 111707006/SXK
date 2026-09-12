/**
 * T2 報告文字層（規格 v2 §6，#55）。不自己挑模型、不碰資料庫：`generate.ts` 的引擎由呼叫端傳進來，其餘全是純函式。
 *
 * - `prompt.ts`：送給模型的系統提示與使用者提示。
 * - `prose.ts`：`T2ReportProse` 的形狀與 `validateProse`（schema → 一致性 → 黑名單）。
 * - `template.ts`：驗證不過時的模板退路，產出過同一個驗證器。
 * - `generate.ts`：「呼叫模型 → 驗證 → 不過就退模板」那一段（#59），引擎由呼叫端傳進來。
 * - `blacklist.ts`／`sentences.ts`：兩張受控的字表。
 */

export * from './blacklist';
export * from './generate';
export * from './prompt';
export * from './prose';
export * from './sentences';
export * from './template';

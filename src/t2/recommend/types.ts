/**
 * 量表推薦引擎的型別（客戶《T2 量表推荐规则规格书 v1.0》§3、§13.1、附錄 A；T2 v3 推薦規格）。
 *
 * 維度代碼與我們的 `DimensionCode` 相同（MOT SEN COG ATT LEARN LANG SOC EMO ADL）。
 * 工具代碼是客戶的（`SXK-ASQ3`、`M-CHAT-R/F`……），與題庫的工具 id 對照在題庫換版時另做。
 */

import type { DimensionCode } from '../types';

/** 填寫人：P 家長／T 教師／S 本人／C 治療師。 */
export type Rater = 'P' | 'T' | 'S' | 'C';
export type Layer = 'T2' | 'T3';
/** T1 年齡題組：A 12–23／B 24–47／C 48–71／D 72–119／E 120–191。 */
export type T1Band = 'A' | 'B' | 'C' | 'D' | 'E';
/** T1 等級：0 未见明显／1 轻度／2 中度／3 明显。 */
export type Level = 0 | 1 | 2 | 3;
export type DxCode = 'NONE' | 'LDADHD' | 'ASD' | 'GDD' | 'CP' | 'EMO' | 'LANG';
export type KeyTag = 'ASD_SIG' | 'NONVERBAL' | 'ARTIC' | 'NARR' | 'READ' | 'LD_SIG' | 'WRITE' | 'PRAG' | 'SAFETY' | 'MED_MOT' | 'TIC';

export interface ToolSpec {
  name: string;
  rater: Rater[];
  minM: number;
  maxM: number;
  minutes: number;
  primary: DimensionCode[];
  secondary: DimensionCode[];
  group: string;
  layer: Layer;
}

export interface DxProfile {
  name: string;
  core: DimensionCode[];
  rel: DimensionCode[];
  diff: DimensionCode[];
  must: string[];
}

export interface KeyItem {
  band: T1Band;
  dim: DimensionCode;
  /** 該維度第幾題，0 起算（客規題序從 1 起）。 */
  idx: number;
  tag: KeyTag;
  cond: '>=1' | '==2';
}

/** 附錄 A 的形狀。 */
export interface RecommendConfig {
  tools: Record<string, ToolSpec>;
  groupMax: Record<string, number>;
  dx: Record<DxCode, DxProfile>;
  dxMinAge: Partial<Record<DxCode, number>>;
  keyItems: KeyItem[];
}

/** 客規 §3 的輸入。 */
export interface RecommendInput {
  /** 月齡（早產 24 個月內已用矯正月齡）。 */
  ageM: number;
  /** 九維 T1 等級（已含紅旗升級）。 */
  levels: Record<DimensionCode, Level>;
  /** 紅旗題答「还不能」的維度。 */
  rfdims: DimensionCode[];
  /** T1 逐題作答，鍵 `${維度}_${題序 0 起}`，值照客規：0 可以做到／1 有时·部分／2 还不能。舊資料沒有就是空物件。 */
  items: Record<string, 0 | 1 | 2>;
  /** 0–2 個診斷，第一個為主；空＝NONE。 */
  dx: DxCode[];
  school: boolean;
  /** 近 3 個月內完成的量表（客戶代碼）。 */
  done: string[];
  /** 目前只有 TIC。 */
  extraTags: KeyTag[];
  hearingChecked: boolean | null;
}

/** 一份推薦量表的優先類別（客規 §9.2 第 14 步的排序、第 12 步的移除順序）。 */
export type ToolClass = 'rule' | 'dx' | 'P1' | 'P2' | 'P3' | 'depth' | 'P4' | 'P5' | 'base' | 'fill';

export interface RecommendedTool {
  order: number;
  code: string;
  name: string;
  rater: Rater[];
  minutes: number;
  cls: ToolClass;
  dim: DimensionCode | null;
  reason: string;
  /** 1 第一次填寫、2 第二次填寫（前兩份是第一次）。 */
  session: 1 | 2;
  /** 規則必選、診斷必選、P1：時間上限也不移除。 */
  mandatory: boolean;
}

export interface Alert {
  type: 'SAFETY' | 'MEDICAL' | 'PREREQ' | 'DX_AGE';
  text: string;
}

export interface Recommendation {
  status: 'RECOMMEND' | 'NO_T2';
  band: T1Band;
  alerts: Alert[];
  dimQueue: Array<{ dim: DimensionCode; tier: number }>;
  tools: RecommendedTool[];
  /** T3 當面評估預告。使用者 2026-10-07：T3 不做 —— 這裡照客規算（對得上客規的表），API 不回、畫面不出。 */
  t3: Array<{ code: string; reason: string }>;
  gaps: string[];
  /** 同 `gaps`，結構化（家長端的字另寫，不讀客規那幾句）：`none` 沒有問卷、`secondary` 以次要涵蓋的替代。 */
  gapDims: Array<{ dim: DimensionCode; kind: 'none' | 'secondary' }>;
  /** 被時間上限移除的。 */
  removed: Array<{ code: string; reason: string }>;
  parentMinutes: number;
  tags: KeyTag[];
}

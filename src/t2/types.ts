/**
 * T2 規則引擎的型別（規格 v2 附錄 A）。
 *
 * 這一層只有「形狀」，沒有任何計算 —— 計分在 #46、判定在 #47、彙整在 #48。
 * 型別與資料分開放是刻意的：登錄表（`toolSpecs.ts`）、發現標籤（`findingTags.ts`）、
 * caveat（`caveats.ts`）、§5.9 的標籤來源（`sectionTags.ts`、`itemTags.ts`）
 * 都只依賴這一檔，彼此不互相 import。
 *
 * `ToolId` 不在這裡定義 —— 它是題庫（#41）就有的東西，從 `./toolkit` 轉出，
 * 避免同一組 22 個代號在 repo 裡有兩份可以各自漂移的定義。
 */

import type { ToolId, ToolkitTier } from './toolkit';
import type { FindingTag } from './findingTags';
import type { Caveat } from './caveats';

export type { ToolId };

/** 九個維度。與正式站的 `dimensionId` 的對照見 CONTEXT.md「維度」。 */
export type DimensionCode = 'COG' | 'LANG' | 'SOC' | 'EMO' | 'ATT' | 'MOT' | 'SEN' | 'ADL' | 'LEARN';

/**
 * 給家長的三級判定。內部名稱，家長端顯示的字一律走 `src/utils/statusWording.ts`。
 * `clear` 與「沒做完」是不同的事，別把 `DimensionFinding.band` 的
 * `partial`／`not_assessed`／`no_tool` 塌進 `clear`（§5.7）。
 */
export type Band = 'clear' | 'watch' | 'refer';

/** 工具自己的分段，1 最好、4 最差。不是每支都有四段（§5.3）。 */
export type Tier = 1 | 2 | 3 | 4;

/** §4.3 的診斷方向，家長選填，十選一。 */
export type DiagnosisDirection =
  | 'cp' | 'dd' | 'id' | 'ld' | 'adhd' | 'lang' | 'emo' | 'psych' | 'tic' | 'asd';
//   腦癱  發展遲緩  智力障礙  學習障礙  多動症  語言障礙  情緒障礙  心理疾病  抽動症  自閉症

/** §5.2 的十個計分族。一支工具屬於且只屬於一族。 */
export type ScoringFamily =
  | 'achievement' | 'pass' | 'independence' | 'concern' | 'total'
  | 'mean-snap' | 'mean-chexi' | 'risk' | 'positive' | 'profile';

/** §5.1 的前置題：先於題目出現、不計分、答案進 `ToolResult.pre`。 */
export interface PreQuestionSpec {
  /** `'regression'`（asb／asr／warn）、`'duration'`（att）、`'settings'`（ab）、`'impact'`（spa／spb）、`'concern'`（mchat）。 */
  key: string;
  kind: 'single' | 'multi' | 'boolean';
  /** `exclusive` 的選項不能與其他並存 —— spa／spb 的 `none`、asb／asr／warn 的「沒有」。 */
  options?: Array<{ value: string; label: string; exclusive?: boolean }>;
}

/**
 * 一條「這支工具用哪些面向餵哪個維度」的對應（附錄 F）。
 *
 * ⚠️ **它只決定 band，不決定標籤歸哪個維度。** 附錄 F 的那句「`producesBand=false` 的
 * 工具 `feeds` 只用來決定標籤歸哪個維度」對好幾支是錯的：氣質的 `feeds` 是 EMO，卻會出
 * `att.inattention`（D8）、`sen.threshold_low`（D9）、`learn.task_persistence`（D7）；
 * chexi 的 `feeds` 是 ATT，卻會出 `emo.regulation`；adp（COG）出 `mot.fine_motor`、
 * soc（SOC）與 ab（ATT）出 `emo.regulation`、adl（ADL）出 `mot.locomotion`、
 * ldp（LEARN）出 `att.inattention`。**標籤的維度一律看標籤自己的前綴**
 * （`findingTags.ts` 的 `tagDimension()`），不看這一欄 —— 照附錄 F 那句做，
 * 氣質的「堅持不下去」會落到情緒那一格，而且標籤仍然合法，沒有一層會喊。
 */
export interface ToolFeed {
  dimension: DimensionCode;
  /** 面向 key（題庫的 `sections[].key`）；`'overall'` 用總分。 */
  sections: ReadonlyArray<string> | 'overall';
}

/**
 * 一支工具的登錄資料（§3 ＋ 附錄 F）。**只有事實，沒有函式** ——
 * 「這支工具是什麼」與「這支工具怎麼判」分開，後者是 `ToolRule`。
 */
export interface ToolSpec {
  id: ToolId;
  /** §3 的代號，`'SXK-GM'`。 */
  code: string;
  /** 月齡窗口，**閉區間**，單位是實足月齡（整數月，不進位）。 */
  windowMonths: { lo: number; hi: number };
  family: ScoringFamily;
  /** 適用題數少於此值的面向不單獨判讀：達成率族 3、獨立率 2、其餘 1（§5.2）。 */
  minItems: number;
  /** 附錄 F。多維度工具每個維度用自己那組面向算 band。**只決定 band，不決定標籤歸哪個維度**（見 `ToolFeed`）。 */
  feeds: ReadonlyArray<ToolFeed>;
  /** chexi、tempa、tempb 為 false —— 它們只出標籤，不推任何維度的判定（§5.4）。 */
  producesBand: boolean;
  /** 22 支全為 true：T2 沒有治療師在場，全部由家長自行施測（§0）。 */
  parentDoable: true;
  /** sxk-warn 為 false —— 它是 T1 位置的紅旗初篩，在 T2 重做沒有意義（§4.6）。 */
  routed: boolean;
  /** §5.3 的分段。直接取題庫抽出來的那一份，不另抄一次。 */
  tiers: ReadonlyArray<ToolkitTier>;
  preQuestions: ReadonlyArray<PreQuestionSpec>;
  /** §5.9 右欄裡**無條件**成立的那些；跟著分數或前置題才出現的由 `ToolRule.caveats` 產生。 */
  fixedCaveats: ReadonlyArray<Caveat>;
  toolkitVersion: 'kit-20260908';
}

/** 一個面向（或總分）的計分結果（§5.8）。 */
export interface SectionStat {
  n: number;
  raw: number;
  max: number;
  /** 已四捨五入；dev 分母為 0，或 chexi／snap 不用百分比時為 `null`。 */
  pct: number | null;
  tier: Tier | null;
  /** `n >= ToolSpec.minItems`。false 代表算得出但不單獨判讀、不出標籤。 */
  scored: boolean;
}

/** 一支工具的一次作答＋計分（§5.8）。重做會是新的一筆，不覆蓋舊的。 */
export interface ToolResult {
  toolId: ToolId;
  toolkitVersion: 'kit-20260908';
  assessedAgeMonth: number;
  /** 工具包的「填表人身份」去掉治療師。只用於 caveat 文案與日後建常模時分層，不擋流程。 */
  rater: 'father' | 'mother' | 'caregiver' | 'teacher' | 'other';
  askedCount: number;
  answeredCount: number;
  pre: Record<string, string | string[] | boolean>;
  /** 題 key → 值（§3.1）；dev 的 key 是 `${band}.${domain}.${idx}`。 */
  answers: Record<string, number | string>;
  sections: Record<string, SectionStat>;
  overall: SectionStat;
  /** 族專屬的東西：mchat 的 `riskItems`、warn 的 `positives`、snap 的 `symptomCounts`……。 */
  native: Record<string, number | string | number[] | string[] | null>;
  computedAt: string;
}

/**
 * 一支工具的判定規則（§5.9）。實作在 #47，這裡只釘住形狀。
 * `bandFor` 對「不餵這個維度」與「這支不出 band」都回 `null` —— 兩者對呼叫端是同一件事：
 * 這支工具不該影響那一格。
 */
export interface ToolRule {
  toolId: ToolId;
  rulesVersion: string;
  bandFor: (r: ToolResult, dimension: DimensionCode) => Band | null;
  tags: (r: ToolResult) => FindingTag[];
  caveats: (r: ToolResult) => Caveat[];
  /** 出處，指向工具包檔名與常數名：`'SXK-GM.html LEVELS（紙本 六、分數解讀）'`。 */
  source: string;
}

/** 一支被推薦的工具（§4.2）。 */
export interface PlanItem {
  toolId: ToolId;
  forDimensions: DimensionCode[];
  askedCount: number;
  role: 'required' | 'optional' | 'followup' | 'extra';
}

/** T1 之後要做哪些工具（§4）。 */
export interface T2Plan {
  ageMonth: number;
  required: PlanItem[];
  optional: PlanItem[];
  followup: PlanItem[];
  /** 只出標籤的工具（chexi、tempa、tempb）。 */
  extras: PlanItem[];
  /** 被 T1 標記、但這個月齡沒有任何會出 band 的工具的維度（§4.5）。 */
  noTool: DimensionCode[];
  estimatedItems: { required: number; optional: number; followup: number };
}

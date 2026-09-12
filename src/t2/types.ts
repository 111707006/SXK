/**
 * T2 規則引擎的型別（規格 v2 附錄 A）。
 *
 * 這一層只有「形狀」，沒有任何計算 —— 計分在 #46、判定在 #47、彙整在 #52（`findings.ts`）。
 * 型別與資料分開放是刻意的：登錄表（`toolSpecs.ts`）、發現標籤（`findingTags.ts`）、
 * caveat（`caveats.ts`）、§5.9 的標籤來源（`sectionTags.ts`、`itemTags.ts`）
 * 都只依賴這一檔，彼此不互相 import。
 *
 * `ToolId` 不在這裡定義 —— 它是題庫（#41）就有的東西，從 `./toolkit` 轉出，
 * 避免同一組 22 個代號在 repo 裡有兩份可以各自漂移的定義。
 */

import type { ToolId, ToolkitTier } from './toolkit';
import type { ActivityTag, FindingTag } from './findingTags';
import type { Caveat } from './caveats';

export type { ToolId };

/** 九個維度。與正式站的 `dimensionId` 的對照見 CONTEXT.md「維度」。 */
export type DimensionCode = 'COG' | 'LANG' | 'SOC' | 'EMO' | 'ATT' | 'MOT' | 'SEN' | 'ADL' | 'LEARN';

/**
 * 九個維度的固定順序（＝附錄 A 的宣告順序）。要「對每個維度做一遍」時用它，
 * 不要用 `Object.keys(t1Flags)` —— 那個順序是呼叫端寫物件時的手順，
 * 路由與報告的輸出順序不該跟著它漂。這不是報告的排序（那是 §8 的另一組順序）。
 */
export const DIMENSION_CODES: ReadonlyArray<DimensionCode> = [
  'COG', 'LANG', 'SOC', 'EMO', 'ATT', 'MOT', 'SEN', 'ADL', 'LEARN',
];

/** T1 對一個維度的標記：0 綠（不做）、1 黃（選做）、2 紅（必做）（§4.1）。 */
export type T1Flag = 0 | 1 | 2;

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

/**
 * 填表人身份 —— 工具包的「填表人身份」去掉治療師（§0：T2 沒有治療師在場）。
 * 只用於 caveat 文案與日後建常模時分層，不擋流程。運行時常數而不只是型別：
 * 交卷（#57）要驗 body、`t2_tool_results.rater` 的 ENUM 要對這五個值，兩處都不該手抄。
 */
export const RATERS = ['father', 'mother', 'caregiver', 'teacher', 'other'] as const;
export type Rater = (typeof RATERS)[number];

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
  /** 見 `RATERS`。 */
  rater: Rater;
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
  /** 只出標籤的工具（chexi、tempa、tempb）。恆為選做，不進 `estimatedItems`。 */
  extras: PlanItem[];
  /** 被 T1 標記、但這個月齡沒有任何會出 band 的工具的維度（§4.5）。 */
  noTool: DimensionCode[];
  estimatedItems: { required: number; optional: number; followup: number };
  /**
   * 診斷方向帶進來的「功能處理順序」（§4.3、附錄 B.2），報告拿它排維度。
   * 沒選、或選的那一格是空的（學習障礙／多動症／抽動症 0–36）→ `null`，
   * 兩種情況對下游要是同一件事。客戶的順序**不是九個都在**（沒有一列有 ADL），
   * 缺的維度怎麼補是報告那一層的事。
   */
  functionOrder: DimensionCode[] | null;
}

/**
 * 一個維度的判定狀態（§5.7）：三級 band，或四種「沒有判定」的原因。
 *
 * 四個非 band 值各自是一件事：`partial` 星號工具沒做完（紅）、`not_assessed` 家長沒做選做（黃）、
 * `no_tool` 這個月齡沒有任何會出 band 的工具（§4.5）。它們跟 `clear` 必須分得開 ——
 * 塌成同一個值就是「沒做完」被讀成「沒事」。
 */
export type DimensionBand = Band | 'partial' | 'not_assessed' | 'no_tool';

/** 一個維度彙整後的結果（§5.7）。九個維度各一筆，含 `clear` 的。 */
export interface DimensionFinding {
  dimensionId: DimensionCode;
  band: DimensionBand;
  /** 哪一支把 band 推到這裡；同 band 取先做完的。band 不是三級之一時為 `null`。 */
  drivenBy: ToolId | null;
  /** 各工具標籤的聯集，去重、保序：`severity.severe` 最前，其次 `drivenBy` 的，再依完成順序。每維度 ≤ 10。 */
  tags: FindingTag[];
  /** 這個維度用到的工具的 caveats 聯集，去重、保序（順序同 `tags`）。 */
  caveats: Caveat[];
  /** 這個維度做了哪幾支（含只出標籤的），依完成順序。 */
  tools: ToolId[];
  t1Flag: T1Flag;
}

/**
 * T2 的唯一真相（§5.8）。報告、活動配對、SMART 目標都只讀它；任何下游不得回頭讀
 * 原始答案自己再判一次。`version` 是這個形狀的版本（v1 規格是 2），`rulesVersion` 是
 * 門檻的版本 —— 門檻改了就換，舊報告記著舊版本。
 */
export interface T2Findings {
  version: 3;
  toolkitVersion: 'kit-20260908';
  rulesVersion: string;
  child: { assessedAgeMonth: number; sex?: 'boy' | 'girl' };
  t1: Record<DimensionCode, T1Flag>;
  /** 家長沒填就是 `null`，不是 `undefined` —— 這筆要存進資料庫再讀回來。 */
  diagnosisDirection: DiagnosisDirection | null;
  /** 九個都在，含 `clear`；順序照 `DIMENSION_CODES`。 */
  dimensions: DimensionFinding[];
  /** 每支工具**最新且完整**的一筆，依完成順序。 */
  toolResults: ToolResult[];
  computedAt: string;
}

/** 客戶的 15 個活動模組（§7.2）。編號 001–020 是模組 1，以此類推：`ceil(編號 / 20)`。 */
export type ModuleNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/** 一則分解步驟：一張圖配一句指令，順序即照著做的順序（ADR-0003／0005）。 */
export interface ActivityStep {
  imageUrl: string;
  instruction: string;
}

/**
 * 活動庫的一支活動（§7.1 ＝ ADR-0005 的欄位，加 `moduleNo` 與 `targetMonth`）。
 *
 * `targetMonth` 是配對真正吃的欄位：這支活動「做得到的孩子」的發展月齡，配對拿它對
 * §7.2 的偏移窗口。`null` 是「內容團隊還沒填」—— 沒填的活動**配不到**，不是退回
 * `ageMonths`（退回會讓偏移規則失效而畫面上看不出來，§7.4）。`ageMonths` 是從原型
 * 「3–8岁」解析出來的區間，只當硬閘。
 *
 * `targets` 的型別是 `ActivityTag` 不是 `FindingTag`：活動只認 ★ 標籤（§5.5），
 * 「慢熱型」這種只進報告的標籤不該出現在這裡。`avoidIf` 對的是孩子的全部標籤，
 * 所以是 `FindingTag`。
 */
export interface Activity {
  /** 沿用原型 `ACT300` 的編號，`'A017'`。 */
  id: string;
  title: string;
  moduleNo: ModuleNo;
  targetMonth: number | null;
  ageMonths: { min: number; max: number };
  /** 從模組推的初值（附錄 B.3），可多個；內容團隊在後台改。 */
  dimensions: DimensionCode[];
  targets: ActivityTag[];
  avoidIf: FindingTag[];
  /** 種子沒有這個值，先是 0，內容團隊在後台填。 */
  durationMin: number;
  equipment: string[];
  steps: ActivityStep[];
  videoUrl: string | null;
  active: boolean;
}

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
 *
 * 【有條件的貢獻】（規格 v2.1 §4.3，客戶 9/21 工作單 #6、#7）
 * `producesBand` 是整支工具一個布林值，說不出「這支工具對**這個維度**、在**這段月齡**、以**這種身分**
 * 出判定」。下面三個選填欄位補這件事；三個都沒有的 feed 與 v2 完全一樣。
 * 一支工具對一個維度最多一條 feed（`test/t2ToolSpecs.structure.test.ts` 盯著）。
 */
export interface ToolFeed {
  dimension: DimensionCode;
  /** 面向 key（題庫的 `sections[].key`）；`'overall'` 用總分。 */
  sections: ReadonlyArray<string> | 'overall';
  /**
   * 只在這段測評月齡生效（閉區間）；沒有＝整個工具窗口。規則表看的是**那一筆結果**的
   * `assessedAgeMonth`，路由看的是這次的月齡。帶了這一欄的 feed 就算工具 `producesBand=false`
   * 也出判定（氣質靠它）。
   */
  months?: { lo: number; hi: number };
  /** 只能當加測（第 2、3 支），不能當星號（#6：另一份問卷裡的幾題，題數少）。 */
  followupOnly?: true;
  /** 這條貢獻最高只判到哪一級（#7：氣質最高留意）。 */
  maxBand?: 'watch';
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
  /**
   * chexi、tempa、tempb 為 false（§5.4）。chexi 只出標籤；氣質兩支仍是 false，但在 feed 帶
   * `months` 的那幾段對情緒、注意力出判定（v2.1 §4.4，最高留意）—— 要問「這支在這個月齡對這個
   * 維度出不出判定」，用 `toolSpecs.ts` 的 `bandFeed`，不要只看這一欄。
   */
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
 *
 * `not_screened`（v2.1 §4.7、S08）：這個月齡段 T2 **不評**這個維度（學習 0–36、注意力 0–11，
 * `routing.ts` 的 `NOT_SCREENED`）。與 `no_tool` 不同 —— `no_tool` 是該評但沒工具，要講出來、導向專家；
 * 不篩是畫面上**不出這一格**（九宮格、總覽、段落都沒有）。`T2Findings.dimensions` 仍是九筆。
 * 規則版 `v2-2026-09-11` 的快照（v2.1 上線前存的）沒有這個值（v2.1 §10），畫面照存的樣子讀。
 */
export type DimensionBand = Band | 'partial' | 'not_assessed' | 'no_tool' | 'not_screened';

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
  /**
   * 30 天內重做過的工具（§10.2 第 2 項「報告要標『距上次 N 天』」）。
   *
   * **一支都沒有時整個欄位不在**，不是空陣列：舊快照（#59 之前存的）讀回來也是沒有這個
   * 欄位，兩者在畫面上要長得一樣 ——「這次沒有重做」與「那時還不記重做」都是不顯示。
   * §5.8 的欄位表沒有這一格，記在勘誤檔。
   */
  redos?: RedoNote[];
  computedAt: string;
}

/**
 * 一支工具「距上次 N 天」（§10.2 第 2 項）。
 *
 * 練習效應：同一份題目隔幾天再答一次，分數會往上跑，而那不是孩子變了。報告上標出天數，
 * 讀報告的人自己判斷這次的進步有多少是練出來的。**只記天數，不改任何判定** —— 規則引擎
 * 對重做的那一筆一視同仁（`latestCompleteResults` 取最新的那一筆）。
 */
export interface RedoNote {
  toolId: ToolId;
  /** 這一筆與同一支上一筆完整結果相距幾天，無條件捨去到整數天；同一天重做是 0。 */
  daysSinceLast: number;
}

/** 客戶的 15 個活動模組（§7.2）。編號 001–020 是模組 1，以此類推：`ceil(編號 / 20)`。 */
export type ModuleNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/**
 * 一則分解步驟：一句指令，圖選填，順序即照著做的順序。
 *
 * ADR-0008（2026-09-23）取代 ADR-0003／0005 的「每則一張圖、兩者都必填」：文字步驟是底，
 * 圖是補充。沒有圖是 `null`（不是空字串）—— 畫面在那裡放序號方塊，不放破圖。
 */
export interface ActivityStep {
  imageUrl: string | null;
  instruction: string;
}

/**
 * 腳本「開拍前的準備」的四項，**照這個順序顯示**（Keep 規格 §4.2）。
 *
 * 要有一份固定順序，是因為 MySQL 的 JSON 物件**不保留鍵的順序**（存進去會依鍵排序），
 * 讀回來照 `Object.keys` 列，家長看到的就是資料庫的排序而不是腳本的。
 */
export const GUIDE_PREP_KEYS = ['场地', '器材', '安全检查', '大人位置'] as const;
export type GuidePrepKey = (typeof GUIDE_PREP_KEYS)[number];

/**
 * 一支活動的影片導引腳本（Keep 規格 §4.2）。現在只有模組一（A001–A020）有。
 *
 * 腳本裡「畫面描述」「拍攝提示」是給拍片的人看的，**不在這裡**，也不上家長端。
 * 內容是客戶原文（`src/t2/activityContent.ts` 由腳本從 docx 抽出），只拿掉段落的標籤
 * （「旁白」「如果」「→」「✓」「1.」）與逐字稿外層的那一對「」。
 */
export interface ActivityGuide {
  /** 「2–3 分钟」原文。 */
  length: string;
  /** 片頭旁白。 */
  intro: string;
  /** 原理，8 條上下。 */
  principles: string[];
  /** 準備：场地、器材、安全检查、大人位置（只認 `GUIDE_PREP_KEYS`，可以少，不能多）。 */
  prep: Partial<Record<GuidePrepKey, string>>;
  /** 分鏡：名稱與旁白（畫面描述不上家長端）。 */
  shots: Array<{ name: string; say: string }>;
  /** 孩子的反應：如果……就……，3 則。 */
  reactions: Array<{ if: string; then: string }>;
  /** 大人常做錯的，3 件。 */
  mistakes: string[];
  /** 降一階、升一階。 */
  down: string;
  up: string;
  /** 怎麼看出有進步，3 條（打卡時勾）。 */
  progress: string[];
  /** 收尾旁白。 */
  outro: string;
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
 *
 * 【內容欄位（Keep 規格 §4.1，2026-09-23）】
 * `ageLabel` 到 `deeper` 是客戶手冊那張卡的原文，`guide` 是模組一的腳本。文字欄位**空字串
 * 就是沒有**（新增的活動、或內容團隊在後台清掉的），畫面據此不顯示那一區；不用 `null`，
 * 呼叫端不必分兩種「沒有」。資料庫那一側 `NULL`＝遷移還沒填、`''`＝後台清掉的，遷移重跑
 * 只填 `NULL`，所以清掉的不會被填回來（`deploy/migrations/2026-09-23-activity-content.sql`）。
 */
export interface Activity {
  /** 沿用原型 `ACT300` 的編號，`'A017'`。 */
  id: string;
  title: string;
  moduleNo: ModuleNo;
  targetMonth: number | null;
  /** 從適齡原文解析出來的區間（`activitySeed.ts` 的 `parseAgeRange`），只當硬閘。 */
  ageMonths: { min: number; max: number };
  /** 手冊標題列的適齡原文「6个月–3岁」。畫面顯示它；`ageMonths` 由它解析。 */
  ageLabel: string;
  /** 手冊的人物配置：「亲子」「亲子或全家」「全家」……。 */
  people: string;
  /** 從模組推的初值（附錄 B.3），可多個；內容團隊在後台改。 */
  dimensions: DimensionCode[];
  targets: ActivityTag[];
  avoidIf: FindingTag[];
  /** 種子沒有這個值，先是 0，內容團隊在後台填。 */
  durationMin: number;
  /** 器材的字串陣列，給配對與後台用；畫面「要准备」顯示的是 `need` 原文。 */
  equipment: string[];
  /** 手冊「需要什么」原文。 */
  need: string;
  /** 手冊「练什么」。 */
  trains: string;
  steps: ActivityStep[];
  /** 手冊「简单／难一点」的前後兩半。 */
  easier: string;
  harder: string;
  /** 手冊「💡 小提醒」。 */
  tip: string;
  /** 手冊「📖 想深入练」（不含「想深入练：」這幾個字）。 */
  deeper: string;
  /** 模組一的影片導引腳本；沒有腳本是 `null`。 */
  guide: ActivityGuide | null;
  videoUrl: string | null;
  /** 示範片的封面，網址規則同 `videoUrl`（Keep 規格 §6，票 3 才有資料）。 */
  posterUrl: string | null;
  /** 示範片長度（秒），畫面顯示「0:10」。 */
  videoSeconds: number | null;
  active: boolean;
}

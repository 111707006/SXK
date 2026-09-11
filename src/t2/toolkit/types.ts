/**
 * T2 題庫的形狀 —— 22 支工具抽成同一個樣子。
 *
 * 來源是 2026-09-08 森心康評估工具包（`NEWT2/森心康评估工具包_20260908.zip`），
 * 由 `scripts/t2-extract-toolkit.ts` 從 zip 重現，**不要手改** `src/t2/toolkit/<id>.ts`。
 * 規格：`docs/specs/t2-v2-sxk-toolkit-rules-engine-report-and-activities.md` §3、§3.1、§5.1、§5.3。
 *
 * 這一層只有「題目與分段」，沒有計分、沒有判定、沒有路由 —— 那些是 #42 之後的票。
 * 工具包裡的建議文字（`PLAN`／`FREQ`／`CONSEQ`、面向的 `what`／`tips`、分段的
 * `head`／`txt`）**刻意不抽**：它們一個字都不能進家長端（#40），不抽進來就不會
 * 有人順手拿去用。
 */

/** §3 的 22 個工具代號。小寫、以工具包代號為準，不沿用中控台的舊名（`weefim`／`spm25`／`social`）。 */
export type ToolId =
  | 'sxk-dev' | 'sxk-warn' | 'mchat-rf' | 'sxk-gm' | 'sxk-soc' | 'sxk-lang' | 'sxk-adp'
  | 'sxk-voc' | 'sxk-asq' | 'sxk-asb' | 'sxk-asr' | 'sxk-ab' | 'sxk-att' | 'snap-iv'
  | 'chexi' | 'sxk-spa' | 'sxk-spb' | 'sxk-adl' | 'sxk-ldp' | 'sxk-lds' | 'sxk-tempa' | 'sxk-tempb';

/** 一個選項。`value` 是 §3.1 的作答值域；`label` 是畫面文字原文（簡體；M-CHAT 繁體）。 */
export interface ToolkitOption {
  value: number | string;
  label: string;
  /** 只有 `sxk-adl` 的七級有：該級的定義全文，畫面要整句顯示（§3.1）。 */
  definition?: string;
}

export interface ToolkitItem {
  /** 面向內的序號，從 1 起 —— 與紙本、與 §5.9 逐題表一致。 */
  no: number;
  /** 題目原文，一字不改。 */
  text: string;
  /**
   * 起始月齡：只出 `startMonth ≤ 測評月齡` 的題（§5.1）。
   * 沒有起始月齡的工具（asb、asr、snap-iv、chexi、ldp、lds、tempa、tempb、mchat-rf、
   * 以及 dev／warn 這兩支用年齡段挑題的）為 `null`，代表全題都出。
   */
  startMonth: number | null;
  /** 原量表的題號，只在與 `no` 不同時才有：snap-iv 的 1–26、chexi 的原始題號。 */
  sourceNo?: number;
  /** 只有 `sxk-asr` 有：四級行為錨點全文，索引即選項值 0–3。畫面顯示的是這四句（§4.6）。 */
  anchors?: string[];
  /** 只有 `mchat-rf` 有：答哪一個算風險（題 2、5、12 是 `'yes'`，其餘 `'no'`）。 */
  riskAnswer?: 'yes' | 'no';
}

export interface ToolkitSection {
  /** 工具包的面向 key（`P1`、`SC`、`wm`……）；dev 是領域 key，warn 是 `m3` 這種時點。 */
  key: string;
  name: string;
  items: ToolkitItem[];
  /**
   * 只有年齡段型的兩支有。`sxk-dev`：所屬年齡段（閉區間）；`sxk-warn`：所屬時點，
   * `lo` 是時點月齡、`hi` 是下一個時點的前一個月（「取 ≤ 月齡的最大時點」）。
   * 有這個欄位的面向，只有 `lo ≤ 月齡 ≤ hi` 時才出題。
   */
  ageBand?: { key: string; lo: number; hi: number };
}

/**
 * 一段分級。`tier` 1 最好；`key` 是工具包的**內部名稱**，家長端一個字都不能出現（§5.3）。
 *
 * `min`／`max` 依計分族解讀（附錄 A 的說法）：
 * - 整數分數的族（達成率、通過率、獨立率、關切率的百分比；ldp／lds 的總分；
 *   mchat 的風險題數；warn 的陽性數）：閉區間，缺 `min` 即無下限、缺 `max` 即無上限。
 * - `snap-iv`（各分量表均分）：`max` 含、`min` 不含 —— `ari ≤ 1.2` 是 tier 1。
 * - `tempa`／`tempb`（|均分 − 2.5|）：`min` 含、`max` 不含 —— `|dev| < 0.42` 是 tier 1。
 * - `chexi`（因素相對百分比）：閉區間整數。
 */
export interface ToolkitTier {
  tier: 1 | 2 | 3 | 4;
  key: string;
  min?: number;
  max?: number;
}

/** §5.1 的前置題：先於題目出現、不計分。 */
export interface ToolkitPreQuestion {
  key: 'regression' | 'duration' | 'settings' | 'impact' | 'concern';
  kind: 'single' | 'multi' | 'boolean';
  /** 畫面問法原文。 */
  prompt: string;
  /** `value` 是 §5.1 的值；`label` 是選項原文。`exclusive` 的選項與其他互斥（「沒有」那一個）。 */
  options: Array<{ value: string; label: string; exclusive?: boolean }>;
}

export interface ToolkitBank {
  id: ToolId;
  /** §3 的代號，`'SXK-GM'`。 */
  code: string;
  /** 工具包頁面的標題原文。 */
  title: string;
  /** 從哪個檔案抽的：zip 內路徑與該檔的 sha256，讓「從 zip 重現」有東西可對。 */
  source: { file: string; sha256: string };
  /** 每題的選項，依工具包畫面的順序。 */
  options: ToolkitOption[];
  sections: ToolkitSection[];
  /** 報告分段（＝紙本「分數解讀」）。不分級的工具（chexi 的因素只有相對描述、氣質）見各檔說明。 */
  tiers: ToolkitTier[];
  /**
   * 面向自己的分段，只在與 `tiers` 不同時才有：ldp／lds 各方面 0–18 分另有一套。
   * 沒有這個欄位代表面向與總分用同一張表（§5.3「面向也用同一張表分級」）。
   */
  sectionTiers?: ToolkitTier[];
  preQuestions: ToolkitPreQuestion[];
  /** 工具包的 `MIN_ITEMS`：適用題數少於此值的面向不單獨判讀（達成率族 3、adl 2）。 */
  minItems?: number;
}

/**
 * 完整版題庫（`kit-20260923`）的形狀（T2 v3 題庫規格 §3.1）。手寫；每支工具的 `<slug>.ts` 由
 * `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出、不手改（`test/t2KitV3.structure.test.ts` 重跑比對）。
 *
 * 比 9/08 的 `src/t2/toolkit/types.ts` 寬：一支工具可以有好幾個「表」（ASQ3 的月齡題組、氣質的 ITQ／TTS／BSQ、
 * SP 的 H25／H512……），每個面向帶自己的選項組（LQ 的「不确定」、ADL 的七級、TIC 的 0–5、氣質的「不适用」）。
 * 計分要的切點與參數放在 `scoring`，形狀由那一支的計分族決定（`src/t2/kitv3/score.ts`）。
 */

export const TOOLKIT_VERSION_V3 = 'kit-20260923' as const;
export type ToolkitVersionV3 = typeof TOOLKIT_VERSION_V3;

/** 一個選項。`value: null` ＝ 「不确定」「看不到」「不适用」—— 分子分母都不算。 */
export interface KitV3Option {
  value: number | null;
  label: string;
  /** 頁面上選項底下的小字（「稳定做得到」）。 */
  hint?: string;
}

/** 一題。`key` 在整支工具裡唯一（作答與存檔都用它）。 */
export interface KitV3Item {
  key: string;
  text: string;
  /** 題目底下的小字（LQ 的「怎么观察」）。 */
  hint?: string;
  /** 題目月齡（「约 N 个月」）：實足月齡 ≥ 它才出、才計分。沒有＝不看月齡。 */
  month?: number;
  /** 反向計分（選項值要倒過來算）。 */
  reverse?: boolean;
  /** 頁面標記的題型（「核心」「紅旗」「倒退」……），計分族自己認。 */
  tags?: string[];
}

export interface KitV3Section {
  key: string;
  name: string;
  /** 用哪一組選項（`KitV3Bank.options` 的鍵）。 */
  options: string;
  items: KitV3Item[];
  /** 選答的一段（LQ 的口腔進食）：沒答不算缺答、不進分級。 */
  optional?: boolean;
}

/** 一個表（月齡題組、年級題組、ITQ／TTS／BSQ……）。只有一個表的工具就一個 `main`。 */
export interface KitV3Form {
  key: string;
  name: string;
  /** 這個表適用的月齡（含）。沒有＝整支工具的窗口。 */
  minM?: number;
  maxM?: number;
  sections: KitV3Section[];
}

export interface KitV3Source {
  zip: string;
  file: string;
  sha256: string;
}

export interface KitV3Bank<S = unknown> {
  /** 客規代碼（`SXK-GM`、`M-CHAT-R/F`、`ITQ/TTS/BSQ`……）。 */
  code: string;
  title: string;
  /** 計分族：決定 `scoring` 的形狀與用哪一個計分函式。 */
  family: string;
  source: KitV3Source;
  options: Record<string, KitV3Option[]>;
  forms: KitV3Form[];
  scoring: S;
}

/** 頁面的一段分級（好 → 壞的順序）。`name` 只進後台與測試，家長端不出。 */
export interface KitV3Band {
  name: string;
  /** 閉區間下限；沒有＝從最小。 */
  min?: number;
  /** 閉區間上限；沒有＝到最大。 */
  max?: number;
}

/**
 * Caveats：受控值 v2（規格 §5.6）。
 *
 * 【這是什麼】
 * 一筆結果「該打多少折」的理由。不是分數的一部分，也不改判定 —— 它決定報告裡
 * 多出哪一句話，以及那句話怎麼寫。
 *
 * 【為什麼要受控】
 * 這些句子是給家長看的，而且是**限制自己結論的**句子。讓每張規則表自由造句，
 * 遲早會出現一份報告說「這份工具尚未建立常模」、另一份說「依臨床經驗訂定」，
 * 讀起來像兩套標準。17 個值，每個值配一句固定文案（§5.6 右欄），
 * 由 #49 的報告層渲染。
 *
 * 【固定與條件】
 * `ToolSpec.fixedCaveats` 是這支工具**每一筆**結果都帶的；跟著分數或前置題才
 * 出現的（`incomplete`、`regression_reported`、`safety_concern`……）由 `ToolRule.caveats`
 * 在 #47 產生。兩邊都只能用這張表裡的字。
 */

export const CAVEATS = [
  /** 本次出的題沒有全答。缺答一律如此，**不以 0 補**（§5.1）。 */
  'incomplete',
  /** 測評月齡在工具窗口外。規則引擎拒算，只會出現在舊紀錄被新窗口重讀時。 */
  'age_out_of_window',
  /** 分段是客戶自承的內部參考帶，沒有常模。18 支自建工具一律帶。 */
  'unsourced_threshold',
  /** 家長問卷（22 支全部都是）。不單獨成句。 */
  'parent_report',
  /** 施測項目由家長操作 —— dev、gm、soc、lang、adp、voc、asq。 */
  'parent_administered_task',
  /** adl 由家長評定，未經治療師覆核 4／5 分界。 */
  'rater_not_credentialed',
  /** asr 由家長填答（原設計由治療師觀察後評定）。 */
  'rater_role_parent',
  /** 用來判級的面向適用題數 ≤ 6。 */
  'few_items',
  /** mchat-rf 3–7 分，第二階段訪談未做。 */
  'follow_up_not_done',
  /** asb／asr 前置題答有倒退。 */
  'regression_reported',
  /** att 前置題 < 6 個月。 */
  'recent_onset',
  /** ab 前置題只勾一個場合。 */
  'single_setting',
  /** spa／spb 前置題勾「無」。 */
  'no_functional_impact',
  /** chexi：只有相對百分比，無切分。 */
  'descriptive_only',
  /** lang／voc 判 refer，或 mchat-rf 第 2 題答「是」。 */
  'hearing_check_first',
  /** sxk-asq 只涵蓋三歲前後，不宜跨年齡比較。 */
  'narrow_window',
  /** asb SH 第 8 項「出现自伤行为」答 ≥2。**報告置頂**。 */
  'safety_concern',
] as const;

export type Caveat = (typeof CAVEATS)[number];

/**
 * v1 有、v2 拿掉的三個。留在這裡是為了讓測試擋住它們回流 ——
 * 舊規格的 `basal_not_established` 依賴 DQ 常模（不存在）、
 * `known_scoring_defect_corrected` 依賴 23 份量表的稽核（已作廢）、
 * `license_pending` 的四份版權工具已換掉。
 */
export const RETIRED_CAVEATS: ReadonlyArray<string> = [
  'basal_not_established',
  'known_scoring_defect_corrected',
  'license_pending',
];

/**
 * 22 支全部都帶的。`ToolSpec.fixedCaveats` 不逐支重複寫它 ——
 * 「全部都是」寫 22 次，等於給了 22 個各自漏掉的機會。
 */
export const UNIVERSAL_CAVEATS: ReadonlyArray<Caveat> = ['parent_report'];

const CAVEAT_SET: ReadonlySet<string> = new Set<string>(CAVEATS);

export function isCaveat(value: string): value is Caveat {
  return CAVEAT_SET.has(value);
}

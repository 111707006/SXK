/**
 * 新版 T1 報告（`T1_REPORT_REAL`，2026-10-08）存進報告快照的形狀，前端與伺服器共用。
 *
 * 【畫面怎麼知道要畫哪一版】
 * 看**快照**，不看開關：伺服器開了 `T1_REPORT_REAL`（只在專案 A）才會產出帶 `version` 的報告，
 * 報告頁（`ReportBody.tsx`）看到 `version === T1_REPORT_REAL_VERSION` 才換成新版的幾塊。
 * 同 T2 v3 報告（快照是 `kit-20260923` 才換 `T2ReportV3`）。所以：
 * - 前端不必另外問伺服器開關開了沒，也不必重新建置；
 * - 開關開著以前存下的舊報告照舊畫（四個儀表那份快照裡就有，那是家長當時看到的）；
 * - 開關關掉，新生成的又是舊版；已經存下的新版照新版畫（它沒有儀表數字可畫）。
 *
 * 這一檔只放形狀與判斷，不放驗證器與模板（`report.ts`，伺服器用，它會拉進 T2 的黑名單）。
 */

export const T1_REPORT_REAL_VERSION = 't1-real-1' as const;

export interface T1DimensionNote {
  dimensionId: string;
  /** 這一方面這次作答的樣子＋可以從哪裡練起（白話，給家長）。 */
  note: string;
}

/**
 * 新版的報告文字。欄位名沿用舊版（`summary`、`rehabSuggestions`、`homeGuidance`、`prognosisPrediction`），
 * 後台、匯出與掃碼那一頁讀舊欄位照樣讀得到；新版另加 `version` 與 `perDimension`。
 *
 * - `prognosisPrediction`：新版放的是「接下来怎么做」，**不是預測**（T1 沒有任何依據說三個月後會怎樣）。
 *   欄位名不改，是為了舊的讀取端（匯出頁、後台）不必改就讀得到。
 * - `neuralPathwayAnalysis`：新版一律空字串（腦神經術語那一段 2026 年前已經不畫，新版不再請模型寫）。
 * - **沒有 `criticalMetrics`**：四個儀表的數字是編的，新版不產。
 */
export interface T1RealReport {
  version: typeof T1_REPORT_REAL_VERSION;
  summary: string;
  perDimension: T1DimensionNote[];
  rehabSuggestions: string[];
  homeGuidance: string[];
  prognosisPrediction: string;
  neuralPathwayAnalysis: '';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 這份報告是不是新版（看快照上的 `version`）。 */
export function isRealT1Report(aiReport: unknown): boolean {
  return isRecord(aiReport) && aiReport.version === T1_REPORT_REAL_VERSION;
}

/** 從快照讀 `perDimension`，形狀不對的條目丟掉（快照是 JSON，型別擋不住）。 */
export function dimensionNotesOf(aiReport: unknown): T1DimensionNote[] {
  if (!isRecord(aiReport) || !Array.isArray(aiReport.perDimension)) return [];
  return aiReport.perDimension.filter(
    (n): n is T1DimensionNote => isRecord(n) && typeof n.dimensionId === 'string' && typeof n.note === 'string',
  ).map(n => ({ dimensionId: n.dimensionId, note: n.note }));
}

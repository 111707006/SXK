/**
 * 報告來源的三態標示 —— T1 報告本體（`ReportBody.tsx`）與 T2 報告頁（`T2Report.tsx`）共用。
 *
 * `true` 是模型寫的、`false` 是本地模板兜底、`null`／`undefined` 是舊紀錄沒存這個旗標。
 * 第三種**不可**當成 AI：舊版前端從來沒存過這一欄，把它顯示成「AI 生成」等於替一份
 * 不知道誰寫的報告背書（`src/types.ts` 的 `isAiGenerated` 註解）。
 */
export function reportSourceLabel(isAiGenerated: boolean | null | undefined): string {
  return isAiGenerated === true ? 'AI 生成' : isAiGenerated === false ? '本地模板生成' : '来源未记录';
}

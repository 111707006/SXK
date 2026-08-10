/**
 * Vite 於建置時注入的環境變數型別宣告。
 *
 * `VITE_APP_MODE` 決定這份建置產物屬於哪一個產品：
 *   VITE_APP_MODE=full   pnpm build   → 專案 A（完整版，含深度評估與付費）
 *   VITE_APP_MODE=t1only pnpm build   → 專案 B（篩查 + 聯繫專家）
 *
 * 實際的分歧內容集中在 `src/productConfig.ts`。
 */
interface ImportMetaEnv {
  /**
   * 刻意宣告為 string 而非 `'full' | 't1only'` —— 這個值來自建置環境，
   * 打錯字時型別系統擋不住。合法值由 `productConfig.ts` 的 `resolveMode()`
   * 在執行期驗證並在無法辨識時直接拋錯。
   */
  readonly VITE_APP_MODE?: string;

  /**
   * ICP 備案號，顯示在頁面底部並連回工信部查詢頁（`src/components/BeianFooter.tsx`）。
   *
   * 未設定是正常狀態 —— 本機開發與境外部署都沒有備案號，那時整段不渲染。
   * 但**中國大陸的正式站少了它會被要求整改乃至關停接入**，所以正式建置一定要帶。
   */
  readonly VITE_ICP_BEIAN?: string;

  /** 公安網備號，上線滿 30 日內辦理。與 ICP 號同一處顯示。 */
  readonly VITE_POLICE_BEIAN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

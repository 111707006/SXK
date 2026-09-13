/**
 * 「後台填進來、家長端原樣貼上去」的那種網址，允許長什麼樣。
 *
 * 兩個呼叫端共用這一份：活動的分解圖與示範連結（`activitySteps.ts`、`activityAdmin.ts`），
 * 以及合作公司的 LOGO（`companies.logo_url`）。分成兩套規則的話，其中一套
 * 遲早會少擋一種東西，而少擋的那一種正是這個函式存在的理由。
 *
 * 【只收兩種】
 *
 * `https://…`
 *   家長端整站走 https。`http://` 的圖會被瀏覽器當成**混合內容**擋掉 ——
 *   後台看起來存好了，家長那邊是一張破圖，而且沒有人會收到訊息。
 *
 * `/…`（站內路徑）
 *   這個 repo **沒有檔案上傳能力**，外部依賴清冊裡也沒有物件儲存服務
 *   （見 `docs/adr/0003`）。隨著建置一起出貨的 `public/` 圖檔是唯一不依賴
 *   外部主機的來源，所以這條要放行。
 *
 * 【擋掉的兩種，理由不是格式而是安全】
 *
 * `javascript:` 與 `data:`
 *   那是把一段可執行的東西存進資料庫，再原樣貼到家長的頁面上。
 *
 * `//example.com`
 *   協定相對網址，長得像站內路徑但其實指向外部主機 —— 它會沿用當前頁面的
 *   協定，在 https 頁面上是 `https://example.com`。看起來被「站內路徑」那條
 *   放行了，實際上是外連。
 */
export function isAllowedAssetUrl(value: string): boolean {
  if (value.startsWith('https://')) return value.length > 'https://'.length;
  return value.startsWith('/') && !value.startsWith('//');
}

/** 兩個呼叫端共用的錯誤說法。`what` 是那個欄位在畫面上的稱呼。 */
export function assetUrlError(what: string): string {
  return `${what}必须是 https:// 开头的网址，或站内的 / 路径。`;
}

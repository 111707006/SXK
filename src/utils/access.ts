/**
 * 深度評估的存取決策。
 *
 * 抽成純函式而非寫在元件裡，是因為它有四個互相影響的輸入（付費牆旗標、後端
 * 是否有持久層、是否登入、已解鎖清單），而判錯的方向不對稱 ——
 * 判太鬆是把付費內容免費送出去，判太緊是收了錢卻進不去。這種東西要能單獨測，
 * 見 `test/access.test.ts`。
 *
 * `paywallEnabled` 刻意由呼叫端傳入（來源是 `PRODUCT.features.paywall`）而非在
 * 這裡直接讀 —— 這樣專案 B 的行為才測得到，否則測試會永遠跑在建置當下的模式。
 *
 * ⚠️ 這只是**畫面的判斷**。真正的閘門在 `server.ts` 的 `denyIfLocked`：
 * 前端擋畫面、後端擋資料，缺一不可 —— 只做前端的話，知道網址的人照樣拿得到。
 */
export type DimensionAccess =
  /** 可直接進入深度評估 */
  | 'open'
  /** 需先付費，導向付費牆 */
  | 'locked'
  /**
   * 展示模式：後端沒有持久層，付費牆**擋不住也不該擋**，但畫面仍要看得到
   * 它長什麼樣子。導向付費牆，並在那裡提供明確標示的略過入口。
   *
   * 與 `locked` 分成兩種而不是共用一個，是因為它們的**去處相同、結果相反** ——
   * 混成一個就會變成「付費牆可以略過」這種永遠不該存在於正式環境的狀態。
   * 資料庫一接上，這個值就再也不會出現。
   */
  | 'demo'
  /** 尚未登入，無法判斷權益，導向登入 */
  | 'needs_login';

export interface AccessInput {
  /** 本建置是否有付費牆（`PRODUCT.features.paywall`）。專案 B 為 `false`。 */
  paywallEnabled: boolean;
  /**
   * `GET /api/unlocks` 的 `available` —— 後端沒接資料庫時為 `false`。
   * 此時不可能有人買得成（`/api/payment/create` 同樣回 503），
   * 擋住只會讓展示站的深度評估整條路死掉，所以放行。
   *
   * `null` 代表**尚未確定**（查詢還沒回來或失敗），一律當作付費牆會執行 ——
   * 不確定的時候放行，等於在每次載入時開一個免費視窗。
   */
  unlocksAvailable: boolean | null;
  /** 是否已登入（有 token） */
  isLoggedIn: boolean;
  /** `GET /api/unlocks` 回傳的已解鎖維度；尚未查詢完成時為 `null` */
  unlockedDimensionIds: string[] | null;
}

export function getDimensionAccess(dimensionId: string, input: AccessInput): DimensionAccess {
  // 專案 B 沒有深度評估也沒有付費牆，這個函式不該影響它的任何流程。
  if (!input.paywallEnabled) return 'open';

  // 後端沒有持久層 → 沒有任何購買存在的可能，付費牆無從執行（展示模式）。
  // 只有明確的 false 才是展示模式；`null`（尚未確定）走下面的正常判斷。
  if (input.unlocksAvailable === false) return 'demo';

  if (!input.isLoggedIn) return 'needs_login';

  // 查詢尚未回來時**當作未解鎖**。反過來（樂觀放行）會在每次重新整理後開一個
  // 短暫的免費視窗，而那正是最容易被發現與濫用的一種漏洞。
  if (input.unlockedDimensionIds === null) return 'locked';

  return input.unlockedDimensionIds.includes(dimensionId) ? 'open' : 'locked';
}

/**
 * 付費 UI（鎖頭、價格、付費牆）是否出現在畫面上。
 *
 * **只看建置模式** —— 專案 B 沒有付費牆，其餘一律顯示。展示模式也顯示，
 * 因為看不到的東西沒辦法拿給人看；差別在那裡的付費牆可以略過，
 * 而那件事由 `getDimensionAccess` 回的 `'demo'` 負責，不在這裡判斷。
 */
export function isPaywallActive(input: Pick<AccessInput, 'paywallEnabled'>): boolean {
  return input.paywallEnabled;
}

/**
 * 公司條件的唯一產生處。
 *
 * 專案 B 以**一個資料庫**服務多家合作公司，代價是漏一個 `WHERE` 就跨公司外洩。
 * 這與 2026-07-31 修掉的付費閘門授權繞過是完全相同的失敗形狀 —— 檢查的東西
 * 與實際回應的東西不是同一個 —— 只是炸開的範圍從一筆 ¥19.9 變成別家公司的
 * 孩子的健康資料。
 *
 * 因此公司條件**不由各個查詢自行拼裝**，而是由這裡從檢視者的身分產生：
 *
 *   身分（來自工作階段） → resolveCompanyCondition() → CompanyCondition
 *                                                       ↓
 *                              companyWhereSql() / matchesCompanyCondition()
 *
 * 三個型別上的刻意選擇，每一個都擋掉一種寫得出來的錯：
 *
 * 1. `CompanyCondition` **沒有「全部公司」這個值**。想查全部就必須先改這個型別，
 *    而改型別是一個看得見的動作 —— 不像少寫一個 `WHERE` 那樣沒有痕跡。
 * 2. `resolveCompanyCondition` 回傳的是 `ok: true | false` 的判別聯集，不是
 *    `CompanyCondition | null`。忘了處理 `false` 會是型別錯誤，而不是一個
 *    悄悄變成 undefined 的條件。
 * 3. `companyWhereSql` **永遠**回傳非空的 SQL 片段。沒有任何輸入能讓它產出空字串。
 */

/** 後台成員的兩種角色。合作公司無法自行增刪帳號，由森心康代為處理。 */
export type AdminRole = 'global_admin' | 'company_member';

/**
 * 全域管理員當下選定的視野。
 *
 * `unassigned` 是一個**明確的選擇**，不是「沒選」：沒帶識別碼進站的家長要有人
 * 看得到，否則他們等於憑空消失。
 */
export type CompanySelection =
  | { kind: 'company'; companyId: number }
  | { kind: 'unassigned' };

/**
 * 檢視者的身分。**只能來自工作階段**，不可由請求參數拼出來 ——
 * 若 `companyId` 讀自 query string，整套隔離就只是一個換數字的遊戲。
 */
export type AdminIdentity =
  | {
      role: 'company_member';
      adminUserId: number;
      email: string;
      companyId: number;
    }
  | {
      role: 'global_admin';
      adminUserId: number;
      email: string;
      /** `null` = 尚未選定任何公司，此時取不到任何個別家長資料。 */
      selection: CompanySelection | null;
    };

/**
 * 資料查詢的公司條件。
 *
 * 刻意只有兩個值，沒有第三個代表「不過濾」的值。
 */
export type CompanyCondition =
  | { kind: 'company'; companyId: number }
  | { kind: 'unassigned' };

export type ScopeDenialReason = 'NO_COMPANY_SELECTED';

export type ScopeResult =
  | { ok: true; condition: CompanyCondition }
  | { ok: false; reason: ScopeDenialReason };

/**
 * 從身分產生公司條件。**後台的每一次家長資料查詢都必須經過這裡。**
 *
 * 全域管理員未選定公司時回 `ok: false` 而不是「看得到全部」：若「看得到所有
 * 公司」是預設狀態，誤看永遠不會被發現。看別家的資料必須是一個明確的動作。
 */
export function resolveCompanyCondition(identity: AdminIdentity): ScopeResult {
  if (identity.role === 'company_member') {
    return { ok: true, condition: { kind: 'company', companyId: identity.companyId } };
  }

  if (identity.selection === null) {
    return { ok: false, reason: 'NO_COMPANY_SELECTED' };
  }

  return { ok: true, condition: identity.selection };
}

/**
 * 把條件翻成 SQL 片段。
 *
 * 回傳的 `sql` **永遠非空**，呼叫端直接 `WHERE ${sql}` 即可，不需要（也不該）
 * 判斷「有沒有條件」—— 那個判斷正是漏掉條件的入口。
 */
export function companyWhereSql(
  condition: CompanyCondition,
  column = 'u.company_id'
): { sql: string; params: Array<string | number> } {
  switch (condition.kind) {
    case 'company':
      return { sql: `${column} = ?`, params: [condition.companyId] };
    case 'unassigned':
      // 未歸屬用 `IS NULL` 而非 `= NULL`。後者在 SQL 裡永遠不成立，
      // 會安靜地回傳零筆，看起來像「這家公司沒有家長」。
      return { sql: `${column} IS NULL`, params: [] };
  }
}

/**
 * 同一個條件的記憶體版本。
 *
 * 存在的理由不是方便，是**兩條路必須由同一個 `CompanyCondition` 決定**：
 * 測試裡的資料層替身用這個函式過濾，正式查詢用 `companyWhereSql`，
 * 兩者共用上游的 `resolveCompanyCondition`。
 */
export function matchesCompanyCondition(
  condition: CompanyCondition,
  row: { companyId: number | null }
): boolean {
  switch (condition.kind) {
    case 'company':
      return row.companyId === condition.companyId;
    case 'unassigned':
      return row.companyId === null;
  }
}

/** 給日誌與畫面用的簡短說法。不參與任何授權判斷。 */
export function describeCondition(condition: CompanyCondition): string {
  return condition.kind === 'company' ? `company#${condition.companyId}` : 'unassigned';
}

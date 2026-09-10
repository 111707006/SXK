/**
 * 合作公司的進站識別碼長什麼樣 —— **全站唯一的一份**。
 *
 * 連結長這樣：`https://<網域>/?c=<識別碼>`。它要印在傳單上、貼在轉發的訊息裡，
 * 所以只收小寫英數與連字號，長度 2–64。
 *
 * 【為什麼要收成一份】
 * 這條規則原本抄在三個地方（前端的 `attribution.ts`、後台的 `admin/routes.ts`，
 * 以及一句「與後端 SLUG_PATTERN 相同」的註解在負責維持同步）。兩邊分岔的後果
 * 特別安靜：前端覺得格式合法、記了下來，後端覺得不合法、判為未歸屬 ——
 * 家長照樣註冊成功，只是**歸到了錯的地方**，而歸屬不可逆。
 */

/** 小寫英數與連字號，開頭不能是連字號，長度 2–64。 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

export function isValidCompanySlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

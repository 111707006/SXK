/**
 * 頁首徽章（`/api/company-badge`）與客服二維碼（`/api/wecom-qr`）看哪一個單位（#121，ADR-0020）。純函式，兩支端點共用，
 * 免得一支改看服務關係、另一支還看帳號歸屬。
 *
 * - 已登入、服務關係開著：看 `service_relations`（沒有列＝森心康直屬，呼叫端回預設）。連結上的 `?c=` 不算 ——
 *   掛不掛上、要不要問家長是登入流程的事，頁首只畫現在服務的單位。
 * - 已登入、開關關著：照舊看帳號歸屬（`users.company_id`）。
 * - 沒登入：不管開關，照舊看 `?c=`。
 */

export type HeaderUnitLookup =
  | { kind: 'service_relation'; userId: number }
  | { kind: 'account'; userId: number }
  | { kind: 'slug'; slug: string }
  | { kind: 'none' };

export interface HeaderUnitInput {
  /** 服務關係開關（已經套過「只在 A」）。 */
  serviceRelations: boolean;
  /** 資料庫的 `users.id`；沒登入（或記憶體模式的帳號）是 null。 */
  userId: number | null;
  /** 進站代號，呼叫端已經驗過形狀；沒帶或形狀不對是 null。 */
  slug: string | null;
}

export function headerUnitLookup(input: HeaderUnitInput): HeaderUnitLookup {
  if (input.userId !== null) {
    return input.serviceRelations ? { kind: 'service_relation', userId: input.userId } : { kind: 'account', userId: input.userId };
  }
  return input.slug ? { kind: 'slug', slug: input.slug } : { kind: 'none' };
}

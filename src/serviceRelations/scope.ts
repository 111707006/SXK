/**
 * 服務關係開關開著時的後台範圍（#119／#118，ADR-0020 第 3 點）。**只在專案 A**。
 *
 * 誰看得到哪位家長改看 `service_relations`：不看帳號歸屬（`users.company_id`，現在是篩查渠道），
 * 也不看推薦綁定（`referrer_bindings`）。條件仍是 `CompanyCondition` 那三種 kind，多一個 `byService` 記號：
 *
 * - company＋byService：服務關係在這個單位（含還沒標注推薦人的）——單位管理者、全域管理員選了單位
 * - referrer＋byService：服務關係標注給這位推薦人
 * - unassigned＋byService：沒有服務關係（森心康直屬）——全域管理員的直屬視野（暫採：取代「沒有歸屬」）
 *
 * kind 不變，所以「只有單位才有」的那幾件事（專家、本單位設定、導出紀錄的 scope_kind）照舊。
 * `companyWhereSql`／`matchesCompanyCondition` 各用一行轉到這裡，SQL 版與記憶體版說同一句話。
 */
import type { AdminCenterShape, CompanyCondition, ScopeResult } from '../admin/companyScope';
import type { ServiceRelation } from './rules';

/** 開關開著（`shape.serviceRelations`）就在條件上加 `byService`；擋下的結果原樣回。路由層 `withScope` 用。 */
export function withServiceBasis(result: ScopeResult, shape: AdminCenterShape): ScopeResult {
  if (!result.ok || !shape.serviceRelations) return result;
  return { ok: true, condition: { ...result.condition, byService: true } };
}

/**
 * `byService` 條件的 SQL；沒有 `byService`、或不是以 `users u` 為主的查詢（專家 `s.company_id`、單位 `c.id`），
 * 回 null 讓 `companyWhereSql` 照原本的寫法（專家、本單位設定本來就看那一欄）。
 */
export function serviceWhereSql(
  condition: CompanyCondition,
  column: string
): { sql: string; params: Array<string | number> } | null {
  if (!condition.byService || column !== 'u.company_id') return null;
  switch (condition.kind) {
    case 'company':
      return {
        sql: 'EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id AND sr.company_id = ?)',
        params: [condition.companyId],
      };
    case 'referrer':
      return {
        sql: 'EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id AND sr.referrer_id = ?)',
        params: [condition.referrerId],
      };
    case 'unassigned':
      return { sql: 'NOT EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id)', params: [] };
  }
}

/** 同一句話的記憶體版（測試的資料層替身用）。`service` 是 null＝沒有服務關係；列沒帶服務關係一律當作沒有，不放寬。 */
export function matchesServiceCondition(condition: CompanyCondition, service: ServiceRelation | null): boolean {
  switch (condition.kind) {
    case 'company':
      return service !== null && service.companyId === condition.companyId;
    case 'referrer':
      return service !== null && service.referrerId === condition.referrerId;
    case 'unassigned':
      return service === null;
  }
}

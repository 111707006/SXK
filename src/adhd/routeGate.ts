/**
 * 成人 ADHD（`APP_MODE=adhd`）這個程序**只開哪些路徑**。
 *
 * `server.ts` 的路由大多直接掛在 `app` 上（A、B 都有）：孩子資料 `/api/db/*`、T1 報告 `/api/report`、
 * 掃碼報告 `/r/:token`、專家預約……這些在 ADHD 都不該存在。不去一支支搬到另一個 Router 上（動到 A、B），
 * 改成在最前面放一道白名單：`/api` 底下只有下面這幾支放行，其他一律 404；`/r/`、`/internal/` 也是 404。
 * 白名單是 fail-closed：之後 `server.ts` 多一支端點，ADHD 預設拿不到。
 *
 * 設計：`docs/specs/adhd-product-design.md` 第 2.1 節。
 */

/** 完全相等才放行。 */
const EXACT = new Set([
  '/api/auth/sms/request',
  '/api/auth/sms/verify',
  '/api/company-brand',
  '/api/db/status',
  '/api/csp-report',
  '/api/admin',
]);

/** 前綴（含結尾斜線）放行。 */
const PREFIXES = ['/api/adhd/', '/api/admin/'];

/** 不在 `/api` 底下、但在 ADHD 也要 404 的伺服器端路徑。 */
const BLOCKED_PREFIXES = ['/r/', '/internal/'];

export type AdhdGateVerdict = 'pass' | 'not_found';

/** `path` 是 `req.path`（不含查詢字串）。 */
export function adhdRouteVerdict(path: string): AdhdGateVerdict {
  if (path === '/api' || path.startsWith('/api/')) {
    if (EXACT.has(path)) return 'pass';
    return PREFIXES.some(p => path.startsWith(p)) ? 'pass' : 'not_found';
  }
  if (path === '/r' || path === '/internal') return 'not_found';
  return BLOCKED_PREFIXES.some(p => path.startsWith(p)) ? 'not_found' : 'pass';
}

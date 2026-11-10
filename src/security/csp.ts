/**
 * Content-Security-Policy（2026-11-10 稽核）。家長端的通行證放在 localStorage，一段 XSS 就拿得走，
 * CSP 是那一層的保險。**分三步開**，避免一次把正式站弄壞：
 *
 * - `CSP_MODE` 不設／`off`：不送（照舊）。
 * - `report`：送 `Content-Security-Policy-Report-Only`，瀏覽器只回報、不擋；違規寫進日誌（`/api/csp-report`）。
 * - `enforce`：送 `Content-Security-Policy`，真的擋。看過一段時間 report 的日誌、確定沒有正常功能被擋才開。
 *
 * 來源照現況列（不放寬到 `*`）：
 * - 程式、字型、樣式表都是自己站上的（Vite 打包、字檔自己放；`index.html` 沒有 inline script）。
 * - `style-src 'unsafe-inline'`：React 的 `style={{…}}` 與伺服器畫的 HTML（掃碼報告舊版、後台匯出）用 inline 樣式。
 *   樣式注入能做的事比腳本小得多；腳本仍然只收自己站上的。
 * - 圖片：合作公司 LOGO、首頁素材的連結可以是任何 https 網址（`isAllowedAssetUrl`），QR 碼是 data URI，
 *   後台抽封面用 blob。
 * - 影音：`/media` 是自己站上的；後台上傳前在瀏覽器裡預覽用 blob；首頁短片連結可以是 https。
 */
export type CspMode = 'off' | 'report' | 'enforce';

export function readCspMode(raw: string | undefined): CspMode {
  const v = (raw ?? '').trim();
  if (v === '' || v === 'off' || v === '0') return 'off';
  if (v === 'report' || v === 'enforce') return v;
  throw new Error(`CSP_MODE="${raw}" is not recognised: use off, report or enforce`);
}

export const CSP_REPORT_PATH = '/api/csp-report';

export function cspDirectives(): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
    'report-uri': [CSP_REPORT_PATH],
  };
}

/** 一筆違規回報 → 日誌一行（只留指令、被擋的來源與頁面路徑；掃碼 token 與查詢字串不進日誌）。 */
export function summariseCspReport(body: unknown): string | null {
  const r = typeof body === 'object' && body !== null ? ((body as Record<string, unknown>)['csp-report'] ?? body) : null;
  if (typeof r !== 'object' || r === null) return null;
  const x = r as Record<string, unknown>;
  const directive = String(x['effective-directive'] ?? x['violated-directive'] ?? x.effectiveDirective ?? '').slice(0, 60);
  const blocked = String(x['blocked-uri'] ?? x.blockedURL ?? '').slice(0, 160);
  // 掃碼報告的 token 在路徑裡（`/r/<token>`），網址片段（`#code=`）瀏覽器不會送，查詢字串一律去掉
  const page = String(x['document-uri'] ?? x.documentURL ?? '').split(/[?#]/)[0].replace(/\/r\/[^/]+/, '/r/…').slice(0, 120);
  if (!directive) return null;
  return `${directive} blocked=${blocked || '(inline)'} page=${page}`;
}

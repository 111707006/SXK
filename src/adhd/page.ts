/**
 * 成人 ADHD（`APP_MODE=adhd`）的作答與報告頁：客戶的單頁 HTML 原樣，只在 `</body>` 前插一行 script。
 *
 * 設計：`docs/specs/adhd-product-design.md` 第 3 節（2026-11-23）。客戶原檔放在 `ADHD/`，一個位元組都不改；
 * 我們加的東西全部在 `src/adhd/bridge.js`（登入、存檔、只讀檢視），這裡只負責把那一行插進去。
 *
 * 客戶換版：把新檔放進 `ADHD/`、改 `ADHD_PAGE_FILE`／`ADHD_PAGE_VERSION`。探針（`PAGE_PROBES`）是 bridge
 * 用到的全域變數；新版少了哪一個，`patchAdhdPage` 直接丟錯（建置與伺服器啟動都會停），不會靜靜壞掉。
 *
 * 純函式，不碰檔案系統：建置（`vite.config.ts`）與伺服器（`server.ts`，開發模式）各自讀檔再叫它。
 */

/** 客戶頁面的版本（頁面上「改版时间」）。每一筆存檔都記這個值。 */
export const ADHD_PAGE_VERSION = '20261111';

/** 客戶原檔，相對於 repo 根目錄。 */
export const ADHD_PAGE_FILE = 'ADHD/成人ADHD筛查版_20261111.html';

/** bridge 的原始檔，相對於 repo 根目錄。 */
export const ADHD_BRIDGE_FILE = 'src/adhd/bridge.js';

/** 頁面在站上的位置。 */
export const ASSESS_PATH = '/assess/';
export const BRIDGE_PATH = '/assess/bridge.js';

/**
 * bridge 依賴的客戶頁面全域變數。每一條都是頁面原始碼裡的一段字（不執行頁面）。
 * 改這裡之前先看 bridge.js 用到了什麼。
 */
export const PAGE_PROBES: readonly { name: string; text: string }[] = [
  { name: 'APP（全域狀態，APP.d.s2 是報告結果）', text: 'var APP={' },
  { name: 'go（換頁）', text: 'function go(k){' },
  { name: 'casePayload（整份個案 JSON）', text: 'casePayload=function(){' },
  { name: 'loadCase（載入個案 JSON）', text: 'loadCase=function(raw){' },
  { name: 'resetCase（開新個案）', text: 'resetCase=function(){' },
  { name: '個案 JSON 的 system 標記', text: "system:'SXK-ADHD-SCREEN'" },
  { name: '報告頁區塊', text: 'id="st_s2"' },
];

/** 插進去的那一段（前後各一個換行，原檔其他位元組不動）。 */
export function bridgeTag(bridgeVersion: string): string {
  if (!/^[0-9a-f]{8,64}$/.test(bridgeVersion)) throw new Error(`bridge 版本格式不對：${bridgeVersion}`);
  return (
    `<!-- SXK 2026-11-23：登入與存檔（src/adhd/bridge.js）；客戶原檔其餘不改 -->\n` +
    `<script src="${BRIDGE_PATH}?v=${bridgeVersion}"></script>\n`
  );
}

/** 原檔 → 站上那一份。探針少一個、`</body>` 不是恰好一個都丟錯。 */
export function patchAdhdPage(html: string, bridgeVersion: string): string {
  const missing = PAGE_PROBES.filter(p => !html.includes(p.text)).map(p => p.name);
  if (missing.length) {
    throw new Error(`客戶 ADHD 頁面少了 bridge 依賴的東西：${missing.join('、')}。客戶換版了？先看 src/adhd/bridge.js。`);
  }
  const at = html.indexOf('</body>');
  if (at < 0 || html.indexOf('</body>', at + 1) >= 0) {
    throw new Error('客戶 ADHD 頁面的 </body> 不是恰好一個，不知道插在哪裡。');
  }
  return html.slice(0, at) + bridgeTag(bridgeVersion) + html.slice(at);
}

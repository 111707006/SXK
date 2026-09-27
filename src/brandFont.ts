/**
 * 全站字型：思源黑体（2026-09 居家訓練評審會議定案：規避版權風險，所有頁面統一換成開源字型）。
 *
 * 【為什麼是 Noto Sans SC】
 * 思源黑体（Source Han Sans）與 Noto Sans CJK 是同一套字、兩個品牌名，SIL OFL 1.1，可商用、可內嵌、
 * 可隨網頁散佈。套件用 `@fontsource-variable/noto-sans-sc`：一份可變字重（100–900 都在同一檔），
 * 依 unicode-range 切成 101 片 woff2 —— 瀏覽器只下載這一頁用到的那幾片，不是整套 8 MB。
 *
 * 【為什麼自己放，不走 Google Fonts】
 * 家長在中國大陸，`fonts.googleapis.com` 在那裡多半連不上；連不上時畫面照樣出得來，只是悄悄退回
 * 手機的系統字 —— 等於沒換。所以字檔跟著 `dist/` 從我們自己的主機出去。
 *
 * 【為什麼路徑固定、帶版本號】
 * 伺服器自己吐的兩頁 HTML（家長掃碼帶走的 `/r/:token`、連結失效頁）不經過 Vite，拿不到打包後
 * 帶雜湊的檔名，所以字檔放在固定路徑 `/fonts/noto-sans-sc-<版本>/`（`vite.config.ts` 的
 * `brandFont()` 在建置時複製過去、開發時直接供應）。路徑帶版本號，伺服器才能放心叫瀏覽器快取一年：
 * 升級套件就換一個目錄，舊快取自然不會被讀到。**升級套件時要改下面的版本號**，不一致建置會停下來。
 *
 * 【備援只寫 sans-serif】
 * 字片還在下載的那一瞬間（`font-display: swap`）與極少數下載失敗時，瀏覽器用裝置自己的黑體。
 * 不點名任何一套商用字型：以前這裡寫的是 "Microsoft YaHei"，而家長掃碼那一頁會被「列印 → 另存為
 * PDF」交給專家 —— 另存 PDF 會把字型內嵌進檔案，那正是要規避的事。
 */

/** `@fontsource-variable/noto-sans-sc` 的版本。與 `package.json` 不一致時建置會停下來。 */
export const BRAND_FONT_VERSION = '5.3.0';

/** 字檔在 `dist/` 底下（也就是網址上）的目錄，不含開頭的斜線。 */
export const BRAND_FONT_DIR = `fonts/noto-sans-sc-${BRAND_FONT_VERSION}`;

/** 那一份 `@font-face` 宣告的網址。 */
export const BRAND_FONT_CSS_HREF = `/${BRAND_FONT_DIR}/index.css`;

/**
 * 全站唯一的字型堆疊。`src/index.css` 的三個字型 token 抄的是這一行（CSS 讀不到 TS，
 * 由 `test/brandFont.test.ts` 比對）；canvas 上寫字、伺服器吐的 HTML 直接用它。
 * 第一個是套件宣告的名字；第二、三個是裝置上若本來就裝了思源黑体時的名字。
 */
export const BRAND_FONT_STACK = '"Noto Sans SC Variable", "Source Han Sans SC", "Noto Sans SC", sans-serif';

/** 伺服器吐的 HTML 放在 `<head>` 裡的那一行。 */
export const BRAND_FONT_LINK_TAG = `<link rel="stylesheet" href="${BRAND_FONT_CSS_HREF}">`;

/*
 * SXK 2026-11-23 加：成人 ADHD 頁面（客戶原檔 ADHD/成人ADHD筛查版_20261111.html）的橋接腳本。
 * 客戶原檔一個位元組都不改；我們加的行為全部在這一檔（設計：docs/specs/adhd-product-design.md 第 3 節）。
 * 由 src/adhd/page.ts 插在 </body> 前，頁面其他 script 都跑完之後才跑。
 *
 * 純 ES5、不打包、不 import —— 跟客戶頁面同一個執行環境。
 */
(function () {
  'use strict';
})();

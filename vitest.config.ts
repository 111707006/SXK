import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * 測試用的獨立設定，刻意不沿用 `vite.config.ts`。
 *
 * 兩個理由：
 * 1. 測試全部跑在 node 上，不需要 react / tailwind 外掛，載入它們只是拖慢啟動。
 * 2. `setupFiles` 必須在載入 `server.ts` 之前把環境變數釘好 —— 那個模組在
 *    import 當下就會 `dotenv.config()` 讀取本機 `.env`，而本機 `.env` 是有
 *    MYSQL_* 的。沒有這一步，HTTP 測試會安靜地打到真的資料庫。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    setupFiles: ['./test/setup/testEnv.ts'],

    // HTTP 測試的 `beforeAll` 不是在準備資料，而是 `await import('../../server')`
    // —— 完整 transform 並執行整個伺服器模組圖，而且**每支測試檔各自載入一份**。
    //
    // 那份重複是刻意的，不是浪費：`loadApp()` 得用動態 import 才能讓 `vi.mock`
    // 來得及裝上替身，而 `server.ts` 有模組層級狀態（速率限制器、依 `APP_MODE`
    // 組出來的路由），共用一份會讓 `adminIsolation.http.test.ts` 這種在檔案頂端
    // 覆寫 `APP_MODE` 的測試安靜地驗到另一個產品。
    //
    // 這段載入單獨跑約 1.6 秒，完整套件在 12 核上平行跑時是 5.6–6.3 秒 ——
    // 貼著 vitest 預設的 10 秒。跨過去不會得到一條紅色斷言，而是整個檔案的
    // `beforeAll` 逾時、該檔測試全部標記成 skipped：2026-08-15 實測連續三次
    // 都有 10 個檔案這樣掉出去、173 條沒跑，而總結行寫的是「0 failed」。
    //
    // 所以這個數字不是「讓慢的測試過關」，是讓**失敗看起來像失敗**。
    // 由 `test/hookTimeout.structure.test.ts` 釘住。
    hookTimeout: 30_000,
  },
});

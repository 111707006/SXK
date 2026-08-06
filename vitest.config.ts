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
  },
});

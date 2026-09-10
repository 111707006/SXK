import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 釘住 `vitest.config.ts` 的 `hookTimeout`。
 *
 * 為什麼需要這一條：12 支 HTTP 測試的 `beforeAll` 做的不是「準備一點資料」，
 * 而是 `await import('../../server')` —— 完整 transform 並執行整個伺服器模組圖
 * （express、helmet、bcryptjs、axios、`@google/genai`、`coze-coding-dev-sdk`，
 * 加上整個 `src/`）。而且**每一支測試檔都要各自載入一次**，那是刻意的：
 * `loadApp()` 用動態 import 才能讓 `vi.mock` 來得及裝上替身（見該函式的說明），
 * 而 `server.ts` 有模組層級狀態（速率限制器、依 `APP_MODE` 組出來的路由），
 * 共用一份會讓 `adminIsolation.http.test.ts` 這種在檔案頂端覆寫 `APP_MODE`
 * 的測試安靜地驗到另一個產品。
 *
 * 這段載入單獨跑約 1.6 秒，但完整套件在 12 核上平行跑時要 5.6–6.3 秒 ——
 * 貼著 vitest 預設的 10 秒在跳。跨過去的後果不是一條斷言失敗，而是**整個檔案的
 * `beforeAll` 逾時、該檔所有測試被標記為 skipped**：2026-08-15 實測完整套件連續
 * 三次都有 10 個檔案這樣掛掉、173 條測試根本沒跑，而總結行寫的是「0 failed」。
 *
 * 也就是說，這個數字掉回預設值時，套件不會變紅，會變成**大片綠底下的沉默空洞**。
 *
 * ⚠️ 這條測試擋不住 bug 本身 —— 平行載入的競爭無法在單元測試裡重現。
 * 它擋的是**修正被刪掉**。真正的驗證方式是完整跑一次 `pnpm test`。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 觀測到的最壞情況約 6.3 秒；留三倍餘裕給較慢的機器與冷快取。 */
const FLOOR_MS = 20_000;

describe('vitest.config.ts 的 hookTimeout', () => {
  const source = read('vitest.config.ts');

  it('有明確設定，不吃 vitest 的預設值', () => {
    expect(source).toMatch(/hookTimeout\s*:/);
  });

  it(`不低於 ${FLOOR_MS} 毫秒`, () => {
    const match = source.match(/hookTimeout\s*:\s*([0-9_]+)/);
    expect(match, 'hookTimeout 必須寫成字面量數字，否則這條測試讀不到它').not.toBeNull();

    const value = Number(match![1].replace(/_/g, ''));
    expect(value).toBeGreaterThanOrEqual(FLOOR_MS);
  });

  it('上面留著理由 —— 沒有理由的話，下一個嫌它慢的人只會把它調回去', () => {
    const lines = source.split('\n');
    const index = lines.findIndex(line => /hookTimeout\s*:/.test(line));
    expect(index).toBeGreaterThan(0);

    // 往上找連續的註解行（`//`、`*`、`/*`），要求至少有一行。
    const comment: string[] = [];
    for (let i = index - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (/^(\/\/|\*|\/\*)/.test(line)) {
        comment.unshift(line);
        continue;
      }
      break;
    }
    expect(comment.length, '`hookTimeout` 上方必須有註解說明為什麼不能用預設值').toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 釘住備案號掛在哪幾棵樹上。
 *
 * 【為什麼需要這一條】
 * 備案號不是裝飾：中國大陸已備案的網站必須在頁面底部掛 ICP 備案號並連回工信部，
 * 抽查沒掛的處理是要求整改乃至關停接入 —— 少了它，網域會打不開。
 *
 * 而 `BeianFooter` 刻意設計成「沒設定就整段不渲染」（見該檔的說明：掛一個不屬於
 * 自己的佔位號碼比沒有更糟）。代價是**漏掉時不會報錯**，只是頁尾少一行 ——
 * 2026-09-01 `t1.sxkscreen.com` 的家長端就是這樣漏了一整段時間沒人發現的。
 *
 * 這個站有**兩棵獨立的 React 樹**（`src/main.tsx` 依網址分流）：家長端 `App.tsx`
 * 與後台 `AdminApp.tsx`。在一棵樹上加頁尾，另一棵完全不受影響 —— 這正是
 * `/admin` 底下每一頁一開始都沒有備案號的原因。規定認的是**網域**，不是
 * 「哪些頁面算對外」，同一個網域下的每一頁都算。
 *
 * ⚠️ 這條測試驗的是**掛點還在**，不是畫面上真的看得到號碼。真的看得到還要
 * 建置時帶 `VITE_ICP_BEIAN=`（見 `deploy/README.md` 第五節）—— 那一步漏掉的
 * 症狀跟這裡擋的一模一樣安靜。
 *
 * 伺服器自己吐的那兩頁（掃碼報告頁、連結失效頁）走另一條路（執行期的
 * `ICP_BEIAN`），由 `test/reportLink.http.test.ts` 真的發請求驗。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('備案頁尾掛在兩棵 React 樹上', () => {
  it.each([
    ['家長端', 'src/App.tsx'],
    ['後台 /admin', 'src/admin/AdminApp.tsx'],
  ])('%s 的樹上有 BeianFooter', (_label, file) => {
    const source = read(file);
    expect(source).toMatch(/import\s*\{[^}]*\bBeianFooter\b[^}]*\}\s*from/);
    expect(source).toMatch(/<BeianFooter\s*\/>/);
  });

  /**
   * 後台的頁尾放在 `Shell` 裡，而不是登入後的主畫面裡。
   *
   * `Shell` 包住了 `AdminApp` 全部四個分支（載入中、錯誤、登入、主畫面），
   * 挪到主畫面裡的話「後台每一頁都有」就會退化成「登入之後才有」——
   * 而沒登入的那個登入頁，正是抽查時最容易被打開的一頁。
   */
  it('後台的頁尾在 Shell 裡，不在登入之後才出現的畫面裡', () => {
    const source = read('src/admin/AdminApp.tsx');
    const shellStart = source.indexOf('function Shell(');
    expect(shellStart, '找不到 Shell —— 這個檔改過結構，這條測試要一起更新').toBeGreaterThan(0);

    const beianAt = source.indexOf('<BeianFooter />');
    expect(beianAt).toBeGreaterThan(shellStart);

    // Shell 之後定義的下一個 function 之前 —— 也就是還在 Shell 的函式體內。
    const nextFn = source.indexOf('\nfunction ', shellStart + 1);
    expect(nextFn).toBeGreaterThan(shellStart);
    expect(beianAt).toBeLessThan(nextFn);
  });
});

describe('後台匯出那一份刻意不掛備案號', () => {
  /**
   * `renderParentExportHtml` 有兩個呼叫端，只有一個該傳備案號：
   *
   *   - `server.ts` 的 `/r/:token`：家長掃碼帶走、收藏起來反覆打開的**網頁** → 要
   *   - `src/admin/routes.ts` 的匯出：要列印給專家的**文件**，不是網頁 → 不要
   *
   * 這條擋的是「順手補齊」—— 看到兩個呼叫端不一致，以為是漏了就補上去。
   * 差別是刻意的，寫在這裡才留得住理由。
   */
  it('src/admin/routes.ts 的呼叫端不傳 icpBeian', () => {
    expect(read('src/admin/routes.ts')).not.toMatch(/icpBeian/);
  });

  it('server.ts 的 /r/:token 呼叫端有傳', () => {
    expect(read('server.ts')).toMatch(/icpBeian:\s*ICP_BEIAN/);
  });
});

describe('兩個環境變數都寫進了部署文件', () => {
  /**
   * 值一樣，但要設在兩台機器上：`VITE_ICP_BEIAN` 是**本機建置期**寫死進前端產物的，
   * `ICP_BEIAN` 是**伺服器執行期**讀的。本專案在本機建置再 scp 上去，產物離開本機
   * 之後就改不動了 —— 共用不了一個來源。
   *
   * 漏掉 `ICP_BEIAN` 的症狀特別難認：家長端頁尾有備案號，掃碼打開的報告頁沒有。
   */
  it.each([
    ['.env.example', '.env.example'],
    ['deploy/README.md', 'deploy/README.md'],
  ])('%s 同時寫了 VITE_ICP_BEIAN 與 ICP_BEIAN', (_label, file) => {
    const source = read(file);
    expect(source).toContain('VITE_ICP_BEIAN');
    // 不含 VITE_ 前綴的那一個要單獨出現過，不能只是前者的一部分。
    expect(source).toMatch(/(^|[^_A-Z])ICP_BEIAN/m);
  });
});

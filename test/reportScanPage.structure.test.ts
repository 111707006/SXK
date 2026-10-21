import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 掃碼報告頁（客戶 10/17 第 1 項，issue #65）：開關 `REPORT_SCAN_SPA` 開著時伺服器把 `/r/:token` 交給 SPA，
 * 這一頁打 `GET /api/r/:token`、畫與 App **同一個** `ReportBody`（ADR-0007 延伸到掃碼頁）。
 *
 * 這裡釘的是畫面那一半的三件事（伺服器那一半在 `reportScanSpa.http.test.ts`）：
 *   1. `main.tsx` 看路徑分流到這一頁 —— 不進 App（App 會要人登入、畫導覽列）；
 *   2. 這一頁**只讀**：不放 `ReportBody` 的任何插槽（T2 入口、二維碼卡、預約），自己沒有按鈕與連結；
 *   3. 拿不到時畫的是舊的失效字樣（家長看到的字不變）。
 */

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'src/components/ScanReportPage.tsx';

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('main.tsx 依路徑分流到掃碼報告頁', () => {
  const main = stripComments(read('src/main.tsx'));

  it('`/r/<token>` 進掃碼報告頁，token 從路徑取', () => {
    expect(main).toMatch(/import\s+ScanReportPage\s+from\s+'\.\/components\/ScanReportPage(\.tsx)?'/);
    expect(main).toMatch(/\^\\\/r\\\/\(\[\^\/\]\+\)\\\/\?\$/);
    expect(main).toMatch(/<ScanReportPage\s+token=\{scanToken\}\s*\/>/);
  });
});

describe('掃碼報告頁只讀', () => {
  const page = stripComments(read(PAGE));

  it('資料只來自公開端點 /api/r/:token，不帶通行證', () => {
    expect(page).toMatch(/fetch\(`\/api\/r\/\$\{encodeURIComponent\(token\)\}`\)/);
    expect(page).not.toMatch(/authFetch|Authorization|authHeaders/);
  });

  it('畫的是 ReportBody，不放任何插槽', () => {
    expect(page).toMatch(/import\s+ReportBody\s+from\s+'\.\/ReportBody'/);
    expect(page).toMatch(/<ReportBody\b/);
    expect(page).not.toMatch(/t2Slot|takeawaySlot|bookingSlot/);
  });

  // 快照裡沒有其他報告，歷次對照畫不出真的樣子（只有一點會被說成「第一次报告」）—— 整塊不畫。
  it('歷次對照那一塊不畫', () => {
    expect(page).toMatch(/historyUnavailable\b/);
  });

  it('這一頁自己沒有按鈕、連結、表單', () => {
    expect(page).not.toMatch(/<button|<a\s|href=|onClick|<form|<input|window\.open|location\.href\s*=/);
  });

  it('拿不到時畫舊的失效字樣', () => {
    expect(page).toContain('这个报告连结无效，或对应的报告已经不在了。');
    expect(page).toContain('报告暂时读取不了，请稍后再扫一次。');
    expect(page).toContain('请回到评估现场的画面，重新扫一次二维码。');
  });

  // 這一頁是這個網域對外的一頁（家長會收藏起來反覆打開），備案號要在 —— 同 App 與後台兩棵樹。
  it('掛備案頁尾', () => {
    expect(page).toMatch(/<BeianFooter\s*\/>/);
  });
});

describe('ReportBody 的歷次對照可以整塊不畫', () => {
  const body = stripComments(read('src/components/ReportBody.tsx'));

  it('historyUnavailable 時不畫 ScreeningHistory', () => {
    expect(body).toMatch(/historyUnavailable\s*\?\s*null\s*:\s*<ScreeningHistory/);
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 原始碼結構護欄。
 *
 * `test/dateUtils.test.ts` 釘住了工具算得對，但算得對的工具照樣可以被繞過：
 * 只要有人在別的地方再寫一次 `new Date('2026-07-08')`，或是讓某一條讀檔路徑
 * 不重算就把 `ageMonth` 送進畫面，孩子的年齡就又停住了 —— 而這件事沒有人會
 * 收到錯誤，它只是安靜地把孩子送去答別的年齡段的題目。
 *
 * 寫法參照 `test/adminScope.structure.test.ts`：**邏輯正確**與**邏輯有被用到**
 * 是兩件事，後者型別檢查擋不住。
 */

const ROOT = path.resolve(__dirname, '..');
const DATE_UTILS_PATH = 'src/utils/dateUtils.ts';
const APP_PATH = 'src/App.tsx';

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * 註解裡舉的反例（正是被修掉的那幾行）不該被當成真的程式碼。
 * 行末註解也要拿掉 —— `birthDate?: string; // e.g. "2023-05-15"` 是說明，不是寫死的日期。
 * `[^:]` 是為了不要把 `https://` 攔腰砍斷。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** 遞迴列出 src 底下所有的 ts/tsx。 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe('「今天」不得再被寫死', () => {
  it('日期工具裡沒有任何年份字面值', () => {
    // 這是這張票的核心：舊版 `calculateAgeMonth` 的預設參考日期是 '2026-07-08'，
    // 於是每個孩子的年齡都停在那一天。今天只能來自執行期。
    const source = stripComments(read(DATE_UTILS_PATH));
    const years = source.match(/\b(19|20)\d{2}\b/g) || [];
    expect(years, `${DATE_UTILS_PATH} 出現寫死的年份`).toEqual([]);
  });

  it('src 底下沒有任何寫死的日期字面值', () => {
    // 工具修好了，但同一個錯誤可以在任何一個元件裡重新長出來。
    const files = sourceFiles('src');
    // 沒有這一條，搬動目錄會讓這條測試「零個檔案全過」。
    expect(files.length).toBeGreaterThanOrEqual(20);

    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(read(file));
      for (const line of source.split('\n')) {
        if (/['"`](19|20)\d{2}-\d{2}-\d{2}/.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders, '這些地方把某一天寫死了，該改成由執行期算出').toEqual([]);
  });
});

describe('孩子檔案只有一個入口，篩查紀錄不走那個入口', () => {
  const app = stripComments(read(APP_PATH));

  it('狀態的 setter 只在 applyChild 裡被呼叫', () => {
    // useState 的原始 setter 刻意取名 setChildState 而不是 setChild：
    // 想繞過重算就得先寫出這個名字，那是一個看得見的動作。
    const calls = app.match(/setChildState\(/g) || [];
    expect(calls.length, '除了 applyChild 之外還有人直接設定孩子檔案').toBe(1);

    const applyChildBody = app.slice(
      app.indexOf('const applyChild ='),
      app.indexOf('const applyChild =') + 260
    );
    expect(applyChildBody).toContain('refreshChildAge(');
    expect(applyChildBody).toContain('setChildState(');
  });

  it('每一條把孩子檔案放進狀態的路徑都經過 applyChild', () => {
    // localStorage、雲端載入、登入帶回、表單存檔、修改檔案、清除檔案、登出。
    const uses = app.match(/applyChild\(/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(7);
  });

  it('重算只發生在 applyChild 裡，沒有第二個呼叫點', () => {
    // 測評月齡是快照。只要有人順手把 refreshChildAge 套到 reportHistory 上，
    // 那一次篩查用的是哪一段就再也讀不出來了 —— 而畫面看起來完全正常。
    const withoutImports = app.replace(/^import[\s\S]*?;$/gm, '');
    const calls = withoutImports.match(/refreshChildAge\(/g) || [];
    expect(calls.length, 'refreshChildAge 應該只在 applyChild 裡出現一次').toBe(1);
  });

  it('篩查紀錄原封不動地進狀態', () => {
    const historyCalls = app.match(/setReportHistory\([^;]*\)/g) || [];
    expect(historyCalls.length).toBeGreaterThanOrEqual(3);

    const recomputed = historyCalls.filter(c => /refreshChildAge|applyChild|calculateAgeMonth/.test(c));
    expect(recomputed, '篩查紀錄裡的測評月齡是事實記錄，永不重算').toEqual([]);
  });
});

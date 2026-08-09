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

  it('src 底下沒有任何寫死的日期', () => {
    // 工具修好了，但同一個錯誤可以在任何一個元件裡重新長出來。
    const files = sourceFiles('src');
    // 沒有這一條，搬動目錄會讓這條測試「零個檔案全過」。
    expect(files.length).toBeGreaterThanOrEqual(20);

    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(read(file));
      for (const line of source.split('\n')) {
        // 字串形式：new Date('2026-07-08')、birthDate = '2026-07-08'
        if (/['"`](19|20)\d{2}-\d{2}-\d{2}/.test(line)) offenders.push(`${file}: ${line.trim()}`);
        // 數字形式：new Date(2026, 6, 8)、new Date(1783283200000)。
        // 只查 `new Date(` 後面**緊接著字面值**的情形 —— 由變數構造（本模組自己
        // 就是這樣做的）不算。少了這一條，把 bug 改用這個寫法放回去測試照樣全綠。
        else if (/new Date\(\s*['"`\d]/.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders, '這些地方把某一天寫死了，該改成由執行期算出').toEqual([]);
  });
});

describe('實足月齡是推導出來的，測評月齡是記下來的', () => {
  const app = stripComments(read(APP_PATH));

  it('全 src 只有一個地方重算實足月齡', () => {
    // 測評月齡是快照。只要有人順手把 refreshChildAge 套到 reportHistory 上，
    // 那一次篩查用的是哪一段就再也讀不出來了 —— 而畫面看起來完全正常。
    // 掃**整個 src**，不是只掃 App.tsx：換一個檔案做同一件事一樣會壞。
    const callers: string[] = [];
    for (const file of sourceFiles('src')) {
      if (file === 'src/utils/dateUtils.ts') continue; // 定義它的地方
      const source = stripComments(read(file)).replace(/^import[\s\S]*?;$/gm, '');
      for (const _ of source.match(/refreshChildAge\(/g) || []) callers.push(file);
    }
    expect(callers, 'refreshChildAge 只該在 App.tsx 的推導處出現一次').toEqual([APP_PATH]);
  });

  it('那個地方是一個推導值，不是某一條寫入路徑', () => {
    // 掛在寫入路徑上的話，只有「檔案被重新寫入」才會更新年齡；
    // 開著不動的分頁跨過午夜就還停在昨天，而它決定出哪一段的題目。
    expect(app).toMatch(/const child = useMemo\(\(\) => refreshChildAge\(childProfile, today\)/);
    expect(app).toContain('const today = useToday()');
  });

  it('狀態裡存的是檔案本身，不是算好的年齡', () => {
    // 命名本身就是護欄：畫面拿到的 `child` 是推導值，`childProfile` 才是存下來的。
    expect(app).toMatch(/const \[childProfile, setChildProfile\] = useState<Child \| null>/);
    expect(app).not.toMatch(/useState<Child \| null>\(null\);\s*\n\s*const child\b/);
  });

  it('篩查紀錄原封不動地進狀態', () => {
    const historyCalls = app.match(/setReportHistory\([^;]*\)/g) || [];
    expect(historyCalls.length).toBeGreaterThanOrEqual(3);

    const recomputed = historyCalls.filter(c => /refreshChildAge|calculateAgeMonth/.test(c));
    expect(recomputed, '篩查紀錄裡的測評月齡是事實記錄，永不重算').toEqual([]);
  });

  it('已產出的報告顯示的是紀錄裡的孩子，不是今天的孩子', () => {
    // 報告的分數是照當時那一段的題目算出來的。配上今天的年齡，
    // 那份報告就沒有人讀得懂了 —— 而畫面上看起來完全正常。
    const analysis = stripComments(read('src/components/AnalysisReport.tsx'));
    expect(analysis).toContain('historicalRecord?.child ?? child');
    expect(analysis).not.toMatch(/childAgeMonth: child\.ageMonth/);

    const specialized = stripComments(read('src/components/SpecializedReportView.tsx'));
    expect(specialized).toContain('record.child');
  });

  it('後台的月齡也是照今天推導的，不是讀存下來的數字', () => {
    // 家長端推導、後台端讀存檔的話，家長不必再存一次檔兩邊就會愈差愈多。
    const store = stripComments(read('src/admin/adminStore.ts'));
    expect(store).toContain('calculateAgeMonth(child.birthDate)');
    expect(store).not.toMatch(/childAgeMonth: typeof child\?\.ageMonth === 'number'/);
  });
});

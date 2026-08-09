import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 原始碼結構護欄。
 *
 * `test/birthDateOptions.test.ts` 釘住了選項算得對，但算得對的選項照樣可以沒被用上：
 * 只要有人在哪張表單裡重新放回一個 `<input type="date">`，iPad 上的系統浮層就又蓋住
 * 整張表單了 —— 而在桌機瀏覽器上開發時，那個控制項看起來完全正常。
 *
 * 寫法參照 `test/childAge.structure.test.ts`：**邏輯正確**與**邏輯有被用到**是兩件事，
 * 型別檢查擋不住後者。
 */

const ROOT = path.resolve(__dirname, '..');
const PROFILE_FORM = 'src/components/ChildProfileForm.tsx';
const EDIT_MODAL = 'src/components/EditProfileModal.tsx';
const BIRTH_DATE_FORMS = [PROFILE_FORM, EDIT_MODAL];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * 註解裡舉的反例（正是被換掉的那個控制項）不該被當成真的程式碼。
 * `[^:]` 是為了不要把 `https://` 攔腰砍斷。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe('出生日期不再用日期輸入框', () => {
  it('兩張表單裡都沒有 <input type="date">', () => {
    // 這是這張票的核心：`<input type="date">` 在 iPad Safari 上叫出的是系統繪製的
    // 浮層，位置我們控制不了。客戶影片裡它蓋住了「保存修改」按鈕。
    for (const file of BIRTH_DATE_FORMS) {
      expect(stripComments(read(file)), `${file} 又用回日期輸入框了`).not.toMatch(/type=["']date["']/);
    }
  });

  it('兩張表單共用同一個元件', () => {
    // 各寫一份的話，只有其中一邊會拿到之後的修正 —— 而兩張表單改的是同一個欄位。
    for (const file of BIRTH_DATE_FORMS) {
      expect(read(file)).toMatch(/<BirthDateSelect\b/);
      expect(read(file)).toMatch(/from '\.\/BirthDateSelect'/);
    }
  });

  it('選項與夾值住在純函式模組裡，不在 JSX 裡', () => {
    // 專案沒有 jsdom，留在元件裡的分支一行都測不到。
    const component = stripComments(read('src/components/BirthDateSelect.tsx'));
    expect(component).toMatch(/from '\.\.\/utils\/birthDateOptions'/);

    // 三個下拉的選項全部來自那個模組，元件不自己算閏年或月份長度
    for (const fn of ['yearOptions(', 'monthOptions(', 'dayOptions(', 'clampSelection(']) {
      expect(component, `元件沒有用上 ${fn}`).toContain(fn);
    }
    expect(component).not.toMatch(/\b(daysInMonth|isLeapYear)\b/);
  });
});

describe('適用範圍只有一個來源', () => {
  it('表單裡不再寫死 12 與 180', () => {
    // 兩個數字原本散在兩張表單的驗證式與說明文字裡，與 `t1Data` 的年齡段各自為政。
    // 漏改的那一邊會表現成「選得到、但選了就被擋下」或反過來。
    for (const file of BIRTH_DATE_FORMS) {
      const source = stripComments(read(file));
      expect(source, `${file} 仍寫死了適用範圍上限`).not.toMatch(/\b180\b/);
      expect(source).toMatch(/T1_AGE_RANGE/);
    }
  });

  it('適用範圍由年齡段反推，不是自己一組常數', () => {
    const t1 = read('src/t1Data.ts');
    expect(t1).toMatch(/minMonths: T1_AGE_BANDS\[0\]\.minAge/);
    expect(t1).toMatch(/maxMonths: T1_AGE_BANDS\[T1_AGE_BANDS\.length - 1\]\.maxAge/);
  });
});

describe('預約日期有上下界', () => {
  it('src 裡剩下的每一個日期輸入框都帶 min 與 max', () => {
    // 沒有上下界的預約日期，家長選得到昨天，也可以完全不選就送出 ——
    // 客服會收到一筆約不到人的預約，而畫面上顯示送出成功。
    const naked: string[] = [];
    for (const file of sourceFiles('src')) {
      const lines = stripComments(read(file)).split('\n');
      lines.forEach((line, i) => {
        if (!/type=["']date["']/.test(line)) return;
        // 同一個 JSX 元素的屬性最多再往下幾行
        const element = lines.slice(i, i + 8).join('\n');
        if (!/\bmin=/.test(element) || !/\bmax=/.test(element)) naked.push(`${file}:${i + 1}`);
      });
    }
    expect(naked, '這些日期輸入框沒有上下界').toEqual([]);
  });

  it('兩處預約都用同一支工具，沒有各自算一次', () => {
    for (const file of ['src/components/AnalysisReport.tsx', 'src/components/LanguageSpecialAssessment.tsx']) {
      expect(read(file), `${file} 沒有沿用共用的預約區間工具`).toMatch(/from '\.\.\/utils\/bookingWindow'/);
    }
  });
});

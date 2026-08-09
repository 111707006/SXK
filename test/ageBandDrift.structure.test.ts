import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 跨年齡段提示的**接線**護欄（issue #24）。
 *
 * `test/ageBandDrift.test.ts` 釘住了判斷算得對。算得對的判斷照樣可以沒有被接上，
 * 或被接到會傷人的地方 —— 兩者型別檢查都擋不住，而它們的樣子都很正常：
 *
 * - 提示元件寫好了但沒有渲染在家長會看到的畫面上 → 家長照著用另一組題目測出來的
 *   結果做決定，而畫面看起來完全正常。
 * - 有人「順手」把跨段的舊報告藏起來或標成過期 → 家長以為自己的紀錄不見了。
 *   驗收條件是**不擋、不標為過期、不自動失效**。
 *
 * 寫法參照 `test/childAge.structure.test.ts`。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例不該被當成真的程式碼。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
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

const app = stripComments(read('src/App.tsx'));

describe('提示真的接在家長看得到的地方', () => {
  // 標籤名後面必須是空白或 `/` —— `toContain('<AgeBandDriftNotice')` 連
  // `<AgeBandDriftNoticeXX` 都收，於是改錯名字的版本照樣全綠。
  const NOTICE_TAG = /<AgeBandDriftNotice[\s/>]/;

  it('評估面板上渲染了提示', () => {
    expect(app).toMatch(NOTICE_TAG);
    expect(app).toMatch(/import AgeBandDriftNotice from '\.\/components\/AgeBandDriftNotice'/);
  });

  it('提示排在九張維度卡片之前', () => {
    // 家長讀那九張卡片上的燈號**之前**就得知道它們是用另一組題目測出來的。
    const notice = app.search(NOTICE_TAG);
    const grid = app.indexOf('<DimensionGrid');
    expect(notice).toBeGreaterThan(-1);
    expect(grid).toBeGreaterThan(-1);
    expect(notice).toBeLessThan(grid);
  });

  it('判斷是推導值，跟著今天走', () => {
    // 掛在某條寫入路徑上的話，開著不動的分頁跨過孩子的生日當天不會長出提示 ——
    // 而那正是這張票要處理的那一刻。
    expect(app).toMatch(/const bandDrift = useMemo\(\s*\(\) => ageBandDrift\(/);
    expect(app).toContain('latestAssessedAgeMonth(completedScores, reportHistory)');
  });

  it('判斷只有純函式模組一份，沒有人在元件裡重寫一次', () => {
    // 比年齡段的方式若散在各處，家長端與後台就會對同一份結果說出不同的段。
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      if (file === 'src/t1Data.ts' || file === 'src/utils/ageBandDrift.ts') continue;
      const source = stripComments(read(file));
      if (/\bminAge\b|\bmaxAge\b/.test(source)) offenders.push(file);
    }
    expect(offenders, '年齡段的上下界只該在 t1Data 與 ageBandDrift 裡被讀到').toEqual([]);
  });
});

describe('舊報告不擋、不標為過期、不自動失效', () => {
  it('報告畫面不認識跨段這件事', () => {
    // 報告頁一旦拿到 drift，「加一顆過期徽章」或「先擋一下」就只差一行 ——
    // 而那兩件事都是驗收條件明文排除的。它讀的是紀錄裡的測評月齡，本來就讀得對。
    for (const file of ['src/components/AnalysisReport.tsx', 'src/components/SpecializedReportView.tsx']) {
      expect(stripComments(read(file)), `${file} 不該引用跨段判斷`).not.toMatch(/ageBandDrift|AgeBandDriftNotice/);
    }
  });

  it('篩查紀錄沒有被跨段判斷過濾掉', () => {
    // `latestAssessedAgeMonth` 只**讀** reportHistory。任何一句
    // `reportHistory.filter(... drift ...)` 都會讓家長的舊報告從報告庫消失。
    const historyReads = app.match(/reportHistory[\s\S]{0,80}?\.filter\([^)]*\)/g) || [];
    const gated = historyReads.filter(c => /drift|ageBand|assessedAgeMonth/i.test(c));
    expect(gated, '舊報告照常可讀 —— 不得依跨段與否過濾').toEqual([]);
  });

  it('提示元件只是說話，沒有停用任何入口', () => {
    const notice = stripComments(read('src/components/AgeBandDriftNotice.tsx'));
    expect(notice).not.toMatch(/\bdisabled\b/);
    // 「不會消失」這句話本身就是驗收條件的一部分：少了它，一句「建議重新篩查」
    // 在家長眼裡就是「我之前那份不算了」。
    expect(notice).toContain('旧的报告不会消失');
  });
});

describe('專家讀得到那次篩查當時的年齡段', () => {
  const store = stripComments(read('src/admin/adminStore.ts'));

  it('後台的測評月齡走的是同一支純函式', () => {
    expect(store).toContain('latestAssessedAgeMonth(scores, reportHistory)');
    expect(store).toMatch(/assessedBandName: assessedAgeMonth === null \? null : ageBandOf\(assessedAgeMonth\)\.name/);
  });

  it('詳情畫面與匯出頁都把它寫出來', () => {
    // issue #8 的驗收條件是「匯出內容與詳情畫面一致」。只補其中一邊的話，
    // 螢幕上與交給專家的那張紙上會是兩份讀法不同的資料。
    for (const file of ['src/admin/panels/ParentsPanel.tsx', 'src/admin/exportView.ts']) {
      const source = stripComments(read(file));
      expect(source, `${file} 沒有顯示測評月齡`).toContain('assessedAgeMonth');
      expect(source, `${file} 沒有顯示年齡段`).toContain('assessedBandName');
    }
  });
});

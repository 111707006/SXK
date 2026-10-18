import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * #71 的接線：`ReportBody` 只認 `noWeeklyPlan`，開關要每一個呼叫端都傳進去 —— 漏一處，那一處（後台、列印、掃碼頁）
 * 就還畫著週計劃圖。專案沒有 jsdom，接線只能讀原始碼（同 `t1ReportView.structure.test.ts`）；畫出來的樣子在 `t1NoWeeklyPlan.test.ts`。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const CALLERS = walk('src').filter(rel => /<ReportBody\b/.test(stripComments(read(rel))));

describe('每一個畫 ReportBody 的地方都傳開關', () => {
  it('呼叫端就是這四處（家長端、後台詳情、列印、掃碼頁）', () => {
    expect(CALLERS.map(p => p.replace(/\\/g, '/')).sort()).toEqual([
      'src/admin/panels/ParentReportPrint.tsx',
      'src/admin/panels/ParentsPanel.tsx',
      'src/components/AnalysisReport.tsx',
      'src/components/ScanReportPage.tsx',
    ]);
  });

  it.each(CALLERS)('%s：從 useReportLayout 拿、傳 noWeeklyPlan', rel => {
    const src = stripComments(read(rel));
    expect(src).toMatch(/useReportLayout\(\)/);
    // 收尾的 `/>` 自己一行（插槽裡也有 `/>`，不能停在第一個）。
    const tags = src.match(/<ReportBody\b[\s\S]*?\n\s*\/>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag).toMatch(/noWeeklyPlan=\{/);
  });

  it('一進站就開始問（報告畫出來時通常已經回來了，版面不跳）', () => {
    expect(stripComments(read('src/main.tsx'))).toMatch(/loadReportLayout\(\)/);
  });
});

describe('捲到 T2 卡等版面定了才捲', () => {
  const report = stripComments(read('src/components/AnalysisReport.tsx'));
  const effect = report.slice(report.indexOf('const t2AutoScrolledRef'), report.indexOf('}, [focusT2, aiReport'));

  it('開關還沒問完就不捲（不然捲完 T2 卡才被移走）', () => {
    expect(effect).toMatch(/!layout\.ready/);
    expect(report).toMatch(/\}, \[focusT2, aiReport, layout\.ready, layout\.noWeeklyPlan\]\)/);
  });

  it('捲的仍是 T2 插槽外那一層（帶 scroll-mt，標題不被頁首蓋住）', () => {
    expect(report).toMatch(/<div ref=\{t2SlotRef\} className="scroll-mt-44 lg:scroll-mt-24">/);
    expect(effect).toContain('t2SlotRef.current?.scrollIntoView');
  });
});

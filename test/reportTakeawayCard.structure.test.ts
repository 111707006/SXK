import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * T1 報告上「把这份报告带回家」那張二維碼卡（客戶 10/17，規格 docs/specs/client-changes-2026-10-17.md §2.2 第 4 點、D4）：
 * 只留二維碼、標題與一行說明；網址那一行與「这个连结长期有效……」提醒句刪掉。
 * A、B 共用 `AnalysisReport.tsx` 的同一張卡，所以釘這一份就是兩邊都釘。專案沒有 jsdom，只能讀原始碼。
 */

const ROOT = path.resolve(__dirname, '..');
const stripComments = (source: string) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const source = stripComments(fs.readFileSync(path.join(ROOT, 'src/components/AnalysisReport.tsx'), 'utf8'));
const start = source.indexOf('function ReportTakeawayCard');
const end = source.indexOf('\ninterface AnalysisReportProps');
const card = source.slice(start, end);

describe('二維碼卡（把这份报告带回家）', () => {
  it('找得到那張卡', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it('留著二維碼、標題與說明句', () => {
    expect(card).toContain('state.qrSvg');
    expect(card).toContain('把这份报告带回家');
    expect(card).toContain('用手机相机扫一下，这份报告就会在您自己的手机上打开，之后随时都能再看。');
  });

  it('不印網址、不寫提醒句', () => {
    expect(card).not.toContain('state.url');
    expect(card).not.toContain('长期有效');
    expect(card).not.toContain('不要转发');
  });

  it('A、B 只有這一張卡：家長端別處沒有提醒句', () => {
    const dir = path.join(ROOT, 'src/components');
    const hits = fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => stripComments(fs.readFileSync(path.join(dir, f), 'utf8')).includes('这个连结长期有效'));
    expect(hits).toEqual([]);
  });
});

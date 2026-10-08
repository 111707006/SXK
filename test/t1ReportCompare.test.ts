import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { SAMPLES, compareDocument, compareReports } from '../scripts/t1/compare';
import { flaggedDimensions, t1AnswersOf } from '../src/t1report/answers';

/**
 * 新舊並排腳本（`scripts/t1-report-compare.ts`）。只走兩套模板，所以可以在 CI 跑：每個內建孩子都跑得出來、
 * 內建孩子涵蓋使用者要的幾種樣子（不同年齡段、全綠、一紅、多黃）、CLI 寫得出檔案。
 */

const ROOT = path.resolve(__dirname, '..');

describe('內建孩子', () => {
  it.each(Object.keys(SAMPLES))('%s：兩邊都產得出來', name => {
    const { legacy, real } = compareReports(SAMPLES[name].input);
    expect(legacy.summary.length).toBeGreaterThan(0);
    expect(real.summary.length).toBeGreaterThan(0);
    expect(real.perDimension.map(n => n.dimensionId)).toEqual(
      flaggedDimensions(t1AnswersOf(SAMPLES[name].input.scores)).map(d => d.dimensionId),
    );
  });

  it('涵蓋：全綠、恰好一紅、多黃無紅、跨兩個以上年齡段、有一份帶歷史', () => {
    const statuses = Object.values(SAMPLES).map(s => s.input.scores.map(x => x.status));
    expect(statuses.some(st => st.every(x => x === 'normal'))).toBe(true);
    expect(statuses.some(st => st.filter(x => x === 'delay').length === 1 && !st.includes('borderline'))).toBe(true);
    expect(statuses.some(st => st.filter(x => x === 'borderline').length >= 2 && !st.includes('delay'))).toBe(true);
    expect(new Set(Object.values(SAMPLES).map(s => t1AnswersOf(s.input.scores, s.input.child.ageMonth).bandName)).size).toBeGreaterThanOrEqual(3);
    expect(Object.values(SAMPLES).some(s => (s.input.history?.length ?? 0) > 0)).toBe(true);
  });

  it('整份文件：每個孩子一節，舊版那一欄是舊模板的字（有儀表、有神經環路那一段）', () => {
    for (const mode of ['full', 't1only'] as const) {
      const doc = compareDocument(Object.keys(SAMPLES), mode);
      for (const name of Object.keys(SAMPLES)) expect(doc).toContain(`## ${name}：`);
      expect(doc).toContain('四个仪表');
      expect(doc).toContain('历次筛查对照');
    }
  });
});

describe('CLI', () => {
  it('--all --out 寫出檔案；不寫進 repo', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 't1cmp-'));
    try {
      const out = path.join(dir, 'cmp.md');
      const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
      const printed = execFileSync(process.execPath, [tsxCli, 'scripts/t1-report-compare.ts', '--all', '--out', out], { cwd: ROOT, encoding: 'utf8' });
      expect(printed.trim()).toBe(path.resolve(out));
      const doc = readFileSync(out, 'utf8');
      for (const name of Object.keys(SAMPLES)) expect(doc).toContain(`## ${name}：`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('預設輸出在作業系統的暫存目錄', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/t1-report-compare.ts'), 'utf8');
    expect(src).toMatch(/valueOf\('--out'\) \?\? path\.join\(os\.tmpdir\(\)/);
  });
});

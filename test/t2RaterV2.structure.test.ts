import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * T2 填表人 v2（#70）的畫面接線：兩個作答畫面照 plan 上的 `raterV2` 換選項、出「其他」的說明框、交卷走
 * `raterPayload`；兩個報告頁畫回顧那一行的 `raterLine`；伺服器用同一套 fail-closed 解析讀開關。
 * 行為本身在 `t2RaterV2.test.ts`（純函式）與 `t2RaterV2.http.test.ts`（交卷）。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('作答畫面', () => {
  for (const file of ['src/components/T2Assessment.tsx', 'src/components/T2AssessmentV3.tsx']) {
    it(`${file}：選項看 plan.raterV2、「其他」才出說明框、交卷走 raterPayload`, () => {
      const src = read(file);
      expect(src).not.toMatch(/\bRATER_OPTIONS\b/);
      expect(src).toMatch(/raterOptions\([^)]*raterV2[^)]*\)/);
      expect(src).toMatch(/<T2RaterNoteInput\b/);
      expect(src).toMatch(/\.\.\.raterPayload\(/);
      expect(src).not.toMatch(/^\s*rater,\s*$|^\s*rater: draft\.rater,\s*$/m);
    });
  }

  it('說明框只在選了「其他」時出現、最多 10 字', () => {
    const src = read('src/components/T2RaterNoteInput.tsx');
    expect(src).toMatch(/rater !== 'other'/);
    expect(src).toMatch(/maxLength=\{RATER_NOTE_MAX\}/);
  });
});

describe('報告頁', () => {
  for (const file of ['src/components/T2Report.tsx', 'src/components/T2ReportV3.tsx']) {
    it(`${file}：回顧每支那一行畫 raterLine（有才畫）`, () => {
      expect(read(file)).toMatch(/g\.raterLine &&/);
    });
  }
});

describe('伺服器', () => {
  it('T2_RATER_V2 用 resolvePaywallSwitch 讀（只收 1/true/0/false，認不得起不來）', () => {
    expect(read('server.ts')).toContain("const T2_RATER_V2 = resolvePaywallSwitch('T2_RATER_V2', process.env.T2_RATER_V2);");
  });
});

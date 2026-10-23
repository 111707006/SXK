import { createHash } from 'node:crypto';
import { T1_AGE_BANDS } from '../../src/t1Data';
import { t1ReportInputOf, templateT1Report } from '../../src/t1report/report';
import { buildT1ReportPrompt } from '../../src/t1report/prompt';
import { bandScores } from './t1Scores';

/**
 * 「`T1_REPORT_1022` 關著，輸出與 10/22 之前一字不差」的基準（#81）。
 * `test/fixtures/t1ReportBaseline.json` 是加開關**之前**的程式碼跑出來的雜湊（模板整份與提示兩段），
 * 由 `npx tsx test/helpers/t1ReportBaseline.ts --write` 產生；之後只比對、不重產 —— 重產就失去基準的意義。
 */

const CHILD = { name: '森森', gender: 'boy' };

export const BASELINE_PATTERNS: Record<string, (dimId: string, i: number) => 0 | 1 | 2> = {
  allClear: () => 2,
  allNotYet: () => 0,
  mixed: (d, i) => (d === 'language' ? 0 : d === 'gross_motor' ? (i < 2 ? 1 : 2) : d === 'attention' && i === 3 ? 1 : 2),
  allBorderline: (_d, i) => (i === 0 ? 1 : 2),
  partlyOnly: () => 1,
  oneRed: d => (d === 'self_care' ? 0 : 2),
};

export function baselineCases() {
  const ages = T1_AGE_BANDS.flatMap(b => [b.minAge, b.maxAge]);
  return ages.flatMap(age =>
    Object.keys(BASELINE_PATTERNS).flatMap(p =>
      [true, false].map(withItems => ({
        key: `${age}/${p}/${withItems ? 'items' : 'noItems'}`,
        input: t1ReportInputOf({ ...CHILD, ageMonth: age }, bandScores(age, BASELINE_PATTERNS[p], withItems)),
      })),
    ),
  );
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** 不帶開關選項的輸出（＝開關關著）。 */
export function baselineHashes(): Record<string, { report: string; system: string; user: string }> {
  const out: Record<string, { report: string; system: string; user: string }> = {};
  for (const { key, input } of baselineCases()) {
    const { system, user } = buildT1ReportPrompt(input);
    out[key] = { report: sha(JSON.stringify(templateT1Report(input))), system: sha(system), user: sha(user) };
  }
  return out;
}

if (process.argv.includes('--write')) {
  const { writeFileSync } = await import('node:fs');
  const path = await import('node:path');
  const file = path.resolve(import.meta.dirname, '../fixtures/t1ReportBaseline.json');
  writeFileSync(file, `${JSON.stringify(baselineHashes(), null, 1)}\n`, 'utf8');
  console.log(file);
}

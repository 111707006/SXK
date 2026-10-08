/**
 * T1 報告新舊並排：同一份輸入各跑一次舊版模板（`src/t1report/legacy.ts`）與新版模板（`templateT1Report`），
 * 寫成一份 Markdown。只走模板，不打網路、不叫模型。
 *
 *   npx tsx scripts/t1-report-compare.ts --all
 *   npx tsx scripts/t1-report-compare.ts --sample one-red --out C:/tmp/t1.md
 *   npx tsx scripts/t1-report-compare.ts --input child.json          # {child, scores, history?}
 *   npx tsx scripts/t1-report-compare.ts --all --mode t1only         # 舊版照專案 B 的兜底建議
 *
 * `--out` 不給就寫到作業系統的暫存目錄（不寫進 repo），路徑印在最後一行。
 * 內建孩子見 `scripts/t1/compare.ts` 的 `SAMPLES`（`--list` 列出）。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SAMPLES, compareDocument, compareMarkdown, type CompareInput } from './t1/compare';
import type { LegacyAppMode } from '../src/t1report/legacy';

const argv = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (argv.includes('--list')) {
  for (const [name, s] of Object.entries(SAMPLES)) console.log(`${name}\t${s.label}`);
  process.exit(0);
}

const mode = (valueOf('--mode') ?? 'full') as LegacyAppMode;
if (mode !== 'full' && mode !== 't1only') {
  console.error(`--mode 只收 full 或 t1only，拿到 ${mode}`);
  process.exit(1);
}

let doc: string;
const inputFile = valueOf('--input');
if (inputFile) {
  const input = JSON.parse(readFileSync(inputFile, 'utf8')) as CompareInput;
  if (!input?.child || !Array.isArray(input.scores)) {
    console.error('--input 的 JSON 要有 child 與 scores（陣列）');
    process.exit(1);
  }
  doc = `# T1 报告新旧对照\n\n${compareMarkdown(path.basename(inputFile), '自订输入', input, mode)}`;
} else {
  const sample = valueOf('--sample');
  const names = argv.includes('--all') ? Object.keys(SAMPLES) : sample ? [sample] : [];
  if (names.length === 0) {
    console.error('要指定 --sample <名字>、--all 或 --input <json>（--list 列出内建的孩子）');
    process.exit(1);
  }
  const unknown = names.filter(n => !SAMPLES[n]);
  if (unknown.length) {
    console.error(`没有这个内建孩子：${unknown.join('、')}（--list 列出内建的孩子）`);
    process.exit(1);
  }
  doc = compareDocument(names, mode);
}

const out = valueOf('--out') ?? path.join(os.tmpdir(), `t1-report-compare-${Date.now()}.md`);
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, doc, 'utf8');
console.log(path.resolve(out));

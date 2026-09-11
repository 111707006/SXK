/**
 * 紙本比對：把 22 支題庫常數（`src/t2/toolkit/`）跟紙本版 docx 逐題對照，印出結果。
 *
 *   npx tsx scripts/t2-diff-paper.ts
 *
 * 來源：`NEWT2/森心康纸本评估工具_20260910.zip`（22 支 docx）。紙本是題目文字的權威
 * （規格 v2 §1）；常數是從 09-08 工具包 HTML 抽的。兩者本該逐字一致 —— 規格記錄
 * 「17 支零差異」但沒說是哪 17 支，這支腳本把 22 支全部比一遍，差異逐條印出來，
 * 比不了的（ASR 的錨點紙本沒印、CHEXI 紙本重新編號）也寫明。
 *
 * 只印報告，不改任何檔案。`test/toolkitPaperDiff.test.ts` 用同一套比對邏輯釘住結果。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readZip } from './t2/zip';
import { PAPER_FILES, PAPER_ROOT, PAPER_ZIP, readPaperTool } from './t2/paper';
import { diffToolAgainstPaper, formatReport } from './t2/paperDiff';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';

const root = process.cwd();
const zip = readZip(readFileSync(path.join(root, PAPER_ZIP)));

const diffs = TOOL_IDS.map(id => {
  const docx = zip.get(PAPER_ROOT + PAPER_FILES[id]);
  if (!docx) throw new Error(`紙本 zip 裡沒有 ${PAPER_FILES[id]}`);
  return diffToolAgainstPaper(TOOLKIT[id], readPaperTool(id, docx));
});

console.log(formatReport(diffs));

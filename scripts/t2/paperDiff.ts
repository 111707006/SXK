/**
 * 題庫常數（從工具包 HTML 抽的）對紙本版（docx）逐題比對。
 *
 * 比什麼：面向的名稱與順序、每個面向的題數、每題的序號／原文／起始月齡、選項標籤、
 * 「分數解讀」的分段、ADL 的七級定義。每支的結果分成兩層 ——
 * `itemDiffs`（面向與題目，決定「零差異」那個計數）與 `otherDiffs`（選項、分段、
 * 定義，紙本與 HTML 的排版差異多半落在這裡）。比不了的東西寫進 `notes`，
 * 不假裝比過。
 */

import type { ToolkitBank, ToolkitTier } from '../../src/t2/toolkit/types';
import type { PaperTool, PaperTier } from './paper';

export interface ToolDiff {
  id: ToolkitBank['id'];
  code: string;
  paperFile: string;
  /** 面向與題目的差異；空陣列就是「零差異」。 */
  itemDiffs: string[];
  /** 選項、分段、七級定義的差異。 */
  otherDiffs: string[];
  /** 無法逐題比對的部分，寫明為什麼。 */
  notes: string[];
  /** 比對到的題數（兩邊都有的題）。 */
  itemsCompared: number;
}

export function diffToolAgainstPaper(bank: ToolkitBank, paper: PaperTool): ToolDiff {
  const itemDiffs: string[] = [];
  const otherDiffs: string[] = [];
  const notes: string[] = [];
  let itemsCompared = 0;

  // ---- 面向 ----
  const kitSecs = bank.sections;
  const paperSecs = paper.sections;
  if (kitSecs.length !== paperSecs.length) {
    itemDiffs.push(`面向數：常數 ${kitSecs.length}，紙本 ${paperSecs.length}`);
  }
  const n = Math.min(kitSecs.length, paperSecs.length);
  for (let i = 0; i < n; i++) {
    const ks = kitSecs[i];
    const ps = paperSecs[i];
    const label = `面向 ${i + 1}（${ks.name || ks.key}）`;

    // M-CHAT 沒有面向，兩邊都是空名稱，這一行對它自然成立。
    if (ks.name !== ps.name) {
      itemDiffs.push(`${label} 名稱：常數「${ks.name}」，紙本「${ps.name}」`);
    }
    if (ks.ageBand && ps.ageBand !== undefined && ps.ageBand !== ks.ageBand.key) {
      itemDiffs.push(`${label} 年齡段：常數 ${ks.ageBand.key}，紙本 ${ps.ageBand}`);
    }
    if (ps.declaredCount !== undefined && ps.declaredCount !== ps.items.length) {
      otherDiffs.push(`${label} 紙本標題寫共 ${ps.declaredCount} 项，表裡有 ${ps.items.length} 題`);
    }
    if (ks.items.length !== ps.items.length) {
      itemDiffs.push(`${label} 題數：常數 ${ks.items.length}，紙本 ${ps.items.length}`);
    }
    const m = Math.min(ks.items.length, ps.items.length);
    for (let j = 0; j < m; j++) {
      const ki = ks.items[j];
      const pi = ps.items[j];
      itemsCompared++;
      const where = `${label} 第 ${j + 1} 題`;
      if (ki.no !== pi.no) itemDiffs.push(`${where} 序號：常數 ${ki.no}，紙本 ${pi.no}`);
      if (ki.text !== pi.text) itemDiffs.push(`${where} 原文：常數「${ki.text}」，紙本「${pi.text}」`);
      if (ki.startMonth !== pi.startMonth) itemDiffs.push(`${where} 起始月齡：常數 ${ki.startMonth}，紙本 ${pi.startMonth}`);
    }
  }

  // ---- 選項 ----
  // ADL 的紙本表頭只印 7…1 七個數字，名稱與定義在表上方那七行（下面另比）；其餘工具表頭就是選項標籤。
  const paperHeaderIsNumeric = paper.optionLabels.length > 0 && paper.optionLabels.every(l => /^\d+$/.test(l));
  const kitSide = paperHeaderIsNumeric ? bank.options.map(o => String(o.value)) : bank.options.map(o => o.label);
  if (kitSide.join('|') !== paper.optionLabels.join('|')) {
    otherDiffs.push(`選項${paperHeaderIsNumeric ? '值' : '標籤'}：常數「${kitSide.join('／')}」，紙本表頭「${paper.optionLabels.join('／')}」`);
  }

  // ---- 分段 ----
  if (paper.tiers === null) {
    notes.push('紙本沒有「分數解讀」的分段表，分段無法對紙本比（常數裡的分段來自 HTML）');
  } else {
    const kitTiers = bank.tiers;
    if (kitTiers.length !== paper.tiers.length) {
      otherDiffs.push(`分段數：常數 ${kitTiers.length}，紙本 ${paper.tiers.length}`);
    }
    const t = Math.min(kitTiers.length, paper.tiers.length);
    for (let i = 0; i < t; i++) {
      const d = tierDiff(kitTiers[i], paper.tiers[i]);
      if (d) otherDiffs.push(`分段 ${i + 1}：${d}`);
    }
  }
  if (bank.sectionTiers) notes.push('各方面的分段（0–4／5–8／9–12／13–18）紙本沒有表，只能對 HTML 的 domLevel()');

  // ---- 只有這一支才有的東西 ----
  if (bank.id === 'sxk-asr') {
    notes.push('紙本只有 15 個項目名稱，沒有印 60 條錨點；錨點無法對紙本逐條比對，只能對 HTML 的 SECS[].items[].a');
  }
  if (bank.id === 'chexi') {
    notes.push('紙本在副量表內從 1 重新編號、常數另存原量表題號（sourceNo）；比的是副量表內的順序與原文，不比題號');
  }
  if (bank.id === 'sxk-adl') {
    const defs = paper.levelDefinitions ?? [];
    if (defs.length !== 7) otherDiffs.push(`七級定義：紙本找到 ${defs.length} 級`);
    for (const opt of bank.options) {
      const pd = defs.find(d => d.value === opt.value);
      if (!pd) { otherDiffs.push(`七級定義 ${opt.value}：紙本沒有`); continue; }
      if (pd.label !== opt.label) otherDiffs.push(`七級定義 ${opt.value} 名稱：常數「${opt.label}」，紙本「${pd.label}」`);
      if (pd.definition !== opt.definition) otherDiffs.push(`七級定義 ${opt.value} 全文：常數「${opt.definition}」，紙本「${pd.definition}」`);
    }
  }

  return { id: bank.id, code: bank.code, paperFile: paper.file, itemDiffs, otherDiffs, notes, itemsCompared };
}

/**
 * 分數是 0–100 的百分比或 0 起的總分，所以「下限 0」與「沒有下限」、「上限 100」與
 * 「沒有上限」是同一件事：紙本寫「55% 以下」、HTML 寫 `min: 0`，不算差異。
 */
function tierDiff(k: ToolkitTier, p: PaperTier): string | null {
  const problems: string[] = [];
  if (k.key !== p.key) problems.push(`名稱 常數「${k.key}」紙本「${p.key}」`);
  const lo = (v: number | undefined) => (v === undefined || v === 0 ? null : v);
  const hi = (v: number | undefined) => (v === undefined || v === 100 ? null : v);
  if (lo(k.min) !== lo(p.min)) problems.push(`下限 常數 ${k.min ?? '無'} 紙本 ${p.min ?? '無'}（${p.range}）`);
  if (hi(k.max) !== hi(p.max)) problems.push(`上限 常數 ${k.max ?? '無'} 紙本 ${p.max ?? '無'}（${p.range}）`);
  return problems.length ? problems.join('；') : null;
}

// ---------------------------------------------------------------------------
// 報告
// ---------------------------------------------------------------------------

export function formatReport(diffs: ToolDiff[]): string {
  const lines: string[] = [];
  const zero = diffs.filter(d => d.itemDiffs.length === 0);
  lines.push(`紙本逐題比對：${diffs.length} 支，面向與題目零差異 ${zero.length} 支，比對 ${diffs.reduce((n, d) => n + d.itemsCompared, 0)} 題`);
  lines.push('');
  for (const d of diffs) {
    const status = d.itemDiffs.length === 0 ? '✓ 題目零差異' : `✗ 題目 ${d.itemDiffs.length} 處差異`;
    lines.push(`${d.code.padEnd(10)} ${status}（比對 ${d.itemsCompared} 題）　${d.paperFile}`);
    for (const x of d.itemDiffs) lines.push(`    - 題目：${x}`);
    for (const x of d.otherDiffs) lines.push(`    - 其他：${x}`);
    for (const x of d.notes) lines.push(`    · 備註：${x}`);
  }
  return lines.join('\n');
}

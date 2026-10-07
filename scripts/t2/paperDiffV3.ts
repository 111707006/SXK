/**
 * 完整版題庫（`src/t2/kitv3/`）對紙本版逐題比對（T2 v3 題庫規格 §3.3，票 R3i）。純函式，只讀不改。
 *
 * 來源：`NEWT2/森心康评估工具包_完整版_20260923.zip` 的 `纸本版/` 31 份 docx（我們接的 24 支各有一份）。
 * 紙本是題目文字的權威；題庫是從同一個 zip 的 HTML 抽的。差異**不擋上線**，列給客戶。
 *
 * 【怎麼比】31 份紙本的版面各不相同（年齡段、題組、年級、錨點表……），逐份寫解析器划不來，也不是這一票要的。
 * 這裡把整份紙本的段落與表格儲存格攤平、正規化（去空白與標點、全形轉半形），題目與選項正規化後**整句出現在紙本裡**
 * 就算一致；找不到的，從紙本儲存格裡挑字元二元組最像的一格附上，讓客戶一眼看出是改字、漏題還是紙本沒印。
 * 所以這份清單只回答「題庫裡的字紙本上有沒有」，不回答「紙本有、題庫沒有」—— 後者要逐份解析，另開票。
 */

import type { DocxBlock } from './docx';
import type { KitV3Bank } from '../../src/t2/kitv3/types';

export const PAPER_ZIP_V3 = 'NEWT2/森心康评估工具包_完整版_20260923.zip';
export const PAPER_DIR_V3 = '森心康评估工具包_完整版/纸本版/';

/** 檔名對不上規則的例外（HTML 叫「问卷」，紙本叫「量表」）。 */
const PAPER_FILE_OVERRIDE: Readonly<Record<string, string>> = {
  '森心康_婴幼儿气质评估问卷_ITQ-TTS-BSQ.html': '森心康_婴幼儿气质评估量表_纸本版.docx',
};

/** 題庫來源 HTML 的檔名 → 同一支的紙本 docx 檔名：去掉結尾的工具代碼，換成「_纸本版.docx」。 */
export function paperFileForV3(htmlFile: string): string {
  if (PAPER_FILE_OVERRIDE[htmlFile]) return PAPER_FILE_OVERRIDE[htmlFile];
  return htmlFile.replace(/(_SXK(-[A-Za-z0-9]+)?)?\.html$/, '') + '_纸本版.docx';
}

/** 去空白、標點與全半形差異；比對只看字。 */
export function normalizeV3(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .replace(/[，。、；：？！“”‘’（）()「」『』《》〈〉【】\[\]—–\-…·・．.,;:?!"'／/～~]/g, '');
}

export interface PaperTextV3 {
  /** 整份攤平正規化後接成一串（找「整句出現」用）。 */
  joined: string;
  /** 每一段、每一格各自正規化（找「最像的一格」用），去掉空的與重複的。 */
  cells: string[];
  /** 同上，但保留原文（附在清單上給人看）。 */
  rawCells: string[];
}

export function paperTextV3(blocks: ReadonlyArray<DocxBlock>): PaperTextV3 {
  const raw: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'p') raw.push(b.text);
    else for (const row of b.rows) for (const cell of row) raw.push(cell);
  }
  const cells: string[] = [];
  const rawCells: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const n = normalizeV3(r);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    cells.push(n);
    rawCells.push(r.trim());
  }
  return { joined: cells.join('|'), cells, rawCells };
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 字元二元組的 Dice 係數（0–1）。一個字的兩邊相等算 1。 */
export function similarityV3(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  for (const [g, n] of A) hit += Math.min(n, B.get(g) ?? 0);
  return (2 * hit) / (a.length - 1 + (b.length - 1));
}

export interface PaperMissV3 {
  /** `item` 是題目；`option`、`hint`、`anchor` 是選項標籤、題目底下的小字、錨點。 */
  kind: 'item' | 'option' | 'hint' | 'anchor';
  key: string;
  text: string;
  /** 紙本上最像的一格（原文）與相似度；一格都不像（< 0.3）時 null。 */
  closest: { text: string; score: number } | null;
}

export interface PaperDiffV3 {
  code: string;
  title: string;
  paperFile: string;
  /** 比了幾句（題目＋選項＋小字＋錨點，去重）。 */
  checked: number;
  misses: PaperMissV3[];
}

/** 一支題庫對它的紙本：題庫裡每一句（去重）在紙本上找不找得到。 */
export function diffBankAgainstPaperV3(bank: KitV3Bank, paperFile: string, paper: PaperTextV3): PaperDiffV3 {
  const entries: Array<Omit<PaperMissV3, 'closest'>> = [];
  const seen = new Set<string>();
  const add = (kind: PaperMissV3['kind'], key: string, text: string) => {
    const n = normalizeV3(text);
    if (!n || seen.has(n)) return;
    seen.add(n);
    entries.push({ kind, key, text });
  };
  for (const form of bank.forms) {
    for (const section of form.sections) {
      for (const item of section.items) {
        add('item', item.key, item.text);
        if (item.hint) add('hint', item.key, item.hint);
        (item.anchors ?? []).forEach((a, i) => add('anchor', `${item.key}#${i}`, a));
      }
    }
  }
  for (const [set, options] of Object.entries(bank.options)) options.forEach(o => add('option', set, o.label));

  const misses: PaperMissV3[] = [];
  for (const e of entries) {
    const n = normalizeV3(e.text);
    if (paper.joined.includes(n)) continue;
    let best = -1;
    let score = 0;
    paper.cells.forEach((c, i) => {
      const s = similarityV3(n, c.length > n.length * 3 ? c.slice(0, n.length * 3) : c);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    misses.push({ ...e, closest: best >= 0 && score >= 0.3 ? { text: paper.rawCells[best], score: Math.round(score * 100) / 100 } : null });
  }
  return { code: bank.code, title: bank.title, paperFile, checked: entries.length, misses };
}

const KIND_LABEL: Readonly<Record<PaperMissV3['kind'], string>> = { item: '题目', option: '选项', hint: '说明小字', anchor: '锚点' };

/** 給客戶的 Markdown 清單：總表一張，有差異的每支一節。 */
export function formatReportV3(diffs: ReadonlyArray<PaperDiffV3>, generatedOn: string): string {
  const lines: string[] = [];
  lines.push(`# T2 完整版题库 × 纸本版 逐句比对（${generatedOn}）`, '');
  lines.push(`来源：\`${PAPER_ZIP_V3}\`。系统里的题库从同一个 zip 的 HTML 取出；这份清单把题库里的每一句（题目、选项、说明小字、锚点）拿去纸本版里找。`);
  lines.push('「找不到」不一定是错：可能是纸本改了字、漏印、换了说法，或是 HTML 版多出来的说明。最像的那一格附在后面，请对照确认以哪一边为准。');
  lines.push('只检查「系统里的字纸本上有没有」；纸本上有、系统里没有的，这份清单不列。', '');
  lines.push('| 量表 | 纸本档 | 比对句数 | 找不到 |', '|---|---|---:|---:|');
  for (const d of diffs) lines.push(`| ${d.code} ${d.title} | ${d.paperFile} | ${d.checked} | ${d.misses.length} |`);
  const total = diffs.reduce((n, d) => n + d.misses.length, 0);
  lines.push('', `合计 ${diffs.length} 支、${diffs.reduce((n, d) => n + d.checked, 0)} 句，找不到 ${total} 句。`, '');
  for (const d of diffs) {
    if (d.misses.length === 0) continue;
    lines.push(`## ${d.code} ${d.title}`, '');
    lines.push('| 类别 | 位置 | 系统里的字 | 纸本上最像的一格 | 相似度 |', '|---|---|---|---|---:|');
    const cell = (s: string) => s.replace(/\|/g, '｜').replace(/\n/g, ' ');
    for (const m of d.misses) {
      lines.push(`| ${KIND_LABEL[m.kind]} | ${m.key} | ${cell(m.text)} | ${m.closest ? cell(m.closest.text) : '（纸本上没有相近的）'} | ${m.closest ? m.closest.score : ''} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

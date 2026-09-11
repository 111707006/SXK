/**
 * 把 docx 讀成「依序排列的段落與表格」。
 *
 * 只做紙本比對需要的事：`word/document.xml` 的 body 裡，最外層依序有 `<w:p>`
 * 段落與 `<w:tbl>` 表格；表格裡的儲存格又各自裝著段落。這裡把它攤成一串區塊，
 * 每個區塊不是一段文字就是一張表（列 × 欄的純文字），格式、字型、邊框全部丟掉。
 *
 * 不用 XML parser 的理由跟 `zip.ts` 一樣：沒有依賴，而 WordprocessingML 這一小塊
 * 的結構夠規則 —— `<w:tbl>` 不會互相巢套（紙本版 22 支都沒有），文字只出現在
 * `<w:t>` 裡。碰到巢套表格會直接丟錯，不會安靜地吃掉內容。
 */

import { readZip } from './zip';

export type DocxBlock =
  | { kind: 'p'; text: string }
  | { kind: 'table'; rows: string[][] };

export function readDocxBlocks(docx: Buffer): DocxBlock[] {
  const inner = readZip(docx);
  const xml = inner.get('word/document.xml')?.toString('utf8');
  if (!xml) throw new Error('docx：沒有 word/document.xml');
  return parseDocumentXml(xml);
}

/** `word/document.xml` 的內容 → 區塊串。拆出來是為了不用造一個 zip 就能測。 */
export function parseDocumentXml(xml: string): DocxBlock[] {
  const start = xml.indexOf('<w:body>');
  const end = xml.lastIndexOf('</w:body>');
  if (start < 0 || end < 0) throw new Error('docx：document.xml 沒有 <w:body>');
  const body = xml.slice(start, end);

  const blocks: DocxBlock[] = [];
  let p = 0;
  while (p < body.length) {
    const nextTbl = indexOfTag(body, 'w:tbl', p);
    const nextP = indexOfTag(body, 'w:p', p);
    if (nextTbl < 0 && nextP < 0) break;

    if (nextTbl >= 0 && (nextP < 0 || nextTbl < nextP)) {
      const open = openTagEnd(body, nextTbl, 'w:tbl');
      if (open.selfClosing) throw new Error('docx：出現自閉合的 <w:tbl/>，表格沒有列，本讀取器不處理');
      const end = body.indexOf('</w:tbl>', open.next);
      if (end < 0) throw new Error('docx：<w:tbl> 沒有結尾');
      const tbl = body.slice(open.next, end);
      // 巢套表格時第一個 `</w:tbl>` 關的是內層，這一段就會夾著另一個開始標籤。
      if (indexOfTag(tbl, 'w:tbl', 0) >= 0) throw new Error('docx：出現巢套表格，本讀取器不處理');
      blocks.push({ kind: 'table', rows: tableRows(tbl) });
      p = end + '</w:tbl>'.length;
    } else {
      const para = readParagraph(body, nextP);
      blocks.push({ kind: 'p', text: para.text });
      p = para.next;
    }
  }
  return blocks;
}

/**
 * `<w:x>`、`<w:x ...>` 或 `<w:x/>` 的位置，但不能誤抓 `<w:pPr>`、`<w:trPr>`、`<w:tcPr>`
 * 這些同字首的標籤。`-1` 代表找不到。
 */
function indexOfTag(s: string, tag: string, from: number): number {
  const re = new RegExp(`<${tag}(?=[\\s>/])`, 'g');
  re.lastIndex = from;
  const m = re.exec(s);
  return m ? m.index : -1;
}

/** 開始標籤的 `>` 之後的位置，以及它是不是 `<w:x/>` 這種自閉合的寫法。 */
function openTagEnd(s: string, start: number, tag: string): { next: number; selfClosing: boolean } {
  const gt = s.indexOf('>', start);
  if (gt < 0) throw new Error(`docx：<${tag}> 的開始標籤沒有結尾`);
  return { next: gt + 1, selfClosing: s[gt - 1] === '/' };
}

/**
 * 一個段落的文字，與它結束之後的位置。
 *
 * Word 對空段落有時會寫成自閉合的 `<w:p/>`：那種段落沒有 `</w:p>`，照著找結尾會一路
 * 吃到**下一段**的結尾，把兩段併成一段、還讓後面少一段。所以先看開始標籤是不是自閉合的。
 */
function readParagraph(s: string, start: number): { text: string; next: number } {
  const open = openTagEnd(s, start, 'w:p');
  if (open.selfClosing) return { text: '', next: open.next };
  const end = s.indexOf('</w:p>', open.next);
  if (end < 0) throw new Error('docx：<w:p> 沒有結尾');
  return { text: runText(s.slice(start, end)), next: end + '</w:p>'.length };
}

function tableRows(tbl: string): string[][] {
  const rows: string[][] = [];
  // 用 lookahead 切，`<w:trPr>`／`<w:tcPr>` 這些同字首的屬性標籤才不會被當成新列、新格。
  for (const tr of tbl.split(/<w:tr(?=[\s>\/])/).slice(1)) {
    const cells: string[] = [];
    for (const tc of tr.split(/<w:tc(?=[\s>\/])/).slice(1)) {
      // 儲存格裡可能有多個段落，用換行接起來 —— 紙本的七級定義就是這樣排的。
      // 走 readParagraph 而不是自己配對 `<w:p>…</w:p>`，儲存格裡的 `<w:p/>` 才不會吃掉下一段。
      const paras: string[] = [];
      for (let q = indexOfTag(tc, 'w:p', 0); q >= 0; q = indexOfTag(tc, 'w:p', q)) {
        const para = readParagraph(tc, q);
        paras.push(para.text);
        q = para.next;
      }
      cells.push(paras.join('\n').trim());
    }
    rows.push(cells);
  }
  return rows;
}

/** 一個段落裡所有 `<w:t>` 的文字接起來；`<w:tab/>` 當成一個 tab。 */
function runText(para: string): string {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(para))) {
    out += m[1] === undefined ? '\t' : decodeXml(m[1]);
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

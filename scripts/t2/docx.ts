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
  const start = xml.indexOf('<w:body>');
  const end = xml.lastIndexOf('</w:body>');
  if (start < 0 || end < 0) throw new Error('docx：document.xml 沒有 <w:body>');
  const body = xml.slice(start, end);

  const blocks: DocxBlock[] = [];
  let p = 0;
  while (p < body.length) {
    const nextTbl = body.indexOf('<w:tbl>', p);
    const nextP = indexOfParagraphOpen(body, p);
    if (nextTbl < 0 && nextP < 0) break;

    if (nextTbl >= 0 && (nextP < 0 || nextTbl < nextP)) {
      const end = body.indexOf('</w:tbl>', nextTbl);
      if (end < 0) throw new Error('docx：<w:tbl> 沒有結尾');
      const tbl = body.slice(nextTbl + '<w:tbl>'.length, end);
      if (tbl.includes('<w:tbl>')) throw new Error('docx：出現巢套表格，本讀取器不處理');
      blocks.push({ kind: 'table', rows: tableRows(tbl) });
      p = end + '</w:tbl>'.length;
    } else {
      const end = body.indexOf('</w:p>', nextP);
      if (end < 0) throw new Error('docx：<w:p> 沒有結尾');
      blocks.push({ kind: 'p', text: runText(body.slice(nextP, end)) });
      p = end + '</w:p>'.length;
    }
  }
  return blocks;
}

/** `<w:p>` 或 `<w:p ...>`，但不能誤抓 `<w:pPr>`、`<w:pStyle>` 這些同字首的標籤。 */
function indexOfParagraphOpen(s: string, from: number): number {
  const re = /<w:p(?=[\s>\/])/g;
  re.lastIndex = from;
  const m = re.exec(s);
  return m ? m.index : -1;
}

function tableRows(tbl: string): string[][] {
  const rows: string[][] = [];
  // 用 lookahead 切，`<w:trPr>`／`<w:tcPr>` 這些同字首的屬性標籤才不會被當成新列、新格。
  for (const tr of tbl.split(/<w:tr(?=[\s>\/])/).slice(1)) {
    const cells: string[] = [];
    for (const tc of tr.split(/<w:tc(?=[\s>\/])/).slice(1)) {
      // 儲存格裡可能有多個段落，用換行接起來 —— 紙本的七級定義就是這樣排的。
      const paras = [...tc.matchAll(/<w:p(?=[\s>\/])[\s\S]*?<\/w:p>/g)].map(m => runText(m[0]));
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

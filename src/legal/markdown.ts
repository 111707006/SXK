/**
 * 條款用的極小 Markdown（客戶 11/03 第 14 頁：後台編輯條款，給沒有經驗的人用）。前端、後台預覽、伺服器檢查共用。
 *
 * 只認四種東西，對應後台工具列的四顆鈕：
 * - 標題：行首 `#`／`##`／`###` 加一個空白
 * - 條列：行首 `- `（或 `* `）；編號條列 `1. `
 * - 粗體：`**字**`
 * - 換行：段落裡的單一換行就是換行；空一行是新段落
 *
 * 其他語法（連結、圖片、HTML、表格）**不認**，照原字顯示 —— 畫面一律用 React 元素組，不走 innerHTML，
 * 條款裡打了 `<script>` 也只是一串字。
 */

export type LegalInline = { text: string; bold: boolean };

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: LegalInline[] }
  | { type: 'list'; ordered: boolean; items: LegalInline[][] }
  | { type: 'paragraph'; lines: LegalInline[][] };

/** 一份條款的長度上限（字元）：現在兩份各約三千字，留十倍。 */
export const MAX_LEGAL_MARKDOWN_LENGTH = 30000;

/** `**粗體**` 切成幾段；沒有配對的 `**` 照原字留著。 */
export function parseInline(line: string): LegalInline[] {
  const out: LegalInline[] = [];
  let rest = line;
  while (rest.length > 0) {
    const open = rest.indexOf('**');
    const close = open >= 0 ? rest.indexOf('**', open + 2) : -1;
    if (open < 0 || close < 0) {
      out.push({ text: rest, bold: false });
      break;
    }
    if (open > 0) out.push({ text: rest.slice(0, open), bold: false });
    const inner = rest.slice(open + 2, close);
    if (inner.length > 0) out.push({ text: inner, bold: true });
    rest = rest.slice(close + 2);
  }
  // 相鄰的同類段併起來（`a****b` 這種）
  return out.reduce<LegalInline[]>((acc, seg) => {
    const last = acc[acc.length - 1];
    if (last && last.bold === seg.bold) last.text += seg.text;
    else acc.push({ ...seg });
    return acc;
  }, []);
}

// 只有記號沒有字（「## 」「- 」去掉行尾空白後）也算，內容是空的。
const HEADING = /^(#{1,3})(?:\s+(.*))?$/;
const BULLET = /^[-*](?:\s+(.*))?$/;
const ORDERED = /^\d{1,3}[.、．]\s*(.*)$/;

export function parseLegalMarkdown(source: string): LegalBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: LegalBlock[] = [];
  let para: LegalInline[][] | null = null;
  let list: { ordered: boolean; items: LegalInline[][] } | null = null;
  const flush = () => {
    if (para) blocks.push({ type: 'paragraph', lines: para });
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    para = null;
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flush();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1].length as 1 | 2 | 3, content: parseInline((h[2] ?? '').trim()) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      const ordered = !b;
      if (para || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(parseInline(((b ?? o)![1] ?? '').trim()));
      continue;
    }
    if (list) flush();
    if (!para) para = [];
    para.push(parseInline(line));
  }
  flush();
  return blocks;
}

/** 拿掉標記之後的純文字（測試比對內建條款、伺服器檢查是不是空的用）。 */
export function legalPlainText(source: string): string {
  return parseLegalMarkdown(source)
    .flatMap(b =>
      b.type === 'heading' ? [b.content] : b.type === 'list' ? b.items : b.lines,
    )
    .map(segs => segs.map(s => s.text).join(''))
    .join('\n');
}

/** 後台送上來的 Markdown：字串、去掉頭尾空白後不是空的、不超過上限、沒有控制字元（換行與 tab 除外）。 */
export function readLegalMarkdown(raw: unknown): { ok: true; markdown: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: '条款内容要是文字。' };
  const markdown = raw.replace(/\r\n?/g, '\n').trim();
  if (legalPlainText(markdown).trim() === '') return { ok: false, error: '条款内容不能是空的。' };
  if (markdown.length > MAX_LEGAL_MARKDOWN_LENGTH) return { ok: false, error: `条款太长了（上限 ${MAX_LEGAL_MARKDOWN_LENGTH} 字）。` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(markdown)) return { ok: false, error: '条款里有看不见的控制字元，请重新贴上纯文字。' };
  return { ok: true, markdown };
}

/**
 * 後台條款編輯器的四顆工具鈕（11/03 第 14 頁：標題、條列、粗體、換行），給沒寫過 Markdown 的人用。
 * 純函式：吃整份文字與選取範圍，回新的文字與游標該落在哪裡（畫面拿去設回 textarea）。
 */

export interface EditorState {
  text: string;
  start: number;
  end: number;
}

/** 選取範圍涵蓋的那幾整行（游標在某一行中間也算那一行）。 */
function lineRange(text: string, start: number, end: number): { from: number; to: number } {
  const from = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const stop = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const nl = text.indexOf('\n', stop);
  return { from: start === 0 ? 0 : from, to: nl < 0 ? text.length : nl };
}

function mapLines(s: EditorState, fn: (line: string) => string): EditorState {
  const { from, to } = lineRange(s.text, s.start, s.end);
  const block = s.text.slice(from, to).split('\n').map(fn).join('\n');
  const text = s.text.slice(0, from) + block + s.text.slice(to);
  return { text, start: from, end: from + block.length };
}

const HEADING_PREFIX = /^#{1,3}\s+/;
const BULLET_PREFIX = /^[-*]\s+/;

/** 標題：選到的行變成 `## 標題`；已經是標題就拿掉（再按一次＝取消）。 */
export function toggleHeading(s: EditorState): EditorState {
  const { from, to } = lineRange(s.text, s.start, s.end);
  const lines = s.text.slice(from, to).split('\n');
  const allHeading = lines.every(l => l.trim() === '' || HEADING_PREFIX.test(l));
  return mapLines(s, l => (l.trim() === '' ? l : allHeading ? l.replace(HEADING_PREFIX, '') : `## ${l.replace(HEADING_PREFIX, '').replace(BULLET_PREFIX, '')}`));
}

/** 條列：選到的每一行前面加 `- `；都已經是條列就拿掉。 */
export function toggleBullets(s: EditorState): EditorState {
  const { from, to } = lineRange(s.text, s.start, s.end);
  const lines = s.text.slice(from, to).split('\n');
  const allBullet = lines.every(l => l.trim() === '' || BULLET_PREFIX.test(l));
  return mapLines(s, l => (l.trim() === '' ? l : allBullet ? l.replace(BULLET_PREFIX, '') : `- ${l.replace(BULLET_PREFIX, '').replace(HEADING_PREFIX, '')}`));
}

/** 粗體：選到的字前後加 `**`；沒選字就插入 `**粗体文字**` 並選起中間那幾個字，直接打字就換掉。 */
export function wrapBold(s: EditorState): EditorState {
  const selected = s.text.slice(s.start, s.end);
  if (selected.length === 0) {
    const placeholder = '粗体文字';
    const text = `${s.text.slice(0, s.start)}**${placeholder}**${s.text.slice(s.end)}`;
    return { text, start: s.start + 2, end: s.start + 2 + placeholder.length };
  }
  // 已經包著 `**` 就拿掉
  if (s.text.slice(s.start - 2, s.start) === '**' && s.text.slice(s.end, s.end + 2) === '**') {
    const text = s.text.slice(0, s.start - 2) + selected + s.text.slice(s.end + 2);
    return { text, start: s.start - 2, end: s.end - 2 };
  }
  const text = `${s.text.slice(0, s.start)}**${selected}**${s.text.slice(s.end)}`;
  return { text, start: s.start + 2, end: s.end + 2 };
}

/** 換行：在游標處斷一行（同一段裡的換行；空一行才是新段落）。 */
export function insertLineBreak(s: EditorState): EditorState {
  const text = `${s.text.slice(0, s.start)}\n${s.text.slice(s.end)}`;
  return { text, start: s.start + 1, end: s.start + 1 };
}

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { entryQrFileName, qrMatrix } from '../src/admin/entryQr';

/** 進站連結的二維碼（11/03 第 2、29 頁）：前端產生、可下載 PNG；合作公司與推薦人兩處都掛。 */
describe('進站二維碼', () => {
  it('同一個連結畫出同一組格子；不同連結不同；方陣、有定位角', () => {
    const a = qrMatrix('https://sxkscreen.com/?c=jia');
    expect(a.length).toBeGreaterThanOrEqual(21);
    expect(a.every(r => r.length === a.length)).toBe(true);
    expect(qrMatrix('https://sxkscreen.com/?c=jia')).toEqual(a);
    expect(qrMatrix('https://sxkscreen.com/?c=yi')).not.toEqual(a);
    // 左上定位角：第一列前七格全黑
    expect(a[0].slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
  });

  it('檔名只留英數與 -_', () => {
    expect(entryQrFileName('jia-01')).toBe('进站二维码-jia-01.png');
    expect(entryQrFileName('../x?')).toBe('进站二维码-x.png');
    expect(entryQrFileName('')).toBe('进站二维码-link.png');
  });

  it('合作公司分頁的進站連結旁掛著二維碼', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/admin/panels/CompaniesPanel.tsx'), 'utf8');
    expect(src).toMatch(/<EntryLinkQr url=\{`\$\{origin\}\/\?c=\$\{c\.slug\}`\}/);
  });
});

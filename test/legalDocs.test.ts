import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalPlainText, parseInline, parseLegalMarkdown, readLegalMarkdown } from '../src/legal/markdown';
import { defaultLegalMarkdown } from '../src/legal/defaultMarkdown';
import { insertLineBreak, toggleBullets, toggleHeading, wrapBold } from '../src/legal/editorActions';
import { latestLegalDate, legalDateLabel, legalDocsFromRows, readLegalDocs } from '../src/legal/shape';
import { BUILTIN_LEGAL_TERMS } from '../src/components/LegalTerms';
import LegalMarkdownView from '../src/legal/LegalMarkdownView';
import { PRODUCT } from '../src/productConfig';

/**
 * 後台可編輯的條款（客戶 11/03 第 14 頁）：極小 Markdown、工具鈕、內建條款的 Markdown 版與畫面上的內建條款一字不差、
 * 落款日期、schema 與遷移。
 */

describe('Markdown', () => {
  it('四種東西：標題、條列（含編號）、粗體、段落裡的換行', () => {
    const blocks = parseLegalMarkdown('## 一、总则\n第一行\n第二行\n\n- 甲\n- **乙**\n\n1. 丙\n2. 丁');
    expect(blocks).toEqual([
      { type: 'heading', level: 2, content: [{ text: '一、总则', bold: false }] },
      { type: 'paragraph', lines: [[{ text: '第一行', bold: false }], [{ text: '第二行', bold: false }]] },
      { type: 'list', ordered: false, items: [[{ text: '甲', bold: false }], [{ text: '乙', bold: true }]] },
      { type: 'list', ordered: true, items: [[{ text: '丙', bold: false }], [{ text: '丁', bold: false }]] },
    ]);
  });

  it('沒配對的 ** 照原字', () => {
    expect(parseInline('a**b')).toEqual([{ text: 'a**b', bold: false }]);
    expect(parseInline('**粗**与**粗2**尾')).toEqual([
      { text: '粗', bold: true }, { text: '与', bold: false }, { text: '粗2', bold: true }, { text: '尾', bold: false },
    ]);
  });

  it('HTML 不執行：畫出來是一串字', () => {
    const html = renderToStaticMarkup(LegalMarkdownView({ markdown: '<script>alert(1)</script>\n<img src=x onerror=alert(1)>' }));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('後台送上來的檢查', () => {
    expect(readLegalMarkdown('  ## a\n内容 \r\n')).toEqual({ ok: true, markdown: '## a\n内容' });
    for (const bad of ['', '  ', '## \n- ', 1, null, 'x'.repeat(30001), 'a\u0007b']) {
      expect(readLegalMarkdown(bad).ok, String(bad).slice(0, 10)).toBe(false);
    }
    expect(readLegalMarkdown('a\tb').ok).toBe(true);
  });
});

describe('工具鈕', () => {
  it('標題：游標那一行變小標題，再按一次取消', () => {
    const s = { text: '甲\n乙\n丙', start: 3, end: 3 };
    const h = toggleHeading(s);
    expect(h.text).toBe('甲\n## 乙\n丙');
    expect(toggleHeading(h).text).toBe('甲\n乙\n丙');
  });

  it('條列：選到的幾行都加，空行不加；都已經是條列就拿掉', () => {
    const s = { text: '甲\n乙\n\n丙', start: 0, end: 6 };
    const b = toggleBullets(s);
    expect(b.text).toBe('- 甲\n- 乙\n\n- 丙');
    expect(toggleBullets(b).text).toBe('甲\n乙\n\n丙');
  });

  it('粗體：包住選到的字；沒選字插入一段可直接打字換掉的示範字；再按一次拿掉', () => {
    const b = wrapBold({ text: '重要条款', start: 0, end: 2 });
    expect(b).toEqual({ text: '**重要**条款', start: 2, end: 4 });
    expect(wrapBold(b)).toEqual({ text: '重要条款', start: 0, end: 2 });
    const empty = wrapBold({ text: 'ab', start: 1, end: 1 });
    expect(empty.text).toBe('a**粗体文字**b');
    expect(empty.text.slice(empty.start, empty.end)).toBe('粗体文字');
  });

  it('換行：游標處斷一行', () => {
    expect(insertLineBreak({ text: 'ab', start: 1, end: 1 })).toEqual({ text: 'a\nb', start: 2, end: 2 });
  });
});

describe('內建條款的 Markdown 版（後台的起點）', () => {
  const squash = (s: string) => s.replace(/\s+/g, '');
  const textOf = (html: string) =>
    html.replace(/<[^>]+>/g, '\n').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  it.each(['service', 'privacy'] as const)('%s：與畫面上的內建條款逐字相同（不計空白）', key => {
    const builtin = squash(textOf(renderToStaticMarkup(BUILTIN_LEGAL_TERMS[key]())));
    const md = squash(legalPlainText(defaultLegalMarkdown(key, PRODUCT.brand)));
    expect(md).toBe(builtin);
  });

  it('不寫落款（日期存檔時自動填）、不寫「技术实验室」那一行、不寫死品牌名', () => {
    for (const key of ['service', 'privacy'] as const) {
      expect(defaultLegalMarkdown(key, PRODUCT.brand)).not.toMatch(/最后更新日期|技术实验室/);
      expect(defaultLegalMarkdown(key, { systemName: '甲系统', operatorClause: '乙，', ipHolder: '丙公司' })).not.toMatch(/森心康|森跃诺动/);
    }
  });
});

describe('落款日期與讀回', () => {
  it('照 Asia/Shanghai 寫日期：UTC 前一天 16:30 是隔天', () => {
    expect(legalDateLabel('2026-11-06T16:30:00Z')).toBe('2026年11月7日');
    expect(legalDateLabel('2026-11-06T15:59:59Z')).toBe('2026年11月6日');
  });

  it('幾份裡取存過的最晚那一天；一份都沒存過是 null', () => {
    expect(latestLegalDate([null, null])).toBeNull();
    expect(latestLegalDate([{ markdown: 'a', updatedAt: '2026-11-01T00:00:00Z' }, { markdown: 'b', updatedAt: '2026-11-05T00:00:00Z' }])).toBe('2026年11月5日');
    expect(latestLegalDate([null, { markdown: 'b', updatedAt: '2026-11-05T00:00:00Z' }])).toBe('2026年11月5日');
  });

  it('資料庫的列與前端讀回：認不得、空的、日期壞的當成沒存過', () => {
    expect(legalDocsFromRows([
      { doc_key: 'service', markdown: '内容', updated_at: '2026-11-07T01:00:00Z' },
      { doc_key: 'privacy', markdown: '  ', updated_at: '2026-11-07T01:00:00Z' },
      { doc_key: 'cookies', markdown: 'x', updated_at: '2026-11-07T01:00:00Z' },
    ])).toEqual({ service: { markdown: '内容', updatedAt: '2026-11-07T01:00:00Z' }, privacy: null });
    expect(readLegalDocs(null)).toEqual({ service: null, privacy: null });
    expect(readLegalDocs({ service: { markdown: 'a', updatedAt: 'nope' }, privacy: { markdown: 'b', updatedAt: '2026-11-07T00:00:00Z' } }))
      .toEqual({ service: null, privacy: { markdown: 'b', updatedAt: '2026-11-07T00:00:00Z' } });
  });
});

describe('schema 與遷移', () => {
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const block = (sql: string) => {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS `legal_documents`');
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
  };

  it('CREATE TABLE 一字不差、遷移只加表', () => {
    const migration = read('deploy/migrations/2026-11-07-legal-documents.sql');
    expect(block(migration)).toBe(block(read('deploy/schema.sql')));
    expect(migration).not.toMatch(/ALTER TABLE|DROP /);
  });
});

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareCardHtml1022 } from '../vite.config';
import { WORDING_1022 } from '../src/wording1022';

/**
 * 客戶 10/22 修改的建置期開關 `VITE_UI_1022`（issue #78，規格 `docs/specs/client-changes-2026-10-22-1-ui.md`）：
 * 只在專案 A、預設關、只收 `1`／`0`。開著時品牌改「家庭评估与训练平台」、頁首不畫「森」字方塊、
 * 頁尾三行、靜態頁的 title／description／第一段給分享卡用。B 的 profile 不讀它。
 */

const BRAND_WORDS = ['森心康', 'SenXinKang', '森跃诺动'];

async function loadProduct(ui1022: string | undefined) {
  vi.resetModules();
  if (ui1022 !== undefined) vi.stubEnv('VITE_UI_1022', ui1022);
  return (await import('../src/productConfig')).PRODUCT;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('VITE_UI_1022', () => {
  it('不設就是關，A 的品牌照舊', async () => {
    const product = await loadProduct(undefined);
    expect(product.mode).toBe('full');
    expect(product.features.ui1022).toBe(false);
    expect(product.brand.headerTitle).toBe('森心康儿童综合发展评估系统');
    expect(product.brand.documentTitle).toBe('森心康 - 儿童综合发展评估系统');
    expect(product.brand.copyright).toBe('© 2026 森心康儿童综合发展评估系统');
  });

  it('0 也是關', async () => {
    expect((await loadProduct('0')).features.ui1022).toBe(false);
  });

  it('開著：網頁標題、頁首、歡迎語、版權都是平台名稱，沒有品牌字', async () => {
    const product = await loadProduct('1');
    expect(product.features.ui1022).toBe(true);
    const { documentTitle, headerTitle, welcomeName, copyright } = product.brand;
    expect(documentTitle).toBe('家庭评估与训练平台');
    expect(headerTitle).toBe('家庭评估与训练平台');
    expect(welcomeName).toBe('家庭评估与训练平台');
    expect(copyright).toBe('© 2026 家庭评估与训练平台');
    for (const text of [documentTitle, headerTitle, welcomeName ?? '', copyright, WORDING_1022.welcome]) {
      for (const word of BRAND_WORDS) expect(text).not.toContain(word);
    }
  });

  it('開著：法律文字的欄位不動', async () => {
    const off = await loadProduct(undefined);
    const offLegal = { ...off.brand };
    const on = await loadProduct('1');
    for (const key of ['systemName', 'legalEntity', 'operatorClause', 'ipHolder'] as const) {
      expect(on.brand[key]).toBe(offLegal[key]);
    }
  });

  it('B 的 profile 寫死 false，不讀這個開關', () => {
    const src = readFileSync('src/productConfig.ts', 'utf8');
    const t1 = src.slice(src.indexOf('t1only: {'));
    expect(t1).toContain('ui1022: false,');
    expect(t1).not.toContain('UI_1022_A');
  });

  it('建置前擋認不得的值', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src).toMatch(/assertValidUiLedo\(\);\s*assertValidUi1022\(\);/);
    expect(src).toContain("raw === '1' || raw === '0'");
  });
});

describe('靜態頁的分享卡', () => {
  const html = readFileSync('index.html', 'utf8');
  const out = shareCardHtml1022(html);

  it('新 title 與 description', () => {
    expect(out).toContain('<title>家庭评估与训练平台</title>');
    expect(out).toContain('<meta name="description" content="欢迎体验家庭评估与训练平台" />');
    expect(out).not.toContain('儿童发育评估系统');
  });

  it('body 第一段是視覺隱藏的歡迎句，在 #root 之前', () => {
    const body = out.slice(out.indexOf('<body>') + '<body>'.length).trimStart();
    expect(body.startsWith('<p style="position:absolute;width:1px;height:1px;')).toBe(true);
    expect(body.indexOf('欢迎体验家庭评估与训练平台')).toBeLessThan(body.indexOf('<div id="root">'));
  });

  it('只在 A、開著時才換', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src).toContain("process.env.VITE_UI_1022 === '1' && process.env.VITE_APP_MODE !== 't1only'");
  });
});

describe('頁首與頁尾', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('頁首的「森」字方塊在 1022 不畫', () => {
    const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
    expect(header).toMatch(/\{!PRODUCT\.features\.ui1022 && \(\s*<div className="w-10 h-10[^"]*">\s*<BrandMark \/>/);
  });

  it('頁尾在 1022 只留版權、兩個條款、備案號', () => {
    const footer = app.slice(app.indexOf('<footer'), app.indexOf('</footer>'));
    expect(footer).toMatch(/\{!PRODUCT\.features\.ui1022 && \(<>[\s\S]*发育评估量表归档声明[\s\S]*<\/>\)\}/);
    expect(footer).toContain('{PRODUCT.brand.copyright}');
    expect(footer).toContain('服务及免责条款');
    expect(footer).toContain('隐私保护条款');
    expect(footer).toContain('<BeianFooter />');
  });

  it('歡迎語在 1022 只寫平台名稱（建檔頁標題下那一行，#83）', () => {
    expect(app).toContain('{WORDING_1022.welcome}。{WORDING_1022.profile.intro}');
  });
});

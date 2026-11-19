import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { B_SYSTEM_NAME, shareCardHtml1022 } from '../vite.config';
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
    expect(product.brand.headerTitle).toBe('森心康儿少综合发展评估系统');
    expect(product.brand.documentTitle).toBe('森心康 - 儿少综合发展评估系统');
    expect(product.brand.copyright).toBe('© 2026 森心康儿少综合发展评估系统');
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

  // 2026-11-19 起 B 也照開關，但用自己的那一份（UI_1022_B），不拿 A 的品牌文案。
  it('B 的 profile 讀同一個開關、只用 UI_1022_B', () => {
    const src = readFileSync('src/productConfig.ts', 'utf8');
    const t1 = src.slice(src.indexOf('t1only: {'));
    expect(t1).toContain('ui1022: UI_1022_B,');
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

  it('開著時才換（A、B 都換，2026-11-19 起）', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src).toContain("const on = process.env.VITE_UI_1022 === '1';");
  });

  // 2026-11-19 使用者：B 的名字改回「儿少综合发展评估系统」，分享卡也寫這個（原本靜態頁還是舊的「儿童发育评估系统」）
  it('B 寫自己的系統名，與 productConfig 的 t1only brand 一致', () => {
    const b = shareCardHtml1022(html, B_SYSTEM_NAME);
    expect(b).toContain('<title>儿少综合发展评估系统</title>');
    expect(b).toContain('content="欢迎体验儿少综合发展评估系统"');
    expect(b).not.toContain('家庭评估与训练平台');
    const profile = readFileSync('src/productConfig.ts', 'utf8');
    const t1 = profile.slice(profile.indexOf('t1only: {'));
    expect(t1).toContain(`headerTitle: '${B_SYSTEM_NAME}'`);
    expect(t1).toContain(`documentTitle: '${B_SYSTEM_NAME}'`);
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("process.env.VITE_APP_MODE === 't1only' ? B_SYSTEM_NAME : WORDING_1022.platformName");
  });
});

describe('頁首與頁尾', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('頁首的「森」字方塊在 1022 不畫', () => {
    const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
    // 專案 B 那一塊是合作公司的 LOGO（logoSource 'company'），1022 照畫（2026-11-19）；A 是「森」字，不畫。
    expect(header).toMatch(/\{\(!PRODUCT\.features\.ui1022 \|\| PRODUCT\.brand\.logoSource === 'company'\) && \(\s*<div className="w-10 h-10[^"]*">\s*<BrandMark \/>/);
  });

  it('頁尾在 1022 只留版權、兩個條款、備案號', () => {
    const footer = app.slice(app.indexOf('<footer'), app.indexOf('</footer>'));
    expect(footer).toMatch(/\{!PRODUCT\.features\.ui1022 && \(<>[\s\S]*发育评估量表归档声明[\s\S]*<\/>\)\}/);
    expect(footer).toContain('{PRODUCT.brand.copyright}');
    expect(footer).toContain('服务及免责条款');
    expect(footer).toContain('隐私保护条款');
    expect(footer).toContain('<BeianFooter />');
  });

  // 系統名照各產品自己的 headerTitle：A 1022 是平台名稱，B 是儿少综合发展评估系统（2026-11-19）
  it('歡迎語在 1022 只寫系統名（建檔頁標題下那一行，#83）', () => {
    expect(app).toContain('欢迎使用{PRODUCT.brand.headerTitle}。{WORDING_1022.profile.intro}');
  });
});

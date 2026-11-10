import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 電腦版版面（版型 C 分屏導覽）的建置期開關 `VITE_DESKTOP_LAYOUT`（使用者 2026-11-10）：只在專案 A、預設關、只收 `1`／`0`。
 * 開著也只在 ≥ 1024px、有孩子檔案時換外框（`useDesktopWide`）；1024px 以下的 DOM 不變。
 */

async function loadProduct(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import('../src/productConfig')).PRODUCT;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('VITE_DESKTOP_LAYOUT', () => {
  it('不設、0 都是關', async () => {
    expect((await loadProduct({})).features.desktopLayout).toBe(false);
    expect((await loadProduct({ VITE_DESKTOP_LAYOUT: '0' })).features.desktopLayout).toBe(false);
  });

  it('A 帶 1 才開', async () => {
    const product = await loadProduct({ VITE_DESKTOP_LAYOUT: '1' });
    expect(product.mode).toBe('full');
    expect(product.features.desktopLayout).toBe(true);
  });

  it('B 帶 1 也不開', async () => {
    const product = await loadProduct({ VITE_APP_MODE: 't1only', VITE_DESKTOP_LAYOUT: '1' });
    expect(product.mode).toBe('t1only');
    expect(product.features.desktopLayout).toBe(false);
  });

  it('建置前擋認不得的值', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src).toMatch(/assertValidMallOpen\(\);\s*assertValidDesktopLayout\(\);/);
    expect(src).toContain("raw === '1' || raw === '0'");
  });

  it('開關關著：useDesktopWide 永遠 false（不問 matchMedia）；頁面不在家長端 App 裡時 useDesktopLayout 也是 false', async () => {
    vi.resetModules();
    const { useDesktopWide, useDesktopLayout } = await import('../src/desktop/useDesktopLayout');
    const { renderToString } = await import('react-dom/server');
    const { createElement } = await import('react');
    const seen: boolean[] = [];
    const Probe = () => { seen.push(useDesktopWide(), useDesktopLayout()); return null; };
    renderToString(createElement(Probe));
    expect(seen).toEqual([false, false]);
  });

  it('電腦版頂欄的導覽沿用頁首那一份（同一組 id、字與去處），不另寫一份', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('items={navItems}');
    expect(app).toContain('right={customerMenu(true, child)}');
    expect(app).toContain('{customerMenu(false, child)}');
    // 電腦版頂欄出現時不畫手機頁首：同一組 id 不會同時在 DOM 裡
    expect(app).toContain('{!desktopLayout && <header');
  });

  it('後台、掃碼頁不吃電腦版排法：只有家長端 App 提供 DesktopLayoutScope', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<DesktopLayoutScope.Provider value={desktopLayout}>');
    for (const f of ['src/admin/AdminApp.tsx', 'src/components/ScanReportPage.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toContain('DesktopLayoutScope');
    }
  });

  it('登入前首頁與登入頁：wide 只從 App 給、只在 useDesktopWide 成立時；手機那一份不吃 wide', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<LedoHomePage onOpen={openHomeTarget} wide={desktopWide} />');
    expect(app).toContain('<AuthScreen onAuthSuccess={handleAuthSuccess} dbConfigured={dbConfigured} wide={desktopWide} />');
    const auth = readFileSync('src/components/AuthScreen.tsx', 'utf8');
    expect(auth).toContain('const desk = ledo && wide;');
    expect(auth).toContain('if (!desk) return card;');
  });

  it('T1 作答：不在電腦版外框裡畫的是手機那一份（沒有右邊的方面清單）；在外框裡才換', async () => {
    vi.resetModules();
    const { renderToString } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { DesktopLayoutScope } = await import('../src/desktop/useDesktopLayout');
    const { default: LedoT1Questions } = await import('../src/components/ledo/LedoT1Questions');
    const questions = [
      { id: 'a1', dimensionId: 'cognitive', dimensionName: '认知', text: '题一', options: [{ label: '可以做到', score: 2 }, { label: '还不能', score: 0 }] },
      { id: 'b1', dimensionId: 'language', dimensionName: '语言', text: '题二', options: [{ label: '可以做到', score: 2 }, { label: '还不能', score: 0 }] },
    ] as never;
    const props = { questions, answers: {}, ageBandName: 'C 段', onSelect: () => {}, onSubmit: () => {}, onExit: () => {} };
    const mobile = renderToString(createElement(LedoT1Questions, props));
    expect(mobile).toContain('id="ledo-t1"');
    expect(mobile).not.toContain('ledo-t1-dims');
    const desk = renderToString(createElement(DesktopLayoutScope.Provider, { value: true }, createElement(LedoT1Questions, props)));
    expect(desk).toContain('id="ledo-t1-dims"');
    expect(desk.replace(/<!-- -->/g, '')).toContain('已答 0 / 2 题');
    // 還沒答到的方面不能跳過去
    const side = desk.slice(desk.indexOf('ledo-t1-dims'));
    const items = side.split('<li>').slice(1);
    expect(items[0]).toContain('认知');
    expect(items[0]).not.toContain('disabled=""');
    expect(items[1]).toContain('语言');
    expect(items[1]).toContain('disabled=""');
  });

  it('T2 付費頁、線下服務點：電腦版是另一個分支，手機那一份原樣留著', () => {
    const pay = readFileSync('src/components/Paywall.tsx', 'utf8');
    expect(pay).toContain('id="paywall-desktop"');
    expect(pay).toContain('<div className="max-w-2xl mx-auto">');
    const off = readFileSync('src/home/OfflineServicePage.tsx', 'utf8');
    expect(off).toContain('const desk = useDesktopLayout();');
    expect(off).toContain('mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4');
  });
});

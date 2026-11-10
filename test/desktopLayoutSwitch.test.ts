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
});

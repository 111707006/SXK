import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT } from '../src/productConfig';

/**
 * Ledo 版的建置期開關（使用者 2026-10-21：A 換、B 先不動）。測試環境沒設 `VITE_UI_LEDO`、模式是 A，
 * 所以 A 的預設必須是開；B 的預設是關、只有帶 `1` 才開；後台不掛 `data-ui`。
 */
describe('VITE_UI_LEDO', () => {
  it('A 不設就是 Ledo 版', () => {
    expect(PRODUCT.mode).toBe('full');
    expect(PRODUCT.features.ledo).toBe(true);
  });

  it('B 只有明講 1 才開，A 只有明講 0 才關', () => {
    const src = readFileSync('src/productConfig.ts', 'utf8');
    expect(src).toContain("ledo: import.meta.env.VITE_UI_LEDO !== '0'");
    expect(src).toContain("ledo: import.meta.env.VITE_UI_LEDO === '1'");
  });

  it('建置前擋認不得的值', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src).toMatch(/assertValidAppMode\(\);\s*assertValidUiLedo\(\);/);
  });

  it('後台不掛 data-ui', () => {
    const src = readFileSync('src/main.tsx', 'utf8');
    expect(src).toContain("if (PRODUCT.features.ledo && !isAdmin) document.documentElement.dataset.ui = 'ledo';");
  });
});

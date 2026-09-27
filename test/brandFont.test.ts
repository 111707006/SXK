import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { BRAND_FONT_STACK, BRAND_FONT_VERSION } from '../src/brandFont';

/**
 * 全站只用思源黑体（2026-09 居家訓練評審會議：規避版權風險；理由見 `src/brandFont.ts`）。
 *
 * 壞掉的樣子全都很安靜：CSS 讀不到字檔、或有人在某一頁又寫回 "Microsoft YaHei"，
 * 畫面照樣出得來，只是用了別的字 —— 肉眼在自己的電腦上根本看不出差別。
 *
 * 伺服器吐的兩頁（掃碼報告頁、連結失效頁）由 `test/reportLink.http.test.ts` 真的發請求驗。
 */

const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const PKG_JSON = require.resolve('@fontsource-variable/noto-sans-sc/package.json');
const PKG_DIR = path.dirname(PKG_JSON);

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx|css|html)$/.test(entry.name) ? [rel] : [];
  });
}

describe('字型套件與路徑', () => {
  // 路徑帶版本號、伺服器叫瀏覽器快取一年。版本沒跟著換，家長會拿到舊字檔配新 CSS。
  it('裝的套件版本就是 BRAND_FONT_VERSION', () => {
    expect(JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version).toBe(BRAND_FONT_VERSION);
    expect(JSON.parse(read('package.json')).dependencies['@fontsource-variable/noto-sans-sc']).toBe(
      BRAND_FONT_VERSION
    );
  });

  // `vite.config.ts` 的 `brandFont()` 照搬 `index.css` 與 `files/*.woff2`。CSS 指到的每一片都要在。
  it('套件的 CSS 指到的每一片字檔都在 files/ 裡', () => {
    const css = fs.readFileSync(path.join(PKG_DIR, 'index.css'), 'utf8');
    const urls = [...css.matchAll(/url\(\.\/(files\/[^)]+\.woff2)\)/g)].map(m => m[1]);
    expect(urls.length).toBeGreaterThan(50);
    for (const rel of urls) expect(fs.existsSync(path.join(PKG_DIR, rel)), rel).toBe(true);
    expect(css).toContain("font-family: 'Noto Sans SC Variable'");
  });
});

describe('index.css 的三個字型 token 都是思源黑体', () => {
  const css = read('src/index.css');

  it.each(['sans', 'serif', 'mono'])('--font-%s', token => {
    expect(css).toContain(`--font-${token}: ${BRAND_FONT_STACK};`);
  });

  // 在中國大陸多半連不上，連不上就悄悄退回系統字 —— 等於沒換。
  it('不再從 Google Fonts 載字', () => {
    expect(css).not.toContain('fonts.googleapis.com');
  });
});

describe('原始碼裡不點名其他字型', () => {
  // 家長看得到的題庫與手冊原文不是樣式，不掃（裡面也沒有字型名）；`brandFont.ts` 的檔頭
  // 要講清楚為什麼不用那幾套，會點到名字，也不掃。
  const files = [...walk('src'), 'server.ts', 'index.html'].filter(
    rel =>
      !rel.startsWith(path.join('src', 't2', 'toolkit')) &&
      !rel.endsWith('activityContent.ts') &&
      rel !== path.join('src', 'brandFont.ts')
  );

  it.each([
    ['微軟雅黑', /Microsoft YaHei|微软雅黑|微軟雅黑/],
    ['蘋方', /PingFang/],
    ['宋體／黑體（Windows）', /SimSun|SimHei|宋体|NSimSun/],
    ['原本的三套英文字', /Plus Jakarta|Playfair|JetBrains Mono/],
    ['Google Fonts', /fonts\.googleapis\.com/],
  ])('%s', (_label, pattern) => {
    const hits = files.filter(rel => pattern.test(read(rel)));
    expect(hits).toEqual([]);
  });

  // canvas 上寫的字不經過 CSS，要自己指定字型。
  it('canvas 的 ctx.font 都用 BRAND_FONT_STACK', () => {
    const offenders = files.flatMap(rel =>
      read(rel)
        .split('\n')
        .filter(line => /ctx\.font\s*=/.test(line) && !line.includes('BRAND_FONT_STACK'))
        .map(line => `${rel}: ${line.trim()}`)
    );
    expect(offenders).toEqual([]);
  });
});

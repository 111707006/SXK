import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import {createRequire} from 'module';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {BRAND_FONT_CSS_HREF, BRAND_FONT_DIR, BRAND_FONT_VERSION} from './src/brandFont';

/**
 * 在建置開始前就擋下無法辨識的 VITE_APP_MODE。
 *
 * `src/productConfig.ts` 的 `resolveMode()` 也會擋，但那是在瀏覽器裡執行的 ——
 * 打錯字的建置會照常成功，直到使用者開啟頁面才變成空白畫面。
 * 交付給合作公司的產物必須在建置階段就發現錯誤，所以這裡再擋一次。
 */
function assertValidAppMode() {
  const raw = process.env.VITE_APP_MODE;
  if (raw === undefined || raw === '' || raw === 'full' || raw === 't1only') return;
  throw new Error(
    `VITE_APP_MODE 的值無法辨識: ${JSON.stringify(raw)}。\n` +
    `只接受 'full'（專案 A，含深度評估與付費）或 't1only'（專案 B，止於聯繫專家）。\n` +
    `未設定時視為 'full'。`
  );
}

/**
 * 思源黑体放到固定路徑 `/fonts/noto-sans-sc-<版本>/`（理由見 `src/brandFont.ts`）。
 *
 * - 建置：把套件的 `index.css` 與 `files/*.woff2` 原封不動複製進 `dist/`（CSS 裡是 `./files/…`
 *   相對路徑，目錄結構照搬就對得上）。
 * - 開發：同一個路徑直接從套件目錄供應 —— `/r/:token` 那一頁在開發時也看得到字。
 * - 首頁：`<head>` 注入那一行 `<link>`。不寫死在 `index.html`：寫死的話 Vite 會去打包它、
 *   找不到檔案；而版本號也只該寫在一個地方。
 *
 * 套件版本與 `BRAND_FONT_VERSION` 不一致就停下來：路徑沒跟著換，伺服器那一年的快取會讓
 * 家長拿到舊字檔配新 CSS。
 */
function brandFont(): Plugin {
  const require = createRequire(import.meta.url);
  const pkgJson = require.resolve('@fontsource-variable/noto-sans-sc/package.json');
  const pkgDir = path.dirname(pkgJson);
  const installed = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
  if (installed !== BRAND_FONT_VERSION) {
    throw new Error(
      `@fontsource-variable/noto-sans-sc 裝的是 ${installed}，src/brandFont.ts 寫的是 ${BRAND_FONT_VERSION}。\n` +
      `升級字型套件時要一起改 BRAND_FONT_VERSION（字檔路徑帶版本號，伺服器才能放心叫瀏覽器快取一年）。`
    );
  }
  const assets = [
    'index.css',
    ...fs.readdirSync(path.join(pkgDir, 'files'))
      .filter(name => name.endsWith('.woff2'))
      .map(name => `files/${name}`),
  ];
  const known = new Set(assets);

  return {
    name: 'sxk-brand-font',
    configureServer(server) {
      server.middlewares.use(`/${BRAND_FONT_DIR}`, (req, res, next) => {
        const rel = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!known.has(rel)) return next();
        res.setHeader('Content-Type', rel.endsWith('.css') ? 'text/css; charset=utf-8' : 'font/woff2');
        fs.createReadStream(path.join(pkgDir, rel)).pipe(res);
      });
    },
    generateBundle() {
      for (const rel of assets) {
        this.emitFile({
          type: 'asset',
          fileName: `${BRAND_FONT_DIR}/${rel}`,
          source: fs.readFileSync(path.join(pkgDir, rel)),
        });
      }
    },
    transformIndexHtml() {
      return [{ tag: 'link', attrs: { rel: 'stylesheet', href: BRAND_FONT_CSS_HREF }, injectTo: 'head' }];
    },
  };
}

export default defineConfig(() => {
  assertValidAppMode();

  return {
    plugins: [react(), tailwindcss(), brandFont()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

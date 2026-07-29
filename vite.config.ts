import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

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

export default defineConfig(() => {
  assertValidAppMode();

  return {
    plugins: [react(), tailwindcss()],
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

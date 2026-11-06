/**
 * 進站連結的二維碼（客戶 11/03 第 2、29 頁）：合作公司與推薦人的進站連結旁各一個，可下載 PNG。
 * 前端產生（`qrcode-generator`，同 `server.ts` 報告扫码那一支用的套件），不經伺服器。
 */
import qrcode from 'qrcode-generator';

/** 連結 → 黑白格（true＝黑）。容錯 M，同報告的二維碼。 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** 下載檔名：`进站二维码-<代號>.png`，代號裡只留英數與 `-_`（檔名不帶奇怪的字元）。 */
export function entryQrFileName(code: string): string {
  const safe = code.replace(/[^a-zA-Z0-9_-]/g, '') || 'link';
  return `进站二维码-${safe}.png`;
}

/**
 * 把格子畫到 canvas：每格 `cell` 像素、四周留 `margin` 格白邊（掃碼需要的靜區）。
 * 回傳畫好的 canvas（畫面顯示與下載用同一張）。
 */
export function drawQr(canvas: HTMLCanvasElement, matrix: boolean[][], cell = 8, margin = 4): HTMLCanvasElement {
  const n = matrix.length;
  const size = (n + margin * 2) * cell;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }),
  );
  return canvas;
}

/**
 * 金額一律以「分」為單位在系統中流動 —— 微信支付的 `amount.total` 是整數分
 * （1 元 = 100），浮點數的元在對帳時會出現 19.899999999999999 這種東西。
 * 只有要顯示給人看的時候才轉成元。
 */

/**
 * 顯示用的預設單價（¥19.9）。**真實金額一律以伺服器回傳的為準** ——
 * 後端的 `UNLOCK_PRICE_FEN` 可用環境變數調整，這個常數只是在 `/api/unlocks`
 * 尚未回應時先有東西可畫，不參與任何計費。
 */
export const DEFAULT_UNLOCK_PRICE_FEN = 1990;

/** 分 → 顯示用的元，去掉無意義的尾隨零（1990 → `19.9`、2000 → `20`、1999 → `19.99`）。 */
export function formatFen(fen: number): string {
  if (!Number.isFinite(fen)) return '—';
  const yuan = Math.round(fen) / 100;
  return yuan.toFixed(2).replace(/\.?0+$/, '');
}

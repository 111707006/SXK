/**
 * H5 下單被微信以「沒有權限」拒絕：商戶號的 H5 支付還沒開通（審核中）。
 *
 * 這不是伺服器壞了，是微信外的瀏覽器現在付不了 —— 伺服器回 409 `WECHAT_ONLY`「请用微信打开本页再付款」，
 * 不回 500（也就不進 5xx 告警）。只認 H5 那條路：前端要求 JSAPI、或伺服器強制 JSAPI 時的 NO_AUTH
 * 是別的問題（支付授權目錄等），照舊當錯誤。
 */
export function isH5NotOpened(err: unknown, requestedChannel: unknown, forcedTradeType: string): boolean {
  if (requestedChannel === 'jsapi' || forcedTradeType === 'jsapi') return false;
  return /WeChat Pay order failed: NO_AUTH\b/.test(String((err as { message?: unknown } | null)?.message ?? ''));
}

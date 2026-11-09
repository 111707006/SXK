/**
 * 家長端付款（2026-11-08）：在微信裡用 JSAPI 調起支付，微信外照舊用 H5 跳轉。
 *
 * - 下單 `POST /api/payment/create`：在微信裡多帶 `channel: 'jsapi'`。
 * - 伺服器說還沒有 openid（409 `OPENID_REQUIRED`）→ 換一條服務號授權網址導過去（靜默，不跳同意畫面），
 *   授權完回到原頁，家長再按一次付款。
 * - 拿到 JSAPI 參數 → `WeixinJSBridge.invoke('getBrandWCPayRequest')`。**回 ok 不代表付款成功**，
 *   只代表微信那一頁關了；成功與否照舊由伺服器查單決定（`/api/payment/status`）。
 */
import { authFetch } from './api';

/** 微信內建瀏覽器（不含企業微信：企業微信裡調不起服務號的 JSAPI 支付）。 */
export function isInWechat(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /MicroMessenger/i.test(ua) && !/wxwork/i.test(ua);
}

export interface JsapiPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

export type PayOutcome =
  | { kind: 'already' }
  /** 已經導去別的頁（H5 付款頁或微信授權頁），呼叫端什麼都不用做。 */
  | { kind: 'redirecting' }
  | { kind: 'jsapi'; outTradeNo: string; result: 'ok' | 'cancel' | 'fail' }
  /** 開了單但付不了（微信支付還沒設好）：照舊顯示「尚未開放」。 */
  | { kind: 'not_ready'; outTradeNo?: string; amountFen?: number; reason?: string | null };

/** 換一條服務號授權網址並導過去；授權完回到 `returnPath`。 */
export async function goWechatOauth(returnPath: string = location.pathname + location.search): Promise<void> {
  const resp = await authFetch('/api/wechat/oauth/link', { method: 'POST', body: JSON.stringify({ returnPath }) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || typeof data.url !== 'string') throw new Error(data?.error || '暂时无法完成微信授权，请稍后再试。');
  location.href = data.url;
}

declare global {
  interface Window { WeixinJSBridge?: { invoke: (name: string, params: unknown, cb: (r: { err_msg?: string }) => void) => void } }
}

/** 調起微信支付；`WeixinJSBridge` 還沒好就等 `WeixinJSBridgeReady`（最多 5 秒）。 */
export function invokeJsapiPay(params: JsapiPayParams): Promise<'ok' | 'cancel' | 'fail'> {
  return new Promise(resolve => {
    // 逾時已經回 'fail' 之後，晚到的 WeixinJSBridgeReady 不能再調起付款頁（畫面已經說失敗了，沒有人在等結果）
    let settled = false;
    const run = () => window.WeixinJSBridge!.invoke('getBrandWCPayRequest', params, r => {
      const msg = r?.err_msg || '';
      resolve(msg === 'get_brand_wcpay_request:ok' ? 'ok' : msg === 'get_brand_wcpay_request:cancel' ? 'cancel' : 'fail');
    });
    if (window.WeixinJSBridge) return run();
    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      document.removeEventListener('WeixinJSBridgeReady', onReady);
      resolve('fail');
    }, 5000);
    document.addEventListener('WeixinJSBridgeReady', onReady, { once: true });
  });
}

/**
 * 下單並付款。`body` 是 `/api/payment/create` 原本的那一包（`{scope:'t2'}`、`{scope:'plan', months}`）。
 * 出錯丟 Error（訊息可以直接給家長看）。`onBeforeLeave` 在要導去 H5 付款頁之前呼叫（存訂單號，回跳後查單）。
 */
export async function startPayment(
  body: Record<string, unknown>,
  onBeforeLeave?: (outTradeNo: string) => void,
): Promise<PayOutcome> {
  const inWechat = isInWechat();
  const resp = await authFetch('/api/payment/create', { method: 'POST', body: JSON.stringify(inWechat ? { ...body, channel: 'jsapi' } : body) });
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 409 && data?.code === 'OPENID_REQUIRED') {
    await goWechatOauth();
    return { kind: 'redirecting' };
  }
  if (!resp.ok) {
    const msg = data?.error || '创建订单失败，请稍后重试。';
    // 微信外的瀏覽器、H5 還沒開通時：叫家長用微信打開
    throw new Error(inWechat || data?.code === 'WECHAT_ONLY' ? msg : `${msg}（也可以用微信打开本页再付款）`);
  }
  if (data.alreadyUnlocked) return { kind: 'already' };
  if (data.wechatReady && data.tradeType === 'jsapi' && data.jsapi) {
    const result = await invokeJsapiPay(data.jsapi as JsapiPayParams);
    return { kind: 'jsapi', outTradeNo: data.outTradeNo, result };
  }
  if (data.wechatReady && typeof data.h5Url === 'string') {
    onBeforeLeave?.(data.outTradeNo);
    // 只允許在既有參數後追加 redirect_url，且值必須 urlencode。用一般導頁 —— H5 支付會檢查 Referer。
    const redirect = `${location.origin}${location.pathname}`;
    location.href = `${data.h5Url}&redirect_url=${encodeURIComponent(redirect)}`;
    return { kind: 'redirecting' };
  }
  return { kind: 'not_ready', outTradeNo: data.outTradeNo, amountFen: data.amountFen, reason: typeof data.reason === 'string' ? data.reason : null };
}

const OAUTH_TRIED_KEY = 'sxk_wx_oauth_tried';

/**
 * 在微信裡、已登入、伺服器開了 JSAPI、這位家長還沒有 openid → 先靜默走一次授權，之後按付款不必再跳。
 * 一個分頁只試一次（授權失敗不會一直跳）；網址帶 `#`（交接連結等）時不動。
 */
export async function maybeSilentWechatOauth(): Promise<void> {
  if (!isInWechat() || location.hash) return;
  try {
    if (sessionStorage.getItem(OAUTH_TRIED_KEY)) return;
    const resp = await authFetch('/api/wechat/oauth/status');
    if (!resp.ok) return;
    const data = await resp.json().catch(() => null);
    if (!data?.enabled || !data?.needed) return;
    sessionStorage.setItem(OAUTH_TRIED_KEY, '1');
    await goWechatOauth();
  } catch {
    // 讀不到就算了：付款時伺服器會再要一次（OPENID_REQUIRED）
  }
}

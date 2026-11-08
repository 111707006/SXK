/**
 * 服務號網頁授權（snsapi_base，靜默、家長看不到同意畫面）拿家長的 openid —— JSAPI 支付的付款人（2026-11-08）。
 * 只給伺服器用。
 *
 * 流程：
 * 1. 家長在微信裡、已登入：前端 `POST /api/wechat/oauth/link`（帶 Bearer）拿一條授權網址，`location.href` 過去。
 * 2. 微信帶著 `code` 與我們發的 `state` 回到 `/api/wechat/oauth/callback`。
 * 3. 伺服器驗 `state`（簽章＋10 分鐘）、拿 `code` 換 openid（要 AppSecret，所以只能在伺服器做）、存起來，
 *    302 回家長原本那一頁。
 *
 * 為什麼 `state` 要簽：回呼是一次頂層導頁，帶不了 Bearer，「這個 openid 是哪一位家長的」只能從 state 讀。
 * 不簽的話，任何人改 state 就能把自己的微信綁到別人的帳號上（付款人錯了，錢付了權益卻開在別人那裡）。
 *
 * 官方文件：https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html
 */
import crypto from 'crypto';
import axios from 'axios';

export interface WechatOauthConfig {
  /** 服務號 AppID（與微信支付關聯的那一個，`WECHATPAY_APPID`）。 */
  appid: string;
  /** 服務號 AppSecret（`WECHAT_MP_APPSECRET`）。 */
  secret: string;
  /** 對外網址（`PUBLIC_BASE_URL`，例 `https://sxkscreen.com`），回呼網址的網域要等於服務號的「網頁授權域名」。 */
  publicBase: string;
}

/** AppID 或 AppSecret 沒設 → `null`（JSAPI 關著）。設一半不報錯：AppID 本來就給 H5 用。 */
export function loadOauthConfig(env: NodeJS.ProcessEnv = process.env): WechatOauthConfig | null {
  const appid = (env.WECHATPAY_APPID || '').trim();
  const secret = (env.WECHAT_MP_APPSECRET || '').trim();
  const publicBase = (env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!appid || !secret || !publicBase) return null;
  if (!/^https:\/\/[^/?#]+$/.test(publicBase)) {
    throw new Error(`PUBLIC_BASE_URL=${JSON.stringify(publicBase)}：JSAPI 網頁授權要 https 的「協定＋網域」，不能帶路徑`);
  }
  return { appid, secret, publicBase };
}

export const OAUTH_CALLBACK_PATH = '/api/wechat/oauth/callback';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const KEY_PURPOSE = 'sxk:wechat-oauth-state:v1';

/** 只收站內路徑（`/` 開頭、不是 `//`），避免授權完被帶去別的網站。 */
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.length > 300) return '/';
  return raw;
}

function keyOf(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(KEY_PURPOSE).digest();
}

/** `state`：base64url(JSON{u, r, e}) + '.' + HMAC。微信限制 state 最長 128 字元，所以回去的路徑另外截短。 */
export function signOauthState(userId: number, returnPath: string, secret: string, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, r: safeReturnPath(returnPath).slice(0, 60), e: now + OAUTH_STATE_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', keyOf(secret)).update(payload).digest('base64url').slice(0, 32);
  return `${payload}.${sig}`;
}

/** 驗 `state`：簽章不對、過期、形狀不對一律 `null`。 */
export function readOauthState(state: unknown, secret: string, now: number = Date.now()): { userId: number; returnPath: string } | null {
  if (typeof state !== 'string' || state.length > 128) return null;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', keyOf(secret)).update(payload).digest('base64url').slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(v.u) || v.u <= 0 || typeof v.e !== 'number' || v.e < now) return null;
    return { userId: v.u, returnPath: safeReturnPath(v.r) };
  } catch {
    return null;
  }
}

/**
 * 回呼要回到家長**原本那個網域**：`sxkscreen.com` 與 `www.sxkscreen.com` 都直接服務家長端，而登入通行證存在
 * 各自網域的 localStorage —— 從 www 授權完被帶回不帶 www 的那一個，家長看起來就登出了。
 * 只收 `PUBLIC_BASE_URL` 與它的 www／不帶 www 那一對，其他一律退回 `PUBLIC_BASE_URL`（兩個都要設成服務號的網頁授權域名）。
 */
export function callbackOrigin(cfg: WechatOauthConfig, requestOrigin: string | null | undefined): string {
  const base = new URL(cfg.publicBase);
  const twin = base.hostname.startsWith('www.') ? base.hostname.slice(4) : `www.${base.hostname}`;
  if (typeof requestOrigin === 'string') {
    try {
      const o = new URL(requestOrigin);
      if (o.protocol === 'https:' && !o.port && (o.hostname === base.hostname || o.hostname === twin)) return `https://${o.hostname}`;
    } catch { /* 認不得就用預設 */ }
  }
  return cfg.publicBase;
}

/** 授權網址（snsapi_base：靜默，不跳同意畫面）。`origin` 是 `callbackOrigin` 算好的那一個。 */
export function buildAuthorizeUrl(cfg: WechatOauthConfig, state: string, origin: string = cfg.publicBase): string {
  const redirect = encodeURIComponent(`${origin}${OAUTH_CALLBACK_PATH}`);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${cfg.appid}&redirect_uri=${redirect}&response_type=code&scope=snsapi_base&state=${encodeURIComponent(state)}#wechat_redirect`;
}

/** 拿 `code` 換 openid。微信回錯誤碼就丟出（含 errcode），呼叫端記錄後導回原頁。 */
export async function exchangeCodeForOpenid(cfg: WechatOauthConfig, code: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(code)) throw new Error('bad code');
  const resp = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
    params: { appid: cfg.appid, secret: cfg.secret, code, grant_type: 'authorization_code' },
    timeout: 8000,
    validateStatus: () => true,
  });
  const openid = resp.data?.openid;
  if (resp.status !== 200 || typeof openid !== 'string' || openid === '') {
    throw new Error(`WeChat oauth failed: ${resp.data?.errcode ?? resp.status} ${resp.data?.errmsg ?? ''}`.trim());
  }
  return openid;
}

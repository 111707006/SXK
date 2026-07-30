/**
 * WeChat Pay APIv3 — signing, ordering, callback verification and decryption.
 * Backend only; imported by server.ts.
 *
 * There is no official Node.js SDK (WeChat ships Java/PHP/Go only), so every
 * byte of this is hand-rolled against the official docs. The contract details
 * live in `docs/research/wechat-pay-v3-h5.md`, which cites a source URL per
 * rule — read that before changing anything here.
 *
 * ⚠️ NOTHING here has run against WeChat's servers. The merchant id, certificate
 * and the ICP filing do not exist yet. What IS verified: the signature-message
 * construction is pinned to WeChat's own published example byte for byte, and
 * the AES-GCM path round-trips (see test/wechatPay.test.ts). Treat "the algorithm
 * matches the spec" and "the integration works" as different claims — the second
 * one needs a real mchid.
 */

import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';

const API_HOST = 'https://api.mch.weixin.qq.com';

/**
 * 交易類型。H5 與 JSAPI 是**互斥的場景**，不是誰包含誰：
 * JSAPI 只能在微信內建瀏覽器調起（需要 openid），H5 只能在微信外調起
 * （官方原文：「H5支付不能直接在微信客户端内调起」）。要全覆蓋就得兩個都接。
 *
 * 這裡先把 JSAPI 的位置留好 —— 下單路徑與 body 差異只有這張表，
 * 簽名、驗簽、回調、查單、冪等全部共用。真正缺的是取得 openid 的網頁授權流程。
 */
export type TradeType = 'h5' | 'jsapi';

export const TRADE_TYPE_PATHS: Record<TradeType, string> = {
  h5: '/v3/pay/transactions/h5',
  jsapi: '/v3/pay/transactions/jsapi',
};

export interface WechatPayConfig {
  appid: string;
  mchid: string;
  /** 商戶API證書序列號 —— 讓微信找到你的公鑰來驗你的簽。 */
  serialNo: string;
  /** 商戶API私鑰（apiclient_key.pem 的內容）。 */
  privateKey: string;
  /** APIv3 密鑰，必須恰為 32 bytes —— 回調解密用。 */
  apiV3Key: string;
  /** 微信支付公鑰（官方推薦方案）—— 驗回調的簽。 */
  platformPublicKey: string;
  /** 微信支付公鑰 ID，用於比對回調的 `Wechatpay-Serial`。 */
  platformKeyId: string;
  /** 必須是 https、公網可達、不帶查詢參數。 */
  notifyUrl: string;
}

/** 設定不全時列出**缺哪幾項**，而不是只說一句「未設定」。 */
export interface ConfigStatus {
  config: WechatPayConfig | null;
  missing: string[];
}

function readKeyMaterial(inline: string | undefined, pathVar: string | undefined): string | null {
  if (inline && inline.trim()) return inline.replace(/\\n/g, '\n');
  if (pathVar && pathVar.trim()) {
    try {
      return fs.readFileSync(pathVar, 'utf8');
    } catch (err: any) {
      console.error(`[WechatPay] Cannot read key file ${pathVar}: ${err.message}`);
      return null;
    }
  }
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConfigStatus {
  const privateKey = readKeyMaterial(env.WECHATPAY_PRIVATE_KEY, env.WECHATPAY_PRIVATE_KEY_PATH);
  const platformPublicKey = readKeyMaterial(env.WECHATPAY_PUBLIC_KEY, env.WECHATPAY_PUBLIC_KEY_PATH);

  const candidate = {
    appid: env.WECHATPAY_APPID || '',
    mchid: env.WECHATPAY_MCHID || '',
    serialNo: env.WECHATPAY_SERIAL_NO || '',
    privateKey: privateKey || '',
    apiV3Key: env.WECHATPAY_APIV3_KEY || '',
    platformPublicKey: platformPublicKey || '',
    platformKeyId: env.WECHATPAY_PUBLIC_KEY_ID || '',
    notifyUrl: env.WECHATPAY_NOTIFY_URL || '',
  };

  const labels: Record<keyof typeof candidate, string> = {
    appid: 'WECHATPAY_APPID',
    mchid: 'WECHATPAY_MCHID',
    serialNo: 'WECHATPAY_SERIAL_NO',
    privateKey: 'WECHATPAY_PRIVATE_KEY(_PATH)',
    apiV3Key: 'WECHATPAY_APIV3_KEY',
    platformPublicKey: 'WECHATPAY_PUBLIC_KEY(_PATH)',
    platformKeyId: 'WECHATPAY_PUBLIC_KEY_ID',
    notifyUrl: 'WECHATPAY_NOTIFY_URL',
  };

  const missing = (Object.keys(candidate) as (keyof typeof candidate)[])
    .filter(k => !candidate[k])
    .map(k => labels[k]);

  // 32 bytes 是硬性規定，長度不對的話會在解密時才炸 —— 那時人已經付完錢了。
  if (candidate.apiV3Key && Buffer.byteLength(candidate.apiV3Key, 'utf8') !== 32) {
    missing.push('WECHATPAY_APIV3_KEY（必須恰為 32 bytes）');
  }
  if (candidate.notifyUrl && !/^https:\/\//.test(candidate.notifyUrl)) {
    missing.push('WECHATPAY_NOTIFY_URL（必須以 https:// 開頭）');
  }
  if (candidate.notifyUrl.includes('?')) {
    missing.push('WECHATPAY_NOTIFY_URL（不可帶查詢參數）');
  }

  return { config: missing.length ? null : candidate, missing };
}

/**
 * APIv3 請求簽名串。固定五行，**每一行都以 `\n` 結尾**（含最後一行）。
 * GET 請求的 body 是空字串，但那一行的 `\n` 仍必須存在。
 *
 * 官方範例已寫進 test/wechatPay.test.ts —— 這個函式的輸出要與微信文件上那段
 * 一字不差，因為錯了不會有錯誤訊息，只會在使用者按下付款那一刻收到驗簽失敗。
 *
 * 來源：https://pay.weixin.qq.com/doc/v3/merchant/4012365336
 */
export function buildSignatureMessage(
  method: string,
  urlPath: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  return `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
}

/** 32 位大寫十六進位隨機串，比照官方範例的形式。 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * `Authorization` header。
 *
 * `serial_no` 是**商戶自己的**證書序列號，與回調裡的 `Wechatpay-Serial`
 * （微信側的公鑰 ID）是兩個不同的東西 —— 混用是這支 API 最常見的錯誤之一。
 */
export function buildAuthorization(
  config: Pick<WechatPayConfig, 'mchid' | 'serialNo' | 'privateKey'>,
  method: string,
  urlPath: string,
  body: string,
  now: () => number = Date.now,
  nonce: string = generateNonce()
): string {
  const timestamp = String(Math.floor(now() / 1000));
  const message = buildSignatureMessage(method, urlPath, timestamp, nonce, body);
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(config.privateKey, 'base64');
  return (
    'WECHATPAY2-SHA256-RSA2048 ' +
    `mchid="${config.mchid}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${config.serialNo}"`
  );
}

export interface OrderRequest {
  description: string;
  outTradeNo: string;
  amountFen: number;
  /** H5 必填 —— 下單者的真實 IP。 */
  payerClientIp: string;
  /** JSAPI 必填 —— 需先透過網頁授權取得。 */
  openid?: string;
}

/**
 * 組下單 body。
 *
 * 回傳的是**字串**而非物件，而且呼叫端必須把這個字串同時用於簽名與送出 ——
 * 讓 HTTP client 重新序列化一次，鍵序或空白只要差一個字元就驗簽失敗。
 */
export function buildOrderBody(
  config: Pick<WechatPayConfig, 'appid' | 'mchid' | 'notifyUrl'>,
  tradeType: TradeType,
  req: OrderRequest
): string {
  const base: Record<string, unknown> = {
    appid: config.appid,
    mchid: config.mchid,
    description: req.description,
    out_trade_no: req.outTradeNo,
    notify_url: config.notifyUrl,
    amount: { total: req.amountFen, currency: 'CNY' },
  };

  if (tradeType === 'h5') {
    base.scene_info = { payer_client_ip: req.payerClientIp, h5_info: { type: 'Wap' } };
  } else {
    if (!req.openid) throw new Error('JSAPI 下單需要 openid（網頁授權流程尚未實作）。');
    base.payer = { openid: req.openid };
  }

  return JSON.stringify(base);
}

export interface OrderResult {
  tradeType: TradeType;
  /** H5：跳轉連結，**有效期 5 分鐘**。 */
  h5Url?: string;
  /** JSAPI：前端調起支付用。 */
  prepayId?: string;
}

/** 呼叫統一下單。失敗時拋出帶有微信錯誤碼的 Error。 */
export async function placeOrder(
  config: WechatPayConfig,
  tradeType: TradeType,
  req: OrderRequest
): Promise<OrderResult> {
  const urlPath = TRADE_TYPE_PATHS[tradeType];
  const body = buildOrderBody(config, tradeType, req);
  const authorization = buildAuthorization(config, 'POST', urlPath, body);

  const resp = await axios.post(`${API_HOST}${urlPath}`, body, {
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // 官方要求帶 User-Agent，部分閘道會擋掉沒有 UA 的請求。
      'User-Agent': 'SenXinKang/1.0 (Node.js)',
    },
    // body 已是字串，不可讓 axios 再序列化一次。
    transformRequest: [(d) => d],
    timeout: 10000,
    validateStatus: () => true,
  });

  if (resp.status !== 200) {
    const code = resp.data?.code || resp.status;
    const message = resp.data?.message || '下单失败';
    throw new Error(`WeChat Pay order failed: ${code} ${message}`);
  }

  return tradeType === 'h5'
    ? { tradeType, h5Url: resp.data?.h5_url }
    : { tradeType, prepayId: resp.data?.prepay_id };
}

/**
 * 驗證回調簽名。**必須先於解密**，順序反過來等於拿未驗證的密文餵解密器。
 *
 * 簽名串是三行（時間戳、隨機串、原始 body），每行以 `\n` 結尾。
 * 第三行必須是**原始 HTTP body 字串** —— 經過 JSON.parse 再 stringify 就不對了。
 *
 * 來源：https://pay.weixin.qq.com/doc/v3/merchant/4013053420
 */
export function verifyCallbackSignature(params: {
  timestamp: string;
  nonce: string;
  rawBody: string;
  signature: string;
  publicKey: string;
  /** 官方建議允許最多 5 分鐘偏差，用於防重放。 */
  toleranceSeconds?: number;
  now?: () => number;
}): { ok: boolean; reason?: string } {
  const { timestamp, nonce, rawBody, signature, publicKey } = params;
  const tolerance = params.toleranceSeconds ?? 300;
  const now = params.now ?? Date.now;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'timestamp is not a number' };
  if (Math.abs(Math.floor(now() / 1000) - ts) > tolerance) {
    return { ok: false, reason: 'timestamp outside the replay window' };
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  try {
    const ok = crypto.createVerify('RSA-SHA256').update(message).verify(publicKey, signature, 'base64');
    return ok ? { ok: true } : { ok: false, reason: 'signature mismatch' };
  } catch (err: any) {
    return { ok: false, reason: `verify threw: ${err.message}` };
  }
}

/**
 * 解密回調的 `resource`（AEAD_AES_256_GCM）。
 *
 * Node 的 `createDecipheriv` **不會**自動從密文尾端取出認證標籤 ——
 * 必須手動切下最後 16 bytes。這是把官方 Java/PHP 範例移植到 Node 時最常見的錯誤。
 *
 * 來源：https://pay.weixin.qq.com/doc/v3/merchant/4012071382
 */
export function decryptResource(
  apiV3Key: string,
  resource: { ciphertext: string; nonce: string; associated_data?: string }
): string {
  const key = Buffer.from(apiV3Key, 'utf8');
  if (key.length !== 32) throw new Error('APIv3 key must be exactly 32 bytes.');

  const buf = Buffer.from(resource.ciphertext, 'base64');
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'));
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * 查單 —— 回調的補償路徑。
 *
 * 回調可能因為網路或部署中斷而全部落空，這時使用者已經付了錢。查單是唯一
 * 不依賴微信主動推送的確認方式。
 *
 * 來源：https://pay.weixin.qq.com/doc/v3/merchant/4012791838
 */
export async function queryOrderByOutTradeNo(
  config: WechatPayConfig,
  outTradeNo: string
): Promise<{ tradeState: string; transactionId: string | null; amountFen: number | null }> {
  // 簽名串的 URL 行必須包含查詢字串，順序也要與實際送出的一致。
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${config.mchid}`;
  const authorization = buildAuthorization(config, 'GET', urlPath, '');

  const resp = await axios.get(`${API_HOST}${urlPath}`, {
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'User-Agent': 'SenXinKang/1.0 (Node.js)',
    },
    timeout: 10000,
    validateStatus: () => true,
  });

  if (resp.status !== 200) {
    const code = resp.data?.code || resp.status;
    throw new Error(`WeChat Pay query failed: ${code} ${resp.data?.message || ''}`);
  }

  return {
    tradeState: resp.data?.trade_state,
    transactionId: resp.data?.transaction_id ?? null,
    amountFen: typeof resp.data?.amount?.total === 'number' ? resp.data.amount.total : null,
  };
}

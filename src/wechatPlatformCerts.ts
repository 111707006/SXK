/**
 * 微信支付平台證書（使用者 2026-11-10：商戶號維持「平台证书」驗簽模式，不切到微信支付公鑰）。
 * 只給伺服器用。
 *
 * 平台證書模式下，微信用**平台證書的私鑰**簽回調與應答；哪一張看 `Wechatpay-Serial`（證書序列號）。
 * 證書不能從商戶平台下載，要呼叫「下載平台證書」API：回來的證書是用 APIv3 密鑰加密的（AEAD_AES_256_GCM，
 * 同回調的 resource），解開才是 PEM。微信會不定期換證書（新舊會並存一段時間），所以：
 *
 * - 第一次需要時下載、存在記憶體；之後每 12 小時重新下載一次。
 * - 回調帶來一個不認得的序列號 → 馬上重新下載一次（最多一分鐘一次），還是不認得就拒收（微信會重試）。
 * - 過期的證書不拿來驗。
 *
 * 下載回來的那一包本身也有簽名：用剛解開、序列號等於應答 `Wechatpay-Serial` 的那一張驗（官方做法）。
 * 驗不過整包不收 —— 解得開就代表對方知道 APIv3 密鑰，再驗簽是多一層。
 *
 * 來源：
 * - 下載平台證書：https://pay.weixin.qq.com/doc/v3/merchant/4012551764
 * - 平台證書簡介與更新：https://pay.weixin.qq.com/doc/v3/merchant/4012068829
 */
import crypto from 'crypto';
import axios from 'axios';
import { buildAuthorization, decryptResource, type WechatPayConfig } from './wechatPay';

const API_HOST = 'https://api.mch.weixin.qq.com';
const CERTS_PATH = '/v3/certificates';

export const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const UNKNOWN_SERIAL_RETRY_MS = 60 * 1000;

export interface PlatformCert {
  serialNo: string;
  /** PEM 公鑰（從證書取出），驗簽用。 */
  publicKey: string;
  /** 毫秒。 */
  expiresAt: number;
}

type CertsConfig = Pick<WechatPayConfig, 'mchid' | 'serialNo' | 'privateKey' | 'apiV3Key'>;

/** 呼叫下載平台證書 API 拿回來的東西（原始字串，驗簽要用原文）。 */
export interface RawCertsResponse {
  status: number;
  body: string;
  headers: { timestamp: string; nonce: string; signature: string; serial: string };
}

export type FetchCerts = (config: CertsConfig) => Promise<RawCertsResponse>;

/** 真的打微信。 */
export const fetchCertsFromWechat: FetchCerts = async config => {
  const authorization = buildAuthorization(config, 'GET', CERTS_PATH, '');
  const resp = await axios.get(`${API_HOST}${CERTS_PATH}`, {
    headers: { Authorization: authorization, Accept: 'application/json', 'User-Agent': 'SenXinKang/1.0 (Node.js)' },
    timeout: 10000,
    validateStatus: () => true,
    // 驗簽要原文：不讓 axios 先 JSON.parse
    responseType: 'text',
    transformResponse: [(d: unknown) => d],
  });
  const h = resp.headers as Record<string, unknown>;
  const str = (k: string) => (typeof h[k] === 'string' ? (h[k] as string) : '');
  return {
    status: resp.status,
    body: typeof resp.data === 'string' ? resp.data : '',
    headers: { timestamp: str('wechatpay-timestamp'), nonce: str('wechatpay-nonce'), signature: str('wechatpay-signature'), serial: str('wechatpay-serial') },
  };
};

/**
 * 應答 → 證書清單。解密、取公鑰、用應答自己的那一張驗整包的簽名；任何一步不對就丟錯。
 * 純函式（除了 `now`），測試直接餵造出來的應答。
 */
export function parseCertsResponse(apiV3Key: string, resp: RawCertsResponse, now: number = Date.now()): PlatformCert[] {
  if (resp.status !== 200) {
    let code: unknown = resp.status;
    try { code = JSON.parse(resp.body)?.code ?? resp.status; } catch { /* 不是 JSON */ }
    throw new Error(`WeChat Pay certificates download failed: ${code}`);
  }
  const data = JSON.parse(resp.body)?.data;
  if (!Array.isArray(data) || data.length === 0) throw new Error('WeChat Pay certificates response has no data');

  const certs: PlatformCert[] = data.map((item: any) => {
    const enc = item?.encrypt_certificate;
    if (typeof item?.serial_no !== 'string' || !enc || typeof enc.ciphertext !== 'string' || typeof enc.nonce !== 'string') {
      throw new Error('WeChat Pay certificates response has a malformed entry');
    }
    const pem = decryptResource(apiV3Key, { ciphertext: enc.ciphertext, nonce: enc.nonce, associated_data: enc.associated_data ?? '' });
    const x509 = new crypto.X509Certificate(pem);
    // 序列號：微信給的是大寫十六進位；證書本身的也對一次，對不上就是有人換了內容
    if (x509.serialNumber.toUpperCase() !== item.serial_no.toUpperCase()) {
      throw new Error(`certificate serial mismatch: ${item.serial_no}`);
    }
    const expiresAt = Date.parse(item.expire_time ?? x509.validTo);
    return {
      serialNo: item.serial_no.toUpperCase(),
      publicKey: x509.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.parse(x509.validTo),
    };
  });

  const signer = certs.find(c => c.serialNo === resp.headers.serial.toUpperCase());
  if (!signer) throw new Error(`certificates response is signed by ${resp.headers.serial || '(no serial)'}, which is not in the list`);
  const message = `${resp.headers.timestamp}\n${resp.headers.nonce}\n${resp.body}\n`;
  let ok = false;
  try {
    ok = crypto.createVerify('RSA-SHA256').update(message).verify(signer.publicKey, resp.headers.signature, 'base64');
  } catch {
    ok = false;
  }
  if (!ok) throw new Error('certificates response signature does not verify');

  return certs.filter(c => c.expiresAt > now);
}

/**
 * 平台證書的快取：依序列號找驗簽用的公鑰。伺服器一個程序一份（PM2 cluster 每個 worker 各自下載，量很小）。
 */
export class PlatformCertStore {
  private certs = new Map<string, PlatformCert>();
  private fetchedAt = 0;
  private lastAttemptAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly config: CertsConfig,
    private readonly fetchCerts: FetchCerts = fetchCertsFromWechat,
    private readonly now: () => number = Date.now,
  ) {}

  /** 重新下載一次（同時只跑一個）。失敗丟錯，原本的快取不動。 */
  refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.lastAttemptAt = this.now();
    this.inflight = (async () => {
      try {
        const list = parseCertsResponse(this.config.apiV3Key, await this.fetchCerts(this.config), this.now());
        if (list.length === 0) throw new Error('WeChat Pay returned only expired certificates');
        this.certs = new Map(list.map(c => [c.serialNo, c]));
        this.fetchedAt = this.now();
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /** 現在認得的序列號（日誌用）。 */
  serials(): string[] {
    return [...this.certs.keys()];
  }

  /**
   * 這個序列號的公鑰；不認得或過期回 null。快取太舊、或不認得而且一分鐘內沒試過，先重新下載。
   * 下載失敗：有快取就照快取判斷，沒有就回 null（呼叫端拒收，微信會重試）。
   */
  async publicKeyFor(serial: string): Promise<string | null> {
    const key = serial.toUpperCase();
    const stale = this.now() - this.fetchedAt > REFRESH_INTERVAL_MS;
    const unknown = !this.certs.has(key);
    if (stale || (unknown && this.now() - this.lastAttemptAt > UNKNOWN_SERIAL_RETRY_MS)) {
      try {
        await this.refresh();
      } catch (err: any) {
        console.error(`[WechatPay] Platform certificates refresh failed: ${err.message}`);
      }
    }
    const cert = this.certs.get(key);
    return cert && cert.expiresAt > this.now() ? cert.publicKey : null;
  }
}

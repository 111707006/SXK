/**
 * 微信分账 APIv3（普通商戶）的四支：添加分账接收方、請求分账、解凍剩餘資金、查詢分账結果。只給伺服器用。
 *
 * 簽名與 HTTP 的做法同 `src/wechatPay.ts`：body 先組成字串，同一個字串拿去簽名與送出。
 *
 * ⚠️ 這裡沒有一行打過微信的伺服器 —— 分账沒有沙箱，商戶號也還沒開通分账。驗過的是：
 * body 的欄位逐個對官方文件、敏感欄位加密能用對應的私鑰解回來（test/profitSharingRun.test.ts）。
 * 「欄位對得上規格」與「真的分得出去」是兩件事，後者要等第一筆真實分账。
 *
 * 來源：
 * - 添加分账接收方 POST /v3/profitsharing/receivers/add：https://pay.weixin.qq.com/doc/v3/merchant/4012528995
 * - 請求分账 POST /v3/profitsharing/orders：https://pay.weixin.qq.com/doc/v3/merchant/4012524936
 * - 解凍剩餘資金 POST /v3/profitsharing/orders/unfreeze：https://pay.weixin.qq.com/doc/v3/merchant/4012526374
 * - 查詢分账結果 GET /v3/profitsharing/orders/{out_order_no}：https://pay.weixin.qq.com/doc/v3/merchant/4012525210
 * - 敏感資訊加密（RSAES-OAEP）：https://pay.weixin.qq.com/doc/v3/merchant/4013053257
 */
import crypto from 'crypto';
import axios from 'axios';
import { buildAuthorization, type WechatPayConfig } from '../wechatPay';
import type { ReceiverType, RelationType } from './plan';

const API_HOST = 'https://api.mch.weixin.qq.com';

/** 加密敏感欄位用的那一把：平台證書（序列號）或微信支付公鑰（公鑰 ID）。 */
export interface EncryptKey {
  /** 放在 `Wechatpay-Serial` 請求頭，讓微信知道用哪一把私鑰解。 */
  serial: string;
  publicKey: string;
}

/** 敏感欄位加密：RSAES-OAEP（SHA-1），base64。 */
export function encryptSensitive(plain: string, publicKey: string): string {
  return crypto
    .publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(plain, 'utf8'))
    .toString('base64');
}

export interface ApiReceiver {
  type: ReceiverType;
  account: string;
  /** 明文；有值就加密後送出（商戶全稱必填，個人不送）。 */
  name: string | null;
}

export function buildAddReceiverBody(
  appid: string,
  r: ApiReceiver & { relationType: RelationType },
  key: EncryptKey | null,
): string {
  const body: Record<string, unknown> = { appid, type: r.type, account: r.account };
  if (r.name) {
    if (!key) throw new Error('profit sharing: 商户全称要加密后送出，但拿不到加密用的公钥');
    body.name = encryptSensitive(r.name, key.publicKey);
  }
  body.relation_type = r.relationType;
  return JSON.stringify(body);
}

export interface ShareRequest {
  transactionId: string;
  outOrderNo: string;
  receivers: Array<ApiReceiver & { amountFen: number; description: string }>;
}

/** 請求分账。一律 `unfreeze_unsplit: true`：一筆訂單只分一次，剩下的當場解凍回商戶（ADR-0017）。 */
export function buildShareBody(appid: string, req: ShareRequest, key: EncryptKey | null): string {
  return JSON.stringify({
    appid,
    transaction_id: req.transactionId,
    out_order_no: req.outOrderNo,
    receivers: req.receivers.map(r => {
      const line: Record<string, unknown> = { type: r.type, account: r.account };
      if (r.name) {
        if (!key) throw new Error('profit sharing: 商户全称要加密后送出，但拿不到加密用的公钥');
        line.name = encryptSensitive(r.name, key.publicKey);
      }
      line.amount = r.amountFen;
      line.description = r.description;
      return line;
    }),
    unfreeze_unsplit: true,
  });
}

export function buildUnfreezeBody(transactionId: string, outOrderNo: string, description: string): string {
  return JSON.stringify({ transaction_id: transactionId, out_order_no: outOrderNo, description });
}

/** 微信回的分账單（請求、解凍、查詢三支同一個形狀）。 */
export interface SharingOrder {
  orderId: string | null;
  /** `PROCESSING`（非終態）／`FINISHED`（終態，每個接收方另看 result）。 */
  state: string;
  receivers: Array<{ type: string; account: string; amountFen: number; result: string; failReason: string | null }>;
}

/** 微信回了業務錯誤（4xx／5xx 帶 code）。`code` 給呼叫端分辨要不要重試。 */
export class WechatApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(`WeChat Pay profit sharing failed: ${code} ${message}`);
  }
}

function parseOrder(data: any): SharingOrder {
  const list = Array.isArray(data?.receivers) ? data.receivers : [];
  return {
    orderId: typeof data?.order_id === 'string' ? data.order_id : null,
    state: typeof data?.state === 'string' ? data.state : '',
    receivers: list.map((r: any) => ({
      type: String(r?.type ?? ''),
      account: String(r?.account ?? ''),
      amountFen: typeof r?.amount === 'number' ? r.amount : 0,
      result: String(r?.result ?? ''),
      failReason: typeof r?.fail_reason === 'string' ? r.fail_reason : null,
    })),
  };
}

type Config = Pick<WechatPayConfig, 'appid' | 'mchid' | 'serialNo' | 'privateKey'>;

async function call(config: Config, method: 'GET' | 'POST', urlPath: string, body: string, serial: string | null): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: buildAuthorization(config, method, urlPath, body),
    Accept: 'application/json',
    'User-Agent': 'SenXinKang/1.0 (Node.js)',
  };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  if (serial) headers['Wechatpay-Serial'] = serial;
  const resp = await axios.request({
    method,
    url: `${API_HOST}${urlPath}`,
    data: method === 'POST' ? body : undefined,
    headers,
    // body 已是字串，不可讓 axios 再序列化一次。
    transformRequest: [(d: unknown) => d],
    timeout: 10000,
    validateStatus: () => true,
  });
  if (resp.status < 200 || resp.status >= 300) {
    throw new WechatApiError(resp.status, String(resp.data?.code ?? resp.status), String(resp.data?.message ?? ''));
  }
  return resp.data;
}

/** 真的打微信的那一組；測試換成假的。 */
export interface ProfitSharingApi {
  addReceiver(r: ApiReceiver & { relationType: RelationType }): Promise<void>;
  share(req: ShareRequest): Promise<SharingOrder>;
  unfreeze(transactionId: string, outOrderNo: string, description: string): Promise<SharingOrder>;
  query(transactionId: string, outOrderNo: string): Promise<SharingOrder>;
}

export function createProfitSharingApi(config: Config, encryptKey: () => Promise<EncryptKey | null>): ProfitSharingApi {
  return {
    async addReceiver(r) {
      const key = r.name ? await encryptKey() : null;
      await call(config, 'POST', '/v3/profitsharing/receivers/add', buildAddReceiverBody(config.appid, r, key), key?.serial ?? null);
    },
    async share(req) {
      const key = req.receivers.some(r => r.name) ? await encryptKey() : null;
      return parseOrder(await call(config, 'POST', '/v3/profitsharing/orders', buildShareBody(config.appid, req, key), key?.serial ?? null));
    },
    async unfreeze(transactionId, outOrderNo, description) {
      return parseOrder(await call(config, 'POST', '/v3/profitsharing/orders/unfreeze', buildUnfreezeBody(transactionId, outOrderNo, description), null));
    },
    async query(transactionId, outOrderNo) {
      // 簽名串的 URL 行要含查詢字串，順序與實際送出的一致。
      const urlPath = `/v3/profitsharing/orders/${encodeURIComponent(outOrderNo)}?transaction_id=${encodeURIComponent(transactionId)}`;
      return parseOrder(await call(config, 'GET', urlPath, '', null));
    },
  };
}

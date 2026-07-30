import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  buildSignatureMessage,
  buildAuthorization,
  buildOrderBody,
  decryptResource,
  verifyCallbackSignature,
  generateNonce,
  loadConfig,
  TRADE_TYPE_PATHS,
} from '../src/wechatPay';

/**
 * 微信支付 APIv3 的密碼學部分。
 *
 * 這裡**沒有**、也無法驗證「與微信伺服器串接成功」—— 商戶號還不存在。
 * 能驗的是演算法與規格一致，而規格錯誤的失敗方式特別惡劣：沒有任何錯誤訊息，
 * 只會在家長按下付款那一刻收到驗簽失敗。所以每一條都釘在官方公布的範例上。
 */

// 官方 POST 範例（https://pay.weixin.qq.com/doc/v3/merchant/4012365336）
const OFFICIAL_BODY = '{"appid":"wxd678efh567hg6787","mchid":"1900007291","description":"Image形象店-深圳腾大-QQ公仔","out_trade_no":"1217752501201407033233368018","notify_url":"https://www.weixin.qq.com/wxpay/pay.php","amount":{"total":100,"currency":"CNY"},"payer":{"openid":"oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"}}';

describe('簽名串構造', () => {
  it('POST 的五行與官方範例逐字相同', () => {
    const msg = buildSignatureMessage(
      'POST', '/v3/pay/transactions/jsapi', '1554208460', '593BEC0C930BF1AFEB40B4A08C8FB242', OFFICIAL_BODY
    );
    expect(msg).toBe(
      'POST\n' +
      '/v3/pay/transactions/jsapi\n' +
      '1554208460\n' +
      '593BEC0C930BF1AFEB40B4A08C8FB242\n' +
      OFFICIAL_BODY + '\n'
    );
  });

  it('GET 的第五行是空行，但那個 \\n 仍在', () => {
    const msg = buildSignatureMessage(
      'GET', '/v3/refund/domestic/refunds/123123123123', '1554208460', '593BEC0C930BF1AFEB40B4A08C8FB242', ''
    );
    expect(msg).toBe(
      'GET\n/v3/refund/domestic/refunds/123123123123\n1554208460\n593BEC0C930BF1AFEB40B4A08C8FB242\n\n'
    );
    // 最容易寫錯的一格：把空 body 那行整行省掉。
    expect(msg.split('\n')).toHaveLength(6);
    expect(msg.endsWith('\n\n')).toBe(true);
  });

  it('用 CRLF 或漏掉結尾換行都會與官方不同', () => {
    const correct = buildSignatureMessage('POST', '/p', '1', 'N', '{}');
    expect(correct).not.toBe('POST\r\n/p\r\n1\r\nN\r\n{}\r\n');
    expect(correct).not.toBe('POST\n/p\n1\nN\n{}');
  });
});

describe('Authorization header', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const cfg = { mchid: '1900007291', serialNo: '408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB', privateKey: pem };

  it('scheme 與五個欄位齊備', () => {
    const header = buildAuthorization(cfg, 'POST', '/v3/pay/transactions/h5', '{}', () => 1554208460000, 'ABC123');
    expect(header.startsWith('WECHATPAY2-SHA256-RSA2048 ')).toBe(true);
    expect(header).toContain('mchid="1900007291"');
    expect(header).toContain('nonce_str="ABC123"');
    expect(header).toContain('timestamp="1554208460"');
    expect(header).toContain('serial_no="408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB"');
    expect(header).toMatch(/signature="[A-Za-z0-9+/=]+"/);
  });

  it('簽出來的值用對應公鑰驗得過，且驗的是同一條簽名串', () => {
    const body = '{"a":1}';
    const header = buildAuthorization(cfg, 'POST', '/v3/pay/transactions/h5', body, () => 1554208460000, 'ABC123');
    const signature = /signature="([^"]+)"/.exec(header)![1];
    const message = buildSignatureMessage('POST', '/v3/pay/transactions/h5', '1554208460', 'ABC123', body);
    expect(crypto.createVerify('RSA-SHA256').update(message).verify(publicKey, signature, 'base64')).toBe(true);
  });

  it('body 改一個字元，簽名就驗不過 —— 這正是不能讓 HTTP client 重新序列化的原因', () => {
    const header = buildAuthorization(cfg, 'POST', '/v3/pay/transactions/h5', '{"a":1}', () => 1554208460000, 'ABC123');
    const signature = /signature="([^"]+)"/.exec(header)![1];
    const tampered = buildSignatureMessage('POST', '/v3/pay/transactions/h5', '1554208460', 'ABC123', '{"a": 1}');
    expect(crypto.createVerify('RSA-SHA256').update(tampered).verify(publicKey, signature, 'base64')).toBe(false);
  });

  it('nonce 每次都不同且為 32 位大寫十六進位', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[0-9A-F]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe('下單 body', () => {
  const cfg = { appid: 'wx123', mchid: '1900007291', notifyUrl: 'https://sxkscreen.com/api/pay/wechat/notify' };

  it('H5 帶 scene_info，金額單位是分', () => {
    const body = JSON.parse(buildOrderBody(cfg, 'h5', {
      description: '语言沟通 深度评估解锁', outTradeNo: 'SXK20260730120000ABCD1234',
      amountFen: 1990, payerClientIp: '119.28.0.1',
    }));
    expect(body.amount).toEqual({ total: 1990, currency: 'CNY' });
    expect(body.scene_info.h5_info.type).toBe('Wap');
    expect(body.scene_info.payer_client_ip).toBe('119.28.0.1');
    expect(body.payer).toBeUndefined();
  });

  it('¥19.9 是 1990 分，不是 19.9 也不是 199', () => {
    const body = JSON.parse(buildOrderBody(cfg, 'h5', {
      description: 'x', outTradeNo: 'SXK1', amountFen: 1990, payerClientIp: '1.1.1.1',
    }));
    expect(body.amount.total).toBe(1990);
    expect(Number.isInteger(body.amount.total)).toBe(true);
  });

  it('JSAPI 帶 payer.openid，沒有 openid 就拒絕下單', () => {
    const body = JSON.parse(buildOrderBody(cfg, 'jsapi', {
      description: 'x', outTradeNo: 'SXK1', amountFen: 1990, payerClientIp: '1.1.1.1', openid: 'oUpF8uMuAJO_M2pxb1Q9zNjWeS6o',
    }));
    expect(body.payer.openid).toBe('oUpF8uMuAJO_M2pxb1Q9zNjWeS6o');
    expect(body.scene_info).toBeUndefined();

    expect(() => buildOrderBody(cfg, 'jsapi', {
      description: 'x', outTradeNo: 'SXK1', amountFen: 1990, payerClientIp: '1.1.1.1',
    })).toThrow(/openid/);
  });

  it('兩種交易類型的路徑不同，且都在 /v3/pay/transactions 下', () => {
    expect(TRADE_TYPE_PATHS.h5).toBe('/v3/pay/transactions/h5');
    expect(TRADE_TYPE_PATHS.jsapi).toBe('/v3/pay/transactions/jsapi');
  });
});

describe('回調驗簽', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const rawBody = '{"id":"EV-2018022511223320873","event_type":"TRANSACTION.SUCCESS"}';
  const nowMs = 1754000000000;
  const ts = String(Math.floor(nowMs / 1000));

  const sign = (message: string) =>
    crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');

  it('正確的三行簽名串驗得過', () => {
    const signature = sign(`${ts}\nNONCE1\n${rawBody}\n`);
    const r = verifyCallbackSignature({ timestamp: ts, nonce: 'NONCE1', rawBody, signature, publicKey: pubPem, now: () => nowMs });
    expect(r.ok).toBe(true);
  });

  it('body 被改動就驗不過', () => {
    const signature = sign(`${ts}\nNONCE1\n${rawBody}\n`);
    const r = verifyCallbackSignature({
      timestamp: ts, nonce: 'NONCE1', rawBody: rawBody.replace('SUCCESS', 'FAIL'),
      signature, publicKey: pubPem, now: () => nowMs,
    });
    expect(r.ok).toBe(false);
  });

  it('超過 5 分鐘的時間戳一律拒絕（防重放）', () => {
    const oldTs = String(Math.floor(nowMs / 1000) - 400);
    const signature = sign(`${oldTs}\nNONCE1\n${rawBody}\n`);
    const r = verifyCallbackSignature({ timestamp: oldTs, nonce: 'NONCE1', rawBody, signature, publicKey: pubPem, now: () => nowMs });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/replay/);
  });

  it('亂七八糟的簽名不會讓程序崩潰，只會回 false', () => {
    const r = verifyCallbackSignature({ timestamp: ts, nonce: 'N', rawBody, signature: 'not-base64!!', publicKey: pubPem, now: () => nowMs });
    expect(r.ok).toBe(false);
  });
});

describe('回調解密（AEAD_AES_256_GCM）', () => {
  const key = 'a'.repeat(32);
  const plaintext = '{"out_trade_no":"SXK20260730120000ABCD1234","trade_state":"SUCCESS"}';

  /** 依官方規格加密：認證標籤附加在密文尾端。 */
  function encrypt(nonce: string, aad: string): string {
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
    cipher.setAAD(Buffer.from(aad));
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([enc, cipher.getAuthTag()]).toString('base64');
  }

  it('解得回原文', () => {
    const nonce = 'abcdefghijkl';
    const ciphertext = encrypt(nonce, 'transaction');
    expect(decryptResource(key, { ciphertext, nonce, associated_data: 'transaction' })).toBe(plaintext);
  });

  it('associated_data 不符就解不開 —— 認證標籤涵蓋 AAD', () => {
    const nonce = 'abcdefghijkl';
    const ciphertext = encrypt(nonce, 'transaction');
    expect(() => decryptResource(key, { ciphertext, nonce, associated_data: 'refund' })).toThrow();
  });

  it('密文被竄改就解不開', () => {
    const nonce = 'abcdefghijkl';
    const buf = Buffer.from(encrypt(nonce, 'transaction'), 'base64');
    buf[0] ^= 0xff;
    expect(() => decryptResource(key, { ciphertext: buf.toString('base64'), nonce, associated_data: 'transaction' })).toThrow();
  });

  it('APIv3 金鑰不是 32 bytes 就直接拒絕', () => {
    expect(() => decryptResource('tooshort', { ciphertext: 'x', nonce: 'y' })).toThrow(/32 bytes/);
  });
});

describe('設定載入', () => {
  it('未設定時回 null，並列出缺哪幾項', () => {
    const { config, missing } = loadConfig({} as NodeJS.ProcessEnv);
    expect(config).toBeNull();
    expect(missing).toContain('WECHATPAY_MCHID');
    expect(missing).toContain('WECHATPAY_APIV3_KEY');
    expect(missing).toContain('WECHATPAY_NOTIFY_URL');
  });

  it('APIv3 金鑰長度不對會被指名', () => {
    const { missing } = loadConfig({ WECHATPAY_APIV3_KEY: 'short' } as NodeJS.ProcessEnv);
    expect(missing.some(m => m.includes('32 bytes'))).toBe(true);
  });

  it('notify_url 必須是 https 且不可帶查詢參數', () => {
    const httpOnly = loadConfig({ WECHATPAY_NOTIFY_URL: 'http://x.com/notify' } as NodeJS.ProcessEnv);
    expect(httpOnly.missing.some(m => m.includes('https'))).toBe(true);

    const withQuery = loadConfig({ WECHATPAY_NOTIFY_URL: 'https://x.com/notify?a=1' } as NodeJS.ProcessEnv);
    expect(withQuery.missing.some(m => m.includes('查詢參數'))).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { parseCertsResponse, PlatformCertStore, REFRESH_INTERVAL_MS, type RawCertsResponse } from '../src/wechatPlatformCerts';

/**
 * 平台證書模式（使用者 2026-11-10）：下載平台證書 → 用 APIv3 密鑰解開 → 用應答自己的那一張驗整包 → 依序列號給公鑰。
 * 測試證書是 openssl 產的自簽憑證（`test/fixtures/wechat-platform-test-*.pem`，序列號固定、到 2126 年），只給測試用。
 */
const FIX = path.join(__dirname, 'fixtures');
const CERT_PEM = fs.readFileSync(path.join(FIX, 'wechat-platform-test-cert.pem'), 'utf8');
const KEY_PEM = fs.readFileSync(path.join(FIX, 'wechat-platform-test-key.pem'), 'utf8');
const SERIAL = '5157F09EFDC096DE15EBE81A47057A7232F1B8E1';
const API_V3_KEY = 'k'.repeat(32);
const NOW = Date.parse('2026-11-10T00:00:00Z');

function encrypt(plain: string, nonce: string, aad: string): string {
  const c = crypto.createCipheriv('aes-256-gcm', Buffer.from(API_V3_KEY, 'utf8'), Buffer.from(nonce, 'utf8'));
  c.setAAD(Buffer.from(aad, 'utf8'));
  return Buffer.concat([c.update(plain, 'utf8'), c.final(), c.getAuthTag()]).toString('base64');
}

function response(opts: { serial?: string; listedSerial?: string; expire?: string; status?: number; tamper?: 'body' | 'signature' } = {}): RawCertsResponse {
  const body = JSON.stringify({
    data: [
      {
        serial_no: opts.listedSerial ?? SERIAL,
        effective_time: '2026-01-01T00:00:00+08:00',
        expire_time: opts.expire ?? '2031-01-01T00:00:00+08:00',
        encrypt_certificate: { algorithm: 'AEAD_AES_256_GCM', nonce: 'abcdefghijkl', associated_data: 'certificate', ciphertext: encrypt(CERT_PEM, 'abcdefghijkl', 'certificate') },
      },
    ],
  });
  const timestamp = String(Math.floor(NOW / 1000));
  const nonce = 'N0NCE';
  let signature = crypto.createSign('RSA-SHA256').update(`${timestamp}\n${nonce}\n${body}\n`).sign(KEY_PEM, 'base64');
  if (opts.tamper === 'signature') signature = signature.slice(0, -4) + (signature.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  return {
    status: opts.status ?? 200,
    body: opts.tamper === 'body' ? body.replace('certificate', 'certificatX') : body,
    headers: { timestamp, nonce, signature, serial: opts.serial ?? SERIAL },
  };
}

const pubOf = (pem: string) => new crypto.X509Certificate(pem).publicKey.export({ type: 'spki', format: 'pem' }).toString();

describe('parseCertsResponse', () => {
  it('解開、驗過，給序列號與公鑰', () => {
    const certs = parseCertsResponse(API_V3_KEY, response(), NOW);
    expect(certs).toHaveLength(1);
    expect(certs[0].serialNo).toBe(SERIAL);
    expect(certs[0].publicKey).toBe(pubOf(CERT_PEM));
  });

  it('內容或簽名被改過就整包不收', () => {
    expect(() => parseCertsResponse(API_V3_KEY, response({ tamper: 'body' }), NOW)).toThrow();
    expect(() => parseCertsResponse(API_V3_KEY, response({ tamper: 'signature' }), NOW)).toThrow(/signature/);
  });

  it('清單上的序列號與證書本身不符、或應答的簽名者不在清單上，都不收', () => {
    expect(() => parseCertsResponse(API_V3_KEY, response({ listedSerial: 'ABCDEF' }), NOW)).toThrow(/serial mismatch/);
    expect(() => parseCertsResponse(API_V3_KEY, response({ serial: 'ABCDEF' }), NOW)).toThrow(/not in the list/);
  });

  it('APIv3 密鑰不對就解不開', () => {
    expect(() => parseCertsResponse('x'.repeat(32), response(), NOW)).toThrow();
  });

  it('過期的證書不拿來用', () => {
    expect(parseCertsResponse(API_V3_KEY, response({ expire: '2026-01-02T00:00:00+08:00' }), NOW)).toEqual([]);
  });

  it('不是 200 就丟錯（帶微信的錯誤碼）', () => {
    const r = { ...response(), status: 401, body: JSON.stringify({ code: 'SIGN_ERROR' }) };
    expect(() => parseCertsResponse(API_V3_KEY, r, NOW)).toThrow(/SIGN_ERROR/);
  });
});

describe('PlatformCertStore', () => {
  const config = { mchid: '1675548366', serialNo: 'S', privateKey: KEY_PEM, apiV3Key: API_V3_KEY };

  it('第一次用才下載；快取 12 小時內不重下，過了就重下', async () => {
    let t = NOW;
    const fetch = vi.fn(async () => response());
    const store = new PlatformCertStore(config, fetch, () => t);
    expect(fetch).not.toHaveBeenCalled();
    expect(await store.publicKeyFor(SERIAL.toLowerCase())).toBe(pubOf(CERT_PEM));
    expect(await store.publicKeyFor(SERIAL)).toBe(pubOf(CERT_PEM));
    expect(fetch).toHaveBeenCalledTimes(1);
    t += REFRESH_INTERVAL_MS + 1;
    await store.publicKeyFor(SERIAL);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('不認得的序列號：重新下載，但一分鐘內最多一次；還是不認得回 null', async () => {
    let t = NOW;
    const fetch = vi.fn(async () => response());
    const store = new PlatformCertStore(config, fetch, () => t);
    await store.publicKeyFor(SERIAL);
    t += 61_000;
    expect(await store.publicKeyFor('UNKNOWN')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    t += 10_000;
    expect(await store.publicKeyFor('UNKNOWN')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('重新下載失敗：原本的快取照用', async () => {
    let t = NOW;
    let fail = false;
    const fetch = vi.fn(async () => {
      if (fail) throw new Error('network down');
      return response();
    });
    const store = new PlatformCertStore(config, fetch, () => t);
    await store.publicKeyFor(SERIAL);
    fail = true;
    t += REFRESH_INTERVAL_MS + 1;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await store.publicKeyFor(SERIAL)).toBe(pubOf(CERT_PEM));
    spy.mockRestore();
    await expect(store.refresh()).rejects.toThrow(/network down/);
  });
});

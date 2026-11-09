import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 在微信裡付款（JSAPI，2026-11-08）：服務號網頁授權拿 openid、下單帶 `channel: 'jsapi'`。
 *
 * 防的是：
 * 1. 還沒有 openid → 409 `OPENID_REQUIRED`，而且**不開單**（不留一列沒人付得了的訂單）。
 * 2. 有 openid → 照 JSAPI 下單，回的 `paySign` 用商戶私鑰簽、驗得過，簽的是那四行。
 * 3. 不帶 channel → 照舊 H5。
 * 4. 授權回呼：state 簽章對才存 openid、存到 state 上那位家長；被改過的 state 不存、導回首頁；回去的路徑只收站內的。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.TRAINING_PLAN_PRICES_FEN = '1:2990,3:7990,6:13990';
process.env.WECHATPAY_APPID = 'wxtestappid';
process.env.WECHAT_MP_APPSECRET = 'test-secret';
process.env.PUBLIC_BASE_URL = 'https://sxkscreen.com';

const PARENT_ID = 1;
const keys = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const c = require('crypto') as typeof import('crypto');
  const { privateKey, publicKey } = c.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), publicKey };
});

const db = vi.hoisted(() => ({
  created: [] as any[],
  openids: new Map<string, string>(),
  placed: [] as any[],
}));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === 1 || id === 2 ? { id, phone: '13800000000' } : null),
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createPayment: async (input: any) => { db.created.push(input); return 99; },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
}));

vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async () => [],
  insertTrainingPass: async () => true,
  hasScaleT2Findings: async () => false,
}));

vi.mock('../src/db/wechatOpenids', () => ({
  findOpenid: async (userId: number, appid: string) => db.openids.get(`${userId}:${appid}`) ?? null,
  saveOpenid: async (userId: number, appid: string, openid: string) => { db.openids.set(`${userId}:${appid}`, openid); },
}));

vi.mock('../src/wechatOauth', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/wechatOauth')>();
  return { ...actual, exchangeCodeForOpenid: async (_cfg: unknown, code: string) => `openid-for-${code}` };
});

vi.mock('../src/wechatPay', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/wechatPay')>();
  return {
    ...actual,
    loadConfig: () => ({
      config: { appid: 'wxtestappid', mchid: '1675548366', serialNo: 'S', privateKey: keys.privatePem, apiV3Key: 'k'.repeat(32), verifyMode: 'public_key', platformPublicKey: 'p', platformKeyId: 'PUB', notifyUrl: 'https://sxkscreen.com/api/payment/notify' },
      missing: [],
    }),
    placeOrder: async (_cfg: unknown, tradeType: string, req: any) => {
      db.placed.push({ tradeType, ...req });
      return tradeType === 'jsapi' ? { tradeType, prepayId: 'pp-1' } : { tradeType, h5Url: 'https://wx.example/h5' };
    },
  };
});

let client: TestClient;
beforeAll(async () => { client = await startTestApp(await loadApp()); });
afterAll(async () => { await client.close(); });
beforeEach(() => { db.created = []; db.placed = []; db.openids.clear(); });

describe('下單（JSAPI）', () => {
  it('還沒有 openid：409 OPENID_REQUIRED、不開單', async () => {
    const resp = await client.postJson('/api/payment/create', { scope: 'plan', months: 1, channel: 'jsapi' }, bearer(PARENT_ID));
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('OPENID_REQUIRED');
    expect(db.created).toHaveLength(0);
    expect(db.placed).toHaveLength(0);
  });

  it('有 openid：照 JSAPI 下單，paySign 用商戶私鑰簽那四行', async () => {
    db.openids.set(`${PARENT_ID}:wxtestappid`, 'o-abc');
    const resp = await client.postJson('/api/payment/create', { scope: 'plan', months: 1, channel: 'jsapi' }, bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toMatchObject({ tradeType: 'jsapi', amountFen: 2990 });
    expect(db.placed[0]).toMatchObject({ tradeType: 'jsapi', openid: 'o-abc', amountFen: 2990 });
    const p = body.jsapi;
    expect(p).toMatchObject({ appId: 'wxtestappid', package: 'prepay_id=pp-1', signType: 'RSA' });
    const message = `${p.appId}\n${p.timeStamp}\n${p.nonceStr}\n${p.package}\n`;
    expect(crypto.createVerify('RSA-SHA256').update(message).verify(keys.publicKey, p.paySign, 'base64')).toBe(true);
  });

  it('不帶 channel：照舊 H5', async () => {
    const resp = await client.postJson('/api/payment/create', { scope: 'plan', months: 1 }, bearer(PARENT_ID));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ tradeType: 'h5', h5Url: 'https://wx.example/h5' });
  });
});

describe('服務號網頁授權', () => {
  it('status：開了、還沒授權過要走一次；授權過就不用', async () => {
    expect(await (await client.get('/api/wechat/oauth/status', bearer(PARENT_ID))).json()).toEqual({ enabled: true, needed: true });
    db.openids.set(`${PARENT_ID}:wxtestappid`, 'o-abc');
    expect(await (await client.get('/api/wechat/oauth/status', bearer(PARENT_ID))).json()).toEqual({ enabled: true, needed: false });
  });

  it('沒登入 401', async () => {
    expect((await client.get('/api/wechat/oauth/status')).status).toBe(401);
    expect((await client.postJson('/api/wechat/oauth/link', { returnPath: '/' })).status).toBe(401);
  });

  it('link → 微信授權網址（snsapi_base、回呼在我們的網域）；callback 存到 state 上那位家長、導回原頁', async () => {
    const link = await (await client.postJson('/api/wechat/oauth/link', { returnPath: '/?c=abc' }, bearer(PARENT_ID))).json();
    const url = new URL(link.url);
    expect(url.origin + url.pathname).toBe('https://open.weixin.qq.com/connect/oauth2/authorize');
    expect(url.searchParams.get('appid')).toBe('wxtestappid');
    expect(url.searchParams.get('scope')).toBe('snsapi_base');
    expect(url.searchParams.get('redirect_uri')).toBe('https://sxkscreen.com/api/wechat/oauth/callback');
    const state = url.searchParams.get('state')!;

    const cb = await client.request(`/api/wechat/oauth/callback?code=C1&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
    expect(cb.status).toBe(302);
    expect(cb.headers.get('location')).toBe('/?c=abc');
    expect(db.openids.get(`${PARENT_ID}:wxtestappid`)).toBe('openid-for-C1');
  });

  it('被改過的 state：不存、導回首頁', async () => {
    const link = await (await client.postJson('/api/wechat/oauth/link', { returnPath: '/x' }, bearer(PARENT_ID))).json();
    const state = new URL(link.url).searchParams.get('state')!;
    const [payload, sig] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), u: 2 })).toString('base64url') + '.' + sig;
    const cb = await client.request(`/api/wechat/oauth/callback?code=C2&state=${encodeURIComponent(forged)}`, { redirect: 'manual' });
    expect(cb.status).toBe(302);
    expect(cb.headers.get('location')).toBe('/');
    expect(db.openids.size).toBe(0);
  });

  it('回去的路徑只收站內的', async () => {
    const link = await (await client.postJson('/api/wechat/oauth/link', { returnPath: '//evil.example/x' }, bearer(PARENT_ID))).json();
    const state = new URL(link.url).searchParams.get('state')!;
    const cb = await client.request(`/api/wechat/oauth/callback?code=C3&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
    expect(cb.headers.get('location')).toBe('/');
  });
});

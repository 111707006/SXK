import { describe, it, expect } from 'vitest';
import { OAUTH_STATE_TTL_MS, callbackOrigin, loadOauthConfig, readOauthState, safeReturnPath, signOauthState } from '../src/wechatOauth';
import { buildJsapiPayMessage } from '../src/wechatPay';
import { isInWechat } from '../src/utils/wechatPayClient';

describe('服務號網頁授權的 state', () => {
  const secret = 's'.repeat(32);
  it('簽了讀得回來；過期、換了秘密、太長都讀不到', () => {
    const now = 1_700_000_000_000;
    const state = signOauthState(7, '/home', secret, now);
    expect(state.length).toBeLessThanOrEqual(128);
    expect(readOauthState(state, secret, now + 1000)).toEqual({ userId: 7, returnPath: '/home' });
    expect(readOauthState(state, secret, now + OAUTH_STATE_TTL_MS + 1)).toBeNull();
    expect(readOauthState(state, 'x'.repeat(32), now)).toBeNull();
    expect(readOauthState('a'.repeat(129), secret, now)).toBeNull();
  });

  it('回去的路徑只收站內的', () => {
    expect(safeReturnPath('/?c=abc')).toBe('/?c=abc');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', '', 3, null]) expect(safeReturnPath(bad)).toBe('/');
  });
});

describe('設定', () => {
  it('三樣都設才開；網址要 https 的協定＋網域', () => {
    expect(loadOauthConfig({ WECHATPAY_APPID: 'wx1' } as any)).toBeNull();
    expect(loadOauthConfig({ WECHATPAY_APPID: 'wx1', WECHAT_MP_APPSECRET: 's', PUBLIC_BASE_URL: 'https://sxkscreen.com/' } as any))
      .toEqual({ appid: 'wx1', secret: 's', publicBase: 'https://sxkscreen.com' });
    expect(() => loadOauthConfig({ WECHATPAY_APPID: 'wx1', WECHAT_MP_APPSECRET: 's', PUBLIC_BASE_URL: 'http://sxkscreen.com' } as any)).toThrow();
  });
});

describe('回呼回到原本的網域', () => {
  const cfg = { appid: 'wx1', secret: 's', publicBase: 'https://sxkscreen.com' };
  it('www 與不帶 www 都認，其他退回 PUBLIC_BASE_URL', () => {
    expect(callbackOrigin(cfg, 'https://www.sxkscreen.com')).toBe('https://www.sxkscreen.com');
    expect(callbackOrigin(cfg, 'https://sxkscreen.com')).toBe('https://sxkscreen.com');
    for (const o of ['https://evil.example', 'http://www.sxkscreen.com', 'https://www.sxkscreen.com:8443', 'https://a.sxkscreen.com', null, 'garbage']) {
      expect(callbackOrigin(cfg, o as any)).toBe('https://sxkscreen.com');
    }
  });
});

describe('JSAPI 調起支付', () => {
  it('簽名串四行、每行都以換行結尾', () => {
    expect(buildJsapiPayMessage('wx1', '1414561699', 'N', 'prepay_id=p')).toBe('wx1\n1414561699\nN\nprepay_id=p\n');
  });

  it('只認微信內建瀏覽器，企業微信不算', () => {
    expect(isInWechat('Mozilla/5.0 ... MicroMessenger/8.0.50')).toBe(true);
    expect(isInWechat('Mozilla/5.0 ... MicroMessenger/8.0.50 wxwork/4.1')).toBe(false);
    expect(isInWechat('Mozilla/5.0 Safari')).toBe(false);
  });
});

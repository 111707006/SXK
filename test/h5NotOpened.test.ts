import { describe, it, expect } from 'vitest';
import { isH5NotOpened } from '../src/payments/h5NotOpened';

/**
 * 商戶號的 H5 支付還沒開通時，微信外按付款：要回「請用微信打開」（409），不是 500。
 * 只認 H5 那條路的 NO_AUTH；JSAPI 的 NO_AUTH 與其他錯誤照舊當錯誤。
 */
describe('H5 還沒開通時的下單失敗', () => {
  const noAuth = new Error('WeChat Pay order failed: NO_AUTH 产品权限预开通中');
  it('微信外（H5）被 NO_AUTH 拒絕：算「請用微信打開」', () => {
    expect(isH5NotOpened(noAuth, undefined, 'h5')).toBe(true);
  });
  it('JSAPI 的 NO_AUTH、其他錯誤：照舊當錯誤', () => {
    expect(isH5NotOpened(noAuth, 'jsapi', 'h5')).toBe(false);
    expect(isH5NotOpened(noAuth, undefined, 'jsapi')).toBe(false);
    expect(isH5NotOpened(new Error('WeChat Pay order failed: PARAM_ERROR x'), undefined, 'h5')).toBe(false);
    expect(isH5NotOpened(new Error('timeout'), undefined, 'h5')).toBe(false);
    expect(isH5NotOpened(null, undefined, 'h5')).toBe(false);
  });
});

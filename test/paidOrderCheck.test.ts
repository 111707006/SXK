import { describe, expect, it } from 'vitest';
import { checkPaidOrder } from '../src/payments/paidOrderCheck';

const expected = { appid: 'wxA', mchid: '100', amountFen: 1990 };

describe('結算前核對：是不是我們開的那一張、那個金額', () => {
  it('三樣都對得上才過', () => {
    expect(checkPaidOrder({ appid: 'wxA', mchid: '100', totalFen: 1990 }, expected)).toEqual({ ok: true });
  });

  it('金額不對、商戶號不對、應用號不對都不過', () => {
    expect(checkPaidOrder({ appid: 'wxA', mchid: '100', totalFen: 1 }, expected).ok).toBe(false);
    expect(checkPaidOrder({ appid: 'wxA', mchid: '999', totalFen: 1990 }, expected).ok).toBe(false);
    expect(checkPaidOrder({ appid: 'wxB', mchid: '100', totalFen: 1990 }, expected).ok).toBe(false);
  });

  it('缺欄位、型別不對都當成對不上', () => {
    expect(checkPaidOrder({ appid: undefined, mchid: '100', totalFen: 1990 }, expected).ok).toBe(false);
    expect(checkPaidOrder({ appid: 'wxA', mchid: '100', totalFen: '1990' }, expected).ok).toBe(false);
    expect(checkPaidOrder({ appid: 'wxA', mchid: '100', totalFen: null }, expected).ok).toBe(false);
    expect(checkPaidOrder({ appid: 'wxA', mchid: '100', totalFen: 19.9 }, expected).ok).toBe(false);
  });
});

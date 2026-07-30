import { describe, it, expect } from 'vitest';
import {
  generateOutTradeNo,
  isValidOutTradeNo,
  OUT_TRADE_NO_MIN_LENGTH,
  OUT_TRADE_NO_MAX_LENGTH,
} from '../src/utils/outTradeNo';

/**
 * 這些斷言把微信支付的官方契約釘在測試裡，而不是註解裡。
 *
 * 官方規則（H5下单 doc_id 4012791834）：
 *   6～32 個字元，只能是數字、大小寫字母 _ - | *，同商戶號下唯一。
 *
 * 違規只會在真正下單時被微信擋下 —— 也就是使用者按下付款的那一刻，
 * 而且測試環境很可能沒有商戶憑證可以提前發現。所以在這裡擋。
 */
describe('out_trade_no 官方契約', () => {
  it('產生的訂單號符合字元集與長度', () => {
    for (let i = 0; i < 200; i++) {
      const no = generateOutTradeNo();
      expect(isValidOutTradeNo(no), `不合法的訂單號: ${no}`).toBe(true);
    }
  });

  it('長度落在 6～32 之間', () => {
    const no = generateOutTradeNo();
    expect(no.length).toBeGreaterThanOrEqual(OUT_TRADE_NO_MIN_LENGTH);
    expect(no.length).toBeLessThanOrEqual(OUT_TRADE_NO_MAX_LENGTH);
  });

  it('帶 SXK 前綴，方便在商戶平台帳單裡辨識', () => {
    expect(generateOutTradeNo()).toMatch(/^SXK/);
  });

  it('同一秒內連續產生不會重複', () => {
    const fixed = new Date('2026-07-30T03:15:00+08:00');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateOutTradeNo(fixed));
    // 8 位 36 進位隨機碼，500 次碰撞機率可忽略；真正的唯一性由 DB 的 UNIQUE 保證
    expect(seen.size).toBe(500);
  });

  it('時間部分不含冒號或點 —— ISO 格式會違規', () => {
    const no = generateOutTradeNo(new Date('2026-07-30T03:15:00+08:00'));
    expect(no).not.toContain(':');
    expect(no).not.toContain('.');
    // 反向確認驗證器真的擋得住 ISO 字串，不是空轉
    expect(isValidOutTradeNo(`SXK${new Date().toISOString()}`)).toBe(false);
  });

  describe('isValidOutTradeNo 擋掉不合法的值', () => {
    const bad: [string, string][] = [
      ['SXK123', ''],
      ['ABCDE', '只有 5 字元，低於下限'],
      ['A'.repeat(33), '33 字元，超過上限'],
      ['SXK2026-07-30T03:15', '含冒號'],
      ['SXK2026.07.30', '含點'],
      ['SXK/20260730', '含斜線'],
      ['SXK 20260730', '含空白'],
      ['SXK#20260730', '含井號'],
      ['森心康20260730', '含中文'],
      ['', '空字串'],
    ];

    for (const [value, why] of bad) {
      if (!why) continue; // 第一筆是合法對照組
      it(`拒絕「${value}」—— ${why}`, () => {
        expect(isValidOutTradeNo(value)).toBe(false);
      });
    }

    it('接受官方允許的四個符號', () => {
      expect(isValidOutTradeNo('SXK_-|*123')).toBe(true);
    });

    it('剛好 6 與剛好 32 字元都合法', () => {
      expect(isValidOutTradeNo('A'.repeat(6))).toBe(true);
      expect(isValidOutTradeNo('A'.repeat(32))).toBe(true);
    });
  });
});

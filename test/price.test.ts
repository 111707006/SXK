import { describe, it, expect } from 'vitest';
import { formatFen, DEFAULT_UNLOCK_PRICE_FEN } from '../src/utils/price';

/**
 * 金額顯示錯一位就是消費爭議。這裡釘住「分 → 元」的轉換與尾隨零的處理，
 * 特別是 ¥19.9 這個實際定價 —— toFixed(2) 會給出 "19.90"，中文定價習慣寫 19.9。
 */
describe('formatFen', () => {
  it('實際定價 ¥19.9', () => {
    expect(formatFen(DEFAULT_UNLOCK_PRICE_FEN)).toBe('19.9');
    expect(DEFAULT_UNLOCK_PRICE_FEN).toBe(1990);
  });

  it('整數元不留小數點', () => {
    expect(formatFen(2000)).toBe('20');
    expect(formatFen(100)).toBe('1');
  });

  it('兩位小數完整保留', () => {
    expect(formatFen(1999)).toBe('19.99');
    expect(formatFen(1)).toBe('0.01');
  });

  it('零與非數值不會畫出 NaN', () => {
    expect(formatFen(0)).toBe('0');
    expect(formatFen(NaN)).toBe('—');
    expect(formatFen(Infinity)).toBe('—');
  });

  it('不會把分當成元（1990 分不是 ¥1990）', () => {
    expect(formatFen(1990)).not.toBe('1990');
  });
});

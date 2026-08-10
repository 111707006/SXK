import { describe, it, expect } from 'vitest';
import {
  REPORT_LINK_TOKEN_LENGTH,
  generateReportLinkToken,
  isValidReportLinkToken,
  reportLinkPath,
  resolveReportLinkBase,
} from '../src/utils/reportLink';

/**
 * 掃碼報告連結的純函式測試（issue #22）。
 *
 * 這條連結是**永久有效且無法撤回**的（產品端已選定的取捨），所以「猜不到」是
 * 它僅有的一道防線。這裡把那道防線釘成斷言：長度、字元集、以及「兩次產生不會
 * 撞在一起」。寫法參照 `test/outTradeNo.test.ts`。
 */

describe('token 的形狀', () => {
  it('是 43 個字元的 base64url', () => {
    const token = generateReportLinkToken();
    expect(token).toHaveLength(REPORT_LINK_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  /**
   * 網址安全的字元集。`+` `/` `=` 進了網址就得再編碼一次，而「有時候要編碼、
   * 有時候不用」是掃出來的網址與存進資料庫的字串對不起來的典型原因。
   */
  it('不含需要再編碼一次的字元', () => {
    for (let i = 0; i < 200; i++) {
      const token = generateReportLinkToken();
      expect(token).not.toMatch(/[+/=]/);
    }
  });

  // 撞號等於把 A 家孩子的報告給 B 家的家長。256 位元的亂數撞不到，
  // 但這一條擋的是「有人把它改成流水號或時間戳」。
  it('連續產生兩千個都不重複', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateReportLinkToken());
    expect(seen.size).toBe(2000);
  });

  it('自己產生的 token 一定通得過形狀檢查', () => {
    for (let i = 0; i < 100; i++) {
      expect(isValidReportLinkToken(generateReportLinkToken())).toBe(true);
    }
  });
});

describe('形狀檢查擋掉的東西', () => {
  it.each([
    ['空字串', ''],
    ['太短', 'abc'],
    ['多一個字元', 'a'.repeat(REPORT_LINK_TOKEN_LENGTH + 1)],
    ['少一個字元', 'a'.repeat(REPORT_LINK_TOKEN_LENGTH - 1)],
    ['帶斜線（路徑穿越）', '../'.padEnd(REPORT_LINK_TOKEN_LENGTH, 'a')],
    ['帶百分號編碼', '%2e'.padEnd(REPORT_LINK_TOKEN_LENGTH, 'a')],
    ['帶單引號（SQL 注入的形狀）', "'".padEnd(REPORT_LINK_TOKEN_LENGTH, 'a')],
  ])('%s 不算 token', (_label, value) => {
    expect(isValidReportLinkToken(value)).toBe(false);
  });

  // 這些值會從 `req.params` 進來，型別上是 string 但實際可能不是。
  it('非字串一律不算', () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(isValidReportLinkToken(value)).toBe(false);
    }
  });
});

describe('連結路徑', () => {
  it('短路徑，token 直接接在後面', () => {
    expect(reportLinkPath('abc')).toBe('/r/abc');
  });
});

describe('二維碼裡的絕對網址', () => {
  it('有設定就用設定的', () => {
    expect(resolveReportLinkBase('https://sxkscreen.com', 'http://127.0.0.1:5000')).toBe(
      'https://sxkscreen.com'
    );
  });

  it('去掉結尾的斜線，避免產出 //r/xxx', () => {
    expect(resolveReportLinkBase('https://sxkscreen.com///', 'http://x')).toBe(
      'https://sxkscreen.com'
    );
  });

  it('沒設定就用請求本身的來源', () => {
    expect(resolveReportLinkBase(undefined, 'https://t1.sxkscreen.com')).toBe(
      'https://t1.sxkscreen.com'
    );
    expect(resolveReportLinkBase('', 'https://t1.sxkscreen.com')).toBe('https://t1.sxkscreen.com');
  });

  /**
   * 這一條是本組的重點。少了協定的 `sxkscreen.com/r/xxx` 進了二維碼會被掃碼
   * 程式當成一段普通文字（或相對路徑），家長掃出來打不開 —— 而 iPad 上的
   * 二維碼看起來完全正常。設定打錯字時退回請求來源至少還是一條打得開的網址。
   */
  it('認不得的設定值一律忽略，不原樣接上去', () => {
    for (const bad of ['sxkscreen.com', 'ftp://sxkscreen.com', 'https://', '   ', 'https://a.com/x']) {
      expect(resolveReportLinkBase(bad, 'https://fallback.com'), bad).toBe('https://fallback.com');
    }
  });
});

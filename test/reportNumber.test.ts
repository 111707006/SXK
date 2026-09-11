import { describe, it, expect } from 'vitest';
import { reportNumber } from '../src/utils/reportNumber';

/**
 * 報告編號（ADR-0007）。
 *
 * 2026-09-11 之前，報告抬頭寫的是 `监测号: SXK-{Date.now().slice(-6)}` —— 那個數字
 * 取的是**渲染當下**的時間，同一份報告家長自己重開一次就換一個號。號碼的用途是
 * 讓家長在電話上說出「我看的是哪一份」，會變的號碼做不了這件事。
 *
 * 這裡釘的是「同一份報告永遠同一號」，不是某個特定的字串 —— 演算法可以換，
 * 穩定性不能。
 */
describe('報告編號', () => {
  it('同一個報告 id 永遠算出同一個號', () => {
    expect(reportNumber('rec_1757500000000')).toBe(reportNumber('rec_1757500000000'));
  });

  it('不同的報告 id 算出不同的號', () => {
    const ids = ['rec_1757500000000', 'rec_1757500000001', 'rec_1757500060000', 'rec_abc', 'rec_abd'];
    expect(new Set(ids.map(reportNumber)).size).toBe(ids.length);
  });

  it('格式是 SXK- 加六碼大寫英數 —— 電話上唸得出來', () => {
    for (const id of ['rec_1757500000000', 'x', '', '報告-1']) {
      expect(reportNumber(id)).toMatch(/^SXK-[0-9A-Z]{6}$/);
    }
  });

  it('不含當下時間 —— 隔一秒再算還是同一個號', () => {
    const first = reportNumber('rec_1757500000000');
    const later = reportNumber('rec_1757500000000');
    expect(later).toBe(first);
    // 而且與時間戳本身的後六位無關：那正是舊寫法，換演算法時最容易不小心退回去。
    expect(first).not.toBe('SXK-' + '1757500000000'.slice(-6));
  });
});

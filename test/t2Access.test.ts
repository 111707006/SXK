import { describe, it, expect } from 'vitest';
import { getT2Access, T2AccessInput } from '../src/utils/access';

/**
 * T2 的存取決策 —— 票 #45：**T2 整份買一次**。
 *
 * 與 `access.test.ts`（`getDimensionAccess`，每個維度各買一次）並存而不是取代它：
 * 伺服器那道舊的維度閘門（`denyIfLocked`）這張票不動，前端仍需要一個對得上它的
 * 函式。兩個函式的四種結果（open／locked／demo／needs_login）刻意相同 ——
 * 呼叫端的處理方式一模一樣，差別只在「問的是哪一種權益」。
 */

const base: T2AccessInput = {
  paywallEnabled: true,
  unlocksAvailable: true,
  isLoggedIn: true,
  t2Unlocked: false,
};

describe('專案 B（無付費牆）', () => {
  it('一律放行，不受其他輸入影響', () => {
    expect(getT2Access({ ...base, paywallEnabled: false })).toBe('open');
    expect(getT2Access({
      paywallEnabled: false,
      unlocksAvailable: false,
      isLoggedIn: false,
      t2Unlocked: null,
    })).toBe('open');
  });
});

describe('展示模式（後端未接資料庫，或示範開關開著）', () => {
  it('回 demo，而不是 open', () => {
    expect(getT2Access({ ...base, unlocksAvailable: false, t2Unlocked: null })).toBe('demo');
  });

  it('未登入也是 demo', () => {
    expect(getT2Access({ ...base, unlocksAvailable: false, isLoggedIn: false })).toBe('demo');
  });

  it('按過「跳过付费」之後放行 —— 不然展示模式的 T2 入口是死路', () => {
    expect(getT2Access({ ...base, unlocksAvailable: false, t2Unlocked: true })).toBe('open');
  });
});

describe('專案 A 且付費牆生效', () => {
  it('未登入 → 導向登入，而非付費牆', () => {
    expect(getT2Access({ ...base, isLoggedIn: false })).toBe('needs_login');
  });

  it('有 t2 權益 → 放行', () => {
    expect(getT2Access({ ...base, t2Unlocked: true })).toBe('open');
  });

  it('沒有 t2 權益 → 擋下', () => {
    expect(getT2Access(base)).toBe('locked');
  });

  /**
   * 查詢尚未回來時當作未解鎖。反過來（樂觀放行）會在每次重新整理後開一個短暫的
   * 免費視窗 —— 與 `getDimensionAccess` 同一個理由，兩邊必須一致。
   */
  it('尚未查到（null）當作未解鎖', () => {
    expect(getT2Access({ ...base, t2Unlocked: null })).toBe('locked');
  });
});

describe('T2 不看維度', () => {
  /**
   * 這是這張票的整個重點：買的是「T2 整份」，不是九個維度中的一個。
   * 型別上就沒有維度可傳 —— 少了這條，日後很容易有人把維度加回來。
   */
  it('輸入裡沒有維度這個概念', () => {
    const keys = Object.keys(base);
    expect(keys).not.toContain('dimensionId');
    expect(keys).not.toContain('unlockedDimensionIds');
  });
});

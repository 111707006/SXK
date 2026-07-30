import { describe, it, expect } from 'vitest';
import { getDimensionAccess, isPaywallActive, AccessInput } from '../src/utils/access';

/**
 * 付費牆的存取決策。判錯的兩個方向都有真實代價：
 * 太鬆 → 付費內容免費送；太緊 → 家長付了錢進不去。
 *
 * 這裡只測畫面層的決策。後端的 `denyIfLocked` 是另一道獨立的閘門，
 * 兩者不共用程式碼是刻意的 —— 前端擋畫面、後端擋資料。
 */

const base: AccessInput = {
  paywallEnabled: true,
  unlocksAvailable: true,
  isLoggedIn: true,
  unlockedDimensionIds: [],
};

describe('專案 B（無付費牆）', () => {
  it('一律放行，不受其他輸入影響', () => {
    expect(getDimensionAccess('language', { ...base, paywallEnabled: false })).toBe('open');
    expect(getDimensionAccess('language', {
      paywallEnabled: false,
      unlocksAvailable: false,
      isLoggedIn: false,
      unlockedDimensionIds: null,
    })).toBe('open');
  });

  it('付費 UI 不得出現', () => {
    expect(isPaywallActive({ paywallEnabled: false })).toBe(false);
  });
});

describe('展示模式（後端未接資料庫）', () => {
  /**
   * 沒有持久層就不可能有人買得成，所以擋不住也不該擋；但付費牆仍要看得到 ——
   * 看不到的東西沒辦法拿給人看。回 `'demo'` 而不是 `'open'`，是為了讓呼叫端
   * 有機會把「可以略過」這件事明確標示出來，而不是靜靜地放行。
   */
  it('回 demo，而不是 open —— 兩者的去處相同、結果相反，不可混為一談', () => {
    expect(getDimensionAccess('language', { ...base, unlocksAvailable: false, unlockedDimensionIds: null }))
      .toBe('demo');
  });

  it('未登入也是 demo（展示模式下不擋登入）', () => {
    expect(getDimensionAccess('language', { ...base, unlocksAvailable: false, isLoggedIn: false }))
      .toBe('demo');
  });

  it('已解鎖清單在展示模式下不影響結果', () => {
    expect(getDimensionAccess('language', { ...base, unlocksAvailable: false, unlockedDimensionIds: ['language'] }))
      .toBe('demo');
  });

  it('鎖頭與價格照顯示', () => {
    expect(isPaywallActive({ paywallEnabled: true })).toBe(true);
  });

  it('專案 B 即使在展示模式也不得出現 demo —— B 根本沒有付費牆', () => {
    expect(getDimensionAccess('language', { ...base, paywallEnabled: false, unlocksAvailable: false }))
      .toBe('open');
  });
});

describe('專案 A 且付費牆生效', () => {
  it('未登入 → 導向登入，而非付費牆', () => {
    expect(getDimensionAccess('language', { ...base, isLoggedIn: false })).toBe('needs_login');
  });

  it('已解鎖的維度可進入', () => {
    expect(getDimensionAccess('language', { ...base, unlockedDimensionIds: ['language'] })).toBe('open');
  });

  it('未解鎖的維度擋下', () => {
    expect(getDimensionAccess('cognitive', { ...base, unlockedDimensionIds: ['language'] })).toBe('locked');
  });

  it('解鎖清單為空時全部擋下', () => {
    expect(getDimensionAccess('language', base)).toBe('locked');
  });

  it('解鎖只對指定維度生效，不會外溢到其他維度', () => {
    const input = { ...base, unlockedDimensionIds: ['language', 'attention'] };
    expect(getDimensionAccess('language', input)).toBe('open');
    expect(getDimensionAccess('attention', input)).toBe('open');
    expect(getDimensionAccess('gross_motor', input)).toBe('locked');
    expect(getDimensionAccess('self_care', input)).toBe('locked');
  });

  it('鎖頭與價格要顯示', () => {
    expect(isPaywallActive({ paywallEnabled: true })).toBe(true);
  });
});

describe('尚未確定後端是否有持久層（unlocksAvailable === null）', () => {
  /**
   * 只有明確的 `false` 才算展示模式。查詢還沒回來或失敗時一律當作付費牆會執行，
   * 否則每次載入頁面都會有一個「還不知道」的免費視窗。
   */
  it('當作付費牆生效，未解鎖的維度仍擋下', () => {
    expect(getDimensionAccess('language', { ...base, unlocksAvailable: null, unlockedDimensionIds: null }))
      .toBe('locked');
  });

  it('鎖頭照顯示 —— 畫面與點擊後的行為必須一致', () => {
    expect(isPaywallActive({ paywallEnabled: true })).toBe(true);
  });

  it('專案 B 不受影響', () => {
    expect(getDimensionAccess('language', { ...base, paywallEnabled: false, unlocksAvailable: null }))
      .toBe('open');
    expect(isPaywallActive({ paywallEnabled: false })).toBe(false);
  });
});

describe('解鎖清單尚未回來（unlockedDimensionIds === null）', () => {
  /**
   * 最容易寫錯的一格。樂觀放行會在每次重新整理後開一個短暫的免費視窗，
   * 而那正是最容易被發現與濫用的漏洞 —— 重整、搶在回應之前點進去即可。
   */
  it('當作未解鎖，不得樂觀放行', () => {
    expect(getDimensionAccess('language', { ...base, unlockedDimensionIds: null })).toBe('locked');
  });

  it('未登入時仍優先導向登入（登入才拿得到清單）', () => {
    expect(getDimensionAccess('language', { ...base, isLoggedIn: false, unlockedDimensionIds: null }))
      .toBe('needs_login');
  });
});

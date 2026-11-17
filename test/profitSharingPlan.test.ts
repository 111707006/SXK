import { describe, it, expect } from 'vitest';
import {
  capFen, keyOf, outOrderNo, partiesDue, planSharing, readProfitSharingConfig, readReceiverInput, shouldFlagOrder,
  type Receiver,
} from '../src/profitSharing/plan';
import { computeSplit, type SplitSnapshot } from '../src/revenueSplit/split';

/**
 * 微信分账的金額（ADR-0017）：清分算出各方該拿多少，這裡決定「實際從微信分出去多少」。
 *
 * 【這裡在防什麼】
 * 1. 分出去的合計超過微信的上限（訂單金額 × 最高比例、且不超過淨額）→ 微信整張拒絕，款項卡在冻结。
 * 2. 沒分出去的錢憑空消失：應得 − 微信分出 一定等於「線下結」。
 * 3. 對方沒有可用接收方的訂單也帶分账標記 → 白白冻结 30 天。
 */
const company: SplitSnapshot = { v: 1, party: { kind: 'company', companyId: 7, companyName: '甲' }, feeBp: 60, platformBp: 2000, companyBp: null };
const three: SplitSnapshot = {
  v: 1,
  party: { kind: 'company_referrer', companyId: 7, companyName: '甲', referrerId: 3, referrerName: '王', referrerKind: 'therapist' },
  feeBp: 60, platformBp: 2000, companyBp: 2000,
};
const none: SplitSnapshot = { v: 1, party: { kind: 'none' }, feeBp: 60, platformBp: 10000, companyBp: null };

const rec = (partyKind: 'company' | 'referrer', refId: number, over: Partial<Receiver> = {}): [string, Receiver] => [
  keyOf(partyKind, refId),
  { partyKind, refId, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', relationType: 'PARTNER', active: true, registered: true, ...over },
];

describe('planSharing', () => {
  it('對方拿 80%、上限 30%：只分到上限，其餘記線下結', () => {
    const p = planSharing(1990, company, new Map([rec('company', 7)]), 3000);
    const due = computeSplit(1990, company).companyFen;
    expect(p.capFen).toBe(597); // floor(1990 × 30%)
    expect(p.action).toBe('share');
    expect(p.sharedFen).toBe(597);
    expect(p.offlineFen).toBe(due - 597);
    expect(p.lines[0]).toMatchObject({ dueFen: due, shareFen: 597, offlineReason: 'over_cap' });
  });

  it('上限夠大就全部分出去，沒有線下結', () => {
    const p = planSharing(1990, company, new Map([rec('company', 7)]), 10000);
    expect(p.offlineFen).toBe(0);
    expect(p.lines[0].offlineReason).toBeNull();
    expect(p.sharedFen).toBe(computeSplit(1990, company).companyFen);
  });

  it('三方超過上限：照比例縮，合計不超過上限', () => {
    const p = planSharing(39900, three, new Map([rec('company', 7), rec('referrer', 3, { type: 'PERSONAL_OPENID', account: 'o'.repeat(28), name: null })]), 3000);
    expect(p.sharedFen).toBeLessThanOrEqual(p.capFen);
    expect(p.capFen - p.sharedFen).toBeLessThan(2); // 只差取整的零頭
    const [c, r] = p.lines;
    expect(c.shareFen * r.dueFen).toBeLessThanOrEqual(r.shareFen * c.dueFen + r.dueFen + c.dueFen); // 比例大致不變
    expect(p.lines.reduce((n, l) => n + l.dueFen, 0)).toBe(p.sharedFen + p.offlineFen);
  });

  it('一方沒有接收方：那一方整份線下結、不佔另一方的上限', () => {
    const p = planSharing(39900, three, new Map([rec('referrer', 3)]), 10000);
    expect(p.lines.find(l => l.partyKind === 'company')).toMatchObject({ shareFen: 0, offlineReason: 'no_receiver', receiver: null });
    const ref = p.lines.find(l => l.partyKind === 'referrer')!;
    expect(ref.shareFen).toBe(ref.dueFen);
  });

  it.each([{ active: false }, { registered: false }])('停用或微信沒加成功的接收方（%o）不算', over => {
    const p = planSharing(1990, company, new Map([rec('company', 7, over)]), 3000);
    expect(p.action).toBe('unfreeze');
    expect(p.sharedFen).toBe(0);
    expect(p.offlineFen).toBe(computeSplit(1990, company).companyFen);
  });

  it('窮舉金額與上限：分出去的永遠不超過上限與淨額，應得＝分出＋線下結', () => {
    const receivers = new Map([rec('company', 7), rec('referrer', 3)]);
    for (const amount of [1, 2, 99, 100, 1990, 2990, 3990, 9990, 39900]) {
      for (const maxBp of [1, 500, 3000, 5000, 10000]) {
        for (const s of [company, three]) {
          const p = planSharing(amount, s, receivers, maxBp);
          expect(p.sharedFen).toBeLessThanOrEqual(capFen(amount, s, maxBp));
          expect(p.sharedFen).toBeLessThanOrEqual(computeSplit(amount, s).netFen);
          expect(p.lines.reduce((n, l) => n + l.dueFen, 0)).toBe(p.sharedFen + p.offlineFen);
          for (const l of p.lines) expect(l.shareFen).toBeLessThanOrEqual(l.dueFen);
        }
      }
    }
  });
});

describe('shouldFlagOrder', () => {
  it('沒有對方、沒有快照、沒有接收方：不帶分账標記', () => {
    expect(shouldFlagOrder(1990, none, new Map([rec('company', 7)]), 3000)).toBe(false);
    expect(shouldFlagOrder(1990, null, new Map([rec('company', 7)]), 3000)).toBe(false);
    expect(shouldFlagOrder(1990, company, new Map(), 3000)).toBe(false);
  });
  it('對方有可用的接收方才帶', () => {
    expect(shouldFlagOrder(1990, company, new Map([rec('company', 7)]), 3000)).toBe(true);
    expect(shouldFlagOrder(1990, company, new Map([rec('company', 8)]), 3000)).toBe(false);
  });
  it('金額小到分不出一分錢：不帶', () => {
    expect(shouldFlagOrder(1, company, new Map([rec('company', 7)]), 3000)).toBe(false);
  });
});

describe('其他', () => {
  it('partiesDue 只列拿得到錢的', () => {
    expect(partiesDue(1990, none)).toEqual([]);
    expect(partiesDue(39900, three).map(d => d.partyKind)).toEqual(['company', 'referrer']);
  });
  it('單號只有數字與字母', () => {
    expect(outOrderNo(12, 2)).toBe('PS12A2');
    expect(outOrderNo(12, 2)).toMatch(/^[0-9A-Za-z]{1,64}$/);
  });
  it('設定：預設 30%、7 天、不自動；認不得起不來', () => {
    expect(readProfitSharingConfig({})).toEqual({ maxBp: 3000, delayDays: 7, autoMinutes: 0 });
    expect(readProfitSharingConfig({ PROFIT_SHARING_MAX_BP: '5000', PROFIT_SHARING_DELAY_DAYS: '0', PROFIT_SHARING_AUTO_MINUTES: '60' })).toEqual({ maxBp: 5000, delayDays: 0, autoMinutes: 60 });
    for (const bad of [{ PROFIT_SHARING_MAX_BP: '0' }, { PROFIT_SHARING_MAX_BP: '30%' }, { PROFIT_SHARING_DELAY_DAYS: '26' }, { PROFIT_SHARING_AUTO_MINUTES: '5' }]) {
      expect(() => readProfitSharingConfig(bad)).toThrow(/not recognised/);
    }
  });
  it('後台輸入：商戶要商戶號與全稱，個人只要 openid、不存姓名', () => {
    expect(readReceiverInput({ partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: ' 1900000109 ', name: ' 甲公司 ' }))
      .toEqual({ partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', relationType: 'PARTNER' });
    expect(readReceiverInput({ partyKind: 'referrer', refId: 3, type: 'PERSONAL_OPENID', account: 'oUpF8uMuAJO_M2pxb1Q9zNjWeS6o', name: '王老师' }))
      .toMatchObject({ name: null });
    for (const bad of [
      { partyKind: 'x', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲' },
      { partyKind: 'company', refId: 0, type: 'MERCHANT_ID', account: '1900000109', name: '甲' },
      { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: 'abc', name: '甲' },
      { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '' },
      { partyKind: 'company', refId: 7, type: 'PERSONAL_OPENID', account: 'short' },
      { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲', relationType: 'CUSTOM' },
    ]) expect(readReceiverInput(bad)).toHaveProperty('error');
  });
});

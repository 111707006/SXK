import { describe, it, expect } from 'vitest';
import { BLOCKER_TEXT, blockersOf, unitDeleteSummary, type UnitDeletePreview } from '../src/admin/unitDeletion';

describe('unitDeletion：擋下的原因與確認框的字', () => {
  it('只有數字大於 0 的才算擋下，訊息帶筆數', () => {
    const b = blockersOf([['active', 0], ['orders', 3], ['exports', 0], ['phone_conflict', 1]]);
    expect(b.map(x => x.code)).toEqual(['orders', 'phone_conflict']);
    expect(b[0].message).toContain('3 笔订单');
  });
  it('每一種擋下都有字', () => {
    for (const fn of Object.values(BLOCKER_TEXT)) expect(fn(2).length).toBeGreaterThan(5);
  });
  it('確認框講清楚會發生什麼（數字、已用的碼保留、不能復原）', () => {
    const p: UnitDeletePreview = {
      company: { id: 4, name: '测试机构', kind: 'institution', active: false },
      servedParents: 2, screeningParents: 3, unusedCodes: 7, usedCodes: 1, accounts: 2, referrers: 1, blockers: [],
    };
    const text = unitDeleteSummary(p).join('\n');
    for (const s of ['2 位', '3 位', '7 组', '1 组已用的保留', '2 个后台帐号', '1 位推荐人', '不能复原']) expect(text).toContain(s);
  });
});

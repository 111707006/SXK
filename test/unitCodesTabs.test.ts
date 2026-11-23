import { describe, it, expect } from 'vitest';
import { visibleTabs } from '../src/admin/adminView';

/** #124：服務關係開關開著時，單位管理者多「本单位兑换码」與「代填」；關著不變。個人治療師帳號照舊用自己的那兩頁。 */
const SR = { multiCompany: true, projectA: true, serviceRelations: true } as const;
const OFF = { multiCompany: true, projectA: true } as const;
const manager = { role: 'company_member' as const, email: 'm@a', companyId: 7, selection: null };
const therapist = { ...manager, referrer: true as const };

describe('單位管理者的分頁', () => {
  it('開著：多本单位兑换码、代填', () => {
    const ids = visibleTabs(manager, SR).map(t => t.id);
    expect(ids).toContain('unitCodes');
    expect(ids).toContain('proxy');
    expect(visibleTabs(manager, SR).find(t => t.id === 'unitCodes')?.label).toBe('本单位兑换码与优惠券');
  });

  it('關著：一個都不多', () => {
    const ids = visibleTabs(manager, OFF).map(t => t.id);
    expect(ids).not.toContain('unitCodes');
    expect(ids).not.toContain('proxy');
  });

  it('個人治療師帳號：照舊「我的兑换码」與「代填」，不重複', () => {
    const ids = visibleTabs(therapist, SR).map(t => t.id);
    expect(ids.filter(id => id === 'proxy')).toHaveLength(1);
    expect(ids).toContain('myCodes');
    expect(ids).not.toContain('unitCodes');
  });

  it('全域管理員、推薦人：沒有「本单位兑换码」', () => {
    const god = { role: 'global_admin' as const, email: 'g', companyId: null, selection: { kind: 'company' as const, companyId: 7 } };
    expect(visibleTabs(god, SR).map(t => t.id)).not.toContain('unitCodes');
    expect(visibleTabs({ role: 'referrer', email: 'r', companyId: null, selection: null }, SR).map(t => t.id)).not.toContain('unitCodes');
  });
});

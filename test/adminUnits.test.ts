import { describe, it, expect } from 'vitest';
import { visibleTabs, type AdminCenterShape } from '../src/admin/adminView';
import type { AdminIdentityView } from '../src/admin/adminApi';
import { isValidReferrerCode, referrerEntryUrl } from '../src/admin/units';

/**
 * 合作單位（#117，ADR-0020，只在專案 A）：分頁改名、個人治療師的帳號同時是單位管理者與推薦人。
 * 專案 B 一個字都不變。
 */
const A_UNITS: AdminCenterShape = { multiCompany: true, projectA: true };
const B: AdminCenterShape = { multiCompany: true };

const god: AdminIdentityView = { role: 'global_admin', email: 'g@x.com', companyId: null, selection: { kind: 'company', companyId: 1 } };
const member: AdminIdentityView = { role: 'company_member', email: 'm@x.com', companyId: 7, selection: null };
const therapist: AdminIdentityView = { ...member, referrer: true };

const labelOf = (identity: AdminIdentityView, shape: AdminCenterShape, id: string) =>
  visibleTabs(identity, shape).find(t => t.id === id)?.label;

describe('分頁名稱', () => {
  it('A 叫「合作单位」', () => {
    expect(labelOf(god, A_UNITS, 'companies')).toBe('合作单位');
  });

  it('B 照舊叫「合作公司」', () => {
    expect(labelOf(god, B, 'companies')).toBe('合作公司');
  });
});

describe('個人治療師的帳號（單位管理者＋推薦人）', () => {
  it('單位管理者的分頁之外，多「我的兑换码」「代填」', () => {
    const ids = visibleTabs(therapist, A_UNITS).map(t => t.id);
    expect(ids).toEqual([...visibleTabs(member, A_UNITS).map(t => t.id), 'myCodes', 'proxy']);
    expect(ids).toContain('parents');
  });

  it('一般單位管理者沒有那兩頁', () => {
    const ids = visibleTabs(member, A_UNITS).map(t => t.id);
    expect(ids).not.toContain('myCodes');
    expect(ids).not.toContain('proxy');
  });
});

describe('推薦人的個人連結', () => {
  const origin = 'https://sxkscreen.com';

  it('機構底下的推薦人：?c=<單位>&t=<代號>', () => {
    expect(referrerEntryUrl(origin, { companySlug: 'yiyuan', companyKind: 'institution', code: 'wang' })).toBe(
      'https://sxkscreen.com/?c=yiyuan&t=wang'
    );
  });

  it('個人治療師單位：就是單位連結', () => {
    expect(referrerEntryUrl(origin, { companySlug: 'li', companyKind: 'therapist', code: null })).toBe('https://sxkscreen.com/?c=li');
  });

  it('沒代號的舊推薦人、沒隸屬單位的推薦人：沒有連結', () => {
    expect(referrerEntryUrl(origin, { companySlug: 'yiyuan', companyKind: 'institution', code: null })).toBeNull();
    expect(referrerEntryUrl(origin, { companySlug: null, companyKind: null, code: 'wang' })).toBeNull();
  });
});

describe('推薦人代號的格式（同進站代號）', () => {
  it.each(['wang', 'dr-li', 'a1'])('收 %s', code => expect(isValidReferrerCode(code)).toBe(true));
  it.each(['', 'a', 'Wang', '-li', 'li li', '王', null, 3])('不收 %s', code => expect(isValidReferrerCode(code)).toBe(false));
});

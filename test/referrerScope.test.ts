import { describe, it, expect } from 'vitest';
import { companyWhereSql, matchesCompanyCondition, resolveCompanyCondition } from '../src/admin/companyScope';
import { buildIdentity } from '../src/admin/adminAuth';
import { referrerMayCall } from '../src/admin/referrerAccess';
import { visibleTabs } from '../src/admin/adminView';

/**
 * 推薦人的範圍（#93）：條件、SQL、記憶體版、白名單、身分、分頁。
 */

const REF = { role: 'referrer' as const, adminUserId: 40, email: 'ref@a.com', referrerId: 7 };

describe('條件', () => {
  it('兩種模式都一樣：綁在他名下', () => {
    expect(resolveCompanyCondition(REF, { multiCompany: true })).toEqual({ ok: true, condition: { kind: 'referrer', referrerId: 7 } });
    expect(resolveCompanyCondition(REF, { multiCompany: false })).toEqual({ ok: true, condition: { kind: 'referrer', referrerId: 7 } });
  });

  it('SQL：以 users u 為主的查詢接 referrer_bindings；別的表一筆都不給', () => {
    expect(companyWhereSql({ kind: 'referrer', referrerId: 7 })).toEqual({
      sql: 'EXISTS (SELECT 1 FROM referrer_bindings rb WHERE rb.user_id = u.id AND rb.referrer_id = ?)',
      params: [7],
    });
    expect(companyWhereSql({ kind: 'referrer', referrerId: 7 }, 's.company_id')).toEqual({ sql: '1 = 0', params: [] });
  });

  it('記憶體版：看 referrerId', () => {
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 7 }, { companyId: null, referrerId: 7 })).toBe(true);
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 7 }, { companyId: null, referrerId: 8 })).toBe(false);
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 7 }, { companyId: null })).toBe(false);
  });
});

describe('身分', () => {
  const payload = { typ: 'admin' as const, aid: 40, email: 'ref@a.com', role: 'referrer' as const, companyId: null, sel: null, exp: Date.now() + 1000 };
  const account = { id: 40, email: 'ref@a.com', role: 'referrer' as const, companyId: null, active: true, referrerId: 7, referrerActive: true };

  it('對得到一位啟用中的推薦人', () => {
    expect(buildIdentity(payload, account)).toEqual(REF);
  });

  it('推薦人那一列停用、或對不到：擋下', () => {
    expect(buildIdentity(payload, { ...account, referrerActive: false })).toBeNull();
    expect(buildIdentity(payload, { ...account, referrerId: null })).toBeNull();
  });

  it('推薦人的 token 不會因為帳號被改成別的角色而變成全域管理員', () => {
    expect(buildIdentity(payload, { ...account, role: 'global_admin' })).toBeNull();
  });
});

describe('白名單', () => {
  it.each([['GET', '/me'], ['GET', '/parents'], ['GET', '/parents/12']])('%s %s 可以', (m, p) => {
    expect(referrerMayCall(m, p)).toBe(true);
  });

  it.each([['DELETE', '/parents/12'], ['GET', '/parent-summary'], ['POST', '/parent-summary/export'], ['GET', '/referrers'], ['GET', '/specialists'], ['POST', '/select-company']])(
    '%s %s 不行',
    (m, p) => {
      expect(referrerMayCall(m, p)).toBe(false);
    },
  );
});

describe('分頁', () => {
  it('推薦人只看到我的家长、我的兑换码、代填', () => {
    expect(visibleTabs({ role: 'referrer', email: 'ref@a.com', companyId: null, selection: null }, { multiCompany: true, projectA: true }).map(t => t.id)).toEqual([
      'parents',
      'myCodes',
      'proxy',
    ]);
  });

  it('全域管理員在 A 看得到「推荐人与兑换码」，B 沒有', () => {
    const god = { role: 'global_admin' as const, email: 'g', companyId: null, selection: { kind: 'unassigned' as const } };
    expect(visibleTabs(god, { multiCompany: false }).map(t => t.id)).toContain('referrers');
    expect(visibleTabs(god, { multiCompany: true }).map(t => t.id)).not.toContain('referrers');
  });
});

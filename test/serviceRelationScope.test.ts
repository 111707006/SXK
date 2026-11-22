import { describe, it, expect } from 'vitest';
import {
  companyWhereSql,
  matchesCompanyCondition,
  resolveCompanyCondition,
  type AdminCenterShape,
  type AdminIdentity,
  type CompanyCondition,
} from '../src/admin/companyScope';

/**
 * 服務關係開關開著時的後台範圍（#119／#118，ADR-0020 第 3 點）：誰看得到哪位家長，看 `service_relations`，
 * 不看帳號歸屬（`users.company_id`，現在是篩查渠道）也不看推薦綁定（`referrer_bindings`）。
 * 條件仍是那三種 kind、多一個 `byService` 記號：`kind === 'company'` 的地方（專家、本單位設定、導出紀錄）照舊。
 */

const SR_A: AdminCenterShape = { multiCompany: true, projectA: true, serviceRelations: true };
const OFF_A: AdminCenterShape = { multiCompany: true, projectA: true };

const manager: AdminIdentity = { role: 'company_member', adminUserId: 1, email: 'm@x', companyId: 7 };
const referrer: AdminIdentity = { role: 'referrer', adminUserId: 2, email: 'r@x', referrerId: 70 };
const globalOn = (selection: { kind: 'company'; companyId: number } | { kind: 'unassigned' } | null): AdminIdentity => ({
  role: 'global_admin', adminUserId: 3, email: 'g@x', selection,
});

describe('resolveCompanyCondition：開著加上 byService', () => {
  it('單位管理者：本單位、看服務關係', () => {
    expect(resolveCompanyCondition(manager, SR_A)).toEqual({ ok: true, condition: { kind: 'company', companyId: 7, byService: true } });
  });

  it('推薦人：標注給自己的', () => {
    expect(resolveCompanyCondition(referrer, SR_A)).toEqual({ ok: true, condition: { kind: 'referrer', referrerId: 70, byService: true } });
  });

  it('全域管理員選了單位／選了直屬：照選擇、看服務關係；沒選照舊擋下', () => {
    expect(resolveCompanyCondition(globalOn({ kind: 'company', companyId: 9 }), SR_A))
      .toEqual({ ok: true, condition: { kind: 'company', companyId: 9, byService: true } });
    expect(resolveCompanyCondition(globalOn({ kind: 'unassigned' }), SR_A))
      .toEqual({ ok: true, condition: { kind: 'unassigned', byService: true } });
    expect(resolveCompanyCondition(globalOn(null), SR_A)).toEqual({ ok: false, reason: 'NO_COMPANY_SELECTED' });
  });

  it('A 沒開合作公司（單一機構）時，全域管理員固定直屬、也看服務關係', () => {
    expect(resolveCompanyCondition(globalOn({ kind: 'company', companyId: 9 }), { multiCompany: false, serviceRelations: true }))
      .toEqual({ ok: true, condition: { kind: 'unassigned', byService: true } });
  });

  it.each([manager, referrer, globalOn({ kind: 'company', companyId: 9 }), globalOn({ kind: 'unassigned' })])(
    '關著：條件一字不差（沒有 byService）',
    identity => {
      const r = resolveCompanyCondition(identity, OFF_A);
      expect(r.ok && 'byService' in r.condition).toBe(false);
      expect(resolveCompanyCondition(identity, { ...OFF_A, serviceRelations: false })).toEqual(r);
    },
  );
});

describe('companyWhereSql：byService', () => {
  it('單位：服務關係在本單位', () => {
    expect(companyWhereSql({ kind: 'company', companyId: 7, byService: true })).toEqual({
      sql: 'EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id AND sr.company_id = ?)',
      params: [7],
    });
  });

  it('推薦人：服務關係標注給他', () => {
    expect(companyWhereSql({ kind: 'referrer', referrerId: 70, byService: true })).toEqual({
      sql: 'EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id AND sr.referrer_id = ?)',
      params: [70],
    });
  });

  it('直屬：沒有服務關係', () => {
    expect(companyWhereSql({ kind: 'unassigned', byService: true })).toEqual({
      sql: 'NOT EXISTS (SELECT 1 FROM service_relations sr WHERE sr.user_id = u.id)',
      params: [],
    });
  });

  it('不是以 users u 為主的查詢（專家、本單位設定）：照舊看那一欄', () => {
    expect(companyWhereSql({ kind: 'company', companyId: 7, byService: true }, 's.company_id')).toEqual({ sql: 's.company_id = ?', params: [7] });
    expect(companyWhereSql({ kind: 'company', companyId: 7, byService: true }, 'c.id')).toEqual({ sql: 'c.id = ?', params: [7] });
    expect(companyWhereSql({ kind: 'unassigned', byService: true }, 's.company_id')).toEqual({ sql: 's.company_id IS NULL', params: [] });
    expect(companyWhereSql({ kind: 'referrer', referrerId: 70, byService: true }, 's.company_id')).toEqual({ sql: '1 = 0', params: [] });
  });

  it('關著（沒有 byService）：與原本一字不差', () => {
    expect(companyWhereSql({ kind: 'company', companyId: 7 })).toEqual({ sql: 'u.company_id = ?', params: [7] });
    expect(companyWhereSql({ kind: 'unassigned' })).toEqual({ sql: 'u.company_id IS NULL', params: [] });
    expect(companyWhereSql({ kind: 'referrer', referrerId: 70 }).sql).toContain('referrer_bindings');
  });

  it('永遠非空', () => {
    const all: CompanyCondition[] = [
      { kind: 'company', companyId: 1, byService: true },
      { kind: 'unassigned', byService: true },
      { kind: 'referrer', referrerId: 1, byService: true },
    ];
    for (const c of all) for (const col of ['u.company_id', 's.company_id', 'c.id']) expect(companyWhereSql(c, col).sql).not.toBe('');
  });
});

describe('matchesCompanyCondition：記憶體版與 SQL 同一句話', () => {
  // 一位家長：篩查渠道（帳號歸屬）是單位 5、推薦綁定是 50，服務關係是單位 7／推薦人 70。
  const moved = { companyId: 5, referrerId: 50, service: { companyId: 7, referrerId: 70 } };
  const unassignedInUnit = { companyId: 7, referrerId: null, service: { companyId: 7, referrerId: null } };
  const direct = { companyId: null, referrerId: null, service: null };
  const legacyRow = { companyId: 7, referrerId: 70 };

  it('單位管理者：看服務關係，不看篩查渠道', () => {
    const c: CompanyCondition = { kind: 'company', companyId: 7, byService: true };
    expect(matchesCompanyCondition(c, moved)).toBe(true);
    expect(matchesCompanyCondition(c, unassignedInUnit)).toBe(true);
    expect(matchesCompanyCondition({ kind: 'company', companyId: 5, byService: true }, moved)).toBe(false);
    expect(matchesCompanyCondition(c, direct)).toBe(false);
  });

  it('推薦人：看服務關係，不看推薦綁定；還沒標注的看不到', () => {
    const c: CompanyCondition = { kind: 'referrer', referrerId: 70, byService: true };
    expect(matchesCompanyCondition(c, moved)).toBe(true);
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 50, byService: true }, moved)).toBe(false);
    expect(matchesCompanyCondition(c, unassignedInUnit)).toBe(false);
  });

  it('直屬：沒有服務關係的才算', () => {
    const c: CompanyCondition = { kind: 'unassigned', byService: true };
    expect(matchesCompanyCondition(c, direct)).toBe(true);
    expect(matchesCompanyCondition(c, { ...moved })).toBe(false);
    expect(matchesCompanyCondition(c, { companyId: null, referrerId: null, service: { companyId: 7, referrerId: null } })).toBe(false);
  });

  it('列沒帶服務關係（舊的替身）：開著一律當作沒有服務關係，不放寬', () => {
    expect(matchesCompanyCondition({ kind: 'company', companyId: 7, byService: true }, legacyRow)).toBe(false);
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 70, byService: true }, legacyRow)).toBe(false);
  });

  it('關著：照舊看歸屬與綁定', () => {
    expect(matchesCompanyCondition({ kind: 'company', companyId: 5 }, moved)).toBe(true);
    expect(matchesCompanyCondition({ kind: 'referrer', referrerId: 50 }, moved)).toBe(true);
    expect(matchesCompanyCondition({ kind: 'unassigned' }, direct)).toBe(true);
  });
});

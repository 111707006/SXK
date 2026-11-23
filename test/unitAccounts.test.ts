import { describe, it, expect } from 'vitest';
import type { AdminUser } from '../src/admin/adminApi';
import { groupAdminUsers, unitAccountRoleLabel } from '../src/admin/unitAccounts';

/** 合併後的「合作单位」分頁（VITE_ADMIN_UNITS_MERGED）：後台帳號分到各單位底下。 */
const user = (id: number, role: AdminUser['role'], companyId: number | null = null, active = true): AdminUser => ({
  id,
  email: `u${id}@a`,
  role,
  companyId,
  active,
});

const UNITS = [7, 8, 9];

describe('groupAdminUsers', () => {
  it('單位管理者照 companyId 掛到那個單位', () => {
    const g = groupAdminUsers([user(1, 'company_member', 7), user(2, 'company_member', 8), user(3, 'company_member', 7)], [], UNITS);
    expect(g.byUnit[7].map(u => u.id)).toEqual([1, 3]);
    expect(g.byUnit[8].map(u => u.id)).toEqual([2]);
    expect(g.byUnit[9]).toBeUndefined();
    expect(g.globalAdmins).toEqual([]);
    expect(g.unattached).toEqual([]);
  });

  it('全域管理員一律歸「全域管理员」，就算帶著 companyId', () => {
    const g = groupAdminUsers([user(1, 'global_admin'), user(2, 'global_admin', 7)], [], UNITS);
    expect(g.globalAdmins.map(u => u.id)).toEqual([1, 2]);
    expect(g.byUnit).toEqual({});
  });

  it('推薦人看 referrers 的單位（admin_users.company_id 是 null）', () => {
    const g = groupAdminUsers([user(5, 'referrer')], [{ adminUserId: 5, companyId: 8 }], UNITS);
    expect(g.byUnit[8].map(u => u.id)).toEqual([5]);
    expect(g.unattached).toEqual([]);
  });

  it('沒掛單位的推薦人、查不到推薦人那一列的、單位不在清單上的：都進「未挂单位的帐号」', () => {
    const g = groupAdminUsers(
      [user(5, 'referrer'), user(6, 'referrer'), user(7, 'company_member', 99), user(8, 'company_member', null)],
      [{ adminUserId: 5, companyId: null }],
      UNITS,
    );
    expect(g.unattached.map(u => u.id)).toEqual([5, 6, 7, 8]);
    expect(g.byUnit).toEqual({});
  });

  it('三種混在一起各歸各的，停用的帳號照樣列出', () => {
    const g = groupAdminUsers(
      [user(1, 'global_admin'), user(2, 'company_member', 9, false), user(3, 'referrer'), user(4, 'referrer')],
      [{ adminUserId: 3, companyId: 9 }, { adminUserId: 4, companyId: null }],
      UNITS,
    );
    expect(g.globalAdmins.map(u => u.id)).toEqual([1]);
    expect(g.byUnit[9].map(u => u.id)).toEqual([2, 3]);
    expect(g.unattached.map(u => u.id)).toEqual([4]);
  });
});

describe('unitAccountRoleLabel', () => {
  it('单位管理者／推荐人／個人治療師那一位兩個都寫', () => {
    expect(unitAccountRoleLabel(user(1, 'company_member', 7), [])).toBe('单位管理者');
    expect(unitAccountRoleLabel(user(2, 'referrer'), [{ adminUserId: 2, companyId: 7 }])).toBe('推荐人');
    expect(unitAccountRoleLabel(user(3, 'company_member', 7), [{ adminUserId: 3, companyId: 7 }])).toBe('单位管理者（兼推荐人）');
    expect(unitAccountRoleLabel(user(4, 'global_admin'), [])).toBe('全域管理员');
  });
});

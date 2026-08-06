import { describe, it, expect } from 'vitest';
import {
  companyWhereSql,
  matchesCompanyCondition,
  resolveCompanyCondition,
  type AdminIdentity,
  type CompanyCondition,
} from '../src/admin/companyScope';

/**
 * 公司條件的純函式測試。
 *
 * 資料層在 HTTP 測試裡是替身，真實查詢裡漏一個公司條件驗不到 —— 而那正是本功能
 * 最大的風險。因此條件必須由一個純函式產生，並在這裡把「它永遠產得出條件」
 * 釘成斷言。寫法參照 `test/access.test.ts`：不確定的時候一律當作未授權。
 */

const memberA: AdminIdentity = { role: 'company_member', adminUserId: 1, email: 'a@x', companyId: 7 };
const globalUnselected: AdminIdentity = { role: 'global_admin', adminUserId: 2, email: 'g@x', selection: null };
const globalOnB: AdminIdentity = {
  role: 'global_admin', adminUserId: 2, email: 'g@x', selection: { kind: 'company', companyId: 9 },
};
const globalOnUnassigned: AdminIdentity = {
  role: 'global_admin', adminUserId: 2, email: 'g@x', selection: { kind: 'unassigned' },
};

describe('從身分產生公司條件', () => {
  it('公司成員一律綁自己的公司', () => {
    expect(resolveCompanyCondition(memberA)).toEqual({
      ok: true,
      condition: { kind: 'company', companyId: 7 },
    });
  });

  // 若「看得到所有公司」是預設狀態，誤看永遠不會被發現。
  it('全域管理員未選定公司時取不到任何條件', () => {
    expect(resolveCompanyCondition(globalUnselected)).toEqual({
      ok: false,
      reason: 'NO_COMPANY_SELECTED',
    });
  });

  it('全域管理員選定公司後，條件與該公司的成員完全相同', () => {
    const asAdmin = resolveCompanyCondition(globalOnB);
    const asMember = resolveCompanyCondition({
      role: 'company_member', adminUserId: 3, email: 'm@x', companyId: 9,
    });
    expect(asAdmin).toEqual(asMember);
  });

  it('全域管理員可以明確選定「未歸屬」視野', () => {
    expect(resolveCompanyCondition(globalOnUnassigned)).toEqual({
      ok: true,
      condition: { kind: 'unassigned' },
    });
  });
});

describe('條件翻成 SQL 片段', () => {
  /**
   * 這一條是整組測試的重點：**沒有任何輸入能讓它產出空條件。**
   * 空字串會讓 `WHERE ${sql}` 變成語法錯誤或（更糟）被某個「有條件才加」的
   * 判斷跳過，而那正是跨公司外洩的形狀。
   */
  it.each([
    ['指定公司', { kind: 'company', companyId: 1 } as CompanyCondition],
    ['公司 id 為 0', { kind: 'company', companyId: 0 } as CompanyCondition],
    ['未歸屬', { kind: 'unassigned' } as CompanyCondition],
  ])('%s 都產出非空的 SQL 片段', (_label, condition) => {
    const { sql } = companyWhereSql(condition);
    expect(sql.trim()).not.toBe('');
    expect(sql).toContain('company_id');
  });

  it('指定公司用參數化比較，不把 id 接進 SQL 字串', () => {
    expect(companyWhereSql({ kind: 'company', companyId: 42 })).toEqual({
      sql: 'u.company_id = ?',
      params: [42],
    });
  });

  // `= NULL` 在 SQL 裡永遠不成立，會安靜地回零筆 —— 看起來像「這家公司沒有家長」。
  it('未歸屬用 IS NULL，不是 = NULL', () => {
    const { sql, params } = companyWhereSql({ kind: 'unassigned' });
    expect(sql).toBe('u.company_id IS NULL');
    expect(sql).not.toContain('= ?');
    expect(params).toEqual([]);
  });

  it('可指定欄位前綴，供 specialists / companies 等表使用', () => {
    expect(companyWhereSql({ kind: 'company', companyId: 5 }, 's.company_id').sql)
      .toBe('s.company_id = ?');
  });
});

describe('條件的記憶體版本與 SQL 版本說的是同一件事', () => {
  it('指定公司只收該公司的列', () => {
    const cond: CompanyCondition = { kind: 'company', companyId: 7 };
    expect(matchesCompanyCondition(cond, { companyId: 7 })).toBe(true);
    expect(matchesCompanyCondition(cond, { companyId: 8 })).toBe(false);
    expect(matchesCompanyCondition(cond, { companyId: null })).toBe(false);
  });

  it('未歸屬只收 company_id 為 null 的列', () => {
    const cond: CompanyCondition = { kind: 'unassigned' };
    expect(matchesCompanyCondition(cond, { companyId: null })).toBe(true);
    expect(matchesCompanyCondition(cond, { companyId: 1 })).toBe(false);
  });
});

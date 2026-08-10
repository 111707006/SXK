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
 * 公司條件的純函式測試。
 *
 * 資料層在 HTTP 測試裡是替身，真實查詢裡漏一個公司條件驗不到 —— 而那正是本功能
 * 最大的風險。因此條件必須由一個純函式產生，並在這裡把「它永遠產得出條件」
 * 釘成斷言。寫法參照 `test/access.test.ts`：不確定的時候一律當作未授權。
 */

/** 專案 B：多合作公司，視野由選擇決定。 */
const MULTI: AdminCenterShape = { multiCompany: true };
/** 專案 A：沒有合作公司，家長全部未歸屬。 */
const SINGLE: AdminCenterShape = { multiCompany: false };

const memberA: AdminIdentity = { role: 'company_member', adminUserId: 1, email: 'a@x', companyId: 7 };
const globalUnselected: AdminIdentity = { role: 'global_admin', adminUserId: 2, email: 'g@x', selection: null };
const globalOnB: AdminIdentity = {
  role: 'global_admin', adminUserId: 2, email: 'g@x', selection: { kind: 'company', companyId: 9 },
};
const globalOnUnassigned: AdminIdentity = {
  role: 'global_admin', adminUserId: 2, email: 'g@x', selection: { kind: 'unassigned' },
};

describe('從身分產生公司條件（多合作公司，專案 B）', () => {
  it('公司成員一律綁自己的公司', () => {
    expect(resolveCompanyCondition(memberA, MULTI)).toEqual({
      ok: true,
      condition: { kind: 'company', companyId: 7 },
    });
  });

  // 若「看得到所有公司」是預設狀態，誤看永遠不會被發現。
  it('全域管理員未選定公司時取不到任何條件', () => {
    expect(resolveCompanyCondition(globalUnselected, MULTI)).toEqual({
      ok: false,
      reason: 'NO_COMPANY_SELECTED',
    });
  });

  it('全域管理員選定公司後，條件與該公司的成員完全相同', () => {
    const asAdmin = resolveCompanyCondition(globalOnB, MULTI);
    const asMember = resolveCompanyCondition(
      { role: 'company_member', adminUserId: 3, email: 'm@x', companyId: 9 },
      MULTI
    );
    expect(asAdmin).toEqual(asMember);
  });

  it('全域管理員可以明確選定「未歸屬」視野', () => {
    expect(resolveCompanyCondition(globalOnUnassigned, MULTI)).toEqual({
      ok: true,
      condition: { kind: 'unassigned' },
    });
  });
});

/**
 * 單一機構模式（專案 A，issue #19）。
 *
 * 專案 A 沒有合作公司，它的家長全部沒有歸屬 —— 「未歸屬」在語意上剛好就是
 * 「森心康直屬」。因此視野**固定**在未歸屬，全域管理員不必先選一家不存在的公司。
 *
 * 這裡刻意不新增第三種 `CompanyCondition`：`unassigned` 本來就是合法的值，
 * 「條件永遠非空、沒有『全部公司』」這兩個型別層的不變量一個字都不用改。
 */
describe('從身分產生公司條件（單一機構，專案 A）', () => {
  it('全域管理員未選定公司也拿得到條件，而且是未歸屬', () => {
    expect(resolveCompanyCondition(globalUnselected, SINGLE)).toEqual({
      ok: true,
      condition: { kind: 'unassigned' },
    });
  });

  /**
   * **固定**的意思是連舊 token 帶進來的選擇也不算數。
   *
   * 專案 A 的切換路由根本不掛載，但一顆在切換路由還在時簽出來的 token 仍然
   * 帶得動 `selection`。照著它走的話，一個早已不存在的公司視野會在專案 A 上
   * 復活 —— 而畫面上只是一個空列表，看不出任何異狀。
   */
  it('token 裡殘留的公司選擇不算數，一律仍是未歸屬', () => {
    expect(resolveCompanyCondition(globalOnB, SINGLE)).toEqual({
      ok: true,
      condition: { kind: 'unassigned' },
    });
  });

  // 專案 A 建不出合作公司，因此也不該有公司成員。萬一資料庫裡真有一個，
  // 他的視野仍以他的公司為準 —— 往「未歸屬」放大會讓他看到森心康直屬的家長。
  it('公司成員仍綁自己的公司，不被放大到未歸屬', () => {
    expect(resolveCompanyCondition(memberA, SINGLE)).toEqual({
      ok: true,
      condition: { kind: 'company', companyId: 7 },
    });
  });

  it('任何身分都取得到條件，沒有「請先選定公司」這個狀態', () => {
    for (const identity of [memberA, globalUnselected, globalOnB, globalOnUnassigned]) {
      expect(resolveCompanyCondition(identity, SINGLE).ok, identity.role).toBe(true);
    }
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

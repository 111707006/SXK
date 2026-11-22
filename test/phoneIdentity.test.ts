import { describe, it, expect } from 'vitest';
import { pickPhoneAccount } from '../src/phoneIdentity';

/**
 * 身分開關（`A_PHONE_IDENTITY`，#115，ADR-0020 第 1 點）：同一支手機號在資料庫裡已經有好幾個帳號
 * （重複尚未合併，例如正式站的 #9／#13）時，登入哪一個。規則固定：有報告或訂單的那一個先；
 * 都有或都沒有時取最早建的（id 最小）。與資料庫回來的順序無關。
 */
const row = (id: number, extra: Partial<{ company_id: number | null; has_reports: number; has_orders: number }> = {}) => ({
  id,
  phone: '13800138000',
  company_id: null,
  has_reports: 0,
  has_orders: 0,
  ...extra,
});

describe('pickPhoneAccount', () => {
  it('沒有帳號回 null', () => {
    expect(pickPhoneAccount([])).toBeNull();
  });

  it('只有一個就是那一個', () => {
    expect(pickPhoneAccount([row(5, { company_id: 7 })])?.id).toBe(5);
  });

  it('有報告的那一個勝過較早建、卻空空的那一個', () => {
    expect(pickPhoneAccount([row(9), row(13, { company_id: 7, has_reports: 1 })])?.id).toBe(13);
  });

  it('有訂單的那一個也算', () => {
    expect(pickPhoneAccount([row(13, { company_id: 7 }), row(20, { has_orders: 1 })])?.id).toBe(20);
  });

  it('兩個都有資料、或都沒有：取 id 最小的，不看資料庫回來的順序', () => {
    expect(pickPhoneAccount([row(13, { has_reports: 1 }), row(9, { has_orders: 1 })])?.id).toBe(9);
    expect(pickPhoneAccount([row(13), row(9)])?.id).toBe(9);
  });

  it('資料庫回字串（COUNT／EXISTS 的 0／1 有時是字串）照樣認得', () => {
    expect(pickPhoneAccount([row(9), { ...row(13), has_reports: '1' as any }])?.id).toBe(13);
    expect(pickPhoneAccount([{ ...row(9), has_orders: '0' as any }, row(13)])?.id).toBe(9);
  });
});

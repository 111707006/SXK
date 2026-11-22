import { describe, it, expect } from 'vitest';
import { resolveServiceRelationsSwitch, SERVICE_RELATIONS_ENV } from '../src/serviceRelations/switch';

/**
 * 服務關係開關（#118，ADR-0020）：只在專案 A、預設關、只收 `1`/`true`/`0`/`false`；
 * 要同時開身分開關（#115）與 `A_COMPANIES`，否則起不來；專案 B 設了不生效（啟動印一行）。
 */

const A_READY = { projectA: true, aCompanies: true, identityByPhone: true };

describe('值', () => {
  it('環境變數名', () => {
    expect(SERVICE_RELATIONS_ENV).toBe('SERVICE_RELATIONS');
  });

  it.each([undefined, '', '0', 'false'])('%j：關', raw => {
    expect(resolveServiceRelationsSwitch(raw, A_READY)).toEqual({ enabled: false, notice: null });
  });

  it.each(['1', 'true'])('%j：開', raw => {
    expect(resolveServiceRelationsSwitch(raw, A_READY)).toEqual({ enabled: true, notice: null });
  });

  it.each(['yes', 'on', 'TRUE', '2', ' 1'])('%j：認不得，起不來', raw => {
    expect(() => resolveServiceRelationsSwitch(raw, A_READY)).toThrow(/SERVICE_RELATIONS/);
  });

  it('認不得的值在 B 也起不來（不因為是 B 就放過打錯字）', () => {
    expect(() => resolveServiceRelationsSwitch('yes', { ...A_READY, projectA: false })).toThrow(/SERVICE_RELATIONS/);
  });
});

describe('專案 A：缺搭配的開關起不來', () => {
  it('沒開 A_COMPANIES', () => {
    expect(() => resolveServiceRelationsSwitch('1', { ...A_READY, aCompanies: false })).toThrow(/A_COMPANIES/);
  });

  it('沒開身分開關', () => {
    expect(() => resolveServiceRelationsSwitch('1', { ...A_READY, identityByPhone: false })).toThrow(/身分開關/);
  });

  it('兩個都沒開：訊息兩個都點名', () => {
    let message = '';
    try {
      resolveServiceRelationsSwitch('1', { projectA: true, aCompanies: false, identityByPhone: false });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/A_COMPANIES/);
    expect(message).toMatch(/身分開關/);
  });

  it('關著的時候不看搭配的開關', () => {
    expect(resolveServiceRelationsSwitch('0', { projectA: true, aCompanies: false, identityByPhone: false }))
      .toEqual({ enabled: false, notice: null });
  });
});

describe('專案 B：設了不生效', () => {
  it('開著：不生效，回一行啟動訊息（搭配的開關不看）', () => {
    const r = resolveServiceRelationsSwitch('1', { projectA: false, aCompanies: false, identityByPhone: false });
    expect(r.enabled).toBe(false);
    expect(r.notice).toMatch(/SERVICE_RELATIONS/);
    expect(r.notice).toMatch(/不生效/);
  });

  it('關著：沒有訊息', () => {
    expect(resolveServiceRelationsSwitch(undefined, { projectA: false, aCompanies: false, identityByPhone: false }))
      .toEqual({ enabled: false, notice: null });
  });
});

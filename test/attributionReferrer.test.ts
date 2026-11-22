import { describe, it, expect, beforeEach } from 'vitest';
import { captureCompanySlug, peekCompanySlug, peekReferrerCode } from '../src/utils/attribution';

/**
 * 推薦人個人連結 `?c=<單位>&t=<推薦人>`（#118）：前端把推薦人代號跟單位代號一起記下來，登入時一起送。
 * 與單位代號同一條規則：第一次進站那一組才算（已經記過就不覆寫，`t` 也不單獨換）；格式不對就不記。
 */

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('推薦人代號跟著單位代號記', () => {
  it('?c=jia&t=zhang：兩個都記', () => {
    expect(captureCompanySlug('?c=jia&t=zhang')).toBe('jia');
    expect(peekCompanySlug()).toBe('jia');
    expect(peekReferrerCode()).toBe('zhang');
  });

  it('大小寫與空白照單位代號的規則收斂', () => {
    captureCompanySlug('?c=Jia&t=%20Zhang%20');
    expect(peekReferrerCode()).toBe('zhang');
  });

  it('只有 ?c=：沒有推薦人代號', () => {
    captureCompanySlug('?c=jia');
    expect(peekReferrerCode()).toBeNull();
  });

  it('格式不對的 t：不記（單位照記）', () => {
    captureCompanySlug('?c=jia&t=../x');
    expect(peekCompanySlug()).toBe('jia');
    expect(peekReferrerCode()).toBeNull();
  });

  it('只有 t、沒有 c：都不記', () => {
    expect(captureCompanySlug('?t=zhang')).toBeNull();
    expect(peekReferrerCode()).toBeNull();
  });

  it('已經記過一組：之後的連結整組都不覆寫', () => {
    captureCompanySlug('?c=jia&t=zhang');
    captureCompanySlug('?c=yi&t=wang');
    expect(peekCompanySlug()).toBe('jia');
    expect(peekReferrerCode()).toBe('zhang');
    captureCompanySlug('?c=jia&t=li');
    expect(peekReferrerCode()).toBe('zhang');
  });

  it('localStorage 不能用：不丟例外、讀回 null', () => {
    (globalThis as any).localStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(() => captureCompanySlug('?c=jia&t=zhang')).not.toThrow();
    expect(peekReferrerCode()).toBeNull();
  });
});

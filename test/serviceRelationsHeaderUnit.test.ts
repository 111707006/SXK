import { describe, it, expect } from 'vitest';
import { headerUnitLookup } from '../src/serviceRelations/headerUnit';

/**
 * 頁首徽章與客服二維碼看哪一個單位（#121）。要抓的錯：開關開著還看帳號歸屬（改派之後頁首不換）、
 * 開關關著卻看了服務關係、登入了還被連結上的 `?c=` 蓋過、沒登入時 `?c=` 不再生效。
 */
describe('headerUnitLookup', () => {
  it('服務關係開著、已登入：看服務關係（連結上的 ?c= 不算）', () => {
    expect(headerUnitLookup({ serviceRelations: true, userId: 5, slug: 'jia' })).toEqual({ kind: 'service_relation', userId: 5 });
    expect(headerUnitLookup({ serviceRelations: true, userId: 5, slug: null })).toEqual({ kind: 'service_relation', userId: 5 });
  });

  it('服務關係關著、已登入：照舊看帳號歸屬', () => {
    expect(headerUnitLookup({ serviceRelations: false, userId: 5, slug: 'jia' })).toEqual({ kind: 'account', userId: 5 });
  });

  it('沒登入：不管開關，照舊看 ?c=；沒有 ?c= 就沒有單位', () => {
    for (const serviceRelations of [true, false]) {
      expect(headerUnitLookup({ serviceRelations, userId: null, slug: 'jia' })).toEqual({ kind: 'slug', slug: 'jia' });
      expect(headerUnitLookup({ serviceRelations, userId: null, slug: null })).toEqual({ kind: 'none' });
    }
  });
});

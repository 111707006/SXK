import { describe, it, expect, beforeEach } from 'vitest';
import {
  declineServiceSwitch,
  offerServiceSwitch,
  pendingServiceSwitch,
  subscribeServiceSwitch,
  clearServiceSwitch,
  shouldCheckVisitLink,
} from '../src/serviceRelations/promptStore';
import { captureVisitLink, peekVisitLink } from '../src/utils/attribution';
import { SERVICE_SWITCH_COPY } from '../src/serviceRelations/parentCopy';

/** 換人提示的前端狀態（#120）：選「不換」之後本次登入內不再追問同一來源；這次進站的連結。 */

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
beforeEach(() => {
  (globalThis as any).sessionStorage = mem();
  (globalThis as any).localStorage = mem();
  clearServiceSwitch();
});

const ZHANG = { currentName: '王老师', toName: '张老师', source: { kind: 'link' as const, companySlug: 'jia', referrerCode: 'zhang' } };
const CODE = { currentName: '王老师', toName: '张老师', source: { kind: 'code' as const, codeId: 501 } };

describe('提示的狀態', () => {
  it('收到就掛著、通知訂閱的畫面', () => {
    let calls = 0;
    const off = subscribeServiceSwitch(() => calls++);
    offerServiceSwitch(ZHANG);
    expect(pendingServiceSwitch()).toEqual(ZHANG);
    expect(calls).toBe(1);
    off();
  });

  it('選「不換」：關掉，本次登入內同一個來源不再追問；別的來源照樣問', () => {
    offerServiceSwitch(ZHANG);
    declineServiceSwitch();
    expect(pendingServiceSwitch()).toBeNull();
    offerServiceSwitch(ZHANG);
    expect(pendingServiceSwitch()).toBeNull();
    offerServiceSwitch(CODE);
    expect(pendingServiceSwitch()).toEqual(CODE);
  });

  it('sessionStorage 不能用：照樣運作（只是不記「不換」）', () => {
    (globalThis as any).sessionStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(() => {
      offerServiceSwitch(ZHANG);
      declineServiceSwitch();
    }).not.toThrow();
  });
});

describe('這次進站的連結', () => {
  it('每次進站有 ?c= 就覆寫（與歸屬的「第一次那一家」分開記）', () => {
    captureVisitLink('?c=jia&t=zhang');
    expect(peekVisitLink()).toEqual({ companySlug: 'jia', referrerCode: 'zhang' });
    captureVisitLink('?c=yi');
    expect(peekVisitLink()).toEqual({ companySlug: 'yi', referrerCode: null });
    captureVisitLink('');
    expect(peekVisitLink()).toEqual({ companySlug: 'yi', referrerCode: null });
  });

  it('格式不對的單位代號不記', () => {
    captureVisitLink('?c=../x');
    expect(peekVisitLink()).toBeNull();
  });

  it('已登入時同一條連結只打一次 /link', () => {
    captureVisitLink('?c=jia&t=zhang');
    expect(shouldCheckVisitLink()).toBe(true);
    expect(shouldCheckVisitLink()).toBe(false);
    captureVisitLink('?c=yi');
    expect(shouldCheckVisitLink()).toBe(true);
  });
});

describe('提示的字', () => {
  it('問句與兩個按鈕', () => {
    expect(SERVICE_SWITCH_COPY.question('王老师', '张老师')).toBe('你目前由 王老师 服务，要换成 张老师 吗？');
    expect(SERVICE_SWITCH_COPY.switchTo('张老师')).toBe('换成 张老师');
    expect(SERVICE_SWITCH_COPY.keep).toBe('不换');
  });
});

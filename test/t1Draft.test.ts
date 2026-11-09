import { describe, expect, it } from 'vitest';
import { DRAFT_MAX_AGE_DAYS, T1_DRAFT_KEY, childDraftKey, clearT1Draft, loadT1Draft, saveT1Draft } from '../src/utils/t1Draft';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

const child = { name: '小测', birthDate: '2023-05-15', ageMonth: 41 };
const ids = ['q1', 'q2', 'q3'];
const now = new Date('2026-11-10T08:00:00Z');

describe('T1 作答草稿', () => {
  it('存了再讀回來，接著做', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 2, q2: 0 } }, now, s);
    expect(loadT1Draft(child, ids, now, s)?.answers).toEqual({ q1: 2, q2: 0 });
  });

  it('換了孩子不用', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 2 } }, now, s);
    expect(loadT1Draft({ ...child, name: '小安' }, ids, now, s)).toBeNull();
    expect(loadT1Draft({ ...child, birthDate: '2023-06-01' }, ids, now, s)).toBeNull();
  });

  it('過期不用', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 2 } }, now, s);
    const later = new Date(now.getTime() + (DRAFT_MAX_AGE_DAYS + 1) * 86_400_000);
    expect(loadT1Draft(child, ids, later, s)).toBeNull();
  });

  it('只留這一次題目裡有的題號、合法的值；一題都對不上當沒有', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 1, old: 2, q2: 7 } }, now, s);
    expect(loadT1Draft(child, ids, now, s)?.answers).toEqual({ q1: 1 });
    saveT1Draft({ childKey: childDraftKey(child), answers: { old: 2 } }, now, s);
    expect(loadT1Draft(child, ids, now, s)).toBeNull();
  });

  it('題目沒答完不會停在补充资料', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 1 }, atSupplement: true }, now, s);
    expect(loadT1Draft(child, ids, now, s)?.atSupplement).toBeUndefined();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 1, q2: 1, q3: 1 }, atSupplement: true }, now, s);
    expect(loadT1Draft(child, ids, now, s)?.atSupplement).toBe(true);
  });

  it('壞掉的 JSON、讀寫丟例外都當沒有草稿', () => {
    const s = memoryStorage();
    s.raw.set(T1_DRAFT_KEY, '{oops');
    expect(loadT1Draft(child, ids, now, s)).toBeNull();
    const throwing = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadT1Draft(child, ids, now, throwing)).toBeNull();
    expect(() => saveT1Draft({ childKey: 'k', answers: {} }, now, throwing)).not.toThrow();
    expect(() => clearT1Draft(throwing)).not.toThrow();
  });

  it('清掉就讀不到', () => {
    const s = memoryStorage();
    saveT1Draft({ childKey: childDraftKey(child), answers: { q1: 2 } }, now, s);
    clearT1Draft(s);
    expect(loadT1Draft(child, ids, now, s)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { mergeStaleSave, revisionOf } from '../src/utils/syncMerge';

/**
 * `/api/db/save` 遇到舊分頁時怎麼合（2026-11-17 code review 第 1 項）。
 * 要抓的錯：別處新做的報告被舊分頁蓋掉、後台刪掉的報告被舊分頁寫回來、舊分頁新做的那一份被丟掉。
 */
const rec = (id: string) => ({ id, type: 'T1_SCREENING' });
const score = (completedAt: string) => ({ tierId: 'T1', dimensionId: 'language', completedAt });

describe('mergeStaleSave', () => {
  it('伺服器上別處新做的報告留著；舊分頁自己新做的也收', () => {
    const out = mergeStaleSave(
      { child: { name: '舊' }, completedScores: [], orders: [], reportHistory: [rec('a'), rec('phone-new')] },
      { child: { name: '新' }, completedScores: [], orders: [], reportHistory: [rec('a'), rec('tab-new')] },
      ['a'],
    );
    expect(out.reportHistory.map((r: any) => r.id)).toEqual(['a', 'phone-new', 'tab-new']);
    expect(out.child).toEqual({ name: '新' });
  });

  it('舊分頁當初讀到、之後在伺服器被刪掉的報告不寫回去', () => {
    const out = mergeStaleSave(
      { child: null, completedScores: [], orders: [], reportHistory: [rec('keep')] },
      { child: null, completedScores: [], orders: [], reportHistory: [rec('keep'), rec('deleted')] },
      ['keep', 'deleted'],
    );
    expect(out.reportHistory.map((r: any) => r.id)).toEqual(['keep']);
  });

  it('成績用比較晚的那一份；一樣晚用伺服器的', () => {
    const older = [score('2026-11-01T00:00:00.000Z')];
    const newer = [score('2026-11-10T00:00:00.000Z')];
    const base = { child: null, orders: [], reportHistory: [] };
    expect(mergeStaleSave({ ...base, completedScores: newer }, { ...base, completedScores: older }, []).completedScores).toBe(newer);
    expect(mergeStaleSave({ ...base, completedScores: older }, { ...base, completedScores: newer }, []).completedScores).toBe(newer);
    expect(mergeStaleSave({ ...base, completedScores: older }, { ...base, completedScores: [...older] }, []).completedScores).toBe(older);
  });

  it('訂單：伺服器的全留，加上送來的新 id；送來的孩子資料是空的就留伺服器的', () => {
    const out = mergeStaleSave(
      { child: { name: '英英' }, completedScores: [], orders: [{ id: 'o1' }], reportHistory: [] },
      { child: null, completedScores: [], orders: [{ id: 'o1' }, { id: 'o2' }], reportHistory: [] },
      [],
    );
    expect(out.orders).toEqual([{ id: 'o1' }, { id: 'o2' }]);
    expect(out.child).toEqual({ name: '英英' });
  });
});

describe('revisionOf', () => {
  it('Date 與字串都讀成毫秒；沒有或讀不成回 null', () => {
    const d = new Date('2026-11-17T01:02:03.000Z');
    expect(revisionOf({ updated_at: d })).toBe(d.getTime());
    expect(revisionOf({ updated_at: '2026-11-17T01:02:03.000Z' })).toBe(d.getTime());
    expect(revisionOf(null)).toBeNull();
    expect(revisionOf({ updated_at: 'nope' })).toBeNull();
  });
});

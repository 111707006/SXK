import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DRAFT_MAX_AGE_MS, clearDraft, draftKey, loadDraft, ownerOf, saveDraft, type DraftStorage } from '../src/t2/draftV3';

/** 完整版作答的草稿：關掉頁面回來接著答；交卷清掉；過期、壞掉、儲存不能用都當沒有。 */

function memory(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k) };
}
const broken: DraftStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};
const T = 1_800_000_000_000;

describe('草稿', () => {
  it('存了讀得回來；不同帳號、不同問卷各自一筆', () => {
    const s = memory();
    saveDraft('a', 'SXK-GM', { rater: 'mother', answers: { 'G1.1': 2 } }, T, s);
    expect(loadDraft('a', 'SXK-GM', T + 1000, s)).toEqual({ rater: 'mother', answers: { 'G1.1': 2 }, savedAt: T });
    expect(loadDraft('b', 'SXK-GM', T, s)).toBeNull();
    expect(loadDraft('a', 'SXK-AB', T, s)).toBeNull();
  });

  it('年級照存（學障兩支）', () => {
    const s = memory();
    saveDraft('a', 'SXK-LDP', { rater: null, grade: 3, answers: { x: 1 } }, T, s);
    expect(loadDraft('a', 'SXK-LDP', T, s)?.grade).toBe(3);
  });

  it('7 天以上不用、順手清掉；什麼都沒答不存', () => {
    const s = memory();
    saveDraft('a', 'SXK-GM', { rater: 'mother', answers: {} }, T, s);
    expect(loadDraft('a', 'SXK-GM', T + DRAFT_MAX_AGE_MS + 1, s)).toBeNull();
    expect(s.map.size).toBe(0);
    saveDraft('a', 'SXK-GM', { rater: null, answers: {} }, T, s);
    expect(s.map.size).toBe(0);
  });

  it('壞掉的內容當沒有；clearDraft 清掉', () => {
    const s = memory();
    s.setItem(draftKey('a', 'SXK-GM'), '{not json');
    expect(loadDraft('a', 'SXK-GM', T, s)).toBeNull();
    saveDraft('a', 'SXK-GM', { rater: 'father', answers: { k: 0 } }, T, s);
    clearDraft('a', 'SXK-GM', s);
    expect(loadDraft('a', 'SXK-GM', T, s)).toBeNull();
  });

  it('儲存不能用（無痕、塞滿）：不丟例外，當沒有草稿', () => {
    expect(() => saveDraft('a', 'SXK-GM', { rater: 'mother', answers: { k: 1 } }, T, broken)).not.toThrow();
    expect(loadDraft('a', 'SXK-GM', T, broken)).toBeNull();
    expect(() => clearDraft('a', 'SXK-GM', broken)).not.toThrow();
  });

  it('鍵裡不放手機號', () => {
    expect(draftKey(ownerOf('13800000001'), 'SXK-GM')).not.toContain('13800000001');
    expect(ownerOf('13800000001')).toBe(ownerOf('13800000001'));
  });

  it('作答畫面：打開時讀草稿、改動時存、交卷成功才清', () => {
    const v3 = fs.readFileSync(path.join(__dirname, '../src/components/T2AssessmentV3.tsx'), 'utf8');
    expect(v3).toMatch(/loadDraft\(owner, tool\.code\)/);
    expect(v3).toMatch(/saveDraft\(owner, selected\.code/);
    const clearAt = v3.indexOf('clearDraft(owner, selected.code)');
    expect(clearAt).toBeGreaterThan(v3.indexOf("typeof body.id !== 'number'"));
  });
});

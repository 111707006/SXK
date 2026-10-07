import { describe, it, expect } from 'vitest';
import { formV3, isNa, keepAnswersFor, missingV3, setNa, GRADE_LABELS } from '../src/t2/answeringV3';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems } from '../src/t2/kitv3/score';

/**
 * 完整版的作答表單（`src/t2/answeringV3.ts`）：表單的題就是伺服器驗卷的那一份；學前段名、整段略過、年級。
 */

describe('formV3', () => {
  it('24 支：表單上的題就是 askedItems（伺服器驗卷的那一份），順序相同', () => {
    for (const [code, bank] of Object.entries(KITV3_BANKS)) {
      const age = code === 'SXK-LDS' ? 160 : code === 'SXK-SP' ? 36 : bank.forms[0].minM ?? 36;
      const ctx = { ageM: Math.max(age, 12), inSchool: true };
      const f = formV3(bank, ctx);
      const grade = f.grade ? { grade: f.grade.value } : {};
      expect(f.sections.flatMap(s => s.items.map(i => i.key)), code).toEqual(askedItems(bank, { ...ctx, ...grade }).map(a => a.item.key));
      expect(f.sections.every(s => s.items.length > 0 && s.options.length > 0), code).toBe(true);
    }
  });

  it('ATT 未滿 72 月：課堂、作業換學前名稱，可以整段勾「无法观察」', () => {
    const f = formV3(KITV3_BANKS['SXK-ATT'], { ageM: 60 });
    expect(f.sections[0]).toMatchObject({ key: 'CL', name: '集体活动情境（幼儿园）', naLabel: '这个情境无法观察' });
    expect(formV3(KITV3_BANKS['SXK-ATT'], { ageM: 80 }).sections[0].name).toBe('课堂情境');
  });

  it('學障：年級預設由月齡推、可改；換年級只留新年級也有的題', () => {
    const bank = KITV3_BANKS['SXK-LDP'];
    const g1 = formV3(bank, { ageM: 75 });
    expect(g1.grade).toEqual({ value: 1, range: [1, 12] });
    const g3 = formV3(bank, { ageM: 75, grade: 3 });
    expect(g3.sections.flatMap(s => s.items)).toHaveLength(69);
    const answers = Object.fromEntries(g3.sections.flatMap(s => s.items.map(i => [i.key, 0])));
    // 3 年級的 69 題換回 1 年級：只留 1 年級也出的 39 題（截止在 4／5 年級的那 4 題兩個年級都出）
    expect(Object.keys(keepAnswersFor(g1, answers))).toHaveLength(39);
    expect(GRADE_LABELS[7]).toBe('初一');
  });

  it('TIC 每題帶 6 個錨點；LQ 的選項組有「不确定」（null）', () => {
    const tic = formV3(KITV3_BANKS['SXK-TIC'], { ageM: 96 });
    expect(tic.sections[0].items[0].anchors).toHaveLength(6);
    const lq = formV3(KITV3_BANKS['SXK-LQ'], { ageM: 30 });
    expect(lq.sections[0].options.some(o => o.value === null)).toBe(true);
  });
});

describe('作答狀態', () => {
  const bank = KITV3_BANKS['SXK-ATT'];
  const ctx = { ageM: 96 };
  const form = formV3(bank, ctx);
  const cl = form.sections.find(s => s.key === 'CL')!;

  it('勾「无法观察」清掉那一段已答的、那一段不再缺；取消就回來', () => {
    const some = { [cl.items[0].key]: 2 };
    const on = setNa(some, cl, true);
    expect(isNa(on, 'CL')).toBe(true);
    expect(on[cl.items[0].key]).toBeUndefined();
    expect(missingV3(bank, ctx, on).some(k => k.startsWith('CL.'))).toBe(false);
    const off = setNa(on, cl, false);
    expect(isNa(off, 'CL')).toBe(false);
    expect(missingV3(bank, ctx, off).filter(k => k.startsWith('CL.'))).toHaveLength(cl.items.length);
  });

  it('答滿就不缺；null 也算答了（有那一項的段）', () => {
    const lq = KITV3_BANKS['SXK-LQ'];
    const f = formV3(lq, { ageM: 30 });
    const all = Object.fromEntries(f.sections.filter(s => !s.optional).flatMap(s => s.items.map(i => [i.key, s.options.at(-1)!.value])));
    expect(missingV3(lq, { ageM: 30 }, all)).toEqual([]);
  });
});

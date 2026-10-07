import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor } from '../src/t2/kitv3/score';
import { readV3Submission, scoreToolV3, type V3Submission } from '../src/t2/kitv3/submit';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';

/**
 * 完整版題庫的交卷（`src/t2/kitv3/submit.ts`）：讀 body、窗口、多題、值域、缺答、年級、整段略過。
 */

const NOW = new Date('2026-10-07T08:00:00Z');

/** 這次出的每一題都答那一段選項組的第一個值。 */
function fullAnswers(toolId: string, ageM: number, ctx: { grade?: number } = {}): Record<string, number | null> {
  const bank = KITV3_BANKS[toolId];
  const form = formFor(bank, ageM);
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM, ...ctx })) {
    const sec = form.sections.find(s => s.key === a.section)!;
    out[a.item.key] = bank.options[sec.options][0].value;
  }
  return out;
}

const sub = (toolId: string, ageM: number, answers = fullAnswers(toolId, ageM), extra: Partial<V3Submission> = {}): V3Submission => ({
  toolId,
  assessedAgeMonth: ageM,
  rater: 'mother',
  answers,
  ...extra,
});

describe('readV3Submission', () => {
  const ok = { toolId: 'SXK-GM', assessedAgeMonth: 30, rater: 'mother', answers: { a: 1, b: null } };

  it('合法的 body 讀得出來；null 是合法的答案', () => {
    expect(readV3Submission(ok)).toEqual({ ok: true, value: { ...ok } });
  });

  it.each([
    ['不是物件', [], 'BODY_INVALID'],
    ['工具不認得（舊的小寫 id）', { ...ok, toolId: 'sxk-gm' }, 'TOOL_UNKNOWN'],
    ['月齡不是整數', { ...ok, assessedAgeMonth: 30.5 }, 'AGE_INVALID'],
    ['填表人不對', { ...ok, rater: 'P' }, 'RATER_INVALID'],
    ['年級不是整數', { ...ok, grade: '三年级' }, 'GRADE_INVALID'],
    ['答案是字串', { ...ok, answers: { a: '1' } }, 'ANSWERS_INVALID'],
    ['答案不是物件', { ...ok, answers: [1] }, 'ANSWERS_INVALID'],
  ])('%s → %s', (_, body, code) => {
    const r = readV3Submission(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.code).toBe(code);
  });
});

describe('scoreToolV3', () => {
  it('每一支在客規窗口裡的每一個月都挑得到表、出得了題（窗口與題庫對得上）', () => {
    for (const [code, bank] of Object.entries(KITV3_BANKS)) {
      const { minM, maxM } = RECOMMEND_CONFIG.tools[code];
      for (let m = minM; m <= maxM; m++) {
        expect(() => formFor(bank, m), `${code} ${m}`).not.toThrow();
        expect(askedItems(bank, { ageM: m }).length, `${code} ${m}`).toBeGreaterThan(0);
      }
    }
  });

  it('每一支都交得過：答滿就算得出來、存的形狀齊全', () => {
    for (const code of Object.keys(KITV3_BANKS)) {
      const { minM, maxM } = RECOMMEND_CONFIG.tools[code];
      const age = Math.max(minM, Math.min(maxM, Math.round((minM + maxM) / 2)));
      const r = scoreToolV3(sub(code, age), { sex: 'female', inSchool: true }, NOW);
      expect(r.ok, code).toBe(true);
      if (r.ok) {
        expect(r.result).toMatchObject({ toolkitVersion: 'kit-20260923', toolId: code, assessedAgeMonth: age, rater: 'mother', computedAt: NOW.toISOString() });
        expect(r.result.score.code).toBe(code);
      }
    }
  });

  it('客規窗口外 → AGE_OUT_OF_WINDOW（頁面只警告的也擋）', () => {
    const r = scoreToolV3(sub('SXK-SP', 60, {}), {}, NOW);
    expect(r).toMatchObject({ ok: false, body: { code: 'AGE_OUT_OF_WINDOW', windowMonths: { lo: 24, hi: 59 } } });
  });

  it('沒出的題 → ANSWERS_UNEXPECTED', () => {
    const r = scoreToolV3(sub('SXK-GM', 30, { ...fullAnswers('SXK-GM', 30), 'nope.1': 1 }), {}, NOW);
    expect(r).toMatchObject({ ok: false, body: { code: 'ANSWERS_UNEXPECTED', unexpected: ['nope.1'] } });
  });

  it('值不在那一段的選項組 → ANSWERS_INVALID；有「不确定」的段才收 null', () => {
    const gm = fullAnswers('SXK-GM', 30);
    const k = Object.keys(gm)[0];
    expect(scoreToolV3(sub('SXK-GM', 30, { ...gm, [k]: null }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'ANSWERS_INVALID' } });
    expect(scoreToolV3(sub('SXK-GM', 30, { ...gm, [k]: 7 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'ANSWERS_INVALID' } });
    const lq = fullAnswers('SXK-LQ', 30);
    const lqMain = Object.keys(lq).find(x => x.startsWith('l1'))!;
    expect(scoreToolV3(sub('SXK-LQ', 30, { ...lq, [lqMain]: null }), {}, NOW).ok).toBe(true);
  });

  it('缺答 → INCOMPLETE，列出缺的題', () => {
    const gm = fullAnswers('SXK-GM', 30);
    const [first, ...rest] = Object.keys(gm);
    const r = scoreToolV3(sub('SXK-GM', 30, Object.fromEntries(rest.map(k => [k, gm[k]]))), {}, NOW);
    expect(r).toMatchObject({ ok: false, body: { code: 'INCOMPLETE', missing: [first] } });
  });

  it('ATT 勾了「无法观察」：那一段的題不能再送；.na 只收 0／1', () => {
    const att = fullAnswers('SXK-ATT', 96);
    const noCl = Object.fromEntries(Object.entries(att).filter(([k]) => !k.startsWith('CL.')));
    expect(scoreToolV3(sub('SXK-ATT', 96, { ...noCl, 'CL.na': 1 }), {}, NOW).ok).toBe(true);
    expect(scoreToolV3(sub('SXK-ATT', 96, { ...att, 'CL.na': 1 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'ANSWERS_UNEXPECTED' } });
    expect(scoreToolV3(sub('SXK-ATT', 96, { ...att, 'CL.na': 2 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'ANSWERS_INVALID' } });
    expect(scoreToolV3(sub('SXK-ATT', 96, { ...att, 'HM.na': 1 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'ANSWERS_UNEXPECTED' } });
  });

  it('年級：只有學障兩支收、要在範圍裡；改了年級就照那個年級出題', () => {
    expect(scoreToolV3(sub('SXK-GM', 30, fullAnswers('SXK-GM', 30), { grade: 1 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'GRADE_INVALID' } });
    expect(scoreToolV3(sub('SXK-LDS', 150, {}, { grade: 6 }), {}, NOW)).toMatchObject({ ok: false, body: { code: 'GRADE_INVALID' } });
    const r = scoreToolV3(sub('SXK-LDS', 150, fullAnswers('SXK-LDS', 150, { grade: 10 }), { grade: 10 }), {}, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.result.context.grade, Object.keys(r.result.answers).length]).toEqual([10, 84]);
  });

  it('情境存進結果：QOL 沒上學少一段、氣質帶性別', () => {
    const qol = scoreToolV3(sub('SXK-QOL', 36, fullAnswers('SXK-QOL', 36)), { inSchool: false }, NOW);
    expect(qol).toMatchObject({ ok: false, body: { code: 'ANSWERS_UNEXPECTED' } });
    const t = scoreToolV3(sub('ITQ/TTS/BSQ', 6), { sex: 'male' }, NOW);
    expect(t.ok && t.result.context).toEqual({ ageM: 6, sex: 'male' });
  });
});

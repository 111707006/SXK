import { describe, it, expect } from 'vitest';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue, ScoreRefusal } from '../src/t2/scoring';
import { readToolSubmission, refusalToHttp, toolBands } from '../src/t2/toolResults';
import { RATERS } from '../src/t2/types';
import type { ToolId, ToolResult } from '../src/t2/types';

/**
 * 交卷的純函式（#57）：讀 body、把拒算翻成 HTTP、算一支工具對它餵的維度的 band。
 *
 * 【這裡在防什麼】
 * 1. body 的每個欄位都要驗，而且**不猜**：`toolId` 不認得、`rater` 不是五種之一、月齡不是整數，
 *    一律 400。安靜地當成 `other`／0 個月，存進去的是一筆對不上任何人的紀錄。
 * 2. 拒算翻成 HTTP 時**缺題數要在訊息裡**（票的驗收）：家長端要能說「還有 N 題」。
 * 3. `toolBands` 只回這支工具餵的維度；不出 band 的工具（chexi）餵的那一格是 `null`，不是缺鍵 ——
 *    「做了、沒有判定」與「不餵這個維度」對加測提示是兩件事。
 */

function full(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, computedAt: '2026-09-12T00:00:00.000Z' });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

const GOOD = { toolId: 'sxk-lang', assessedAgeMonth: 48, rater: 'mother', pre: {}, answers: full('sxk-lang', 48, 2) };

describe('readToolSubmission', () => {
  it('完整的 body → ok，欄位原樣進 ScoreInput', () => {
    const parsed = readToolSubmission(GOOD);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.toolId).toBe('sxk-lang');
    expect(parsed.value.assessedAgeMonth).toBe(48);
    expect(parsed.value.rater).toBe('mother');
    expect(parsed.value.pre).toEqual({});
    expect(parsed.value.answers).toEqual(GOOD.answers);
  });

  it('pre 沒帶 → 空物件（前置題不是每支都有）', () => {
    const parsed = readToolSubmission({ ...GOOD, pre: undefined });
    expect(parsed.ok && parsed.value.pre).toEqual({});
  });

  it('pre 的值收字串、字串陣列、布林；其餘丟掉的話會讓 regression 判斷失真，所以整筆 400', () => {
    const okOne = readToolSubmission({ ...GOOD, pre: { regression: 'none', impact: ['school', 'home'], concern: true } });
    expect(okOne.ok).toBe(true);
    const bad = readToolSubmission({ ...GOOD, pre: { regression: 3 } });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.body.code).toBe('PRE_INVALID');
  });

  it.each([
    ['body 不是物件', null, 'BODY_INVALID'],
    ['toolId 不認得', { ...GOOD, toolId: 'sxk-nope' }, 'TOOL_UNKNOWN'],
    ['toolId 缺', { ...GOOD, toolId: undefined }, 'TOOL_UNKNOWN'],
    ['月齡不是整數', { ...GOOD, assessedAgeMonth: 48.5 }, 'AGE_INVALID'],
    ['月齡是負數', { ...GOOD, assessedAgeMonth: -1 }, 'AGE_INVALID'],
    ['月齡是字串', { ...GOOD, assessedAgeMonth: '48' }, 'AGE_INVALID'],
    ['rater 是治療師', { ...GOOD, rater: 'therapist' }, 'RATER_INVALID'],
    ['rater 缺', { ...GOOD, rater: undefined }, 'RATER_INVALID'],
    ['answers 不是物件', { ...GOOD, answers: [1, 2] }, 'ANSWERS_INVALID'],
    ['answers 缺', { ...GOOD, answers: undefined }, 'ANSWERS_INVALID'],
    ['answers 的值不是數字或字串', { ...GOOD, answers: { 'P1.1': true } }, 'ANSWERS_INVALID'],
    ['pre 不是物件', { ...GOOD, pre: 'none' }, 'PRE_INVALID'],
  ])('%s → 400 %s', (_label, body, code) => {
    const parsed = readToolSubmission(body);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.body.code).toBe(code);
  });

  it('五種填表人都收', () => {
    for (const rater of RATERS) {
      expect(readToolSubmission({ ...GOOD, rater }).ok).toBe(true);
    }
  });
});

describe('refusalToHttp', () => {
  it('缺答：訊息含缺題數，code 是 INCOMPLETE', () => {
    const refusal: ScoreRefusal = { ok: false, reason: 'incomplete', toolId: 'sxk-lang', askedCount: 49, answeredCount: 46, missing: ['P1.1', 'P1.2', 'P1.3'] };
    const http = refusalToHttp(refusal);
    expect(http.status).toBe(400);
    expect(http.body.code).toBe('INCOMPLETE');
    expect(http.body.error).toContain('3');
    expect(http.body.missing).toEqual(['P1.1', 'P1.2', 'P1.3']);
  });

  it('窗口外：400 AGE_OUT_OF_WINDOW，帶窗口', () => {
    const http = refusalToHttp({ ok: false, reason: 'age_out_of_window', toolId: 'sxk-lang', assessedAgeMonth: 80, windowMonths: { lo: 12, hi: 72 } });
    expect(http.status).toBe(400);
    expect(http.body.code).toBe('AGE_OUT_OF_WINDOW');
    expect(http.body.windowMonths).toEqual({ lo: 12, hi: 72 });
  });

  it('其餘三種也都是 400，各自的 code', () => {
    expect(refusalToHttp({ ok: false, reason: 'no_items_at_age', toolId: 'sxk-warn', assessedAgeMonth: 84, windowMonths: { lo: 3, hi: 84 } }).body.code).toBe('AGE_OUT_OF_WINDOW');
    expect(refusalToHttp({ ok: false, reason: 'unexpected_answer', toolId: 'sxk-lang', unexpected: ['P9.9'] }).body.code).toBe('ANSWERS_UNEXPECTED');
    expect(refusalToHttp({ ok: false, reason: 'invalid_answer', toolId: 'sxk-lang', invalid: [{ key: 'P1.1', value: 9 }] }).body.code).toBe('ANSWERS_INVALID');
  });
});

describe('toolBands', () => {
  it('sxk-lang 達成率 72 → { LANG: watch }', () => {
    // 49 題滿分 98：raw 71 → 72%
    const answers = full('sxk-lang', 48, 2);
    const keys = Object.keys(answers);
    for (let i = 0; i < 27; i += 1) answers[keys[i]] = 1;
    const r = score('sxk-lang', 48, answers);
    expect(r.overall.pct).toBe(72);
    expect(toolBands(r)).toEqual({ LANG: 'watch' });
  });

  it('chexi 不出 band：餵的 ATT 是 null，不是沒有鍵', () => {
    const r = score('chexi', 48, full('chexi', 48, 5));
    expect(toolBands(r)).toEqual({ ATT: null });
    expect('ATT' in toolBands(r)).toBe(true);
  });

  it('多維度工具（sxk-asq）每個餵的維度各一格，不餵的維度沒有鍵', () => {
    const r = score('sxk-asq', 36, full('sxk-asq', 36, 2));
    const bands = toolBands(r);
    expect(Object.keys(bands).sort()).toEqual(['COG', 'LANG', 'MOT', 'SOC']);
    expect(bands).not.toHaveProperty('ATT');
  });
});

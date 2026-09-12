import { describe, it, expect } from 'vitest';
import { RATER_OPTIONS, TRAD_TO_SIMP, asrItemNotes, canSubmit, completedAt, followupHints, displayItemText, displayPrompt, exclusiveChecked, formFor, missingCount, toSimplified, togglePreMulti } from '../src/t2/answering';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { planT2 } from '../src/t2/routing';
import type { Band, DimensionCode } from '../src/t2/types';
import { findBannedWords } from '../src/utils/parentWording';

/**
 * 家長端逐支作答的純函式層（票 #58，規格 v2 §5.1、§3.1、§4.6）。
 * 畫面沒有 jsdom 看不到；出題、缺答、前置題互斥、簡體轉換、加測提示都抽到這裡測。
 */

const itemCount = (toolId: Parameters<typeof formFor>[0], age: number) =>
  formFor(toolId, age).sections.reduce((n, s) => n + s.items.length, 0);

describe('formFor：這個月齡出哪些題', () => {
  it('24 個月開 sxk-lang → 23 題；60 個月 → 60 題（票的驗收）', () => {
    expect(itemCount('sxk-lang', 24)).toBe(23);
    expect(itemCount('sxk-lang', 60)).toBe(60);
  });

  it('dev 在 30 個月 → 只有 25–36 段的 30 題，六個領域各 5 題', () => {
    const form = formFor('sxk-dev', 30);
    expect(form.sections).toHaveLength(6);
    for (const s of form.sections) expect(s.items).toHaveLength(5);
    // 題 key 帶年齡段前綴，與伺服器驗收卷的 key 一致
    expect(form.sections[0].items[0].key).toBe('25-36.MOT.1');
  });

  it('沒有適用題目的面向不出現在表單上（6 個月的 sxk-gm 只有 P1、P2 有題）', () => {
    const form = formFor('sxk-gm', 6);
    expect(form.sections.map(s => s.key)).toEqual(['P1', 'P2']);
    for (const s of form.sections) expect(s.items.length).toBeGreaterThan(0);
  });

  it('前置題照題庫原文，asb 的倒退題在題目之前', () => {
    const form = formFor('sxk-asb', 48);
    expect(form.preQuestions).toHaveLength(1);
    expect(form.preQuestions[0].key).toBe('regression');
    expect(form.preQuestions[0].prompt).toBe(TOOLKIT['sxk-asb'].preQuestions[0].prompt);
  });
});

describe('缺答不能交卷', () => {
  it('missingCount 數的是這次出的題裡沒答的；全答是 0', () => {
    const form = formFor('sxk-lang', 24);
    const answers: Record<string, number> = {};
    expect(missingCount(form, answers)).toBe(23);
    for (const s of form.sections) for (const it of s.items) answers[it.key] = 2;
    delete answers[form.sections[0].items[0].key];
    expect(missingCount(form, answers)).toBe(1);
    answers[form.sections[0].items[0].key] = 0;
    expect(missingCount(form, answers)).toBe(0);
  });

  it('答了這次沒出的題不抵缺答', () => {
    const form = formFor('sxk-lang', 24);
    expect(missingCount(form, { 'RC.16': 2 })).toBe(23);
  });

  it('canSubmit：題目、填表人、前置題三者都齊才能交', () => {
    const form = formFor('sxk-asb', 48);
    const answers: Record<string, number> = {};
    for (const s of form.sections) for (const it of s.items) answers[it.key] = 0;
    expect(canSubmit(form, { rater: null, pre: {}, answers })).toBe(false);
    expect(canSubmit(form, { rater: 'mother', pre: {}, answers })).toBe(false);
    expect(canSubmit(form, { rater: 'mother', pre: { regression: 'none' }, answers })).toBe(true);
    delete answers['SE.1'];
    expect(canSubmit(form, { rater: 'mother', pre: { regression: 'none' }, answers })).toBe(false);
  });

  it('複選的前置題要至少勾一項；沒有前置題的工具只看填表人與題目', () => {
    const ab = formFor('sxk-ab', 48);
    const answers: Record<string, number> = {};
    for (const s of ab.sections) for (const it of s.items) answers[it.key] = 0;
    expect(canSubmit(ab, { rater: 'father', pre: { settings: [] }, answers })).toBe(false);
    expect(canSubmit(ab, { rater: 'father', pre: { settings: ['home'] }, answers })).toBe(true);

    const gm = formFor('sxk-gm', 48);
    const gmAnswers: Record<string, number> = {};
    for (const s of gm.sections) for (const it of s.items) gmAnswers[it.key] = 2;
    expect(canSubmit(gm, { rater: 'other', pre: {}, answers: gmAnswers })).toBe(true);
  });
});

describe('前置題複選的互斥（§5.1：spa 的「無」與其餘互斥）', () => {
  const impact = TOOLKIT['sxk-spa'].preQuestions[0];

  it('勾「無」後其餘全部清掉；再勾其餘時「無」被清掉', () => {
    expect(togglePreMulti(impact, ['adl', 'play'], 'none')).toEqual(['none']);
    expect(togglePreMulti(impact, ['none'], 'adl')).toEqual(['adl']);
  });

  it('沒有互斥的選項照一般勾選／取消', () => {
    expect(togglePreMulti(impact, ['adl'], 'play')).toEqual(['adl', 'play']);
    expect(togglePreMulti(impact, ['adl', 'play'], 'adl')).toEqual(['play']);
  });

  it('isExclusiveChecked：勾了「無」時其餘選項要停用', () => {
    expect(exclusiveChecked(impact, ['none'])).toBe(true);
    expect(exclusiveChecked(impact, ['adl'])).toBe(false);
    expect(exclusiveChecked(impact, [])).toBe(false);
  });
});

describe('M-CHAT 題目以簡體顯示，題庫常數仍為繁體（§4.6 本票的取捨）', () => {
  /** 題庫原文裡確實出現的繁體字，抽樣十個；畫面上一個都不能剩。 */
  const TRADITIONAL_SAMPLE = ['嬰', '兒', '會', '嗎', '這', '個', '沒', '對', '說', '聽'];

  it('題庫常數是繁體（不動）', () => {
    const raw = TOOLKIT['mchat-rf'].sections[0].items.map(i => i.text).join('');
    expect(TRADITIONAL_SAMPLE.filter(c => raw.includes(c)).length).toBeGreaterThan(5);
  });

  it('formFor 出來的每一題 displayText 是簡體，且與原文不同', () => {
    const form = formFor('mchat-rf', 24);
    expect(form.sections[0].items).toHaveLength(20);
    const shown = form.sections[0].items.map(it => displayItemText(form.toolId, it.item)).join('');
    for (const c of TRADITIONAL_SAMPLE) expect(shown, c).not.toContain(c);
    for (const it of form.sections[0].items) {
      expect(displayItemText(form.toolId, it.item)).not.toBe(it.item.text);
    }
    // 抽一題對照
    expect(displayItemText('mchat-rf', form.sections[0].items[1].item)).toBe('你有没有想过你的子女可能是聋的？');
  });

  it('前置題問法也轉簡體', () => {
    const q = TOOLKIT['mchat-rf'].preQuestions[0];
    expect(displayPrompt('mchat-rf', q.prompt)).toBe('医护人员或家长是否对儿童患上自闭症谱系障碍有担心？');
  });

  it('其他工具原樣顯示（本來就是簡體）', () => {
    const it0 = TOOLKIT['sxk-lang'].sections[0].items[0];
    expect(displayItemText('sxk-lang', it0)).toBe(it0.text);
  });

  it('轉換表覆蓋 M-CHAT 全部題目與前置題：轉完沒有任何一個表上的繁體字殘留', () => {
    const bank = TOOLKIT['mchat-rf'];
    const all = [...bank.sections[0].items.map(i => i.text), bank.preQuestions[0].prompt];
    for (const text of all) {
      const shown = toSimplified(text);
      for (const trad of Object.keys(TRAD_TO_SIMP)) expect(shown, `${trad} in ${text}`).not.toContain(trad);
    }
  });
});

describe('SXK-ASR 給家長填的配套（§4.6）', () => {
  it('每題帶四條錨點全文，索引即選項值', () => {
    const form = formFor('sxk-asr', 48);
    for (const s of form.sections) for (const it of s.items) {
      expect(it.item.anchors).toHaveLength(4);
    }
    expect(form.options.map(o => o.value)).toEqual([0, 1, 2, 3]);
  });

  it('第 4 項（SC.4 语言沟通）有「仿说」「功能性语言」的白話註解；第 15 項（GN.3 整体印象）有同齡比較的提示', () => {
    const n4 = asrItemNotes('SC', 4);
    expect(n4.join('')).toContain('仿说');
    expect(n4.join('')).toContain('功能性语言');
    const n15 = asrItemNotes('GN', 3);
    expect(n15).toHaveLength(1);
    expect(n15[0]).toContain('幼儿园');
    expect(n15[0]).toContain('亲戚');
    expect(asrItemNotes('SC', 1)).toEqual([]);
  });

  it('註解對得上題庫：SC.4 是「语言沟通」、GN.3 是「整体印象」', () => {
    const bank = TOOLKIT['sxk-asr'];
    expect(bank.sections.find(s => s.key === 'SC')!.items[3].text).toBe('语言沟通');
    expect(bank.sections.find(s => s.key === 'GN')!.items[2].text).toBe('整体印象');
  });
});

describe('SXK-ADL 七級定義', () => {
  it('七個選項每一個都有定義全文，畫面要整句顯示', () => {
    const form = formFor('sxk-adl', 48);
    expect(form.options).toHaveLength(7);
    for (const o of form.options) expect(o.definition, String(o.value)).toBeTruthy();
  });
});

describe('加測提示：星號做完、該維度 band 是 watch 或 refer 才推（§4.2）', () => {
  const flags = { COG: 0, LANG: 2, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0 } as const;
  const plan = planT2(flags, 40);
  const entry = (toolId: ToolId, band: Band | null, createdAt = '2026-09-12T10:00:00.000Z') => ({
    id: 1,
    createdAt,
    toolId,
    bands: { LANG: band } as Partial<Record<DimensionCode, Band | null>>,
  });

  it('40 個月 LANG 紅：星號 sxk-lang，加測 voc 與 asq', () => {
    expect(plan.required.map(i => i.toolId)).toEqual(['sxk-lang']);
    expect(plan.followup.map(i => i.toolId).sort()).toEqual(['sxk-asq', 'sxk-voc']);
  });

  it('星號還沒做 → 沒有提示', () => {
    expect(followupHints(plan, [])).toEqual({});
  });

  it('星號判 watch → 該維度的每支加測都寫「再花约 N 题可以更精确」，N 是那支的題數', () => {
    const hints = followupHints(plan, [entry('sxk-lang', 'watch')]);
    const voc = plan.followup.find(i => i.toolId === 'sxk-voc')!;
    expect(hints['sxk-voc']).toBe(`再花约 ${voc.askedCount} 题可以更精确`);
    expect(hints['sxk-asq']).toBeDefined();
    expect(findBannedWords(hints['sxk-voc']!)).toEqual([]);
  });

  it('refer 也推；clear 不推', () => {
    expect(Object.keys(followupHints(plan, [entry('sxk-lang', 'refer')])).sort()).toEqual(['sxk-asq', 'sxk-voc']);
    expect(followupHints(plan, [entry('sxk-lang', 'clear')])).toEqual({});
  });

  it('做的是別支、或那支對這個維度沒有 band → 不推', () => {
    expect(followupHints(plan, [entry('sxk-voc', 'refer')])).toEqual({});
    expect(followupHints(plan, [entry('sxk-lang', null)])).toEqual({});
  });
});

describe('已完成的標示', () => {
  it('completedAt：每支最新一筆的日期；沒做的沒有鍵', () => {
    const done = completedAt([
      { id: 1, createdAt: '2026-09-10T10:00:00.000Z', toolId: 'sxk-lang', bands: {} },
    ]);
    expect(done['sxk-lang']).toBe('2026-09-10T10:00:00.000Z');
    expect(done['sxk-voc']).toBeUndefined();
  });
});

describe('填表人', () => {
  it('五種，沒有治療師；標籤沒有禁字', () => {
    expect(RATER_OPTIONS.map(o => o.value)).toEqual(['father', 'mother', 'caregiver', 'teacher', 'other']);
    for (const o of RATER_OPTIONS) {
      expect(o.label).not.toContain('治疗');
      expect(findBannedWords(o.label)).toEqual([]);
    }
  });
});

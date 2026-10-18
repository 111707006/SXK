import { describe, it, expect } from 'vitest';
import { RATER_OPTIONS } from '../src/t2/answering';
import { raterLabel, raterOptions, raterPayload } from '../src/t2/raterV2';
import { reviewGroups } from '../src/t2/reportCopy';
import { reviewGroupsV3 } from '../src/t2/reportCopyV3';
import { askedItems, scoreTool } from '../src/t2/scoring';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems as askedV3, formFor } from '../src/t2/kitv3/score';
import { scoreToolV3, type ToolResultV3 } from '../src/t2/kitv3/submit';
import type { Rater, ToolResult } from '../src/t2/types';

/**
 * T2 填表人 v2（#70，規格 client-changes-2026-10-17 §6）的畫面那一半：選項、報告作答回顧那一行。
 * 交卷的規則在 `t2RaterV2.http.test.ts`。
 */

describe('作答畫面的選項', () => {
  it('開關關著：五種照舊，順序與字一字不差', () => {
    const old = [
      { value: 'father', label: '父亲' },
      { value: 'mother', label: '母亲' },
      { value: 'caregiver', label: '主要照顾者' },
      { value: 'teacher', label: '老师' },
      { value: 'other', label: '其他' },
    ];
    expect(raterOptions(false)).toEqual(old);
    expect(RATER_OPTIONS).toEqual(old);
  });

  it('開關開著：沒有「老师」', () => {
    expect(raterOptions(true).map(o => o.label)).toEqual(['父亲', '母亲', '主要照顾者', '其他']);
  });
});

describe('raterPayload（交卷 body 裡填表人那一段）', () => {
  it('開關關著：只有 rater，與以前一字不差', () => {
    expect(raterPayload(false, 'other', '阿姨')).toEqual({ rater: 'other' });
  });
  it('開關開著：其他＋說明才帶 raterNote（去頭尾空白）；空白或別的填表人不帶', () => {
    expect(raterPayload(true, 'other', ' 阿姨 ')).toEqual({ rater: 'other', raterNote: '阿姨' });
    expect(raterPayload(true, 'other', '  ')).toEqual({ rater: 'other' });
    expect(raterPayload(true, 'mother', '阿姨')).toEqual({ rater: 'mother' });
  });
});

describe('raterLabel', () => {
  it('其他＋說明 →「其他（阿姨）」；沒說明 →「其他」；舊的老师照原樣；別的說明不出', () => {
    expect(raterLabel('other', '阿姨')).toBe('其他（阿姨）');
    expect(raterLabel('other')).toBe('其他');
    expect(raterLabel('teacher')).toBe('老师');
    expect(raterLabel('mother', '阿姨')).toBe('母亲');
    expect(raterLabel('nurse')).toBeNull();
  });
});

function legacy(rater: Rater, raterNote?: string): ToolResult {
  const answers: Record<string, number> = {};
  for (const a of askedItems('sxk-lang', 48)) answers[a.key] = 0; // 全部「还不会」→ 每題都列進回顧
  const out = scoreTool({ toolId: 'sxk-lang', assessedAgeMonth: 48, rater, ...(raterNote ? { raterNote } : {}), pre: {}, answers });
  if (!out.ok) throw new Error(out.reason);
  return out.result;
}

function v3(rater: Rater, raterNote?: string): ToolResultV3 {
  const bank = KITV3_BANKS['SXK-GM'];
  const form = formFor(bank, 24);
  const answers: Record<string, number | null> = {};
  for (const a of askedV3(bank, { ageM: 24 })) {
    const values = bank.options[form.sections.find(s => s.key === a.section)!.options].map(o => o.value);
    answers[a.item.key] = [...values].reverse().find(v => v !== null)!; // 最差那一檔
  }
  const out = scoreToolV3({ toolId: 'SXK-GM', assessedAgeMonth: 24, rater, ...(raterNote ? { raterNote } : {}), answers }, {});
  if (!out.ok) throw new Error(out.body.error);
  return out.result;
}

describe('作答回顧：每支那一行的填表人', () => {
  it('9/08 題庫：快照帶 raterV2 才寫「填表人：其他（阿姨）」；舊的老师寫「填表人：老师」', () => {
    const groups = reviewGroups({ toolResults: [legacy('other', '阿姨')], raterV2: true });
    expect(groups.map(g => g.raterLine)).toEqual(['填表人：其他（阿姨）']);
    expect(reviewGroups({ toolResults: [legacy('teacher')], raterV2: true })[0].raterLine).toBe('填表人：老师');
  });

  it('9/08 題庫：快照沒有 raterV2 → 回顧一字不差（沒有填表人這一欄）', () => {
    const groups = reviewGroups({ toolResults: [legacy('teacher')] });
    expect(groups).toHaveLength(1);
    expect('raterLine' in groups[0]).toBe(false);
  });

  it('完整版：同上', () => {
    const banks = { 'SXK-GM': KITV3_BANKS['SXK-GM'] };
    expect(reviewGroupsV3({ toolResults: [v3('other', '阿姨')], raterV2: true }, banks).map(g => g.raterLine)).toEqual(['填表人：其他（阿姨）']);
    expect(reviewGroupsV3({ toolResults: [v3('teacher')], raterV2: true }, banks)[0].raterLine).toBe('填表人：老师');
    const off = reviewGroupsV3({ toolResults: [v3('teacher')] }, banks);
    expect(off).toHaveLength(1);
    expect('raterLine' in off[0]).toBe(false);
  });
});

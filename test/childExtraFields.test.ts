import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChildExtraFields, { extrasOf, toggleDiagnosis } from '../src/components/ChildExtraFields';
import { DX_OPTIONS } from '../src/t2/recommend/childFieldsCopy';
import { buildRecommendInput } from '../src/t2/recommend/input';
import type { Child } from '../src/types';

/**
 * 孩子資料的「补充资料」（T2 v3 推薦規格 §2.1，R1b）。
 * - 診斷最多兩個、第一個為主：滿兩個再點，換掉的是第二個。
 * - 兩張表單（建檔、編輯檔案）存檔時先攤開既有檔案 —— 原本只送四個欄位，補充資料填了也存不住。
 * - 只在專案 A 出現（`PRODUCT.features.tier2And3`），B 的表單不動。
 * - T1 交卷時存逐題作答（推薦的關鍵題要看）。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('toggleDiagnosis', () => {
  it('點一下加、再點一下取消', () => {
    expect(toggleDiagnosis([], 'ASD')).toEqual(['ASD']);
    expect(toggleDiagnosis(['ASD'], 'LANG')).toEqual(['ASD', 'LANG']);
    expect(toggleDiagnosis(['ASD', 'LANG'], 'ASD')).toEqual(['LANG']);
  });

  it('滿兩個再點第三個：主診斷不動，換掉第二個', () => {
    expect(toggleDiagnosis(['ASD', 'LANG'], 'GDD')).toEqual(['ASD', 'GDD']);
  });
});

describe('extrasOf', () => {
  it('舊檔案沒有這幾欄：診斷空、聽力與孕週 null、上學與抽動未答', () => {
    expect(extrasOf({ name: 'x', ageMonth: 30, gender: 'boy' })).toEqual({
      diagnoses: [],
      inSchool: undefined,
      hasTics: undefined,
      hearingChecked: null,
      gestationWeeks: null,
    });
    expect(extrasOf(null).diagnoses).toEqual([]);
  });

  it('既有的值原樣帶進表單', () => {
    const child = { name: 'x', ageMonth: 30, gender: 'girl' as const, diagnoses: ['LANG' as const], inSchool: true, hasTics: false, hearingChecked: true, gestationWeeks: 33 };
    expect(extrasOf(child)).toEqual({ diagnoses: ['LANG'], inSchool: true, hasTics: false, hearingChecked: true, gestationWeeks: 33 });
  });
});

describe('ChildExtraFields 畫面', () => {
  it('六個診斷選項都在、選中的那一個有標記；孕週 24–36 週', () => {
    const html = renderToStaticMarkup(
      createElement(ChildExtraFields, { value: extrasOf({ name: 'x', ageMonth: 30, gender: 'boy', diagnoses: ['CP'] }), onChange: () => {} }),
    );
    for (const o of DX_OPTIONS) expect(html).toContain(o.label);
    expect(html).toMatch(/border-brand-clay[^"]*"[^>]*data-dx="CP"/);
    expect(html).not.toMatch(/border-brand-clay[^"]*"[^>]*data-dx="ASD"/);
    expect(html).toContain('<option value="24">');
    expect(html).toContain('<option value="36">');
    expect(html).not.toContain('<option value="37">');
  });
});

describe('兩張表單', () => {
  it.each([
    ['src/components/ChildProfileForm.tsx', 'currentChild'],
    ['src/components/EditProfileModal.tsx', 'child'],
  ])('%s：存檔先攤開既有檔案、补充资料只在專案 A', (file, prop) => {
    const src = read(file);
    expect(src).toMatch(new RegExp(String.raw`onSave\(\{\s*\.\.\.${prop},\s*\.\.\.\(PRODUCT\.features\.tier2And3 \? extras : \{\}\)`));
    expect(src).toContain('{PRODUCT.features.tier2And3 && <ChildExtraFields');
  });
});

describe('補充欄位接到推薦輸入', () => {
  it('T1 交卷存逐題作答', () => {
    expect(read('src/components/T1Screening.tsx')).toMatch(/items: dimQuestions\.map\(q => answers\[q\.id\] \?\? 0\)/);
  });

  it('表單存下的 Child 直接餵推薦輸入：診斷、上學、抽動、聽力、早產矯正都讀得到', () => {
    const child: Child = { name: 'x', ageMonth: 18, gender: 'boy', diagnoses: ['LANG', 'ASD'], inSchool: true, hasTics: true, hearingChecked: false, gestationWeeks: 32 };
    const { input } = buildRecommendInput({ ageM: child.ageMonth, child, t1Scores: [] });
    expect(input.dx).toEqual(['LANG', 'ASD']);
    expect(input.school).toBe(true);
    expect(input.extraTags).toEqual(['TIC']);
    expect(input.hearingChecked).toBe(false);
    expect(input.ageM).toBe(16);
  });
});

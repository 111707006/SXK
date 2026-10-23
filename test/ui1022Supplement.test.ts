import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Child } from '../src/types';
import { applySupplement, supplementFromChild, supplementMissing, type SupplementAnswers } from '../src/utils/t1Supplement';
import T1SupplementStep from '../src/components/T1SupplementStep';

/**
 * 補充資料移到 T1 最後（issue #83，`VITE_UI_1022`）：孕週、抽動、聽力必填（有「足月」「不清楚」），
 * 上學、診斷選填；重做帶入上次的值；交卷時寫回孩子檔案的五個欄位。
 */

const child: Child = { name: '小树', ageMonth: 30, gender: 'girl' } as Child;
const full: SupplementAnswers = { gestation: 'term', tics: false, hearing: 'unknown', diagnoses: [] };
const unsureAll: SupplementAnswers = { gestation: 'term', tics: 'unknown', hearing: 'unknown', diagnoses: [] };

describe('必填與選填', () => {
  it('三題都答了才可以送出，兩題選填可空', () => {
    expect(supplementMissing(full)).toEqual([]);
    expect(supplementMissing({ ...full, gestation: undefined })).toEqual(['gestation']);
    expect(supplementMissing({ ...full, tics: undefined })).toEqual(['tics']);
    expect(supplementMissing({ ...full, hearing: undefined })).toEqual(['hearing']);
    expect(supplementMissing({ diagnoses: [] })).toEqual(['gestation', 'tics', 'hearing']);
  });

  it('第一次做：空著讓家長選', () => {
    expect(supplementMissing(supplementFromChild(child, false))).toEqual(['gestation', 'tics', 'hearing']);
  });

  it('重做：帶入上次的值', () => {
    const saved = applySupplement(child, { gestation: 33, tics: true, hearing: false, inSchool: true, diagnoses: ['LANG'] });
    expect(supplementFromChild(saved, true)).toEqual({ gestation: 33, tics: true, hearing: false, inSchool: true, diagnoses: ['LANG'] });
    // 上次選「足月」「不清楚」：檔案上是 null／沒有，重做時帶回同樣的選擇
    const unsure = applySupplement(child, unsureAll);
    expect(supplementFromChild(unsure, true)).toEqual({ gestation: 'term', tics: 'unknown', hearing: 'unknown', inSchool: undefined, diagnoses: [] });
  });
});

describe('寫回孩子檔案', () => {
  it('五個欄位與答案一致，其他欄位不動', () => {
    const next = applySupplement({ ...child, birthDate: '2024-04-01' } as Child, { gestation: 30, tics: true, hearing: true, inSchool: false, diagnoses: ['ASD', 'LANG'] });
    expect(next).toMatchObject({ name: '小树', birthDate: '2024-04-01', gestationWeeks: 30, hasTics: true, hearingChecked: true, inSchool: false, diagnoses: ['ASD', 'LANG'] });
  });

  it('足月存 null、聽力不清楚存 null、抽動不清楚與沒答的上學不存（T2 推薦照舊讀得懂）', () => {
    const next = applySupplement({ ...child, hasTics: true, inSchool: true }, unsureAll);
    expect(next.gestationWeeks).toBeNull();
    expect(next.hearingChecked).toBeNull();
    expect('hasTics' in next).toBe(false);
    expect('inSchool' in next).toBe(false);
  });
});

describe('畫面', () => {
  const render = (value: SupplementAnswers) =>
    renderToStaticMarkup(createElement(T1SupplementStep, { value, onChange: () => {}, onBack: () => {}, onSubmit: () => {} }));

  it('缺必填時「生成报告」按不下去', () => {
    expect(render({ diagnoses: [] })).toMatch(/<button type="button" id="t1-supplement-submit" disabled=""/);
    expect(render(full)).not.toMatch(/id="t1-supplement-submit" disabled/);
    expect(render(full)).toContain('生成报告');
  });

  it('三題必填、兩題選填，各有「不清楚」或「足月」', () => {
    const html = render(full);
    expect(html.match(/必填/g)).toHaveLength(3);
    expect(html.match(/选填/g)).toHaveLength(2);
    expect(html).toContain('足月（37 周以上）');
    expect(html.match(/>不清楚</g)).toHaveLength(2);
  });
});

describe('接線', () => {
  it('T1：1022 九個方面之後先到补充资料，那一步才交卷並帶著寫好的孩子檔案', () => {
    const src = readFileSync('src/components/T1Screening.tsx', 'utf8');
    expect(src).toMatch(/if \(PRODUCT\.features\.ui1022\) \{\s*setAtSupplement\(true\);/);
    expect(src).toContain('onSaveT1Results(scoreAnswers(), applySupplement(child, supplement));');
  });

  it('上層：交卷時一起存孩子檔案', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain("answeredBefore={completedScores.some(s => s.tierId === 'T1')}");
    expect(app).toMatch(/setChildProfile\(childWithSupplement\);[\s\S]*syncToCloud\(savedChild, finalScores, orders, reportHistory\);/);
  });

  it.each(['src/components/ChildProfileForm.tsx', 'src/components/EditProfileModal.tsx'])('%s 在 1022 不問補充資料', rel => {
    expect(readFileSync(rel, 'utf8')).toContain('{PRODUCT.features.tier2And3 && !PRODUCT.features.ui1022 && <ChildExtraFields');
  });

  it('建檔頁的標題與說明是新字', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/PRODUCT\.features\.ui1022\s*\? WORDING_1022\.profile\.title/);
  });
});

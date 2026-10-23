import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInT1Range, T1_AGE_RANGE } from '../src/t1Data';
import { birthDateWindow, PROFILE_AGE_RANGE_1022, yearOptions } from '../src/utils/birthDateOptions';
import { calculateAgeMonth } from '../src/utils/dateUtils';

/**
 * 生日放寬到 0–18 歲、T1 範圍外顯示紅燈卡（issue #82，`VITE_UI_1022`）。
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('isInT1Range', () => {
  it.each([
    [11, false],
    [12, true],
    [180, true],
    [181, false],
    [0, false],
    [Number.NaN, false],
  ])('%s 個月 → %s', (age, expected) => {
    expect(isInT1Range(age)).toBe(expected);
  });

  it('範圍由年齡段反推，不是另寫的數字', () => {
    expect(T1_AGE_RANGE).toEqual({ minMonths: 12, maxMonths: 180 });
  });
});

describe('1022 的生日區間', () => {
  const today = new Date(2026, 9, 23);
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  it('今天出生（0 個月）到剛滿 18 歲都選得到', () => {
    const w = birthDateWindow(today, null, PROFILE_AGE_RANGE_1022);
    expect(iso(w.latest)).toBe('2026-10-23');
    expect(calculateAgeMonth(iso(w.earliest), today)).toBe(216);
    expect(calculateAgeMonth(iso(new Date(w.earliest.getFullYear(), w.earliest.getMonth(), w.earliest.getDate() - 1)), today)).toBe(217);
    expect(yearOptions(w)[0]).toBe(2008);
  });

  it('不給範圍時照舊是 T1 的範圍', () => {
    const w = birthDateWindow(today, null);
    expect(calculateAgeMonth(iso(w.latest), today)).toBe(12);
    expect(calculateAgeMonth(iso(w.earliest), today)).toBe(180);
  });

  it('生日下拉、建檔、編輯讀同一個範圍；1022 不寫適用範圍', () => {
    expect(readFileSync('src/components/BirthDateSelect.tsx', 'utf8')).toContain('birthDateWindow(today, storedBirthDate, PROFILE_AGE_RANGE)');
    for (const rel of ['src/components/ChildProfileForm.tsx', 'src/components/EditProfileModal.tsx']) {
      const src = readFileSync(rel, 'utf8');
      expect(src).not.toContain('T1_AGE_RANGE');
      expect(src).toMatch(/\{!PRODUCT\.features\.ui1022 && \(\s*<p[^>]*>系统适用范围为/);
    }
  });

  it('開關決定範圍', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_UI_1022', '1');
    expect((await import('../src/utils/profileAgeRange')).PROFILE_AGE_RANGE).toEqual({ minMonths: 0, maxMonths: 216 });
    vi.resetModules();
    vi.stubEnv('VITE_UI_1022', '0');
    expect((await import('../src/utils/profileAgeRange')).PROFILE_AGE_RANGE).toEqual(T1_AGE_RANGE);
  });
});

describe('紅燈卡', () => {
  it('寫「建议寻找专业人士」、列四種服務（能約的那一種按得下去）', async () => {
    const { default: OutOfRangeCard } = await import('../src/components/OutOfRangeCard');
    const html = renderToStaticMarkup(createElement(OutOfRangeCard, { childName: '小树', onBook: () => {} }));
    expect(html).toContain('建议寻找专业人士');
    expect(html).toContain('小树目前的年龄不在 T1 儿少综合发展评估的题目范围内');
    expect(html.match(/<button/g)).toHaveLength(4);
    // 能約的那一種（线上咨询说明）沒有 disabled 屬性。
    expect(html).toMatch(/<button type="button" class="[^"]*">(?:(?!<\/button>).)*线上咨询说明/);
  });

  it('Ledo 評估面板：給了紅燈卡就沒有開始評估的按鈕', async () => {
    const { default: LedoDashboard } = await import('../src/components/ledo/LedoDashboard');
    const props = { childName: '小树', completedScores: [], onSelectDimension: () => {}, onViewReport: () => {}, onStartT1Screening: () => {} };
    const blocked = renderToStaticMarkup(createElement(LedoDashboard, { ...props, t1Blocked: createElement('div', { id: 'CARD' }) }));
    expect(blocked).toContain('id="CARD"');
    expect(blocked).not.toContain('ledo-start-t1');
    expect(renderToStaticMarkup(createElement(LedoDashboard, props))).toContain('ledo-start-t1');
  });

  it('T1 那一頁也擋：範圍外拿不到題目', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('const t1Blocked = PRODUCT.features.ui1022 && !!child && !isInT1Range(child.ageMonth);');
    expect(app).toMatch(/currentView === 't1_screening' && outOfRangeCard \? \([\s\S]*?\) : currentView === 't1_screening' \? \(/);
    expect(app).not.toContain("onStartT1Screening={() => setCurrentView('t1_screening')}");
  });

  it('沒有 T1 成績時報告頁只畫專家預約，不生成', () => {
    const src = readFileSync('src/components/AnalysisReport.tsx', 'utf8');
    expect(src).toContain("const bookingOnly = PRODUCT.features.ui1022 && !hasT1 && !historicalRecord;");
    expect(src).toContain('const shouldGenerate = generateOnOpen || (PRODUCT.features.ui1022 && hasT1);');
    expect(src).toContain('{bookingOnly && bookingSlot}');
  });
});

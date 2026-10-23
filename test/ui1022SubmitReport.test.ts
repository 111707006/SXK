import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bandScores } from './helpers/t1Scores';

/**
 * 交卷即生成報告（issue #79，ADR-0014）。1022 開著時：T1 交卷直接交給上層（結論頁走不到）、上層當下存成績、
 * 報告頁一進來就生成新的一份；生成前只有「正在生成」，沒有摘要、生成器卡與「9 维度评估结果明细」。
 * 關著時三畫面流程照舊。
 */

const AGE = 30;
const scores = bandScores(AGE, () => 1);

async function renderReport(ui1022: '0' | '1') {
  vi.resetModules();
  vi.stubEnv('VITE_UI_1022', ui1022);
  const { default: AnalysisReport } = await import('../src/components/AnalysisReport');
  return renderToStaticMarkup(createElement(AnalysisReport, {
    child: { name: '森森', ageMonth: AGE, gender: 'boy' } as never,
    completedScores: scores,
    onBack: () => {},
    onSaveReportToHistory: () => {},
    generateOnOpen: true,
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('報告頁生成前', () => {
  it('1022 開著：只有「正在生成」', async () => {
    const html = await renderReport('1');
    expect(html).toContain('id="report-generating"');
    expect(html).toContain('正在生成报告');
    expect(html).not.toContain('9 维度评估结果明细');
    expect(html).not.toContain('先看这几项');
    expect(html).not.toContain('ai-report-trigger-btn');
    expect(html).not.toContain('一键生成');
    expect(html).not.toContain('报告生成器');
  });

  it('關著：生成器卡與明細照舊', async () => {
    const html = await renderReport('0');
    expect(html).not.toContain('id="report-generating"');
    expect(html).toContain('ai-report-trigger-btn');
    expect(html).toContain('9 维度评估结果明细');
  });
});

describe('結論頁在 1022 走不到', () => {
  const src = readFileSync('src/components/T1Screening.tsx', 'utf8');

  it('交卷：開著就交給上層、不設 isCompleted', () => {
    const submit = src.slice(src.indexOf('const handleSubmitT1'), src.indexOf('const handleActivateDeepAssessment'));
    expect(submit).toMatch(/if \(PRODUCT\.features\.ui1022\) \{\s*onSaveT1Results\(scores\);\s*return;\s*\}\s*setCalculatedScores\(scores\);\s*setIsCompleted\(true\);/);
  });

  it('結論頁那一段本身也擋著開關', () => {
    expect(src).toContain('if (isCompleted && !PRODUCT.features.ui1022) {');
  });

  it('最後一題的按鈕是「生成报告」', () => {
    expect(src).toContain('submitLabel: WORDING_1022.buttons.generateReport');
    expect(src).toContain("PRODUCT.features.ui1022 ? WORDING_1022.buttons.generateReport : '提交 T1 综合评估'");
  });
});

describe('上層：交卷當下就存、生成新的一份', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const start = app.indexOf('onSaveT1Results={(t1Scores) => {');
  const onSave = app.slice(start, app.indexOf('</div>', start));

  it('開著：存到雲端、到報告頁就生成、不接舊報告', () => {
    expect(onSave).toMatch(/if \(PRODUCT\.features\.ui1022\) \{[\s\S]*syncToCloud\(child, finalScores, orders, reportHistory\);[\s\S]*setT1ReportGenerate\(true\); setFreshT1Report\(true\);/);
    expect(app).toContain('resumeFrom={freshT1Report ? null : liveReportResume}');
  });

  it('關著：照舊不自己生成', () => {
    expect(onSave).toMatch(/\} else \{[\s\S]*setT1ReportGenerate\(false\); setFreshT1Report\(false\);/);
  });

  it('其他進報告頁的路都清掉「新的一份」', () => {
    const sets = app.match(/setT1ReportGenerate\((true|false)\);(?! setFreshT1Report)/g);
    expect(sets).toBeNull();
  });
});

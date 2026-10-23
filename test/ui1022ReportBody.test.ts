import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getT1AgeBand } from '../src/t1Data';
import { t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { bandScores } from './helpers/t1Scores';

/**
 * 報告本體精簡（issue #80，`VITE_UI_1022`）。家長端、掃碼頁、後台詳情與列印畫同一個 `ReportBody`，
 * 所以在這裡開／關各畫一次：Ledo 摘要、「9 维度评估结果明细」、逐題清單不在；雷達圖在；標題、免責句、
 * 「T2 深度评估」的叫法換新。舊快照（舊版、新版 T1）都畫得出來。
 */

const AGE = 30;
// 語言四題都「还不能」（紅），其餘全會。
const scores = bandScores(AGE, dim => (dim === 'language' ? 0 : 2));
/** 逐題清單每一列前面那個「还不能」標籤（`ReportRealBlocks` 的 AnswersOverview）。 */
const ITEM_PILL = 'shrink-0 mt-0.5 px-1.5 rounded bg-rose-50';
const languageQuestion = getT1AgeBand(AGE).questions.find(q => q.dimensionId === 'language')!.text;

const legacyReport = {
  summary: '总结',
  neuralPathwayAnalysis: '',
  rehabSuggestions: ['建议甲'],
  homeGuidance: ['家庭丙'],
  prognosisPrediction: '预判',
  criticalMetrics: { sensoryIntegration: 50, motorCoordination: 50, cognitiveLanguage: 50, socialEmotional: 50 },
};
const realReport = templateT1Report(t1ReportInputOf({ name: '森森', ageMonth: AGE }, scores));

async function render(ui1022: '0' | '1', aiReport: unknown) {
  vi.resetModules();
  vi.stubEnv('VITE_UI_1022', ui1022);
  const { default: ReportBody } = await import('../src/components/ReportBody');
  return renderToStaticMarkup(createElement(ReportBody, {
    childName: '森森',
    scores,
    aiReport: aiReport as never,
    ledoSummary: true,
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe.each([
  ['舊版快照', legacyReport],
  ['新版快照', realReport],
])('1022 開著（%s）', (_name, report) => {
  it('拿掉摘要與明細，留雷達圖', async () => {
    const html = await render('1', report);
    expect(html).not.toContain('先看这几项');
    expect(html).not.toContain('9 维度评估结果明细');
    expect(html).not.toContain('关注分:');
    expect(html).toContain('雷达图');
  });

  it('標題、免責句、首席專家結論在最上面', async () => {
    const html = await render('1', report);
    expect(html).toContain('T1 儿少综合发展评估报告');
    expect(html).toContain('本筛查仅作参考，不是医疗诊断，不能替代医院专业诊疗');
    expect(html).toContain('首席专家结论');
    expect(html.indexOf('首席专家结论')).toBeLessThan(html.indexOf('雷达图'));
  });

  it('「第二层」改叫「T2 深度评估」', async () => {
    const html = await render('1', report);
    expect(html).not.toContain('第二层');
    expect(html).not.toContain('量表评估中心');
    expect(html).toContain('建议近期进入「T2 深度评估」。');
  });
});

describe('1022 開著：接下来可以多练的', () => {
  it('只畫說明，不畫逐題清單', async () => {
    const html = await render('1', realReport);
    expect(html).toContain('接下来可以多练的');
    // 說明本身與居家建議可能引用題目原文（模板），逐題清單是一列一題、前面一個「还不能」標籤。
    expect(html).not.toContain(ITEM_PILL);
  });
});

describe('關著照舊', () => {
  it.each([['舊版快照', legacyReport], ['新版快照', realReport]])('%s', async (_name, report) => {
    const html = await render('0', report);
    expect(html).toContain('先看这几项');
    expect(html).toContain('9 维度评估结果明细');
    expect(html).toContain('儿童综合发展评估报告');
    expect(html).toContain('第二层');
  });

  it('新版快照的逐題清單照畫', async () => {
    const html = await render('0', realReport);
    expect(html).toContain(ITEM_PILL);
    expect(html).toContain(languageQuestion);
  });
});

describe('T2 深度評估入口卡醒目', () => {
  it('報告頁的插槽在 1022 加跳色邊框與光暈', () => {
    const src = readFileSync('src/components/AnalysisReport.tsx', 'utf8');
    expect(src).toMatch(/id="t2-entrance-slot" className=\{PRODUCT\.features\.ui1022\s*\? '[^']*bg-gradient-to-r[^']*shadow-\[0_0_28px/);
  });

  it.each(['src/components/T2Entrance.tsx', 'src/components/T2EntranceV3.tsx'])('%s 的標籤叫「T2 深度评估」', rel => {
    expect(readFileSync(rel, 'utf8')).toContain("PRODUCT.features.ui1022 ? WORDING_1022.t2Name : '第二层 · 深度评估'");
  });
});

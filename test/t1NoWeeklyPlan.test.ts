import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportBody from '../src/components/ReportBody';
import { asModelOutput, t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { isRealT1Report } from '../src/t1report/shape';
import { bandScores } from './helpers/t1Scores';

/**
 * T1 報告拿掉週計劃圖、T2 付費區移到原位置（#71，規格 client-changes-2026-10-17 §7、D19、D20）。
 * 開關 `T1_NO_WEEKLY_PLAN` 由伺服器給（`GET /api/report-config`），報告本體只認 `noWeeklyPlan` 這個 prop。
 * 直接把 `ReportBody` 畫成字串看：圖在不在、插槽的先後。
 */

const AGE = 30;
const scores = bandScores(AGE, () => 0); // 全紅：舊版「发育进度对比」走最低那一段說明句

const legacyReport = {
  summary: '总结',
  neuralPathwayAnalysis: '',
  rehabSuggestions: ['建议甲', '建议乙'],
  homeGuidance: ['家庭丙'],
  prognosisPrediction: '预判',
  criticalMetrics: { sensoryIntegration: 50, motorCoordination: 50, cognitiveLanguage: 50, socialEmotional: 50 },
};
const realReport = templateT1Report(t1ReportInputOf({ name: '森森', ageMonth: AGE }, scores));

const slot = (id: string) => createElement('div', { id }, id);

function render(aiReport: unknown, noWeeklyPlan?: boolean) {
  return renderToStaticMarkup(createElement(ReportBody, {
    childName: '森森',
    scores,
    aiReport: aiReport as never,
    t2Slot: slot('SLOT-T2'),
    takeawaySlot: slot('SLOT-TAKEAWAY'),
    bookingSlot: slot('SLOT-BOOKING'),
    ...(noWeeklyPlan === undefined ? {} : { noWeeklyPlan }),
  }));
}

const PLANNER_TITLES = /多维感官康复与训练周计划图|一周居家练习安排/;

describe('前提', () => {
  it('兩份快照一份舊版、一份新版', () => {
    expect(isRealT1Report(legacyReport)).toBe(false);
    expect(isRealT1Report(asModelOutput(realReport) as never) || isRealT1Report(realReport as never)).toBe(true);
  });
});

describe.each([
  ['舊版快照', legacyReport],
  ['新版快照', realReport],
])('開關開（%s）', (_name, report) => {
  const html = render(report, true);

  it('沒有週計劃圖，AI 建議一條都不畫', () => {
    expect(html).not.toMatch(PLANNER_TITLES);
    expect(html).not.toContain('建议甲');
  });

  it('沒有任何一句指向「7 日居家活动安排」', () => {
    expect(html).not.toMatch(/7\s*日居家|7日/);
  });

  it('順序：二維碼卡 → T2 付費區 → 專家預約', () => {
    const takeaway = html.indexOf('SLOT-TAKEAWAY');
    const t2 = html.indexOf('SLOT-T2');
    const booking = html.indexOf('SLOT-BOOKING');
    expect(takeaway).toBeGreaterThan(-1);
    expect(t2).toBeGreaterThan(takeaway);
    expect(booking).toBeGreaterThan(t2);
  });
});

describe.each([
  ['舊版快照', legacyReport],
  ['新版快照', realReport],
])('開關關（%s）：與現在一字不差', (_name, report) => {
  it('不給 prop 與給 false 畫出來一模一樣', () => {
    expect(render(report, false)).toBe(render(report));
  });

  it('週計劃圖還在；T2 付費區在二維碼卡正上方', () => {
    const html = render(report);
    expect(html).toMatch(PLANNER_TITLES);
    const t2 = html.indexOf('SLOT-T2');
    const takeaway = html.indexOf('SLOT-TAKEAWAY');
    const booking = html.indexOf('SLOT-BOOKING');
    expect(takeaway).toBeGreaterThan(t2);
    expect(booking).toBeGreaterThan(takeaway);
  });
});

it('開關開、沒有插槽（後台、列印、掃碼頁）：週計劃圖那一區整塊不留（不剩一條空的分隔線）', () => {
  for (const report of [legacyReport, realReport]) {
    const html = renderToStaticMarkup(createElement(ReportBody, {
      childName: '森森', scores, aiReport: report as never, noWeeklyPlan: true,
    }));
    expect(html).not.toMatch(PLANNER_TITLES);
    expect(html).not.toContain('pt-4 border-t border-brand-cream/80');
  }
});

it('開關關：舊版說明句照舊（含「7 日居家活动安排」）', () => {
  expect(render(legacyReport)).toContain('建议跟进最下方的 7 日居家活动安排，并近期预约专家一对一说明。');
});

it('開關開：舊版說明句改成「建议近期预约专家一对一说明。」', () => {
  expect(render(legacyReport, true)).toContain('的整体发展节奏与同龄常见的节奏有一定差距。建议近期预约专家一对一说明。');
});

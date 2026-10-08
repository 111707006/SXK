import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderParentExportHtml } from '../src/admin/exportView';
import type { ParentDetail } from '../src/admin/adminStore';
import { latestReportOf } from '../src/utils/reportHistory';
import { asModelOutput, t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { T1_REPORT_REAL_VERSION, isRealT1Report } from '../src/t1report/shape';
import { bandScores } from './helpers/t1Scores';

/**
 * 新版 T1 報告的畫面（`T1_REPORT_REAL`，2026-10-08）。專案沒有 jsdom，畫面上出現什麼只能讀原始碼（同
 * `parentWording.structure.test.ts`）。釘住三件事：
 * 1. 換版看快照、而且只在 A；B 的報告頁照舊畫那幾塊（使用者：「B 一個字都不變」）。
 * 2. 新版的畫面與模板裡沒有編出來的比較與預測（百分位、常模、ASQ、預測曲線）與腦神經術語。
 * 3. 舊報告照舊讀得出來：後台與掃碼頁讀新版、舊版兩種快照都不炸。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('換版：看快照、只在專案 A', () => {
  const body = stripComments(read('src/components/ReportBody.tsx'));

  it('新版的判斷同時要「專案 A」與「快照是新版」', () => {
    expect(body).toMatch(/const real = PRODUCT\.features\.tier2And3 && isRealT1Report\(aiReport\)/);
  });

  it('專案 B 的 PRODUCT 沒有 T2（tier2And3: false）—— 所以 B 永遠走舊版那幾塊', () => {
    const profile = read('src/productConfig.ts');
    const t1only = profile.slice(profile.indexOf('t1only: {'));
    expect(t1only).toMatch(/tier2And3:\s*false/);
  });

  it('舊版那幾塊還在，而且只在「不是新版」那一支', () => {
    for (const name of ['PeerComparison', 'IntegrationGauges', 'PrognosisTrajectoryChart']) {
      expect(body, name).toContain(`<${name}`);
    }
    const realBranch = body.slice(body.indexOf('{real ? ('), body.indexOf(') : (', body.indexOf('{real ? (')));
    expect(realBranch).toContain('<AnswersOverview');
    expect(realBranch).not.toMatch(/PeerComparison|IntegrationGauges/);
    expect(body).toMatch(/real\s*\n?\s*\?\s*<ScreeningHistory[\s\S]*?:\s*<PrognosisTrajectoryChart/);
    expect(body).toContain('plain={real}');
  });

  it('腦區拓撲圖只在舊版（腦區名稱與協同率不是從作答算的）', () => {
    expect(body).toMatch(/\{!real && \(\s*<div className="space-y-4">\s*<NeuralNetworkTopology/);
  });

  it('每週課表：固定的第三張卡與設備標籤只在舊版', () => {
    const charts = stripComments(read('src/components/ReportCharts.tsx'));
    expect(charts).toMatch(/if \(!plain\) tasks\.push\(\{\s*id: `std-/);
    expect(charts).toMatch(/sensorBadge: plain \? '' : '智能肌电\/重力仪支持'/);
  });
});

describe('新版沒有編出來的比較、預測與腦神經術語', () => {
  const FORBIDDEN = /百分位|常模|居同龄前|同龄前|%|％|ASQ|预测|预判|预计|回归|突触|前额叶|神经|脑区|环路|皮层/;

  it.each(['src/components/ReportRealBlocks.tsx', 'src/t1report/report.ts', 'src/t1report/answers.ts'])('%s', rel => {
    const src = stripComments(read(rel))
      // 驗證器自己的字表在 rules.ts，這幾檔不該有；`${...}%` 這種寬度樣式不是給家長看的字。
      .replace(/width: `\$\{[^`]*\}%`/g, '');
    const m = src.match(FORBIDDEN);
    expect(m, m ? `${rel}: 「${m[0]}」 …${src.slice(Math.max(0, m.index! - 30), m.index! + 30)}…` : '').toBeNull();
  });

  it('模板產出（年齡段 × 作答）沒有這些字', () => {
    for (const age of [12, 30, 60, 100, 150]) {
      for (const pick of [() => 0 as const, () => 2 as const, (_d: string, i: number) => (i % 3) as 0 | 1 | 2]) {
        const r = templateT1Report(t1ReportInputOf({ name: '森森', ageMonth: age }, bandScores(age, pick)));
        const text = JSON.stringify(asModelOutput(r));
        expect(text).not.toMatch(FORBIDDEN);
      }
    }
  });
});

describe('快照讀回（後台、掃碼頁）', () => {
  const scores = bandScores(30, d => (d === 'language' ? 0 : 2));
  const realReport = templateT1Report(t1ReportInputOf({ name: '森森', ageMonth: 30 }, scores));
  const oldReport = {
    summary: '总结', neuralPathwayAnalysis: '旧的分析', rehabSuggestions: ['建议一'], homeGuidance: ['指导一'],
    prognosisPrediction: '预判', criticalMetrics: { neuralPlasticity: 72, sensoryIntegration: 64, familyEnvironmentScore: 81, motorControlIndex: 58 },
  };
  const rec = (id: string, aiReport: unknown) => ({
    id, type: 'T1_SCREENING', child: { name: '森森', ageMonth: 30, gender: 'boy' }, scores, aiReport, isAiGenerated: false, createdAt: '2026-10-08T00:00:00.000Z',
  });

  it('latestReportOf：新版保留 version、perDimension 與逐題作答；舊版 perDimension 是空陣列、儀表照舊', () => {
    const r = latestReportOf([rec('a', realReport)])!;
    expect(r.aiReport.version).toBe(T1_REPORT_REAL_VERSION);
    expect(isRealT1Report(r.aiReport)).toBe(true);
    expect(r.aiReport.perDimension.map(n => n.dimensionId)).toEqual(['language']);
    expect(r.aiReport.criticalMetrics).toBeNull();
    expect(r.scores.find(s => s.dimensionId === 'language')!.items).toEqual([0, 0, 0, 0]);

    const o = latestReportOf([rec('b', oldReport)])!;
    expect(isRealT1Report(o.aiReport)).toBe(false);
    expect(o.aiReport.perDimension).toEqual([]);
    expect(o.aiReport.criticalMetrics).toEqual(oldReport.criticalMetrics);
  });

  it('壞的逐題作答與 perDimension 被丟掉，不讓畫面撞到', () => {
    const bad = rec('c', { ...realReport, perDimension: [null, { dimensionId: 1 }, { dimensionId: 'language', note: '好' }] });
    (bad.scores as any) = [{ ...scores[0], items: [0, 'x', 2, 2] }];
    const r = latestReportOf([bad])!;
    expect(r.aiReport.perDimension).toEqual([{ dimensionId: 'language', note: '好' }]);
    expect(r.scores[0].items).toBeUndefined();
  });

  function detail(aiReport: unknown): ParentDetail {
    return {
      id: 1, email: null, phone: null, companyId: 1, childName: '森森', childAgeMonth: 30, childGender: 'boy',
      flaggedDimensions: [], screeningTotal: null, screenedAt: null, registeredAt: '2026-01-01T00:00:00.000Z',
      hasBooking: false, lastInvitedAt: null, handoffUsedAt: null, handoffSource: null,
      scores, reportHistory: [rec('r', aiReport) as any], bookings: [], assessedAgeMonth: 30, assessedBandName: null,
    } as ParentDetail;
  }

  it('掃碼頁：新版印分維度段落與「接下来怎么做」，不印腦神經那一段', () => {
    const html = renderParentExportHtml(detail(realReport), { reportId: 'r', includeBookings: false });
    expect(html).toContain('接下来怎么做');
    expect(html).toContain('<strong>语言沟通：</strong>');
    expect(html).not.toContain('神经环路分析');
    expect(html).not.toContain('预后预判');
  });

  it('掃碼頁：舊版照舊', () => {
    const html = renderParentExportHtml(detail(oldReport), { reportId: 'r', includeBookings: false });
    expect(html).toContain('神经环路分析');
    expect(html).toContain('预后预判');
    expect(html).not.toContain('接下来怎么做');
  });
});

/**
 * 舊版與新版 T1 報告並排（`scripts/t1-report-compare.ts` 的邏輯；`test/t1ReportCompare.test.ts` 也呼叫）。
 *
 * 同一份輸入（孩子＋九維成績，含逐題作答＋選填的報告歷史）各跑一次：
 * - 舊版：`src/t1report/legacy.ts` 的 `generateLegacyFallbackReport`（開關關著時 `/api/report` 的本地模板，
 *   tag `t1-report-legacy` 那一版的輸出）；
 * - 新版：`src/t1report/report.ts` 的 `templateT1Report`（`T1_REPORT_REAL` 的模板退路）。
 *
 * **只走模板，不打任何網路、不叫模型**：比的是兩套模板寫出來的字，模型那一路每次都不一樣，比不了。
 * 輸出 Markdown，交給使用者並排看。
 */

import { getT1AgeBand } from '../../src/t1Data';
import type { AssessmentStatus, DimensionScore } from '../../src/types';
import { generateLegacyFallbackReport, type LegacyAppMode, type LegacyT1Report } from '../../src/t1report/legacy';
import { t1ReportInputOf, templateT1Report } from '../../src/t1report/report';
import { ANSWER_LABEL, screeningSeries, t1AnswersOf, type T1Answer } from '../../src/t1report/answers';
import { STATUS_WORDING } from '../../src/utils/statusWording';
import type { T1RealReport } from '../../src/t1report/shape';

export interface CompareChild {
  name: string;
  ageMonth: number;
  gender: 'boy' | 'girl';
}

export interface CompareInput {
  child: CompareChild;
  scores: DimensionScore[];
  /** 報告歷史（同 `AssessmentRecord[]` 的形狀）。只有新版畫面的「历次筛查对照」用得到，文字兩邊都不看。 */
  history?: unknown[];
}

/** 一個年齡段的九維成績；`pick(維度, 第幾題)` 給逐題作答。判定照 `T1Screening.tsx`（≤5 紅、<8 黃、紅旗題沒做到也黃）。 */
export function scoresFor(ageMonth: number, pick: (dimId: string, i: number) => T1Answer, completedAt = '2026-10-08T00:00:00.000Z'): DimensionScore[] {
  const band = getT1AgeBand(ageMonth);
  const dims = [...new Set(band.questions.map(q => q.dimensionId))];
  return dims.map(dimId => {
    const qs = band.questions.filter(q => q.dimensionId === dimId);
    const items = qs.map((_, i) => pick(dimId, i));
    const score = items.reduce<number>((a, b) => a + b, 0);
    const redFlag = qs.some((q, i) => q.isRedFlag && items[i] < 2);
    const status: AssessmentStatus = score <= 5 ? 'delay' : score < 8 || redFlag ? 'borderline' : 'normal';
    return {
      dimensionId: dimId, dimensionName: qs[0].dimensionName, tierId: 'T1', score, maxScore: 8, status,
      completedAt, assessedAgeMonth: ageMonth, items,
    } as DimensionScore;
  });
}

function historyRecord(id: string, createdAt: string, child: CompareChild, scores: DimensionScore[]) {
  return { id, type: 'T1_SCREENING', child, scores, aiReport: { summary: '（旧报告）' }, isAiGenerated: false, createdAt };
}

/** 內建的幾個孩子：不同年齡段、全綠、一紅、多黃、紅黃混合（含一份歷史）。 */
export const SAMPLES: Record<string, { label: string; input: CompareInput }> = (() => {
  const toddler: CompareChild = { name: '小树', ageMonth: 20, gender: 'girl' };
  const preschool: CompareChild = { name: '森森', ageMonth: 42, gender: 'boy' };
  const kinder: CompareChild = { name: '果果', ageMonth: 60, gender: 'girl' };
  const school: CompareChild = { name: '乐乐', ageMonth: 100, gender: 'boy' };
  return {
    'all-green': {
      label: '20 个月，全部做得到（全绿）',
      input: { child: toddler, scores: scoresFor(20, () => 2) },
    },
    'one-red': {
      label: '42 个月，语言沟通四题都还不能（一红），其余全绿',
      input: { child: preschool, scores: scoresFor(42, d => (d === 'language' ? 0 : 2)) },
    },
    'several-yellow': {
      label: '60 个月，注意力、情绪、自理各一题有时做得到（三黄）',
      input: {
        child: kinder,
        scores: scoresFor(60, (d, i) => (['attention', 'emotion_behavior', 'self_care'].includes(d) && i === 0 ? 1 : 2)),
      },
    },
    'school-mixed': {
      label: '100 个月，学习能力红、社交与注意力黄，带一份三个月前的报告',
      input: {
        child: school,
        scores: scoresFor(100, (d, i) => (d === 'learning_ability' ? (i < 3 ? 0 : 1) : (d === 'social_emotional' || d === 'attention') && i === 1 ? 1 : 2)),
        history: [
          historyRecord('prev-1', '2026-07-08T00:00:00.000Z', { ...school, ageMonth: 97 },
            scoresFor(97, (d, i) => (d === 'learning_ability' ? 0 : d === 'attention' && i < 2 ? 1 : 2), '2026-07-08T00:00:00.000Z')),
        ],
      },
    },
  };
})();

export interface CompareResult {
  legacy: LegacyT1Report;
  real: T1RealReport;
}

export function compareReports(input: CompareInput, mode: LegacyAppMode = 'full'): CompareResult {
  return {
    legacy: generateLegacyFallbackReport(input.child, input.scores, mode),
    real: templateT1Report(t1ReportInputOf(input.child, input.scores)),
  };
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const list = (xs: string[]) => (xs.length ? xs.map((x, i) => `${i + 1}. ${x}`).join('<br>') : '（无）');

/** 一個孩子的並排 Markdown（標題、輸入、逐欄對照、新版才有的分方面說明與歷次對照）。 */
export function compareMarkdown(name: string, label: string, input: CompareInput, mode: LegacyAppMode = 'full'): string {
  const { legacy, real } = compareReports(input, mode);
  const answers = t1AnswersOf(input.scores, input.child.ageMonth);
  const out: string[] = [];
  out.push(`## ${name}：${label}`, '');
  out.push(`孩子：${input.child.name}，${input.child.ageMonth} 个月，${input.child.gender === 'boy' ? '男孩' : '女孩'}；题组：${answers.bandName ?? '（不明）'}`, '');
  out.push('| 方面 | 判定 | 合计 | 逐题作答 |', '|---|---|---|---|');
  for (const d of answers.dimensions) {
    const items = d.items ? d.items.map(it => ANSWER_LABEL[it.answer]).join('／') : '（没有逐题）';
    out.push(`| ${d.dimensionName} | ${STATUS_WORDING[d.status].label} | ${d.score}/${d.maxScore} | ${items} |`);
  }
  out.push('');
  out.push(`| 栏位 | 旧版（legacy，${mode === 'full' ? '专案 A' : '专案 B'}） | 新版（T1_REPORT_REAL 模板） |`, '|---|---|---|');
  out.push(`| 总览 summary | ${cell(legacy.summary)} | ${cell(real.summary)} |`);
  out.push(`| 康复／练习建议 | ${cell(list(legacy.rehabSuggestions))} | ${cell(list(real.rehabSuggestions))} |`);
  out.push(`| 居家指导 | ${cell(list(legacy.homeGuidance))} | ${cell(list(real.homeGuidance))} |`);
  out.push(`| 预判／接下来怎么做 | ${cell(legacy.prognosisPrediction)} | ${cell(real.prognosisPrediction)} |`);
  out.push(`| 神经环路分析 | ${cell(legacy.neuralPathwayAnalysis)} | （新版不写） |`);
  const m = legacy.criticalMetrics;
  out.push(`| 四个仪表 | 可塑性 ${m.neuralPlasticity}、感觉整合 ${m.sensoryIntegration}、家庭环境 ${m.familyEnvironmentScore}、运动控制 ${m.motorControlIndex} | （新版不产） |`);
  out.push(`| 分方面说明 perDimension | （旧版没有） | ${cell(real.perDimension.length ? real.perDimension.map(n => `**${answers.dimensions.find(d => d.dimensionId === n.dimensionId)?.dimensionName ?? n.dimensionId}**：${n.note}`).join('<br>') : '（没有被标记的方面）')} |`);
  out.push('');
  const series = screeningSeries(input.history ?? [], { id: 'current', createdAt: '2026-10-08T00:00:00.000Z', scores: input.scores, ageMonth: input.child.ageMonth });
  if (series.length > 1) {
    out.push('新版「历次筛查对照」（关注分 0–8，旧版画的是每个孩子一样的三条预测曲线）：', '');
    out.push(`| 方面 | ${series.map((p, i) => (i === series.length - 1 ? '本次' : p.createdAt.slice(0, 10))).join(' | ')} |`);
    out.push(`|---|${series.map(() => '---').join('|')}|`);
    for (const d of answers.dimensions) {
      out.push(`| ${d.dimensionName} | ${series.map(p => (p.dimensions[d.dimensionId] ? String(p.dimensions[d.dimensionId].concern) : '—')).join(' | ')} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

export function compareDocument(names: string[], mode: LegacyAppMode = 'full', now = new Date()): string {
  const head = [
    '# T1 报告新旧对照',
    '',
    `产生于 ${now.toISOString().slice(0, 16).replace('T', ' ')}（UTC）。两边都是本地模板，没有呼叫模型；同一份输入各跑一次。`,
    '旧版＝`src/t1report/legacy.ts`（tag `t1-report-legacy` 时 `/api/report` 的模板）；新版＝`src/t1report/report.ts` 的 `templateT1Report`。',
    '',
  ];
  return [...head, ...names.map(n => compareMarkdown(n, SAMPLES[n].label, SAMPLES[n].input, mode))].join('\n');
}

/**
 * 模板退路（規格 v2 §6.4，#55）。
 *
 * 【這是什麼】
 * 一個純函式 `templateProse`：同一份 `T2ReportInput`，不呼叫模型，拼出一份完整的
 * `T2ReportProse`。AI 那條路壞掉時（API 掛了、回來的 JSON 沒過 `validateProse`），家長拿到的
 * 就是這一份。
 *
 * 【模板要過同一個驗證器】
 * `templateProse(input)` 的產出**一定**過得了 `validateProse(…, input)`（`t2ReportProse.test.ts`
 * 對各種形狀的 findings 逐一驗）。理由很簡單：驗證器擋的是「這份東西能不能給家長看」，退路
 * 寫出禁字、少一個維度、caveats 漏一條，跟模型寫錯一樣糟，而且模板是我們自己寫的，更沒有
 * 理由例外。這也是為什麼字數範圍在這裡是**設計約束**，不是事後檢查。
 *
 * 【怎麼湊到字數範圍】（`fitBetween`）
 * 每個欄位有「一定要有的句子」與「有就加、加不下就算了的句子」。標籤句是後者：§5.5 允許一個
 * 維度最多 10 個標籤，10 句排下去是 250 字，遠超 §6.3 的 150。所以標籤句**依序取到上限為止**
 * ——`DimensionFinding.tags` 是保序的（`drivenBy` 那支先），取前面幾個就是取「最主要那一支
 * 看到的事」。取不到的標籤不會消失：它們是活動配對（§7.3）與 SMART 目標（§8）吃的東西，
 * 家長在週計畫那一頁看得到。
 *
 * 【模板刻意不寫的】
 * - **不寫數字**：band 從哪個百分比來、tier 是幾，模板一個字都不提。§6.2 允許 AI 引用原生數字，
 *   但模板沒有辦法判斷「引用得恰不恰當」——「達成率 45%」這種句子在沒有上下文時只會嚇人。
 * - **不寫工具名**：18 支自建工具的名字對家長沒有意義（`unsourced_threshold` 說它們還沒有常模）。
 *   四支公開工具的官方名稱可以寫（§6.2），但模板也不寫 —— 寫了就要解釋它是什麼。
 * - **不引用題目原文**：§6.4 明寫敘述段落不得引用。題目原文只出現在「你勾選的項目」那一段可摺疊
 *   的回顧裡，那是家長端（#59）的事，不是這一層。
 */

import { SCREENING_DISCLAIMER } from '../../utils/statusWording';
import { SITE_DIMENSION_NAME } from '../dimensionMap';
import type { DimensionFinding, T2Findings } from '../types';
import type { DimensionCode } from '../types';
import type { Caveat } from '../caveats';
import type { ToolResult } from '../types';
import { inWindow, sectionsFor } from '../toolSpecs';
import {
  CHAR_RANGES,
  CLOSING_SENTENCE,
  caveatsToVoice,
  charCount,
  hasSafetyConcern,
  reportedDimensions,
  temperamentTagsOf,
} from './prose';
import type { ProseDimension, T2ReportInput, T2ReportProse } from './prose';
import { DIMENSION_WHY, SAFETY_SENTENCE, TAG_SENTENCES, caveatSentence } from './sentences';

/** 報告裡會出現的三種 band（其餘的維度不出段落）。 */
type ReportedBand = 'watch' | 'refer' | 'no_tool';

/**
 * 夾在 `head` 與 `tail` 之間、能塞幾句就塞幾句：由前往後取，取到整段的字數上限為止。
 * 回傳挑中的那幾句（可能一句都沒有）；`head` 與 `tail` 由呼叫端自己接上。
 */
function fitBetween(head: string, optional: ReadonlyArray<string>, tail: string, max: number): string[] {
  const room = max - charCount(head) - charCount(tail);
  const chosen: string[] = [];
  let used = 0;
  for (const part of optional) {
    const n = charCount(part);
    if (used + n > room) continue;
    chosen.push(part);
    used += n;
  }
  return chosen;
}

/** 幾個維度名稱串成一句裡的主詞：最多列兩個，多的收成「等 N 项」。 */
function nameList(dimensions: ReadonlyArray<DimensionCode>): string {
  const names = dimensions.map(d => SITE_DIMENSION_NAME[d]);
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')}等 ${names.length} 项`;
}

// ---------------------------------------------------------------------------
// overview
// ---------------------------------------------------------------------------

const OVERVIEW_LEAD = '这份报告把这次填写的问卷结果整理成一份总览。';

function overviewClauses(findings: T2Findings): string[] {
  const by = (test: (d: DimensionFinding) => boolean) =>
    findings.dimensions.filter(test).map(d => d.dimensionId);

  const refer = by(d => d.band === 'refer');
  const watch = by(d => d.band === 'watch');
  const noTool = by(d => d.band === 'no_tool');
  const notDone = by(d => d.band === 'partial' || d.band === 'not_assessed');
  const clear = by(d => d.band === 'clear');

  const clauses: string[] = [];
  if (refer.length > 0) clauses.push(`${nameList(refer)}建议请专业人员再看一看。`);
  if (watch.length > 0) clauses.push(`${nameList(watch)}可以在日常里多给一些练习的机会。`);
  if (noTool.length > 0) clauses.push(`${nameList(noTool)}这个月龄暂时没有适合的问卷可以做。`);
  if (notDone.length > 0) clauses.push(`${nameList(notDone)}这次没有做完对应的问卷，先照第一层的结果看。`);
  if (clear.length > 0) clauses.push(`其余各项目前的表现与同龄孩子的节奏相当。`);
  return clauses;
}

function buildOverview(findings: T2Findings): string {
  const prefix = hasSafetyConcern(findings) ? SAFETY_SENTENCE : '';
  const clauses = fitBetween(
    OVERVIEW_LEAD,
    [...overviewClauses(findings), SCREENING_DISCLAIMER],
    '',
    CHAR_RANGES.overview.max,
  );
  return `${prefix}${OVERVIEW_LEAD}${clauses.join('')}`;
}

// ---------------------------------------------------------------------------
// perDimension
// ---------------------------------------------------------------------------

/** 一個維度的開場：band 在這裡講，只講「落在哪一種處理方式」，不講數字也不講級別。 */
const BAND_OPENING: Readonly<Record<ReportedBand, (area: string) => string>> = {
  refer: area => `${area}这一项，这次的结果提示需要请专业人员进一步看看。`,
  watch: area => `${area}这一项，这次的结果提示值得在日常里多留意。`,
  no_tool: area => `${area}这一项，这个月龄暂时没有适合的问卷可以做，所以这次没有它的结果。这既不代表没事，也不代表有事。`,
};

/** 一個維度的收尾：家裡這一週可以怎麼接。 */
const BAND_ADVICE: Readonly<Record<ReportedBand, string>> = {
  refer: '在等专业人员看之前，家里可以先从孩子已经做得到的那一步开始练，不用等到预约那天。',
  watch: '这一项的进展多半靠日常里的机会累积，每天有固定的时间去用它，比额外加课有用。',
  no_tool: '这一项先照第一层的结果看，等孩子长到适用的月龄，我们会再提醒你补做。',
};

/** 一個標籤都沒有時替代標籤句的那一句（band 判出来了，但没有指向更细的方向）。 */
const NO_TAG_SENTENCE = '这次的结果没有指向更细的方向，先从这一项日常里最常用到的场景开始留意。';

/** `whyItMatters` 的開場：band 一句，接 `DIMENSION_WHY`。 */
const BAND_WHY: Readonly<Record<ReportedBand, string>> = {
  refer: '这一项这次被标记出来，从现在开始多练，通常进步最快、也最省力。',
  watch: '这一项这次被标记出来，现在多给一些机会，通常几周内就能看到进展。',
  no_tool: '这一项这次没有可以做的问卷，所以下面讲的是它平常撑着什么。',
};

function bandOf(dimension: DimensionFinding): ReportedBand {
  const band = dimension.band;
  if (band === 'refer' || band === 'watch' || band === 'no_tool') return band;
  throw new Error(`report/template：${dimension.dimensionId} 的 band 是 ${band}，不該出段落`);
}

/**
 * §5.6 裡帶 N 的三句，N 從這個維度做過的工具算回來。算不出來就傳 `null`，
 * `caveatSentence` 會改用沒有數字的寫法（不編一個數字出來）。
 *
 * - `incomplete`：這個維度做過的工具裡，缺答題數的總和。
 * - `age_out_of_window`：**唯一**一支落在窗口外的工具，當時的測評月齡。不只一支落在窗口外時
 *   回 `null` —— caveats 是整個維度的聯集，不記是哪一支帶來的，挑錯一支就是在報告上寫一個
 *   與那句話無關的月齡。
 * - `few_items`：判這個維度用的面向裡，題數最少的那一個。
 */
function caveatNumber(
  caveat: Caveat,
  dimension: DimensionFinding,
  toolResults: ReadonlyArray<ToolResult>,
): number | null {
  const used = toolResults.filter(r => dimension.tools.includes(r.toolId));
  if (caveat === 'incomplete') {
    const missing = used.reduce((n, r) => n + Math.max(0, r.askedCount - r.answeredCount), 0);
    return missing > 0 ? missing : null;
  }
  if (caveat === 'age_out_of_window') {
    const outside = used.filter(r => !inWindow(r.toolId, r.assessedAgeMonth));
    return outside.length === 1 ? outside[0].assessedAgeMonth : null;
  }
  if (caveat === 'few_items') {
    const counts: number[] = [];
    for (const r of used) {
      const keys = sectionsFor(r.toolId, dimension.dimensionId);
      if (keys === null) continue;
      const stats = keys === 'overall'
        ? [r.overall]
        : keys.map(k => r.sections[k]).filter((s): s is NonNullable<typeof s> => s !== undefined);
      for (const s of stats) if (s.n > 0) counts.push(s.n);
    }
    return counts.length > 0 ? Math.min(...counts) : null;
  }
  return null;
}

function buildDimension(dimension: DimensionFinding, findings: T2Findings): ProseDimension {
  const band = bandOf(dimension);
  const area = SITE_DIMENSION_NAME[dimension.dimensionId];
  const opening = BAND_OPENING[band](area);
  const advice = BAND_ADVICE[band];

  const chosen = fitBetween(
    opening,
    dimension.tags.map(t => TAG_SENTENCES[t]),
    advice,
    CHAR_RANGES.whatWeSaw.max,
  );
  if (chosen.length === 0) chosen.push(NO_TAG_SENTENCE);

  return {
    dimensionId: dimension.dimensionId,
    whatWeSaw: [opening, ...chosen, advice].join(''),
    whyItMatters: `${BAND_WHY[band]}${DIMENSION_WHY[dimension.dimensionId]}`,
    caveats: caveatsToVoice(dimension)
      .map(c => caveatSentence(c, caveatNumber(c, dimension, findings.toolResults)))
      .filter((s): s is string => s !== null),
  };
}

// ---------------------------------------------------------------------------
// temperament
// ---------------------------------------------------------------------------

const TEMPERAMENT_LEAD = '下面这些是孩子的天生风格，不是要改掉的东西：';
const TEMPERAMENT_TAIL = '顺着孩子的风格来安排，通常比硬要他配合省力得多，也少很多拉扯。';

function buildTemperament(findings: T2Findings): string | undefined {
  const tags = temperamentTagsOf(findings);
  if (tags.length === 0) return undefined;
  const chosen = fitBetween(
    TEMPERAMENT_LEAD,
    tags.map(t => TAG_SENTENCES[t]),
    TEMPERAMENT_TAIL,
    CHAR_RANGES.temperament.max,
  );
  return `${TEMPERAMENT_LEAD}${chosen.join('')}${TEMPERAMENT_TAIL}`;
}

// ---------------------------------------------------------------------------
// weeklyPlanIntro、closing
// ---------------------------------------------------------------------------

const PLAN_RHYTHM = '每支活动一次做 10 到 15 分钟，建议隔天做一次，做完在记录表上打个勾。';
/**
 * 這一句**恆在**。沒有它時，「一个维度、一支活动、名称又短」那一組（例如只有认知被标记）
 * 拼出来只有五十几个字，過不了自己的下限；把地基放在「剛好有其他句子可加」上，是等着哪天
 * 一个刚好的输入让退路自己失效。
 */
const PLAN_BASIS = '活动是照孩子这次被标记的方面挑的，也照他现在做得到的程度挑，不是照实际年龄挑的。';
const PLAN_EMPTY = '这一周暂时没有可以安排的活动，先从上面提到的日常机会开始就可以。';
const PLAN_BELOW_WINDOW = '其中有几支是从更早一步的内容开始的——从孩子做得到的地方起步，累积起来比较快。';

function buildWeeklyPlanIntro(input: T2ReportInput): string {
  const { picks, preparing } = input.activities;
  const counted = new Map<DimensionCode, number>();
  for (const p of picks) counted.set(p.dimension, (counted.get(p.dimension) ?? 0) + 1);
  const perDimension = [...counted.entries()]
    .map(([d, n]) => `${SITE_DIMENSION_NAME[d]} ${n} 支`)
    .join('、');

  const lead = picks.length === 0
    ? PLAN_EMPTY
    : `这一周安排了 ${picks.length} 支活动：${perDimension}。`;

  const optional: string[] = [];
  if (picks.some(p => p.reason.belowWindow)) optional.push(PLAN_BELOW_WINDOW);
  if (preparing.length > 0) optional.push(`${nameList(preparing)}的活动还在准备中，这一周先不安排。`);
  if (input.goals.length > 0) optional.push(`这一周的活动对着上面那 ${input.goals.length} 条目标。`);

  const head = `${lead}${PLAN_BASIS}${PLAN_RHYTHM}`;
  const extra = fitBetween(head, optional, '', CHAR_RANGES.weeklyPlanIntro.max);
  return `${head}${extra.join('')}`;
}

const CLOSING_LEAD = '这份报告帮你看见孩子现在走到哪里、下一步可以在家里练什么。';

/**
 * `T2ReportInput` → 一份完整的報告文字，不呼叫模型。
 *
 * 產出一定過得了 `validateProse(…, input)`。回傳的每個物件與陣列都是新的。
 */
export function templateProse(input: T2ReportInput): T2ReportProse {
  const prose: T2ReportProse = {
    overview: buildOverview(input.findings),
    perDimension: reportedDimensions(input.findings).map(d => buildDimension(d, input.findings)),
    weeklyPlanIntro: buildWeeklyPlanIntro(input),
    closing: `${CLOSING_LEAD}${CLOSING_SENTENCE}。`,
  };
  const temperament = buildTemperament(input.findings);
  if (temperament !== undefined) prose.temperament = temperament;
  return prose;
}

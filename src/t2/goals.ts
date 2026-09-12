/**
 * SMART 目標（規格 v2 §8，#54）。
 *
 * 【這一層做什麼】
 * 一個純函式：`T2Findings` → 最多三條目標。挑哪幾個維度、每條的起點百分比從哪來、
 * 四週與十二週的數字怎麼算、句子怎麼寫。
 *
 * 【挑誰】
 * 被標記的維度＝`band` 是 `watch` 或 `refer` 的。排序直接用 `dimensionOrder.ts` 的
 * `prioritizeDimensions`（§8 三把鍵：band → T1 標記 → 客戶的功能處理順序或固定順序），
 * 與活動配對共用同一份，兩邊的「先講誰」永遠是同一個答案。
 *
 * `partial`／`not_assessed`／`no_tool` **不出目標**：那三個是「沒有判定」，不是「輕一點的判定」。
 * 對一個星號沒做完的維度寫「由目前約 X% 提升到 Y%」，等於把沒做完講成已經量過。報告層對這三種
 * 各有自己的段落（#55），目標段落不替它們代言。只出標籤、不出 band 的工具（氣質、chexi）
 * 同理：氣質把 `emo.slow_to_warm` 餵給 EMO，但 EMO 的 band 仍是 `clear`，不會成為目標。
 *
 * 【幾條】
 * 最多 3 條，一個維度一條。規格寫「2–3 個」但沒寫不足時怎麼辦；原型是**湊**的
 * （`picks.length<2` 就從已評維度補次重的，再不足給 `['MOT','LANG']`）。這裡不湊：
 * 被標記的維度只有一個就只有一條。湊出來的第二條是對一個沒有被標記的維度設訓練目標，
 * 家長會照著做 —— 那比少一條糟。（勘誤 L1）
 *
 * 【起點百分比】
 * 用原生值，沒有就寫「以第一周家长记录为起点」，**不憑空給數字**（§8 明寫）。原生值取
 * `drivenBy` 那一支 —— 家長會問「哪一份說的」，目標的起點就該是那一份說的那個數。
 * 哪幾族有：達成率（達成率族六支）、通過率（dev，工具包自己的分段寫「達成」）、獨立率（adl）、
 * 關切率（關切率族六支）。其餘四族沒有可用的百分比：`total`（ldp／lds）的 `pct` 是給雷達圖的
 * 0–100，分段比的是原始總分（`scoring/families.ts` 那行警告）；`mean-snap`、`mean-chexi`、
 * `risk`、`positive`、`profile` 的 `pct` 根本是 `null`。這幾支推出來的維度走退路那句話。
 *
 * 【方向】
 * 關切率是**越低越好**，其餘三種越高越好。同一句「由目前約 78% 提升到 87%」套在關切率上
 * 就是把要減少的講成要增加的，所以句型分兩套（`GOAL_SENTENCES`）。
 *
 * 【四週與十二週的數字】
 * 「把與上限的差距縮一半」：十二週 ＝ 起點 ＋ ⌈(95 − 起點) ÷ 2⌉，四週 ＝ 起點 ＋ ⌈(十二週 − 起點) ÷ 2⌉；
 * 關切率往下對稱，下限 5。原型是 `min(90, base+40)`／`min(80, base+20)`，那組數字配的是原型
 * 憑嚴重度編出來的起點（20／30／50）；換成真的原生值後它會倒退 —— 達成率 84 的孩子
 * 「四週目標 80%」比現在還低。不寫 100／0 是因為十二週要求全對或歸零不是可達成的目標。
 * 上限與下限之外的起點（舊紀錄）不會往回退：沒有空間時三個數字相同。
 */

import { prioritizeDimensions } from './dimensionOrder';
import { SITE_DIMENSION_NAME } from './dimensionMap';
import { TOOL_SPECS, sectionsFor } from './toolSpecs';
import { GOAL_TEMPLATES } from './goalTemplates';
import type { GoalTemplate } from './goalTemplates';
import type { ToolId } from './toolkit';
import type {
  Band,
  DimensionCode,
  DimensionFinding,
  ScoringFamily,
  SectionStat,
  T2Findings,
  ToolResult,
} from './types';

/** 最多幾條目標（§8「2–3 個」的上限；下限不湊，見檔頭）。 */
export const MAX_GOALS = 3;

/** 沒有原生百分比時寫的那一句（§8）。 */
export const NO_BASELINE_NOTE = '以第一周家长记录为起点';

/** 十二週目標的上限與下限：不要求全對，也不要求歸零。 */
export const GOAL_CEILING = 95;
export const GOAL_FLOOR = 5;

/** 沒有孩子名字時句子的主詞。`T2Findings` 不帶名字，呼叫端要就自己傳。 */
export const DEFAULT_CHILD_NAME = '孩子';

/** 這個百分比是越高越好，還是越低越好。 */
export type BaselineDirection = 'higher_better' | 'lower_better';

/** 四週與十二週的目標百分比。 */
export interface Milestones {
  short: number;
  long: number;
}

export interface GoalBaseline {
  /** 起點百分比，原生值，已四捨五入（`SectionStat.pct`）。 */
  pct: number;
  /** 哪一支說的 —— `DimensionFinding.drivenBy`。 */
  toolId: ToolId;
  /** 哪一格：面向 key，或 `'overall'`。 */
  sectionKey: string;
  direction: BaselineDirection;
  /** 家長端怎麼稱呼它：达成率／独立率／关切率。 */
  label: string;
}

export interface SmartGoal {
  dimensionId: DimensionCode;
  /** 只會是 `watch` 或 `refer` —— 沒有判定的維度不出目標。 */
  band: Extract<Band, 'watch' | 'refer'>;
  /** 家長看到的維度名稱，＝正式站九宮格上的那個詞（`dimensionMap.ts`）。 */
  area: string;
  /** 沒有原生百分比時為 `null`，句子改走退路那一套。 */
  baseline: GoalBaseline | null;
  /** 四週與十二週的目標百分比；`baseline` 是 `null` 時一起是 `null`。 */
  milestones: Milestones | null;
  /** 十二週的長期目標句。 */
  longTerm: string;
  /** 四週的短期目標句。 */
  shortTerm: string;
  /** 怎麼量：一句話，含三個數字（或退路那句）。 */
  measure: string;
}

/** 哪幾族有可以當起點的原生百分比，家長端叫它什麼（檔頭「起點百分比」）。 */
const BASELINE_BY_FAMILY: Readonly<Partial<Record<ScoringFamily, { label: string; direction: BaselineDirection }>>> = {
  achievement: { label: '达成率', direction: 'higher_better' },
  pass: { label: '达成率', direction: 'higher_better' },
  independence: { label: '独立率', direction: 'higher_better' },
  concern: { label: '关切率', direction: 'lower_better' },
};

function isGoalBand(band: DimensionFinding['band']): band is 'watch' | 'refer' {
  return band === 'watch' || band === 'refer';
}

interface Cell {
  key: string;
  stat: SectionStat;
}

/**
 * 兩格裡比較該擔心的那一格（達成率取低的、關切率取高的），＝把 band 推上去的那一格。
 *
 * ⚠️ **今天沒有輸入走得到「兩格」。** 四個 baseline 族的 `feeds` 全部是 `'overall'` 或
 * 單元素陣列（dev 每個維度一個領域、asq 的 LANG 只有 CO）；附錄 F 裡真正多面向的兩組
 * （`snap-iv` 的 IA／HI、`sxk-warn` 的 i3／i4）都在 `BASELINE_BY_FAMILY` 之外。留著是因為
 * `ToolFeed.sections` 的型別允許多格，而哪天真有一支多面向的工具落進這四族時，**這裡挑的
 * 那一格與 `ToolRule.bandFor` 判 band 用的那一格不保證是同一格** —— 兩邊不是同一段邏輯。
 * 要走到那一步時，先讓規則層把「是哪一格推的」吐出來，而不是在這裡猜。（勘誤 L3）
 */
function worseOf(a: Cell, b: Cell, direction: BaselineDirection): Cell {
  const pa = a.stat.pct as number;
  const pb = b.stat.pct as number;
  return direction === 'higher_better' ? (pb < pa ? b : a) : (pb > pa ? b : a);
}

/**
 * 這個維度的起點：`drivenBy` 那一支、餵這個維度的那幾格裡最該擔心的一格的 `pct`。
 *
 * 回 `null` 的四種情形，對呼叫端都是同一件事（寫退路那句）：沒有 `drivenBy`（band 不是三級、
 * 或舊快照沒記）、`toolResults` 裡找不到那一支（舊快照）、那一族沒有可用的百分比、
 * 那幾格都不單獨判讀或算不出百分比（`scored=false`、`pct=null`，例如 dev 一個領域全「不評」）。
 */
export function baselineOf(
  dimension: DimensionFinding,
  toolResults: ReadonlyArray<ToolResult>,
): GoalBaseline | null {
  if (dimension.drivenBy === null) return null;
  const result = toolResults.find(r => r.toolId === dimension.drivenBy);
  if (result === undefined) return null;

  const meta = BASELINE_BY_FAMILY[TOOL_SPECS[result.toolId].family];
  if (meta === undefined) return null;

  const sections = sectionsFor(result.toolId, dimension.dimensionId);
  if (sections === null) return null;
  const cells: Cell[] = sections === 'overall'
    ? [{ key: 'overall', stat: result.overall }]
    : sections
      .map(key => ({ key, stat: result.sections[key] }))
      .filter((c): c is Cell => c.stat !== undefined);

  const usable = cells.filter(c => c.stat.scored && c.stat.pct !== null);
  if (usable.length === 0) return null;

  const worst = usable.reduce((a, b) => worseOf(a, b, meta.direction));
  return {
    pct: worst.stat.pct as number,
    toolId: result.toolId,
    sectionKey: worst.key,
    direction: meta.direction,
    label: meta.label,
  };
}

/** 檔頭「四週與十二週的數字」：把與上限（或下限）的差距縮一半，再縮一半。 */
export function milestonesFrom(pct: number, direction: BaselineDirection): Milestones {
  if (direction === 'higher_better') {
    const long = pct >= GOAL_CEILING ? pct : pct + Math.ceil((GOAL_CEILING - pct) / 2);
    return { short: pct + Math.ceil((long - pct) / 2), long };
  }
  const long = pct <= GOAL_FLOOR ? pct : pct - Math.ceil((pct - GOAL_FLOOR) / 2);
  return { short: pct - Math.ceil((pct - long) / 2), long };
}

interface Sentences {
  longTerm: string;
  shortTerm: string;
  measure: string;
}

/**
 * 三套句型。`higher_better` 是原型那一套換成家長用語；`lower_better` 是關切率專用
 * （數字要往下）；`none` 是沒有原生值時的退路，整套句子裡**一個百分比都沒有**。
 */
const GOAL_SENTENCES: Readonly<Record<
  BaselineDirection,
  (name: string, t: GoalTemplate, pct: number, m: Milestones, label: string) => Sentences
>> = {
  higher_better: (name, t, pct, m, label) => ({
    longTerm: `${name}能在 12 周内，${t.activity}时，由目前约 ${pct}% 提升到 ${m.long}% 以上（${t.criterion}）。`,
    shortTerm: `${name}能在 4 周内，${t.activity}时，先达到 ${m.short}%。`,
    measure: `量化方式：在家中以每 10 次机会里做到几次来记（${label}）；起点 ${pct}%、4 周 ${m.short}%、12 周 ${m.long}%。`,
  }),
  lower_better: (name, t, pct, m, label) => ({
    longTerm: `${name}能在 12 周内，${t.activity}时，需要大人多帮一把的情况由目前约 ${pct}% 减到 ${m.long}% 以下，逐步做到${t.criterion}。`,
    shortTerm: `${name}能在 4 周内，${t.activity}时，需要大人多帮一把的情况先降到 ${m.short}%。`,
    measure: `量化方式：在家中以家长每周记录到的次数占机会数的比例来记（${label}）；起点 ${pct}%、4 周 ${m.short}%、12 周 ${m.long}%。`,
  }),
};

function fallbackSentences(name: string, t: GoalTemplate): Sentences {
  return {
    longTerm: `${name}能在 12 周内，${t.activity}时，稳定做到${t.criterion}。`,
    shortTerm: `${name}能在 4 周内，${t.activity}时，做到的次数比第一周多。`,
    measure: `量化方式：在家中以每 10 次机会里做到几次来记；${NO_BASELINE_NOTE}，4 周与 12 周都对照这个起点看。`,
  };
}

export interface SmartGoalOptions {
  /** 家長填的孩子名字。空字串與沒給一樣，用 `DEFAULT_CHILD_NAME`。 */
  childName?: string;
}

/**
 * `T2Findings` → 最多三條 SMART 目標（§8），依 §8 的維度排序。
 *
 * 被標記的維度一個都沒有 → 空陣列（不是錯，也不湊）。回傳的每個物件都是新的。
 */
export function buildSmartGoals(findings: T2Findings, options: SmartGoalOptions = {}): SmartGoal[] {
  const name = options.childName?.trim() || DEFAULT_CHILD_NAME;

  const goals: SmartGoal[] = [];
  for (const dimension of prioritizeDimensions(findings)) {
    if (goals.length >= MAX_GOALS) break;
    if (!isGoalBand(dimension.band)) continue;

    const template = GOAL_TEMPLATES[dimension.dimensionId];
    const baseline = baselineOf(dimension, findings.toolResults);
    let milestones: Milestones | null = null;
    let sentences: Sentences;
    if (baseline === null) {
      sentences = fallbackSentences(name, template);
    } else {
      milestones = milestonesFrom(baseline.pct, baseline.direction);
      sentences = GOAL_SENTENCES[baseline.direction](name, template, baseline.pct, milestones, baseline.label);
    }

    goals.push({
      dimensionId: dimension.dimensionId,
      band: dimension.band,
      area: SITE_DIMENSION_NAME[dimension.dimensionId],
      baseline,
      milestones,
      ...sentences,
    });
  }
  return goals;
}

/**
 * 維度彙整與 `T2Findings`（規格 v2 §5.7、§5.8，#52）。
 *
 * 【這一層做什麼】
 * 兩個純函式。`aggregateDimensions` 把一組 `ToolResult` 各自過規則表（#47–#51），彙成九個
 * `DimensionFinding`；`buildT2Findings` 再把它們跟 T1 九碼、診斷方向、每支工具最新且完整的
 * 那一筆包成 `T2Findings` —— T2 的唯一真相，報告、活動配對、SMART 目標都只讀它。
 *
 * 【這一層不做什麼】
 * 不讀原始答案、不看分數、不判 tier。band／標籤／caveats 全部是 `ToolRule` 吐的，這裡只做
 * 「取最差、記是誰、聯集去重」。唯一碰 `sections` 的地方是 `severeFor`（規則層自己的函式）：
 * 一支多維度工具（dev、asq）出了 `severity.severe`，得知道落在哪一格，而規則表的 `tags()` 是
 * 整支工具一串，分不出來。
 *
 * 【一個維度的 band 怎麼定】（§5.7；順序就是優先順序）
 * 1. T1 紅或黃、而這個月齡沒有任何會出 band 的工具餵它 → `no_tool`（§4.5，跟 `planT2` 同一條）。
 * 2. T1 紅、星號工具沒有完整的一筆 → `partial`；T1 黃 → `not_assessed`。星號做了、但對這個
 *    維度算不出 band（dev 一個領域全「不評」）也算沒做完 —— 塌成 `clear` 就是「沒做完」被讀成
 *    「沒事」。加測工具的結果**不代表整個維度**：標籤與 caveats 照收，band 不從它們算。
 * 3. 其餘 → `max(各工具對此維度的 band)`（refer > watch > clear）；一支都沒有 → `clear`。
 *    T1 綠的維度也走這條：為 LANG 做的 sxk-dev 也餵 MOT，MOT 領域 tier 3 就是 `refer`，不因為
 *    T1 沒標就藏起來 —— §5.7「漏掉後者比多看一次糟」。`few_items` 之類的 caveat 會跟著過去，
 *    報告層拿它決定講多重。
 *
 * 【哪一支算「做了這個維度」】
 * 登錄表說它餵這個維度（band 用的 feeds；只出標籤的三支 chexi／tempa／tempb 的 feeds 也算）、
 * 或它吐的標籤有一個前綴是這個維度、或它的 `severity.severe` 落在這個維度。三者任一。
 * 標籤歸哪個維度一律看前綴（`tagDimension`），不看 feeds —— 氣質餵 EMO 卻會出
 * `learn.task_persistence`，那要落在 LEARN（見 `types.ts` 的 `ToolFeed`）。
 *
 * 【順序】
 * 「先做完」看 `computedAt`，不看陣列順序（API 進來的順序是前端送的，不可靠）。`tools` 依完成
 * 順序；`tags` 與 `caveats` 是 `drivenBy` 那支的先、其餘依完成順序，去重。`severity.severe`
 * 若在，排到最前 —— 它是嚴重度標記不是練習標的，截到 10 個時（§5.5）不能被截掉。
 */

import type { ToolId } from './toolkit';
import { TOOLKIT_VERSION } from './toolkit';
import type { Caveat } from './caveats';
import { SEVERITY_TAG } from './sectionTags';
import { tagDimension } from './findingTags';
import type { FindingTag } from './findingTags';
import { feedsDimension } from './toolSpecs';
import { RULES_VERSION } from './scoring';
import { candidatesFor, planT2 } from './routing';
import { ruleFor, severeFor } from './rules';
import { DIMENSION_CODES } from './types';
import type {
  Band,
  DiagnosisDirection,
  DimensionBand,
  DimensionCode,
  DimensionFinding,
  RedoNote,
  T1Flag,
  T2Findings,
  ToolResult,
} from './types';

/** `T2Findings` 這個形狀的版本（§5.8；v1 規格是 2）。 */
export const T2_FINDINGS_VERSION = 3 as const;

/** 每個維度最多幾個標籤（§5.5「每個維度不超過 10 個」）。 */
export const MAX_TAGS_PER_DIMENSION = 10;

const BAND_RANK: Readonly<Record<Band, number>> = { clear: 0, watch: 1, refer: 2 };

/**
 * 一筆結果算不算「完整」：本次出的題全答了，而且至少出了一題。
 * 現在的計分層（#46）算不出這種東西 —— 缺答與零題都拒算 —— 但舊紀錄會有：
 * 一筆存了半年的結果被改過窗口的登錄表重讀時，`askedCount` 可能比當時多。
 */
export function isCompleteResult(r: ToolResult): boolean {
  return r.askedCount > 0 && r.answeredCount >= r.askedCount;
}

function timeOf(r: ToolResult): number {
  const t = Date.parse(r.computedAt);
  if (Number.isNaN(t)) {
    throw new Error(`findings：${r.toolId} 的 computedAt 不是能解析的時間：${JSON.stringify(r.computedAt)}`);
  }
  return t;
}

/**
 * 每支工具**最新且完整**的一筆（§5.1「重做」、§5.8），依完成順序（早的在前）。
 *
 * 「最新」看 `computedAt`；同一支、同一時刻兩筆，輸入裡後面那筆算較新（存進去的順序）。
 * 沒做完的那幾筆整個不算 —— 較新的一筆沒做完就用較舊完整的，不是用較新的、也不是沒有。
 * 回傳的是輸入裡的原物件（不複製 `ToolResult`，它是值物件，這一層不改它）。
 */
export function latestCompleteResults(results: ReadonlyArray<ToolResult>): ToolResult[] {
  const latest = new Map<ToolId, { r: ToolResult; t: number; i: number }>();
  results.forEach((r, i) => {
    if (!isCompleteResult(r)) return;
    const t = timeOf(r);
    const cur = latest.get(r.toolId);
    if (!cur || t >= cur.t) latest.set(r.toolId, { r, t, i });
  });
  return [...latest.values()]
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(x => x.r);
}

/** 幾天之內的重做要標出來（§10.2 第 2 項）。 */
export const REDO_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 這一批結果裡，哪幾支是「`REDO_WINDOW_DAYS` 天內重做的」（§10.2 第 2 項）。
 *
 * 對每支工具取**最新且完整**的那一筆與它前一筆完整結果，相距 ≤ 30 天就記一條，天數無條件
 * 捨去到整數天（同一天重做是 0）。順序照 `latestCompleteResults`（完成順序）。
 *
 * 【為什麼只比前一筆，不比更早的】
 * 練習效應是「上一次答過同一份題目」帶來的。第三次答的時候，會影響它的是第二次，不是半年前
 * 的第一次 —— 拿最舊的那筆來比，會在一支答過三次的工具上算出一個沒有人需要的大數字。
 *
 * 【沒做完的那幾筆不算「上一次」】
 * 與 `latestCompleteResults` 同一條規則：半途離開的那一次，題目也只看了一半。
 */
export function redoNotes(results: ReadonlyArray<ToolResult>): RedoNote[] {
  const byTool = new Map<ToolId, Array<{ t: number; i: number }>>();
  results.forEach((r, i) => {
    if (!isCompleteResult(r)) return;
    const list = byTool.get(r.toolId) ?? [];
    list.push({ t: timeOf(r), i });
    byTool.set(r.toolId, list);
  });

  const notes: Array<{ note: RedoNote; t: number; i: number }> = [];
  for (const [toolId, list] of byTool) {
    if (list.length < 2) continue;
    // 「最新」的挑法與 `latestCompleteResults` 一字不差：時間相同時輸入裡後面那筆算較新。
    const sorted = [...list].sort((a, b) => a.t - b.t || a.i - b.i);
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const days = Math.floor((latest.t - previous.t) / MS_PER_DAY);
    if (days <= REDO_WINDOW_DAYS) notes.push({ note: { toolId, daysSinceLast: days }, t: latest.t, i: latest.i });
  }
  return notes.sort((a, b) => a.t - b.t || a.i - b.i).map(x => x.note);
}

/** 一支工具對一個維度貢獻的東西：規則表吐的，按維度切好。 */
interface Contribution {
  toolId: ToolId;
  band: Band | null;
  severe: boolean;
  /** 前綴是這個維度的標籤（不含 `severity.severe`）。 */
  tags: FindingTag[];
  caveats: Caveat[];
}

function contributionFor(r: ToolResult, dimension: DimensionCode): Contribution | null {
  const rule = ruleFor(r.toolId);
  const prefix = dimension.toLowerCase();
  const tags = rule.tags(r).filter(t => tagDimension(t) === prefix);
  const severe = severeFor(r, dimension);
  const band = rule.bandFor(r, dimension);
  if (band === null && tags.length === 0 && !severe && !feedsDimension(r.toolId, dimension)) return null;
  return { toolId: r.toolId, band, severe, tags, caveats: rule.caveats(r) };
}

function dedupe<T>(values: ReadonlyArray<T>): T[] {
  return [...new Set(values)];
}

/** 這個維度的 band 狀態（檔頭「一個維度的 band 怎麼定」的 1–3 條）與是誰推的。 */
function bandOf(
  dimension: DimensionCode,
  flag: T1Flag,
  ageMonth: number,
  noTool: ReadonlyArray<DimensionCode>,
  contributions: ReadonlyArray<Contribution>,
): { band: DimensionBand; drivenBy: ToolId | null } {
  if (flag !== 0) {
    if (noTool.includes(dimension)) return { band: 'no_tool', drivenBy: null };
    const star = candidatesFor(dimension, ageMonth)[0];
    const starBand = contributions.find(c => c.toolId === star)?.band ?? null;
    if (starBand === null) return { band: flag === 2 ? 'partial' : 'not_assessed', drivenBy: null };
  }
  let best: Contribution | null = null;
  for (const c of contributions) {
    if (c.band !== null && (best === null || BAND_RANK[c.band] > BAND_RANK[best.band as Band])) best = c;
  }
  return best === null ? { band: 'clear', drivenBy: null } : { band: best.band as Band, drivenBy: best.toolId };
}

/**
 * 一組 `ToolResult` → 九個 `DimensionFinding`（§5.7），順序照 `DIMENSION_CODES`。
 *
 * - `results`：任何順序、任何筆數；這裡先用 `latestCompleteResults` 篩成每支一筆。
 * - `t1Flags`、`ageMonth`、`diagnosis`：與 `planT2` 同一組輸入、同一套檢查（月齡要是非負整數、
 *   九個標記都要是 0／1／2、診斷方向要認得）。`no_tool` 直接取 `planT2` 的 `noTool`；診斷方向
 *   不影響它（診斷帶進來的也是窗口內的工具，能餵的維度早就在候選裡），傳進來只為了同一套驗證。
 *
 * 回傳的每個物件與陣列都是新的。
 */
export function aggregateDimensions(
  results: ReadonlyArray<ToolResult>,
  t1Flags: Readonly<Record<DimensionCode, T1Flag>>,
  ageMonth: number,
  diagnosis?: DiagnosisDirection | null,
): DimensionFinding[] {
  const { noTool } = planT2(t1Flags, ageMonth, diagnosis);
  const selected = latestCompleteResults(results);

  return DIMENSION_CODES.map(dimension => {
    const contributions = selected
      .map(r => contributionFor(r, dimension))
      .filter((c): c is Contribution => c !== null);
    const flag = t1Flags[dimension];
    const { band, drivenBy } = bandOf(dimension, flag, ageMonth, noTool, contributions);

    // drivenBy 的先、其餘依完成順序（contributions 已經是完成順序）
    const ordered = drivenBy === null
      ? contributions
      : [...contributions.filter(c => c.toolId === drivenBy), ...contributions.filter(c => c.toolId !== drivenBy)];
    const severe = ordered.some(c => c.severe);
    const tags = dedupe([
      ...(severe ? [SEVERITY_TAG] : []),
      ...ordered.flatMap(c => c.tags),
    ]).slice(0, MAX_TAGS_PER_DIMENSION);

    return {
      dimensionId: dimension,
      band,
      drivenBy,
      tags,
      caveats: dedupe(ordered.flatMap(c => c.caveats)),
      tools: contributions.map(c => c.toolId),
      t1Flag: flag,
    };
  });
}

export interface T2FindingsInput {
  /** 這個孩子在 T2 做過的全部 `ToolResult`（含重做的、含舊紀錄）；這裡自己挑每支最新且完整的。 */
  results: ReadonlyArray<ToolResult>;
  t1Flags: Readonly<Record<DimensionCode, T1Flag>>;
  /** 實足月齡，整數月不進位。 */
  assessedAgeMonth: number;
  sex?: 'boy' | 'girl';
  /** 沒填、`null`、空字串（中控台「未定」）三者一樣，存成 `null`。 */
  diagnosisDirection?: DiagnosisDirection | null;
  /** 只有測試會傳；正式路徑用現在時間。 */
  computedAt?: string;
}

/**
 * 組 `T2Findings`（§5.8）：九個維度都在（含 clear）、每支工具最新且完整的一筆、T1 九碼、
 * 診斷方向、版本三件（形狀、題庫、門檻）、計算時間。
 */
export function buildT2Findings(input: T2FindingsInput): T2Findings {
  const diagnosis = input.diagnosisDirection == null || (input.diagnosisDirection as string) === ''
    ? null
    : input.diagnosisDirection;
  const toolResults = latestCompleteResults(input.results);
  const dimensions = aggregateDimensions(toolResults, input.t1Flags, input.assessedAgeMonth, diagnosis);

  const t1 = {} as Record<DimensionCode, T1Flag>;
  for (const d of DIMENSION_CODES) t1[d] = input.t1Flags[d];

  const child: T2Findings['child'] = { assessedAgeMonth: input.assessedAgeMonth };
  if (input.sex !== undefined) child.sex = input.sex;

  const findings: T2Findings = {
    version: T2_FINDINGS_VERSION,
    toolkitVersion: TOOLKIT_VERSION,
    rulesVersion: RULES_VERSION,
    child,
    t1,
    diagnosisDirection: diagnosis,
    dimensions,
    toolResults,
    computedAt: input.computedAt ?? new Date().toISOString(),
  };
  // 一支都沒有時整個欄位不在（`RedoNote` 的註解）。
  const redos = redoNotes(input.results);
  if (redos.length > 0) findings.redos = redos;
  return findings;
}

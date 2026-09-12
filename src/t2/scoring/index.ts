/**
 * 計分引擎：一支工具的一次作答 → `ToolResult`（規格 §5.1 後半、§5.2、§5.3）。
 *
 * 【這一層做什麼】
 * 出題（哪些題該問）、完整性（是不是全答了）、窗口（這個月齡能不能算）、
 * 原生計分（各面向與總體的 n／raw／max／pct）、分級（tier）、`scored`。
 *
 * 【這一層不做什麼】
 * 不判 band、不出發現標籤、不產 caveat。那些在 #47 的 22 張規則表，讀的是這裡
 * 吐出來的 `ToolResult`。分工的理由很實際：門檻改一次要換 `rulesVersion`，而
 * 「85 分以上是 tier 1」與「tier 1 對家長講什麼」改動的頻率差很多。
 *
 * 【唯一的例外，講在前面】
 * `sxk-warn` 的 tier 會看前置題。§5.3 那一列寫的是「0 **且無倒退**：初篩未見異常／
 * 任一陽性**或任一倒退**：初篩異常」—— 倒退勾了就是異常，分數是 0 也一樣。其餘
 * 21 支的前置題一律只是原樣存進 `pre`，不碰任何數字（見 `applyWarnRegression`）。
 */

import { TOOLKIT, TOOLKIT_VERSION, askedSections } from '../toolkit';
import type { ToolId, ToolkitBank, ToolkitItem, ToolkitSection, ToolkitTier } from '../toolkit';
import { TOOL_SPECS, inWindow } from '../toolSpecs';
import { CHEXI_FACTORS } from '../sectionTags';
import type { SectionStat, Tier, ToolResult } from '../types';
import { FAMILIES } from './families';
import type { AnswerValue } from './families';
import { tierFor } from './tiers';

export { tierFor, intervalOf } from './tiers';
export { FAMILIES } from './families';
export type { AnswerValue, FamilyScorer, RawStat } from './families';
export type { TierInterval } from './tiers';

/** 本次計分規則的版本。門檻或算法改了就要換 —— 舊報告記著舊版本，才知道是怎麼算出來的。 */
export const RULES_VERSION = 'v2-2026-09-11' as const;

export interface ScoreInput {
  toolId: ToolId;
  /** 實足月齡，整數月不進位。 */
  assessedAgeMonth: number;
  rater: ToolResult['rater'];
  /** 題 key → 值。key 由 `askedItems()` 給，不要自己拼。 */
  answers: Record<string, AnswerValue>;
  /** 前置題答案，原樣存進 `ToolResult.pre`。 */
  pre?: Record<string, string | string[] | boolean>;
  /** 只有測試會傳；正式路徑用現在時間。 */
  computedAt?: string;
}

/**
 * 拒算。五種都**不產生 `ToolResult`** —— 沒有半套結果這種東西，一支工具要嘛算得出
 * 一筆完整的，要嘛什麼都沒有。
 *
 * `incomplete` 與 `age_out_of_window` 同時也是 caveat 值（§5.6），但那兩個 caveat
 * 是給**舊紀錄**用的：一筆早就存下來的結果被新版窗口重讀時會帶上它。現在這一刻
 * 算不出來的，回這裡的拒算。
 */
export type ScoreRefusal =
  | {
      ok: false;
      reason: 'age_out_of_window';
      toolId: ToolId;
      assessedAgeMonth: number;
      windowMonths: { lo: number; hi: number };
    }
  | {
      ok: false;
      reason: 'no_items_at_age';
      toolId: ToolId;
      assessedAgeMonth: number;
      /** 登錄表說的窗口 —— 與這個月齡實際出得了幾題**不一致**時才會走到這裡。 */
      windowMonths: { lo: number; hi: number };
    }
  | {
      ok: false;
      reason: 'incomplete';
      toolId: ToolId;
      askedCount: number;
      answeredCount: number;
      /** 沒答的題 key，照出題順序。 */
      missing: string[];
    }
  | {
      ok: false;
      reason: 'unexpected_answer';
      toolId: ToolId;
      /** 送來了、但這個月齡根本沒出的題 key。 */
      unexpected: string[];
    }
  | {
      ok: false;
      reason: 'invalid_answer';
      toolId: ToolId;
      /** 值不在 §3.1 值域內的題。 */
      invalid: Array<{ key: string; value: AnswerValue }>;
    };

export type ScoreOutcome = { ok: true; result: ToolResult } | ScoreRefusal;

/** 本次要出的一題：題 key、屬於哪個面向、題目本身。 */
export interface AskedItem {
  key: string;
  sectionKey: string;
  item: ToolkitItem;
}

/**
 * 面向 key 在這支工具裡會重複嗎。
 *
 * 只有 `sxk-dev` 會（6 領域 × 6 年齡段，每段都有一個叫 `MOT` 的面向），所以它的
 * 題 key 要加年齡段前綴 —— 規格附錄 A 寫的 `${band}.${domain}.${idx}` 就是這個。
 * 這裡用「面向 key 有沒有重複」判斷而不是寫死 `id === 'sxk-dev'`：日後題庫再出現
 * 同樣結構的工具時，不會有人因為沒想到而讓兩個面向共用同一組題 key。
 */
const NEEDS_BAND_PREFIX = new WeakMap<ToolkitBank, boolean>();

function needsBandPrefix(bank: ToolkitBank): boolean {
  const cached = NEEDS_BAND_PREFIX.get(bank);
  if (cached !== undefined) return cached;
  const seen = new Set<string>();
  let repeats = false;
  for (const s of bank.sections) {
    if (seen.has(s.key)) {
      repeats = true;
      break;
    }
    seen.add(s.key);
  }
  NEEDS_BAND_PREFIX.set(bank, repeats);
  return repeats;
}

/** 一題的 key。`sxk-dev` 是 `25-36.MOT.1`，其餘 21 支是 `P1.1` 這種。 */
export function answerKey(bank: ToolkitBank, section: ToolkitSection, item: ToolkitItem): string {
  const prefix = needsBandPrefix(bank) && section.ageBand ? `${section.ageBand.key}.` : '';
  return `${prefix}${section.key}.${item.no}`;
}

/**
 * 這個月齡本次要出的題，照面向順序攤平。
 *
 * 家長端建表單（#58）與伺服器驗收卷（#57）都該用這一份，不要各自依 `startMonth`
 * 再篩一次 —— 兩邊篩法只要差一題，交卷就會永遠回 `incomplete`。
 */
export function askedItems(toolId: ToolId, ageMonth: number): AskedItem[] {
  const bank = TOOLKIT[toolId];
  const out: AskedItem[] = [];
  for (const section of askedSections(bank, ageMonth)) {
    for (const item of section.items) {
      out.push({ key: answerKey(bank, section, item), sectionKey: section.key, item });
    }
  }
  return out;
}

/**
 * 這個面向要不要**單獨判讀**（§5.2）。
 *
 * 題數不足時分數照算，只是不單獨成一句話、不出標籤 —— 三題以下的達成率抖得太
 * 厲害（達成率族 `minItems` 是 3，一題的差距就是 33 個百分點）。`sxk-adl` 的
 * 括約肌領域只有兩題，剛好踩在獨立率族的 2 上，所以那條線不能再往上調。
 */
export function isScored(toolId: ToolId, n: number): boolean {
  return n >= TOOL_SPECS[toolId].minItems;
}

function statOf(
  toolId: ToolId,
  n: number,
  raw: number,
  max: number,
  pct: number | null,
  tier: Tier | null,
): SectionStat {
  return { n, raw, max, pct, tier, scored: isScored(toolId, n) };
}

/** 族專屬欄位寫進 `native`：總分不加後綴（`hi`），面向加面向 key（`hi.SE`）。 */
function putNative(
  target: ToolResult['native'],
  native: Record<string, number | number[]> | undefined,
  sectionKey?: string,
): void {
  if (!native) return;
  for (const [name, value] of Object.entries(native)) {
    target[sectionKey === undefined ? name : `${name}.${sectionKey}`] = value;
  }
}

/**
 * CHEXI 的兩個因素。副量表本身不判級，判級的是 F1（工作記憶 9 題＋計劃力 4）與
 * F2（抑制力 6＋調節力 5），`pct = round((Σ − n) ÷ (4n) × 100)`（§5.2）。
 *
 * 減 `n` 除以 `4n` 跟獨立率同一個道理：CHEXI 每題最低分是 1 不是 0，全部答
 * 「完全不正确」該是 0%。哪些副量表組成哪個因素讀 `CHEXI_FACTORS`（#42），
 * 不在這裡抄第二次。
 */
function chexiFactorStats(
  sections: ReadonlyArray<ToolkitSection>,
  valuesOf: (section: ToolkitSection) => AnswerValue[],
  tiers: ReadonlyArray<ToolkitTier>,
): Record<string, SectionStat> {
  const out: Record<string, SectionStat> = {};
  for (const factor of CHEXI_FACTORS) {
    const values = sections
      .filter(s => factor.sections.includes(s.key))
      .flatMap(s => valuesOf(s));
    const n = values.length;
    let raw = 0;
    for (const v of values) if (typeof v === 'number') raw += v;
    const pct = n === 0 ? null : Math.round(((raw - n) / (4 * n)) * 100);
    out[factor.key] = statOf('chexi', n, raw, n * 5, pct, tierFor('mean-chexi', tiers, pct));
  }
  return out;
}

/**
 * `sxk-att` 的 `native.hotSettings`：tier ≥ 2 的情境數（§5.9）。
 *
 * att 的五個面向是五個**情境**（課堂、作業、居家、人際、自我管理），報告要講「在幾個
 * 情境裡看得到」—— 這是 ADHD 判斷裡「跨場合」那一條的材料。放在這一層而不是規則表，
 * 是因為 `native` 是 `ToolResult` 的一部分、要存進資料庫；規則表（`rules/`）只讀
 * `ToolResult`，不寫它。只數 `scored` 的面向，跟面向級標籤的觸發條件一致（att 在窗口內
 * 五個情境都是 8 題、都 `scored`，所以這是一致性不是實際的分岔）。
 */
const HOT_SETTINGS_TOOL: ToolId = 'sxk-att';

function hotSectionCount(stats: Record<string, SectionStat>): number {
  let n = 0;
  for (const s of Object.values(stats)) if (s.scored && s.tier !== null && s.tier >= 2) n += 1;
  return n;
}

/** `pre` 的複本。值可能是陣列（複選題），所以陣列也要複製，不能只複製外層。 */
function copyPre(pre: ScoreInput['pre']): ToolResult['pre'] {
  const out: ToolResult['pre'] = {};
  for (const [key, value] of Object.entries(pre ?? {})) {
    out[key] = Array.isArray(value) ? [...value] : value;
  }
  return out;
}

/**
 * 前置題裡「什麼都沒有」的那個選項值（asb、asr、warn、spa、spb 五支都有，都是
 * `'none'`）。從題庫讀而不是寫死，題庫換字時跟著走。
 */
export function noneValueOf(bank: ToolkitBank, preKey: string): string | undefined {
  const option = bank.preQuestions.find(q => q.key === preKey)?.options?.find(o => o.exclusive);
  return option?.value;
}

/**
 * 前置題「倒退」有沒有勾。warn 在這一層用它改 tier；asb／asr 在規則表那一層
 * （`rules/asd.ts`）用它把 band 直接推成 `refer` —— 同一個判斷，只寫一次。
 *
 * ⚠️ **「沒有倒退」不是空陣列。** warn 的前置題是複選，「未见异常」是一個真的選項值
 * `'none'`（題庫標成 `exclusive`），家長勾它送出來的是 `['none']`；asb／asr 是單選，
 * 送出來的是 `'none'` 這個字串。早先這裡用「陣列非空」判斷，結果是每一個好好回答
 * 「沒有倒退」的孩子都被判初篩異常 —— 而那是最常走的一條路。
 *
 * 認不出「沒有」的值時（題庫換了形狀）一律當成有勾。warn 是紅旗初篩，多轉診一個
 * 比漏掉一個好；而且那個狀況會讓每一份 warn 都變 tier 3，看得見。
 * `test/t2Scoring.test.ts` 另有一條直接釘住那個值是 `'none'`，題庫先動測試就會紅。
 */
export function regressionReported(bank: ToolkitBank, pre: ScoreInput['pre']): boolean {
  const raw = pre?.regression;
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  const none = noneValueOf(bank, 'regression');
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some(v => v !== none);
}

/**
 * `sxk-warn` 的倒退勾：勾了就是初篩異常（tier 3），不論陽性數（§5.3）。
 *
 * 這是 22 支裡**唯一**一支前置題會影響 tier 的。分數本身不變 —— `raw`、`pct`、
 * `native.positives` 都還是只數陽性條目，動到的只有 tier。
 */
function applyWarnRegression(stat: SectionStat, bank: ToolkitBank, pre: ScoreInput['pre']): SectionStat {
  if (!regressionReported(bank, pre)) return stat;
  return { ...stat, tier: 3 };
}

/**
 * 算一支工具的一次作答。
 *
 * 檢查順序是窗口 → 零題 → 缺答 → 多餘 → 值域，五關都過才進計分。先擋窗口是因為窗口外的題
 * 本身就不該出（出了也算不得數），先報缺答沒有意義。
 */
export function scoreTool(input: ScoreInput): ScoreOutcome {
  const { toolId, assessedAgeMonth: age } = input;
  const spec = TOOL_SPECS[toolId];
  const bank = TOOLKIT[toolId];

  if (!inWindow(toolId, age)) {
    return {
      ok: false,
      reason: 'age_out_of_window',
      toolId,
      assessedAgeMonth: age,
      windowMonths: spec.windowMonths,
    };
  }

  const sections = askedSections(bank, age);
  const asked = askedItems(toolId, age);

  // 窗口內卻一題都出不了 —— 目前只有 `sxk-warn` 在整整 84 個月會這樣：登錄表照 §3
  // 寫窗口 3–84（閉區間），但工具包 HTML 自己說「本表适用未满 7 周岁」，最後一個
  // 時點只管到 83。沒有這一關的話會回一筆 `askedCount: 0`、`tier: null` 的結果，
  // 而下游讀起來跟「做完了、沒有異常」長得一模一樣。零題就是沒有結果。
  // （已記進 `docs/specs/t2-v2-errata-2026-09-11.md` D1，規格改版時把窗口改成 3–83。）
  if (asked.length === 0) {
    return { ok: false, reason: 'no_items_at_age', toolId, assessedAgeMonth: age, windowMonths: spec.windowMonths };
  }

  // 缺答一律拒算，**不以 0 補**（§5.1）。以 0 補會把「沒答」變成「做不到」，
  // 而那兩件事在報告裡是相反的結論。dev 的「不評」是一個合法的答案值，走到
  // 這裡時它已經在 `answers` 裡了，不算缺答。
  const missing = asked.filter(a => input.answers[a.key] === undefined).map(a => a.key);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: 'incomplete',
      toolId,
      askedCount: asked.length,
      answeredCount: asked.length - missing.length,
      missing,
    };
  }

  // 送來了、但這次沒出的題。計分不會讀它們（只掃 `asked`），所以分數不受影響 ——
  // 但 `answers` 是要存進資料庫、之後給作答回顧（#61）逐題重播的。放著不管的話，
  // 一個在 36 個月做過、又回頭補做 24 個月版本而前端沒清狀態的孩子，會存下 34 筆
  // 作答配上「答了 23 題」，回顧頁列出 11 題這次根本沒問過的題目。
  const askedKeys = new Set(asked.map(a => a.key));
  const unexpected = Object.keys(input.answers).filter(k => !askedKeys.has(k));
  if (unexpected.length > 0) {
    return { ok: false, reason: 'unexpected_answer', toolId, unexpected };
  }

  // 值域照題庫自己的選項（§3.1），不另立一份對照表。一個 0–2 的題收到 5 會讓
  // 達成率超過 100%，而那個結果看起來完全正常。
  const allowed = new Set<AnswerValue>(bank.options.map(o => o.value));
  const invalid = asked
    .filter(a => !allowed.has(input.answers[a.key]))
    .map(a => ({ key: a.key, value: input.answers[a.key] }));
  if (invalid.length > 0) {
    return { ok: false, reason: 'invalid_answer', toolId, invalid };
  }

  const family = FAMILIES[spec.family];
  const sectionTiers = bank.sectionTiers ?? bank.tiers;
  const valuesOf = (section: ToolkitSection): AnswerValue[] =>
    section.items.map(item => input.answers[answerKey(bank, section, item)]);

  const native: ToolResult['native'] = {};
  const stats: Record<string, SectionStat> = {};
  for (const section of sections) {
    const rs = family.section(valuesOf(section), section.items);
    const tier = tierFor(spec.family, sectionTiers, rs.tierValue);
    const stat = statOf(toolId, rs.n, rs.raw, rs.max, rs.pct, tier);
    stats[section.key] = toolId === 'sxk-warn' ? applyWarnRegression(stat, bank, input.pre) : stat;
    putNative(native, rs.native, section.key);
  }

  if (spec.family === 'mean-chexi') {
    Object.assign(stats, chexiFactorStats(sections, valuesOf, bank.tiers));
  }

  if (toolId === HOT_SETTINGS_TOOL) native.hotSettings = hotSectionCount(stats);

  const allValues = asked.map(a => input.answers[a.key]);
  const allItems = asked.map(a => a.item);
  const totalRaw = family.section(allValues, allItems);
  let overall: SectionStat;
  if (family.overall === 'counts-only') {
    // snap、chexi、氣質在 §5.2 的總分欄是「—」。`n`／`raw`／`max` 仍然留著
    // （報告要講「這份答了幾題」），pct 與 tier 是 null。
    overall = statOf(toolId, totalRaw.n, totalRaw.raw, totalRaw.max, null, null);
  } else {
    overall = statOf(
      toolId,
      totalRaw.n,
      totalRaw.raw,
      totalRaw.max,
      totalRaw.pct,
      tierFor(spec.family, bank.tiers, totalRaw.tierValue),
    );
    if (toolId === 'sxk-warn') overall = applyWarnRegression(overall, bank, input.pre);
    putNative(native, totalRaw.native);
  }

  return {
    ok: true,
    result: {
      toolId,
      toolkitVersion: TOOLKIT_VERSION,
      assessedAgeMonth: age,
      rater: input.rater,
      askedCount: asked.length,
      answeredCount: asked.length,
      // 複本，不是呼叫端傳進來的那個物件。`ToolResult` 是要存進資料庫、之後重讀的
      // 值物件；共用同一份的話，呼叫端之後就地改一下（把 `req.body.answers` 正規化、
      // 或把同一個 builder 重複用在下一支工具），已經算完的這一筆就會跟著變，而
      // `sections`／`overall` 還是舊的 —— 兩者從此對不起來，型別層攔不到，測試在
      // 乾淨的 import 下也照樣綠。#42 的 code review 已經踩過兩次同一類（14da8d1）。
      pre: copyPre(input.pre),
      answers: { ...input.answers },
      sections: stats,
      overall,
      native,
      computedAt: input.computedAt ?? new Date().toISOString(),
    },
  };
}

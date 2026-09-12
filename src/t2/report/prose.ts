/**
 * 報告文字的 schema 與驗證器（規格 v2 §6.3、§6.4，#55）。
 *
 * 【這一層做什麼】
 * 三件事，全是純函式：`T2ReportProse` 這個形狀（§6.3）、`validateProse`（schema ＋ 一致性 ＋
 * 黑名單），以及兩邊共用的字數規則。**不接模型、不碰資料庫** —— 呼叫哪個引擎、失敗退哪一條，
 * 是伺服器票（#59）的事。這一層只回答一個問題：「這份 JSON 能不能給家長看。」
 *
 * 【為什麼是「任一項不過，整份丟」】（§6.4）
 * 局部修補比整份丟危險。少一個維度就補一段、黑名單中一個字就挖掉那個詞 —— 補出來的那一段是
 * 誰寫的？挖掉「自闭症」之後剩下的那句話還通嗎？模型寫錯的時候，錯的通常不只那一處。整份丟、
 * 退模板，家長拿到的是一份確定沒有問題的報告，代價是它比較平。這個交換是規格定的。
 *
 * 【一致性檢查為什麼是這三條】
 * 1. **`perDimension` 的維度集合**＝`watch`／`refer`／`no_tool` 三種。少一個 watch 的維度 →
 *    家長看不到那一項為什麼被標記；多一個 `clear` 的維度 → 報告在講一件規則引擎沒說的事。
 *    `no_tool` 要有**專屬段落**：這個月齡沒有工具可做，跟做完了沒事是兩件事，而報告上最容易
 *    塌成同一句話（§5.7「四種非 band 值與 clear 必須分得開」）。
 * 2. **caveats 逐條對應**：§6.2「不可以省略 caveats」。模型會改寫句子，所以比不了字，比的是
 *    條數 —— 少一條就是少一個「這份結果該打的折」。`parent_report` 不算（§5.6「不單獨成句」）。
 * 3. **黑名單**：`blacklist.ts`。五類，其中 tier 內部名稱是從工具包算出來的。
 *
 * 【`safety_concern` 為什麼是「原樣照抄在 overview 最前面」】
 * §5.6 說它**報告置頂**。整份報告裡最該被讀到的一句話，不能交給模型改寫 —— 改寫過的版本讀起來
 * 有多急，我們事前不知道。所以規則是機械的：`overview` 以 `SAFETY_SENTENCE` 開頭，一字不改，
 * 字數範圍算在這一句**之後**（這一句不佔 overview 的額度）。
 *
 * 【字數怎麼算】
 * §6.3 寫的是「字」。中文一個字一個字元，所以 `charCount` 數的是**去掉空白之後的碼位數**
 * （不是 UTF-16 長度：emoji 不該算兩個字）。標點算進去 —— 排除標點要先決定哪些算標點，而
 * 中英文標點混用時那條線不好畫，算進去比較不會有人爭。
 *
 * 【範圍哪來的】
 * `overview` 60–120、`whatWeSaw` 80–150、`whyItMatters` 60–100、`temperament` 60–120 是 §6.3
 * 寫的。`weeklyPlanIntro` 與 `closing` **§6.3 沒給範圍**，這裡給的是寬鬆的界（60–250、30–150）：
 * 目的是擋「空字串」與「模型把整份報告塞進一個欄位」，不是替規格定字數。記在勘誤檔。
 */

import type { Caveat } from '../caveats';
import { REPORT_ONLY_TAGS } from '../findingTags';
import type { FindingTag } from '../findingTags';
import { TEMPERAMENT_TAGS } from '../sectionTags';
import { prioritizeDimensions } from '../dimensionOrder';
import { DIMENSION_CODES } from '../types';
import type { DimensionCode, DimensionFinding, T2Findings } from '../types';
import type { WeeklyActivities } from '../activityMatch';
import type { SmartGoal } from '../goals';
import { findBlacklisted } from './blacklist';
import { SAFETY_SENTENCE } from './sentences';

/** §6.3 的輸出 schema。`temperament` 只有在有氣質標籤時才在（見 `temperamentTagsOf`）。 */
export interface T2ReportProse {
  overview: string;
  perDimension: ProseDimension[];
  temperament?: string;
  weeklyPlanIntro: string;
  closing: string;
}

export interface ProseDimension {
  dimensionId: DimensionCode;
  whatWeSaw: string;
  whyItMatters: string;
  /** 逐條對應 `DimensionFinding.caveats`（扣掉 `parent_report`）。模型可以改寫，不可以少。 */
  caveats: string[];
}

/**
 * 寫一份報告要的全部素材：規則引擎的結論、已經選好的活動、已經算好的目標。
 * 三者都是**別人算完的**——這一層與 AI 都不重算、不改、不換（§6.2）。
 */
export interface T2ReportInput {
  findings: T2Findings;
  activities: WeeklyActivities;
  goals: ReadonlyArray<SmartGoal>;
  /** 家長填的孩子名字；沒有就用 `goals` 裡已經填好的那個主詞，這一層不再補。 */
  childName?: string;
}

/** `closing` 一定要含這一句（§6.3）。 */
export const CLOSING_SENTENCE = '若有疑虑请咨询专业人员';

/** 各欄位的字數範圍，閉區間。 */
export const CHAR_RANGES = {
  overview: { min: 60, max: 120 },
  whatWeSaw: { min: 80, max: 150 },
  whyItMatters: { min: 60, max: 100 },
  temperament: { min: 60, max: 120 },
  weeklyPlanIntro: { min: 60, max: 250 },
  closing: { min: 30, max: 150 },
} as const;

/** 報告會講到的 band：`watch`／`refer` 要一段，`no_tool` 也要一段（§6.4）。 */
export const REPORTED_BANDS: ReadonlyArray<DimensionFinding['band']> = ['watch', 'refer', 'no_tool'];

/**
 * 氣質段落認哪些標籤：`TEMPERAMENT_TAGS` 與「只進報告」的交集，算出來的。
 *
 * 氣質九向度另外會吐 `att.inattention`（D8）與 `learn.task_persistence`（D7），那兩個是 ★ 標籤、
 * 別的工具也產得出來 —— 拿它們當「做過氣質量表」的證據會誤判，所以不算在內。剩下的七個
 * （情緒本質那六個加反應閾）只有氣質量表產得出來，它們在就是氣質在。
 */
export const TEMPERAMENT_REPORT_TAGS: ReadonlyArray<FindingTag> = (() => {
  const reportOnly = new Set<string>(REPORT_ONLY_TAGS);
  const fromTemperament = new Set<FindingTag>();
  for (const side of Object.values(TEMPERAMENT_TAGS)) {
    for (const tag of [...side.hi, ...side.lo]) if (reportOnly.has(tag)) fromTemperament.add(tag);
  }
  return [...fromTemperament];
})();

/** 去掉空白之後的碼位數（檔頭「字數怎麼算」）。 */
export function charCount(text: string): number {
  return [...text.replace(/\s+/g, '')].length;
}

/** 這份 findings 要寫哪幾個維度的段落，依 §8 排序。 */
export function reportedDimensions(findings: T2Findings): DimensionFinding[] {
  return prioritizeDimensions(findings).filter(d => REPORTED_BANDS.includes(d.band));
}

/** 這個維度要寫幾條 caveat（扣掉不單獨成句的 `parent_report`）。 */
export function caveatsToVoice(dimension: DimensionFinding): Caveat[] {
  return dimension.caveats.filter(c => c !== 'parent_report');
}

/** 這份 findings 有哪些氣質標籤（九個維度的聯集，照 `TEMPERAMENT_REPORT_TAGS` 的順序）。 */
export function temperamentTagsOf(findings: T2Findings): FindingTag[] {
  const present = new Set<FindingTag>(findings.dimensions.flatMap(d => d.tags));
  return TEMPERAMENT_REPORT_TAGS.filter(t => present.has(t));
}

/** 有沒有自我傷害的那一條（§5.6，報告置頂）。 */
export function hasSafetyConcern(findings: T2Findings): boolean {
  return findings.dimensions.some(d => d.caveats.includes('safety_concern'));
}

export type ProseValidation =
  | { ok: true; prose: T2ReportProse }
  | { ok: false; errors: string[] };

const DIMENSION_SET: ReadonlySet<string> = new Set<string>(DIMENSION_CODES);

const PROSE_KEYS: ReadonlyArray<string> = ['overview', 'perDimension', 'temperament', 'weeklyPlanIntro', 'closing'];
const DIMENSION_KEYS: ReadonlyArray<string> = ['dimensionId', 'whatWeSaw', 'whyItMatters', 'caveats'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: ReadonlyArray<string>): string[] {
  return Object.keys(value).filter(k => !allowed.includes(k));
}

/** 一個字串欄位：型別、字數範圍。`where` 只進錯誤訊息。 */
function checkText(
  value: unknown,
  where: string,
  range: { min: number; max: number },
  errors: string[],
): string | null {
  if (typeof value !== 'string') {
    errors.push(`${where}：要是字串，拿到 ${value === undefined ? '缺這個欄位' : typeof value}`);
    return null;
  }
  const n = charCount(value);
  if (n < range.min || n > range.max) {
    errors.push(`${where}：${n} 字，超出 ${range.min}–${range.max} 的範圍`);
  }
  return value;
}

/** schema（§6.3）。回傳收集到的字串，供後面兩關掃黑名單。 */
function checkSchema(value: unknown, input: T2ReportInput, errors: string[]): {
  prose: T2ReportProse | null;
  texts: Array<{ where: string; text: string }>;
} {
  const texts: Array<{ where: string; text: string }> = [];
  if (!isRecord(value)) {
    errors.push(`整份：要是一個物件，拿到 ${Array.isArray(value) ? 'array' : typeof value}`);
    return { prose: null, texts };
  }
  const extra = unknownKeys(value, PROSE_KEYS);
  if (extra.length > 0) errors.push(`整份：多了不認得的欄位 ${extra.join('、')}`);

  // overview：safety_concern 在時，開頭要原樣照抄那一句，字數算在它之後
  let overview = value.overview;
  if (hasSafetyConcern(input.findings)) {
    if (typeof overview !== 'string' || !overview.startsWith(SAFETY_SENTENCE)) {
      errors.push(`overview：有 safety_concern，開頭要原樣是「${SAFETY_SENTENCE}」`);
      overview = typeof overview === 'string' ? overview : undefined;
    } else {
      overview = overview.slice(SAFETY_SENTENCE.length);
    }
  }
  checkText(overview, 'overview', CHAR_RANGES.overview, errors);
  if (typeof value.overview === 'string') texts.push({ where: 'overview', text: value.overview });

  if (!Array.isArray(value.perDimension)) {
    errors.push(`perDimension：要是陣列，拿到 ${value.perDimension === undefined ? '缺這個欄位' : typeof value.perDimension}`);
  } else {
    value.perDimension.forEach((entry, i) => {
      if (!isRecord(entry)) {
        errors.push(`perDimension[${i}]：要是一個物件`);
        return;
      }
      const entryExtra = unknownKeys(entry, DIMENSION_KEYS);
      if (entryExtra.length > 0) errors.push(`perDimension[${i}]：多了不認得的欄位 ${entryExtra.join('、')}`);
      const id = entry.dimensionId;
      const label = typeof id === 'string' && DIMENSION_SET.has(id) ? id : `[${i}]`;
      if (typeof id !== 'string' || !DIMENSION_SET.has(id)) {
        errors.push(`perDimension[${i}].dimensionId：不是九個維度之一，拿到 ${JSON.stringify(id)}`);
      }
      const saw = checkText(entry.whatWeSaw, `perDimension ${label}.whatWeSaw`, CHAR_RANGES.whatWeSaw, errors);
      const why = checkText(entry.whyItMatters, `perDimension ${label}.whyItMatters`, CHAR_RANGES.whyItMatters, errors);
      if (saw !== null) texts.push({ where: `perDimension ${label}.whatWeSaw`, text: saw });
      if (why !== null) texts.push({ where: `perDimension ${label}.whyItMatters`, text: why });
      if (!Array.isArray(entry.caveats)) {
        errors.push(`perDimension ${label}.caveats：要是陣列`);
      } else {
        entry.caveats.forEach((c, j) => {
          if (typeof c !== 'string' || c.trim() === '') {
            errors.push(`perDimension ${label}.caveats[${j}]：要是非空字串`);
            return;
          }
          texts.push({ where: `perDimension ${label}.caveats[${j}]`, text: c });
        });
      }
    });
  }

  // `null` 不當成「沒有這一段」：模型常常拿 null 表示「不適用」，而 `T2ReportProse.temperament`
  // 是 `string | undefined`。放過去的話，有氣質標籤時一致性檢查會看成「有這個欄位」而不報錯，
  // 家長就少了一整段。要嘛是字串，要嘛整個欄位不要有。
  if (value.temperament === null) {
    errors.push('temperament：要嘛是字串，要嘛整個欄位不要有；不要寫 null');
  } else if (value.temperament !== undefined) {
    const t = checkText(value.temperament, 'temperament', CHAR_RANGES.temperament, errors);
    if (t !== null) texts.push({ where: 'temperament', text: t });
  }

  const intro = checkText(value.weeklyPlanIntro, 'weeklyPlanIntro', CHAR_RANGES.weeklyPlanIntro, errors);
  if (intro !== null) texts.push({ where: 'weeklyPlanIntro', text: intro });

  const closing = checkText(value.closing, 'closing', CHAR_RANGES.closing, errors);
  if (closing !== null) {
    texts.push({ where: 'closing', text: closing });
    if (!closing.includes(CLOSING_SENTENCE)) errors.push(`closing：要含「${CLOSING_SENTENCE}」`);
  }

  return { prose: errors.length === 0 ? (value as unknown as T2ReportProse) : null, texts };
}

/** 一致性（§6.4）：維度集合、caveats 條數、氣質段落。 */
function checkConsistency(prose: T2ReportProse, input: T2ReportInput, errors: string[]): void {
  const expected = reportedDimensions(input.findings);
  const expectedIds = expected.map(d => d.dimensionId);
  const got = prose.perDimension.map(d => d.dimensionId);

  const dup = got.filter((d, i) => got.indexOf(d) !== i);
  if (dup.length > 0) errors.push(`perDimension：同一個維度出現兩次（${[...new Set(dup)].join('、')}）`);

  const missing = expectedIds.filter(d => !got.includes(d));
  const surplus = got.filter(d => !expectedIds.includes(d));
  if (missing.length > 0) {
    const detail = missing.map(d => `${d}(${expected.find(x => x.dimensionId === d)!.band})`).join('、');
    errors.push(`perDimension：少了要講的維度 ${detail}`);
  }
  if (surplus.length > 0) {
    const bandOf = (d: DimensionCode) => input.findings.dimensions.find(x => x.dimensionId === d)?.band ?? '不在 findings 裡';
    errors.push(`perDimension：多了不該講的維度 ${[...new Set(surplus)].map(d => `${d}(${bandOf(d)})`).join('、')}`);
  }

  for (const entry of prose.perDimension) {
    const finding = expected.find(d => d.dimensionId === entry.dimensionId);
    if (!finding) continue;
    const want = caveatsToVoice(finding);
    if (entry.caveats.length !== want.length) {
      errors.push(`perDimension ${entry.dimensionId}.caveats：要 ${want.length} 條（${want.join('、') || '無'}），拿到 ${entry.caveats.length} 條`);
    }
  }

  const temperament = temperamentTagsOf(input.findings);
  if (temperament.length > 0 && prose.temperament === undefined) {
    errors.push(`temperament：有氣質標籤（${temperament.join('、')}），要有這一段`);
  }
  if (temperament.length === 0 && prose.temperament !== undefined) {
    errors.push('temperament：沒有氣質標籤，不該有這一段');
  }
}

/**
 * 一份候選報告能不能給家長看：schema（§6.3）→ 一致性 ＋ 黑名單（§6.4）。
 *
 * `value` 是 `unknown`：模型回來的是剛 `JSON.parse` 的東西，什麼形狀都有可能。
 * schema 沒過就不做後面兩關 —— 形狀壞掉時談「維度集合對不對」只會生出一串跟著壞的訊息。
 * 任一項不過就是 `{ ok: false }`，**整份丟**（§6.4）；`errors` 是給日誌與測試看的，不給家長看。
 */
export function validateProse(value: unknown, input: T2ReportInput): ProseValidation {
  const errors: string[] = [];
  const { prose, texts } = checkSchema(value, input, errors);
  if (prose === null) return { ok: false, errors };

  checkConsistency(prose, input, errors);
  for (const { where, text } of texts) {
    for (const hit of findBlacklisted(text)) errors.push(`${where}：黑名單 ${hit}`);
  }

  return errors.length === 0 ? { ok: true, prose } : { ok: false, errors };
}


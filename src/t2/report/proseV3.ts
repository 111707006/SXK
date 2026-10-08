/**
 * 完整版報告（T2 v3，`T2FindingsV3`）的文字：形狀、驗證器、模板退路、「呼叫模型 → 驗證 → 不過就退模板」。
 *
 * 使用者 2026-10-08：「v3 報告要用 AI，跟之前 T1 報告串接相同即可」。引擎由呼叫端傳進來 —— 正式站傳
 * `generateReportJSON`（T1 報告同一串：Qwen → 豆包 → DashScope），這一層只認「回了一個東西」與「整個丟例外」。
 * 做法照舊版的 `generate.ts`／`prose.ts`（規格 v2 §6.4）：**任一項不過，整份丟、退模板**，不重試、不局部修補；
 * `aiEngine` 一樣分三種（引擎代號／`template:<引擎>`／`template:all_engines_failed`）。
 *
 * 【和舊版不同的地方】
 * - 完整版沒有發現標籤、沒有 caveat：段落的素材是那一維最重那一支的**面向**（哪幾面比較弱），不是標籤。
 * - 沒有每週活動與目標兩段：線上干預 2026-09-28 起不在報告裡，報告只留一行連結（規則輸出）。
 * - 生活品質、氣質、最上方提示、九宮格、作答回顧都是規則輸出（`reportCopyV3.ts`），模型只當背景讀，不寫那幾段。
 * - **不寫量表名稱**：客戶的量表名稱裡有《用语对照表》的禁字與舊黑名單的字（「自闭行为量表」「学习障碍量表」、
 *   `ASQ`／`TTS`／`BSQ`），模型與模板都只講維度。哪幾份問卷算進來由畫面的規則句列出。
 * - 字數範圍：v3 規格沒定，取寬鬆的界擋「空字串」與「整份塞進一欄」（**暫採**，R-34）。
 *
 * 這一檔的模板句在用字掃描裡；提示在 `promptV3.ts`（含禁止清單，不掃）。
 */

import { SITE_DIMENSION_NAME } from '../dimensionMap';
import type { T2FindingsV3 } from '../findingsV3';
import type { DimensionFindingV3 } from '../judgeV3';

import { STATUS_OF_BAND } from '../weeklyCopy';
import { STATUS_WORDING } from '../../utils/statusWording';
import type { DimensionCode } from '../types';
import { DIMENSION_CODES } from '../types';
import { findBlacklisted } from './blacklist';
import { KITV3_BANKS } from '../kitv3';
import { ALL_ENGINES_FAILED, templateEngineLabel, type ProseEngine } from './generate';
import { CLOSING_SENTENCE, charCount } from './prose';
import { DIMENSION_WHY } from './sentences';
import { buildProsePromptV3 } from './promptV3';

export interface T2ReportProseV3 {
  overview: string;
  perDimension: ProseDimensionV3[];
  closing: string;
}

export interface ProseDimensionV3 {
  dimensionId: DimensionCode;
  whatWeSaw: string;
  whyItMatters: string;
}

export interface T2ReportInputV3 {
  findings: T2FindingsV3;
  childName?: string;
}

/** 字數範圍（閉區間，去空白的碼位數，同 `charCount`）。暫採 R-34。 */
export const CHAR_RANGES_V3 = {
  overview: { min: 30, max: 200 },
  whatWeSaw: { min: 30, max: 160 },
  whyItMatters: { min: 30, max: 120 },
  closing: { min: 20, max: 160 },
} as const;

/** 要成段的維度：留意、關注、這個月齡沒有問卷（順序照快照＝`DIMENSION_CODES`）。 */
export const REPORTED_BANDS_V3: ReadonlyArray<DimensionFindingV3['band']> = ['refer', 'watch', 'no_tool'];

export function reportedDimensionsV3(findings: Pick<T2FindingsV3, 'dimensions'>): DimensionFindingV3[] {
  return findings.dimensions.filter(d => REPORTED_BANDS_V3.includes(d.band));
}

/**
 * 這一維最重那一支裡比較弱的面向（分段不是最好那一段的），去掉含禁字或黑名單字的面向名稱 ——
 * 客戶的面向名稱是題庫原文，可能踩到報告的黑名單（例如舊量表名）；講不出口的那一面就不點名。
 *
 * 一支量表涵蓋好幾個維度時（分齡發育綜合評估：沟通→語言、粗大／精細動作→動作、解决问题→認知、个人-社会→社交，
 * 題庫的 `domainDim`），只列**這一維**的面向 —— 否則語言、認知、社交三段各自寫出同一串「沟通、粗大动作、
 * 精细动作、解决问题」（2026-10-08 展示站實測）。
 */
export function weakFacetsV3(findings: Pick<T2FindingsV3, 'toolResults'>, d: DimensionFindingV3): string[] {
  if (!d.drivenBy) return [];
  const r = findings.toolResults.find(x => x.toolId === d.drivenBy);
  if (!r) return [];
  const domainDim = (KITV3_BANKS[r.toolId]?.scoring as { domainDim?: Record<string, DimensionCode> } | undefined)?.domainDim;
  return [...new Set(
    r.score.facets
      .filter(f => f.band !== null && f.band > 0)
      .filter(f => !domainDim || domainDim[f.key] === d.dimensionId)
      .map(f => f.name),
  )].filter(name => findBlacklisted(name).length === 0);
}

// ---------------------------------------------------------------------------
// 模板（模型不在或寫壞時）
// ---------------------------------------------------------------------------

/** 結尾。不重複「三个月后重评」：畫面上那一句是規則輸出，就在結尾上面。 */
export const TEMPLATE_CLOSING_V3 = `接下来可以照「线上干预」里安排的家庭活动，每周陪孩子练几次，变化会在日常里一点一点累积。${CLOSING_SENTENCE}。`;

function templateOverview(input: T2ReportInputV3): string {
  const { findings } = input;
  const who = input.childName || '孩子';
  const names = (band: string) => findings.dimensions.filter(d => d.band === band).map(d => `「${SITE_DIMENSION_NAME[d.dimensionId]}」`);
  const refer = names('refer');
  const watch = names('watch');
  const parts: string[] = [];
  parts.push(`这份报告整理了${who}近 3 个月填写的 ${findings.toolResults.length} 份问卷。`);
  if (refer.length) parts.push(`${refer.join('、')}${STATUS_WORDING.delay.tag}；`);
  if (watch.length) parts.push(`${watch.join('、')}${STATUS_WORDING.borderline.tag}；`);
  if (!refer.length && !watch.length) parts.push('这次做了问卷的方面，目前看起来都还在稳定的范围里；');
  parts.push('下面逐项说明，各方面的结果也列在总览里。');
  return parts.join('');
}

function templateWhatWeSaw(input: T2ReportInputV3, d: DimensionFindingV3): string {
  const name = SITE_DIMENSION_NAME[d.dimensionId];
  if (d.band === 'no_tool') {
    return `筛查时「${name}」这一项有标记，但这个年龄还没有适合家长在家填写的问卷，这次没有结果；可以预约专家当面多了解。`;
  }
  const status = STATUS_WORDING[STATUS_OF_BAND[d.band as 'watch' | 'refer']];
  const weak = weakFacetsV3(input.findings, d).slice(0, 4);
  const detail = weak.length
    ? `其中「${weak.join('」「')}」这几方面比较需要多陪孩子练。`
    : '这一项整体都可以在日常里多陪孩子练。';
  return `这次关于「${name}」的问卷看下来，${status.describe}，${status.tag}。${detail}`;
}

/** 模板退路。產出一定過 `validateProseV3`（`t2ReportProseV3.test.ts` 窮舉盯著）。 */
export function templateProseV3(input: T2ReportInputV3): T2ReportProseV3 {
  return {
    overview: templateOverview(input),
    perDimension: reportedDimensionsV3(input.findings).map(d => ({
      dimensionId: d.dimensionId,
      whatWeSaw: templateWhatWeSaw(input, d),
      whyItMatters: DIMENSION_WHY[d.dimensionId],
    })),
    closing: TEMPLATE_CLOSING_V3,
  };
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

export type ProseValidationV3 = { ok: true; prose: T2ReportProseV3 } | { ok: false; errors: string[] };

const DIMENSION_SET: ReadonlySet<string> = new Set<string>(DIMENSION_CODES);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkText(value: unknown, where: string, range: { min: number; max: number }, errors: string[]): string | null {
  if (typeof value !== 'string') {
    errors.push(`${where}：要是字串，拿到 ${value === undefined ? '缺這個欄位' : typeof value}`);
    return null;
  }
  const n = charCount(value);
  if (n < range.min || n > range.max) errors.push(`${where}：${n} 字，超出 ${range.min}–${range.max} 的範圍`);
  return value;
}

/** schema → 一致性（要成段的維度不多不少、不重複）→ 黑名單與《用语对照表》禁字。任一項不過整份丟。 */
export function validateProseV3(value: unknown, input: T2ReportInputV3): ProseValidationV3 {
  const errors: string[] = [];
  const texts: Array<{ where: string; text: string }> = [];
  if (!isRecord(value)) return { ok: false, errors: ['整份：要是一個物件'] };
  const extra = Object.keys(value).filter(k => !['overview', 'perDimension', 'closing'].includes(k));
  if (extra.length) errors.push(`整份：多了不認得的欄位 ${extra.join('、')}`);

  const overview = checkText(value.overview, 'overview', CHAR_RANGES_V3.overview, errors);
  if (overview !== null) texts.push({ where: 'overview', text: overview });
  const closing = checkText(value.closing, 'closing', CHAR_RANGES_V3.closing, errors);
  if (closing !== null) {
    texts.push({ where: 'closing', text: closing });
    if (!closing.includes(CLOSING_SENTENCE)) errors.push(`closing：要含「${CLOSING_SENTENCE}」`);
  }

  const got: string[] = [];
  if (!Array.isArray(value.perDimension)) {
    errors.push('perDimension：要是陣列');
  } else {
    value.perDimension.forEach((entry, i) => {
      if (!isRecord(entry)) {
        errors.push(`perDimension[${i}]：要是一個物件`);
        return;
      }
      const entryExtra = Object.keys(entry).filter(k => !['dimensionId', 'whatWeSaw', 'whyItMatters'].includes(k));
      if (entryExtra.length) errors.push(`perDimension[${i}]：多了不認得的欄位 ${entryExtra.join('、')}`);
      const id = entry.dimensionId;
      if (typeof id !== 'string' || !DIMENSION_SET.has(id)) errors.push(`perDimension[${i}].dimensionId：不是九個維度之一，拿到 ${JSON.stringify(id)}`);
      else got.push(id);
      const label = typeof id === 'string' ? id : `[${i}]`;
      const saw = checkText(entry.whatWeSaw, `perDimension ${label}.whatWeSaw`, CHAR_RANGES_V3.whatWeSaw, errors);
      const why = checkText(entry.whyItMatters, `perDimension ${label}.whyItMatters`, CHAR_RANGES_V3.whyItMatters, errors);
      if (saw !== null) texts.push({ where: `perDimension ${label}.whatWeSaw`, text: saw });
      if (why !== null) texts.push({ where: `perDimension ${label}.whyItMatters`, text: why });
    });
  }

  const expected = reportedDimensionsV3(input.findings).map(d => d.dimensionId as string);
  const dup = got.filter((d, i) => got.indexOf(d) !== i);
  if (dup.length) errors.push(`perDimension：同一個維度出現兩次（${[...new Set(dup)].join('、')}）`);
  const missing = expected.filter(d => !got.includes(d));
  const surplus = got.filter(d => !expected.includes(d));
  if (missing.length) errors.push(`perDimension：少了要講的維度 ${missing.join('、')}`);
  if (surplus.length) errors.push(`perDimension：多了不該講的維度 ${[...new Set(surplus)].join('、')}`);

  for (const { where, text } of texts) for (const hit of findBlacklisted(text)) errors.push(`${where}：黑名單 ${hit}`);

  return errors.length === 0 ? { ok: true, prose: value as unknown as T2ReportProseV3 } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// 呼叫模型
// ---------------------------------------------------------------------------

export interface ProseOutcomeV3 {
  prose: T2ReportProseV3;
  isAiGenerated: boolean;
  aiEngine: string;
  /** 退模板的原因，只給日誌與測試。 */
  errors: string[];
}

/** 永遠回得出一份 prose：模型過了用模型的，否則用模板。 */
export async function generateProseV3(input: T2ReportInputV3, engine: ProseEngine): Promise<ProseOutcomeV3> {
  const { system, user } = buildProsePromptV3(input);
  let report: unknown;
  let aiEngine: string;
  try {
    ({ report, aiEngine } = await engine(system, user));
  } catch (err: any) {
    return { prose: templateProseV3(input), isAiGenerated: false, aiEngine: ALL_ENGINES_FAILED, errors: [`所有引擎皆失敗：${err?.message ?? err}`] };
  }
  const checked = validateProseV3(report, input);
  if (checked.ok) return { prose: checked.prose, isAiGenerated: true, aiEngine, errors: [] };
  return { prose: templateProseV3(input), isAiGenerated: false, aiEngine: templateEngineLabel(aiEngine), errors: checked.errors };
}

/** 讀回來的 prose 是不是完整版的形狀（舊的 `T2ReportProse` 有 `weeklyPlanIntro`）。 */
export function isProseV3(x: unknown): x is T2ReportProseV3 {
  return isRecord(x) && Array.isArray(x.perDimension) && typeof x.overview === 'string' && !('weeklyPlanIntro' in x);
}

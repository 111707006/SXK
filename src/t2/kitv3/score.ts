/**
 * 完整版題庫的計分（T2 v3 題庫規格 §4）。純函式；每一族一個計分函式，頁面的公式一行一行搬，出處寫在各族的配方檔頭
 *（`scripts/t2/kitv3-recipes/<族>.ts`）。
 *
 * 共同規則（§4.1）：
 * - 只算「這次有出的題」（`askedKeys`）：月齡起點以下、別的表的題都不算缺答。
 * - 選項值 `null`（不确定／看不到／不适用）分子分母都不算。
 * - 吐：各面向數值與頁面分段、整支數值與分段、對主維度的 0–3（`grade03`）。分段名稱只進後台與測試。
 */

import type { DimensionCode } from '../types';
import type { KitV3Bank, KitV3Form, KitV3Item } from './types';

export type Grade03 = 0 | 1 | 2 | 3;
/** 作答：題 `key` → 選項值（`null`＝不确定這一類）。 */
export type KitV3Answers = Readonly<Record<string, number | null>>;

export interface ScoreContext {
  /** 實足月齡（早產 < 24 月已矯正）。 */
  ageM: number;
  /** 有沒有上托育／園所／學校（QOL 的「园所与学校生活」只在有上學時出；沒說＝有）。 */
  inSchool?: boolean;
}

export interface FacetResult {
  key: string;
  name: string;
  /** 計分題數。 */
  n: number;
  /** 這一族的數值（達成率％、總分……）；題數不足不單獨判時是 `null`。 */
  value: number | null;
  /** 頁面分段的索引（好 → 壞，0 起）；不判時 `null`。 */
  band: number | null;
  /** 這一族多算的數字（LQ 的最高穩定達成帶 `lv`、帶差 `gap`……），只進後台與測試。 */
  detail?: Record<string, number | null>;
}

export interface KitV3Score {
  code: string;
  form: string;
  facets: FacetResult[];
  total: { value: number | null; band: number | null; bandName: string | null };
  /** 對主維度的 0–3；沒有主維度的工具（QOL、氣質）是空的。 */
  grade03: Partial<Record<DimensionCode, Grade03>>;
  /** 這次有出、卻沒答的題（交卷時伺服器據此 400）。 */
  missing: string[];
  /** 不改分級、但報告最上方要出一句的情形（`refer`：ASQ3 的紅旗／聽力視力倒退／任一領域 < 55）。 */
  flags?: string[];
}

// ── 共用 ──

/** 這個月齡用哪一個表（`minM`／`maxM` 含）；只有一個表就是它。 */
export function formFor(bank: KitV3Bank, ageM: number): KitV3Form {
  if (bank.forms.length === 1) return bank.forms[0];
  const hit = bank.forms.find(f => (f.minM ?? -Infinity) <= ageM && ageM <= (f.maxM ?? Infinity));
  if (!hit) throw new Error(`kitv3：${bank.code} 沒有適用 ${ageM} 個月的表`);
  return hit;
}

/** 這次要出（也就是要計分）的題。 */
export function askedItems(bank: KitV3Bank, ctx: ScoreContext): Array<{ section: string; item: KitV3Item }> {
  const form = formFor(bank, ctx.ageM);
  switch (bank.family) {
    case 'pct': {
      const s = bank.scoring as PctScoring;
      return form.sections.flatMap(sec =>
        sec.items
          .filter(it => ctx.ageM >= (it.month ?? 0) && (s.sectionMaxMonth[sec.key] === undefined || ctx.ageM <= s.sectionMaxMonth[sec.key]))
          .map(item => ({ section: sec.key, item })),
      );
    }
    case 'qol': {
      // 「园所与学校生活」只在有上學時出（頁面 `activeSecs`）；沒說＝有上學
      const school = (bank.scoring as QolScoring).schoolSection;
      return form.sections
        .filter(sec => sec.key !== school || ctx.inSchool !== false)
        .flatMap(sec => sec.items.map(item => ({ section: sec.key, item })));
    }
    default:
      // 題目帶月齡（`month`／`maxMonth`）的照月齡出，其餘全出
      return form.sections.flatMap(sec =>
        sec.items
          .filter(it => ctx.ageM >= (it.month ?? -Infinity) && ctx.ageM <= (it.maxMonth ?? Infinity))
          .map(item => ({ section: sec.key, item })),
      );
  }
}

const roundHalf = (x: number) => Math.round(x);

/** 由高到低的 `min` 切點：第一個 `p >= min` 的索引（頁面的 `band(p)`）。 */
export function bandByMin(levels: ReadonlyArray<{ min: number }>, p: number): number {
  const i = levels.findIndex(l => p >= l.min);
  return i < 0 ? levels.length - 1 : i;
}

// ── 達成率族（GM、SOC、ADP、PLC、LANG）──

export interface PctScoring {
  dim: DimensionCode;
  /** 由好到壞，四段。 */
  levels: Array<{ min: number; name: string }>;
  minItems: number;
  /** 面向的月齡上限（LANG 的 PL：60）。 */
  sectionMaxMonth: Record<string, number>;
}

function scorePct(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as PctScoring;
  const form = formFor(bank, ctx.ageM);
  const asked = askedItems(bank, ctx);
  const missing = asked.filter(a => answers[a.item.key] === undefined || answers[a.item.key] === null).map(a => a.item.key);
  const got = (keys: ReadonlyArray<string>) => keys.reduce((n, k) => n + (answers[k] ?? 0), 0);
  const facets = form.sections.map(sec => {
    const keys = asked.filter(a => a.section === sec.key).map(a => a.item.key);
    const value = keys.length >= s.minItems ? roundHalf((got(keys) / (keys.length * 2)) * 100) : null;
    return { key: sec.key, name: sec.name, n: keys.length, value, band: value === null ? null : bandByMin(s.levels, value) };
  });
  const all = asked.map(a => a.item.key);
  const value = all.length ? roundHalf((got(all) / (all.length * 2)) * 100) : null;
  const band = value === null ? null : bandByMin(s.levels, value);
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value, band, bandName: band === null ? null : s.levels[band].name },
    grade03: band === null ? {} : { [s.dim]: band as Grade03 },
    missing,
  };
}

// ── LQ（帶差）──

export interface LqScoring {
  dim: DimensionCode;
  /** 月齡參考帶 B1–B7。 */
  bands: Array<{ level: number; min: number; max: number }>;
  /** 題 → 它屬於第幾帶。 */
  itemBand: Record<string, number>;
  maxValue: number;
  /** 頁面結論名稱：g0、g1、g2、紅旗。 */
  rules: [string, string, string, string];
}

/** 實足月齡所在的帶；12 以下回 0、72 以上回 8（頁面 `ageBand`）。 */
export function lqAgeBand(s: LqScoring, ageM: number): number {
  if (ageM < s.bands[0].min) return 0;
  if (ageM > s.bands[s.bands.length - 1].max) return 8;
  return s.bands.find(b => ageM >= b.min && ageM <= b.max)?.level ?? 0;
}

function scoreLq(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as LqScoring;
  const form = bank.forms[0];
  const required = form.sections.filter(sec => !sec.optional);
  const missing = required.flatMap(sec => sec.items.filter(it => answers[it.key] === undefined).map(it => it.key));
  const ab = lqAgeBand(s, ctx.ageM);
  const dimSecs = form.sections.filter(sec => sec.options === 'main');

  const facets = dimSecs.map(sec => {
    let sum = 0;
    let tested = 0;
    let done = 0;
    for (const it of sec.items) {
      const v = answers[it.key];
      if (v === undefined) continue;
      done++;
      if (v === null) continue; // 不确定：不進分母
      tested++;
      sum += v;
    }
    const pct = tested > 0 ? Math.round((sum / (tested * s.maxValue)) * 100) : null;
    // 最高穩定達成帶：該帶與以下每一題都是 MAXV
    let lv = 0;
    for (let L = 1; L <= s.bands.length; L++) {
      const ok = sec.items.filter(it => s.itemBand[it.key] <= L).every(it => answers[it.key] === s.maxValue);
      if (!ok) break;
      lv = L;
    }
    const gap = ab === 0 || ab === 8 || done === 0 ? null : Math.max(0, ab - lv);
    return { key: sec.key, name: sec.name, n: sec.items.length, value: pct, band: gap === null ? null : Math.min(3, gap), detail: { lv, gap } };
  });

  const gaps = facets.map(f => f.detail!.gap).filter((g): g is number => g !== null);
  const maxGap = gaps.length ? Math.max(...gaps) : null;
  const flagged = form.sections.filter(sec => sec.key === 'FLAGS').some(sec => sec.items.some(it => answers[it.key] === 1));
  // 頁面結論：紅旗凌駕；否則 0／1／≥2
  const ruleIdx = flagged ? 3 : maxGap === null ? null : Math.min(2, maxGap);
  let grade: Grade03 | null = maxGap === null ? null : (Math.min(3, maxGap) as Grade03);
  if (flagged) grade = Math.max(grade ?? 0, 2) as Grade03;
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value: maxGap, band: ruleIdx, bandName: ruleIdx === null ? null : s.rules[ruleIdx] },
    grade03: grade === null ? {} : { [s.dim]: grade },
    missing,
  };
}

// ── 分段表（閉區間 min／max，好 → 壞）共用 ──

/** 落在哪一段；都不在就是最後一段（頁面 `bandOf` 的 `||BANDS[2]`）。 */
export function bandByRange(bands: ReadonlyArray<{ min?: number; max?: number }>, v: number): number {
  const i = bands.findIndex(b => v >= (b.min ?? -Infinity) && v <= (b.max ?? Infinity));
  return i < 0 ? bands.length - 1 : i;
}

/** 這次有出、必答（`optional` 的段不算）卻沒答的題。 */
function missingOf(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): string[] {
  const form = formFor(bank, ctx.ageM);
  const optional = new Set(form.sections.filter(s => s.optional).map(s => s.key));
  return askedItems(bank, ctx)
    .filter(a => !optional.has(a.section) && answers[a.item.key] === undefined)
    .map(a => a.item.key);
}

// ── M-CHAT 第一階段 ──

export interface MchatScoring {
  dim: DimensionCode;
  /** 答「是」才是風險的題（2、5、12）；其餘答「否」是風險。 */
  riskIsYes: string[];
  bands: Array<{ min: number; max: number; name: string }>;
  /** 各段的 0–3。 */
  grade: Grade03[];
}

function scoreMchat(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as MchatScoring;
  const form = bank.forms[0];
  const items = form.sections.flatMap(sec => sec.items);
  const risky = items.filter(it => {
    const v = answers[it.key];
    if (v === undefined || v === null) return false;
    return s.riskIsYes.includes(it.key) ? v === 1 : v === 0;
  }).length;
  const band = bandByRange(s.bands, risky);
  return {
    code: bank.code,
    form: form.key,
    facets: [],
    total: { value: risky, band, bandName: s.bands[band].name },
    grade03: { [s.dim]: s.grade[band] },
    missing: missingOf(bank, answers, ctx),
  };
}

// ── ASQ3（月齡題組、領域達成率）──

export interface Asq3Scoring {
  levels: Array<{ min: number; name: string }>;
  /** 領域 → 主維度（粗大、精細都是 MOT，取重）。 */
  domainDim: Record<string, DimensionCode>;
  perItemMax: number;
  /** 整體問題答哪一邊算警示。 */
  overallWarn: Record<string, number>;
  /** 答了警示就轉介的整體問題（聽力、視力、倒退、動作）。 */
  referOverall: string[];
  /** 任一領域低於這個％就轉介。 */
  referBelow: number;
}

function scoreAsq3(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as Asq3Scoring;
  const form = formFor(bank, ctx.ageM);
  const asked = askedItems(bank, ctx);
  const domainSecs = form.sections.filter(sec => sec.key in s.domainDim);
  const facets = domainSecs.map(sec => {
    const got = sec.items.reduce((n, it) => n + (answers[it.key] ?? 0), 0);
    const value = Math.round((got / (sec.items.length * s.perItemMax)) * 100);
    return { key: sec.key, name: sec.name, n: sec.items.length, value, band: bandByMin(s.levels, value), detail: { got } };
  });
  const total = facets.reduce((n, f) => n + (f.detail!.got ?? 0), 0);
  const totalMax = domainSecs.reduce((n, sec) => n + sec.items.length * s.perItemMax, 0);
  const totPct = Math.round((total / totalMax) * 100);
  const band = bandByMin(s.levels, totPct);

  const grade03: Partial<Record<DimensionCode, Grade03>> = {};
  for (const f of facets) {
    const dim = s.domainDim[f.key];
    grade03[dim] = Math.max(grade03[dim] ?? 0, f.band!) as Grade03;
  }
  const askedKeys = new Set(asked.map(a => a.item.key));
  const flagged = asked.some(a => a.section === 'RED' && answers[a.item.key] === 1);
  const warn = s.referOverall.some(k => askedKeys.has(k) && answers[k] === s.overallWarn[k]);
  const low = facets.some(f => (f.value ?? 100) < s.referBelow);
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value: totPct, band, bandName: s.levels[band].name },
    grade03,
    missing: missingOf(bank, answers, ctx),
    ...(flagged || warn || low ? { flags: ['refer'] } : {}),
  };
}

// ── VOC（里程碑％＋旗標）──

export interface VocScoring {
  dim: DimensionCode;
  /** 三段（80／60／0），好 → 壞。 */
  levels: Array<{ min: number; name: string }>;
  grade: Grade03[];
}

function scoreVoc(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as VocScoring;
  const form = bank.forms[0];
  const asked = askedItems(bank, ctx);
  const of = (sec: string) => asked.filter(a => a.section === sec).map(a => a.item.key);
  const pctOf = (keys: string[]) => (keys.length ? Math.round((keys.reduce((n, k) => n + (answers[k] ?? 0), 0) / (keys.length * 2)) * 100) : null);
  const mileSecs = form.sections.filter(sec => sec.options === 'main');
  const facets = mileSecs.map(sec => {
    const keys = of(sec.key);
    const value = pctOf(keys);
    return { key: sec.key, name: sec.name, n: keys.length, value, band: null };
  });
  const aKeys = mileSecs.flatMap(sec => of(sec.key));
  const aPct = pctOf(aKeys) ?? 0;
  const M = ctx.ageM;
  const flags: string[] = [];
  if (M >= 24 && answers['gram.1'] === 0) flags.push('two');
  if (M >= 12 && M < 18 && of('GEST').filter(k => answers[k] === 1).length < 6) flags.push('gest');
  const v1 = facets.find(f => f.key === 'V1')!.value;
  if (v1 !== null && v1 < 60) flags.push('v1');
  const level = flags.length >= 2 || aPct < s.levels[1].min ? 2 : flags.length === 1 || aPct < s.levels[0].min ? 1 : 0;
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value: aPct, band: level, bandName: s.levels[level].name },
    grade03: { [s.dim]: s.grade[level] },
    missing: missingOf(bank, answers, ctx),
    ...(flags.length ? { flags } : {}),
  };
}

// ── 關切率族（ASB、ASR）──

export interface ConcernScoring {
  dim: DimensionCode;
  /** 用上限分段（p ≤ max），好 → 壞，三段。 */
  levels: Array<{ max: number; name: string }>;
  perItemMax: number;
  /** 「不适用」超過幾題頁面不給結果（ASR 12）；沒有這個選項是 null。 */
  naLimit: number | null;
  grade: Grade03[];
}

const REG_SECTION = 'REG';

function scoreConcern(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as ConcernScoring;
  const form = formFor(bank, ctx.ageM);
  const asked = askedItems(bank, ctx).filter(a => a.section !== REG_SECTION);
  const pctOf = (keys: string[]) => {
    const scored = keys.filter(k => typeof answers[k] === 'number');
    return scored.length ? Math.round((scored.reduce((n, k) => n + (answers[k] as number), 0) / (scored.length * s.perItemMax)) * 100) : null;
  };
  const byMax = (p: number) => {
    const i = s.levels.findIndex(l => p <= l.max);
    return i < 0 ? s.levels.length - 1 : i;
  };
  const facets = form.sections
    .filter(sec => sec.key !== REG_SECTION)
    .map(sec => {
      const keys = asked.filter(a => a.section === sec.key).map(a => a.item.key);
      const value = pctOf(keys);
      return { key: sec.key, name: sec.name, n: keys.length, value, band: value === null ? null : byMax(value) };
    });
  const keys = asked.map(a => a.item.key);
  const value = pctOf(keys);
  const na = keys.filter(k => answers[k] === null).length;
  const missing = missingOf(bank, answers, ctx);
  if (s.naLimit !== null && na > s.naLimit) {
    return { code: bank.code, form: form.key, facets, total: { value, band: null, bandName: null }, grade03: {}, missing, flags: ['too_many_na'] };
  }
  const regressed = (form.sections.find(sec => sec.key === REG_SECTION)?.items ?? []).some(it => answers[it.key] === 1);
  let band = value === null ? null : byMax(value);
  if (regressed) band = s.levels.length - 1;
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value, band, bandName: band === null ? null : s.levels[band].name },
    grade03: band === null ? {} : { [s.dim]: s.grade[band] },
    missing,
    ...(regressed ? { flags: ['regression'] } : {}),
  };
}

// ── QOL（困擾率；沒有主維度）──

export interface QolScoring {
  /** lo／hi 閉區間，好 → 壞，四段。 */
  levels: Array<{ min: number; max: number; name: string }>;
  /** 有上學才出的面向。 */
  schoolSection: string;
}

function scoreQol(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  const s = bank.scoring as QolScoring;
  const form = formFor(bank, ctx.ageM);
  const asked = askedItems(bank, ctx);
  const sumOf = (keys: string[]) => keys.reduce((n, k) => n + (answers[k] ?? 0), 0);
  const facets = form.sections
    .filter(sec => asked.some(a => a.section === sec.key))
    .map(sec => {
      const keys = asked.filter(a => a.section === sec.key).map(a => a.item.key);
      const value = Math.round((sumOf(keys) / (keys.length * 3)) * 100);
      return { key: sec.key, name: sec.name, n: keys.length, value, band: bandByRange(s.levels, value) };
    });
  const keys = asked.map(a => a.item.key);
  const value = keys.length ? Math.round((sumOf(keys) / (keys.length * 3)) * 100) : null;
  const band = value === null ? null : bandByRange(s.levels, value);
  return {
    code: bank.code,
    form: form.key,
    facets,
    total: { value, band, bandName: band === null ? null : s.levels[band].name },
    grade03: {},
    missing: missingOf(bank, answers, ctx),
  };
}

// ── 入口 ──

export function scoreKitV3(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  switch (bank.family) {
    case 'pct':
      return scorePct(bank, answers, ctx);
    case 'lq':
      return scoreLq(bank, answers, ctx);
    case 'mchat':
      return scoreMchat(bank, answers, ctx);
    case 'asq3':
      return scoreAsq3(bank, answers, ctx);
    case 'voc':
      return scoreVoc(bank, answers, ctx);
    case 'concern':
      return scoreConcern(bank, answers, ctx);
    case 'qol':
      return scoreQol(bank, answers, ctx);
    default:
      throw new Error(`kitv3：還沒有「${bank.family}」族的計分（${bank.code}）`);
  }
}

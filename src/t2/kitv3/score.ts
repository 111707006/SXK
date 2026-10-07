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
    default:
      return form.sections.flatMap(sec => sec.items.map(item => ({ section: sec.key, item })));
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

// ── 入口 ──

export function scoreKitV3(bank: KitV3Bank, answers: KitV3Answers, ctx: ScoreContext): KitV3Score {
  switch (bank.family) {
    case 'pct':
      return scorePct(bank, answers, ctx);
    default:
      throw new Error(`kitv3：還沒有「${bank.family}」族的計分（${bank.code}）`);
  }
}

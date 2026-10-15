/**
 * 量表详解（規格 `docs/specs/t2-v3-scale-detail-report.md`）：一份做完的量表 → 報告上那一段的資料。
 *
 * 【分工】分數照正式的 `scoreKitV3`（快照裡已經存了，這裡不重算）；這一層只把它換成家長看得懂的三種講法：
 * ① 量表自己的分級換成白話；② 講題數，不講百分比；③ 講孩子會什麼、下一步先練哪一題。
 * 面向說明與練法取題庫 `texts`（客戶原文）經 `adaptForParents` 改寫。題目原文照題庫引用，不改寫。
 *
 * 【各族】作答怎麼分種類、面向狀態怎麼講、「下一步」怎麼挑，每一族一筆 `STYLES`（規格 §4）。
 * 還沒登記的族回 `null`（報告上不出那一支的详解）：D-3 達成率族、D-4 頻率族與七級，D-5 其餘。
 *
 * 純函式：同一份快照算兩次結果一樣；快照存的是它的輸出（規格 D6），之後照存的樣子讀。
 */

import type { KitV3Bank, KitV3Item, KitV3Option } from './kitv3/types';
import { askedItems, type KitV3Score, type ScoreContext } from './kitv3/score';
import { adaptForParents } from './kitv3/textAdapt';
import {
  ACHIEVEMENT_KINDS,
  ACHIEVEMENT_PLAIN,
  ACHIEVEMENT_SHORT,
  ADL_KINDS,
  ADL_PLAIN,
  ADL_SHORT,
  ASR_KINDS,
  CHEXI_KINDS,
  CONCERN_KINDS,
  CONCERN_PLAIN,
  CONCERN_SHORT,
  FACET_NAME_ALIAS,
  FEW_ITEMS,
  SCALE_DISPLAY,
  SNAP_KINDS,
  achievementAllSteady,
  achievementOverall,
  adlAllSteady,
  adlOverall,
  concernAllSteady,
  concernOverall,
} from './scaleDetailCopy';

export const SCALE_DETAIL_VERSION = 1 as const;

/** 一題的作答種類：0 最好、2 最差。 */
export type AnswerKind = 0 | 1 | 2;

export interface ScaleDetailFacet {
  key: string;
  name: string;
  /** 面向狀態的白話；這一支不分面向判、或題數太少時是 `null`（畫面只出題數）。 */
  plain: string | null;
  /** 題數太少、不單獨判。 */
  fewItems: boolean;
  asked: number;
  /** 各種作答幾題（順序同 `kinds`）。 */
  counts: [number, number, number];
}

export interface ScaleDetailFocus {
  key: string;
  name: string;
  plain: string | null;
  /** 這一面在看什麼（客戶說明，改寫後）；沒有說明是空字串。 */
  what: string;
  /** 還沒穩定的題（題目原文）：`kind` 1＝中間那種、2＝最差那種。 */
  items: Array<{ kind: 1 | 2; text: string }>;
  /** 下一步先練的那一題（題目原文）；這一族不講「下一步」時 `null`。 */
  next: string | null;
  /** 在家怎麼練（客戶說明，改寫後）。 */
  tips: string[];
}

export interface ScaleDetail {
  version: typeof SCALE_DETAIL_VERSION;
  code: string;
  displayName: string;
  oneLiner: string;
  /** 作答種類的名稱（好 → 壞）與各幾題。 */
  kinds: Array<{ label: string; count: number }>;
  asked: number;
  overall: string;
  facets: ScaleDetailFacet[];
  /** 最需要練的面向，最多 2 個；各方面都穩時是空的。 */
  focus: ScaleDetailFocus[];
  /** `next`：達成率、七級 —— 講「下一步先练」；`frequent`：頻率族 —— 講「先从这几种情形着手」（最常出現的題）。 */
  mode: 'next' | 'frequent';
  /** 沿用 `score.flags`（轉介句由報告最上方的提示出，這裡只留著給畫面判斷）。 */
  flags: string[];
}

type Counts = readonly [number, number, number];
type Asked = ReturnType<typeof askedItems>;

interface FamilyStyle {
  kinds: readonly [string, string, string];
  /** 選項 → 作答種類；`null`＝不計（不適用、不確定）。 */
  kindOf: (value: number | null, options: readonly KitV3Option[]) => AnswerKind | null;
  plain: Readonly<Record<3 | 4, readonly string[]>>;
  short: Readonly<Record<3 | 4, readonly string[]>>;
  mode: 'next' | 'frequent';
  overall: (asked: number, counts: Counts, focus: ReadonlyArray<{ name: string; short: string }>, kinds: readonly string[]) => string;
  allSteady: (asked: number, counts: Counts, kinds: readonly string[]) => string;
  /** 一個面向有哪幾題；預設＝同 key 的段落（CHEXI 的因素由題目的副量表標籤組成）。 */
  itemsOf?: (bank: KitV3Bank, facetKey: string, asked: Asked) => Asked;
  /** 一個面向的說明；預設＝`texts.facets[key]`（CHEXI 把因素底下的副量表接起來）。 */
  textsOf?: (bank: KitV3Bank, facetKey: string) => { what: string; tips: string[] } | undefined;
}

/** 達成率：最高那個值＝已經會、0＝還不會、其間＝偶爾會（GM 一族 2／1／0、ASQ3 10／5／0、VOC 的「会／还不会」）。 */
const achievementKind: FamilyStyle['kindOf'] = (value, options) => {
  if (value === null) return null;
  const max = Math.max(...options.map(o => (typeof o.value === 'number' ? o.value : -Infinity)));
  if (value === max) return 0;
  if (value === 0) return 2;
  return 1;
};

/** 頻率：0＝很少或沒有、1＝偶爾、2 以上＝常出現（經常、總是）。 */
const concernKind: FamilyStyle['kindOf'] = value => (value === null ? null : value <= 0 ? 0 : value === 1 ? 1 : 2);

const ACHIEVEMENT: FamilyStyle = {
  kinds: ACHIEVEMENT_KINDS, kindOf: achievementKind, plain: ACHIEVEMENT_PLAIN, short: ACHIEVEMENT_SHORT, mode: 'next',
  overall: achievementOverall, allSteady: achievementAllSteady,
};

const CONCERN: FamilyStyle = {
  kinds: CONCERN_KINDS, kindOf: concernKind, plain: CONCERN_PLAIN, short: CONCERN_SHORT, mode: 'frequent',
  overall: concernOverall, allSteady: concernAllSteady,
};

function chexiSubs(bank: KitV3Bank, facetKey: string): string[] {
  const factors = (bank.scoring as { factors?: Array<{ key: string; subs: string[] }> }).factors ?? [];
  return factors.find(f => f.key === facetKey)?.subs ?? [];
}

/** CHEXI：題目是「孩子是不是這樣」，1–2 不太像、3 有點像、4–5 很像；兩個因素由副量表組成。 */
const CHEXI_STYLE: FamilyStyle = {
  ...CONCERN,
  kinds: CHEXI_KINDS,
  kindOf: value => (value === null ? null : value <= 2 ? 0 : value === 3 ? 1 : 2),
  itemsOf: (bank, facetKey, asked) => {
    const subs = chexiSubs(bank, facetKey);
    return asked.filter(a => ((a.item as { tags?: string[] }).tags ?? []).some(t => subs.includes(t)));
  },
  textsOf: (bank, facetKey) => {
    const parts = chexiSubs(bank, facetKey)
      .map(k => bank.texts?.facets[k])
      .filter((x): x is { what: string; tips: string[] } => Boolean(x));
    return parts.length ? { what: parts.map(x => x.what).join(''), tips: parts.flatMap(x => x.tips) } : undefined;
  },
};

/** 七級（ADL）：6–7 自己做到、3–5 需要一點幫忙、1–2 大人做為主。 */
const ADL_STYLE: FamilyStyle = {
  kinds: ADL_KINDS,
  kindOf: value => (value === null ? null : value >= 6 ? 0 : value >= 3 ? 1 : 2),
  plain: ADL_PLAIN, short: ADL_SHORT, mode: 'next',
  overall: adlOverall, allSteady: adlAllSteady,
};

/** 族 → 講法。還沒登記的族（D-5：LQ、M-CHAT、EMO、TIC、QOL、氣質）回 `null`。 */
const STYLES: Readonly<Record<string, FamilyStyle>> = {
  pct: ACHIEVEMENT,
  voc: ACHIEVEMENT,
  asq3: ACHIEVEMENT,
  concern: CONCERN,
  ld: CONCERN,
  snap: { ...CONCERN, kinds: SNAP_KINDS },
  chexi: CHEXI_STYLE,
  adl: ADL_STYLE,
};

/** 同一族裡選項意思不同的工具（ASR 是「和同龄孩子比起来」）。 */
const KINDS_BY_CODE: Readonly<Record<string, readonly [string, string, string]>> = {
  'SXK-ASR': ASR_KINDS,
};

export function hasScaleDetail(bank: Pick<KitV3Bank, 'family' | 'code'>): boolean {
  return Boolean(STYLES[bank.family] && SCALE_DISPLAY[bank.code]);
}

function levelCount(bank: KitV3Bank): 3 | 4 {
  const levels = (bank.scoring as { levels?: unknown[] }).levels;
  return Array.isArray(levels) && levels.length === 3 ? 3 : 4;
}

export interface ScaleDetailInput {
  bank: KitV3Bank;
  answers: Readonly<Record<string, number | null>>;
  score: KitV3Score;
  context: ScoreContext;
}

export function scaleDetailOf({ bank, answers, score, context }: ScaleDetailInput): ScaleDetail | null {
  const family = STYLES[bank.family];
  const display = SCALE_DISPLAY[bank.code];
  if (!family || !display) return null;
  const style: FamilyStyle = KINDS_BY_CODE[bank.code] ? { ...family, kinds: KINDS_BY_CODE[bank.code] } : family;
  const n = levelCount(bank);
  const asked = askedItems(bank, context);
  const optionsOf = (section: string): readonly KitV3Option[] => {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section);
    return sec ? bank.options[sec.options] ?? [] : [];
  };

  type Line = { item: KitV3Item; order: number; kind: AnswerKind };
  const itemsOf = style.itemsOf ?? ((_b: KitV3Bank, key: string, all: Asked) => all.filter(a => a.section === key));
  const linesOf = (facetKey: string): Line[] =>
    itemsOf(bank, facetKey, asked)
      .map((a, order) => ({ item: a.item, order, kind: style.kindOf(answers[a.item.key] ?? null, optionsOf(a.section)) }))
      .filter((l): l is Line => l.kind !== null);

  const alias = FACET_NAME_ALIAS[bank.code] ?? {};
  const facetLines = score.facets
    .filter(f => f.n > 0)
    .map(f => ({ f: { ...f, name: alias[f.key] ?? f.name }, lines: linesOf(f.key) }));
  const facets: ScaleDetailFacet[] = facetLines.map(({ f, lines }) => ({
    key: f.key,
    name: f.name,
    plain: f.band === null ? null : style.plain[n][f.band] ?? null,
    fewItems: f.value === null,
    asked: lines.length,
    counts: [0, 1, 2].map(k => lines.filter(l => l.kind === k).length) as [number, number, number],
  }));
  for (const f of facets) if (f.fewItems) f.plain = FEW_ITEMS;

  // 最需要練的面向：頁面分段最差的先；同段（或這一支不分面向判）看作答偏向差的比例（最差那種算兩倍），高的先。
  const notBestRatio = (c: Counts) => (c[1] + 2 * c[2]) / Math.max(1, 2 * (c[0] + c[1] + c[2]));
  const graded = facetLines.some(x => x.f.band !== null);
  const candidates = facetLines.filter(({ f, lines }) =>
    !(f.value === null) && lines.some(l => l.kind > 0) && (graded ? (f.band ?? 0) > 0 : (score.total.band ?? 0) > 0));
  candidates.sort((a, b) =>
    ((b.f.band ?? 0) - (a.f.band ?? 0)) ||
    (notBestRatio(facets.find(x => x.key === b.f.key)!.counts) - notBestRatio(facets.find(x => x.key === a.f.key)!.counts)));
  const textsOf = style.textsOf ?? ((b: KitV3Bank, key: string) => b.texts?.facets[key]);
  const focus: ScaleDetailFocus[] = candidates.slice(0, 2).map(({ f, lines }) => {
    const gaps = lines.filter(l => l.kind > 0);
    const byMonth = [...gaps].sort((a, b) => ((a.item.month ?? Infinity) - (b.item.month ?? Infinity)) || (a.order - b.order));
    // 頻率族：最常出現的先（常出現 → 偶爾），同種照題目順序。
    const ordered = style.mode === 'frequent' ? [...gaps].sort((a, b) => (b.kind - a.kind) || (a.order - b.order)) : gaps;
    const t = textsOf(bank, f.key);
    return {
      key: f.key,
      name: f.name,
      plain: facets.find(x => x.key === f.key)!.plain,
      what: t ? adaptForParents(t.what) : '',
      items: ordered.map(l => ({ kind: l.kind as 1 | 2, text: l.item.text })),
      next: style.mode === 'next' ? byMonth[0]?.item.text ?? null : null,
      tips: (t?.tips ?? []).map(adaptForParents).filter(Boolean),
    };
  });

  // 一題只屬於一個面向（CHEXI 的兩個因素題目也不重疊），所以面向加總＝整支。
  const total = facets.reduce<[number, number, number]>((acc, f) => [acc[0] + f.counts[0], acc[1] + f.counts[1], acc[2] + f.counts[2]], [0, 0, 0]);
  const totalAsked = total[0] + total[1] + total[2];
  const band = score.total.band;
  const levelTxt = band === null ? '' : adaptForParents(bank.texts?.levels?.[band]?.txt ?? '');
  // 規格 §5：有需要練的面向時，不用「各面向都好」的那一段（它會被早就會的題撐高）；整支分段不是最好那段時，接上題庫那一段的建議。
  const overall = focus.length > 0
    ? style.overall(totalAsked, total, focus.map(f => ({ name: f.name, short: shortOf(style, n, facetLines.find(x => x.f.key === f.key)!.f.band) })), style.kinds)
      + (band !== null && band > 0 && levelTxt ? levelTxt : '')
    : (band === 0 && levelTxt) || style.allSteady(totalAsked, total, style.kinds);

  return {
    version: SCALE_DETAIL_VERSION,
    code: bank.code,
    displayName: display.name,
    oneLiner: display.oneLiner,
    kinds: style.kinds.map((label, i) => ({ label, count: total[i] })),
    asked: totalAsked,
    overall,
    facets,
    focus,
    mode: style.mode,
    flags: score.flags ?? [],
  };
}

function shortOf(style: FamilyStyle, n: 3 | 4, band: number | null): string {
  return band === null ? '' : style.short[n][band] ?? '';
}

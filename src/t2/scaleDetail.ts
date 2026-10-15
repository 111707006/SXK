/**
 * 量表详解（規格 `docs/specs/t2-v3-scale-detail-report.md`）：一份做完的量表 → 報告上那一段的資料。
 *
 * 【分工】分數照正式的 `scoreKitV3`（快照裡已經存了，這裡不重算）；這一層只把它換成家長看得懂的三種講法：
 * ① 量表自己的分級換成白話；② 講題數，不講百分比；③ 講孩子會什麼、下一步先練哪一題。
 * 面向說明與練法取題庫 `texts`（客戶原文）經 `adaptForParents` 改寫。題目原文照題庫引用，不改寫。
 *
 * 【各族】作答怎麼分種類、面向狀態怎麼講、「下一步」怎麼挑，每一族一筆 `STYLES`（規格 §4）。
 * 還沒登記的族回 `null`（報告上不出那一支的详解），票 D-4、D-5 逐族補上。
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
  FEW_ITEMS,
  SCALE_DISPLAY,
  achievementAllSteady,
  achievementOverall,
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
  /** 沿用 `score.flags`（轉介句由報告最上方的提示出，這裡只留著給畫面判斷）。 */
  flags: string[];
}

interface FamilyStyle {
  kinds: readonly [string, string, string];
  /** 選項 → 作答種類；`null`＝不計（不適用、不確定）。 */
  kindOf: (value: number | null, options: readonly KitV3Option[]) => AnswerKind | null;
  plain: Readonly<Record<3 | 4, readonly string[]>>;
  short: Readonly<Record<3 | 4, readonly string[]>>;
  overall: (asked: number, best: number, focus: ReadonlyArray<{ name: string; short: string }>) => string;
  allSteady: (asked: number, best: number) => string;
}

/** 達成率：最高那個值＝已經會、0＝還不會、其間＝偶爾會（GM 一族 2／1／0、ASQ3 10／5／0、VOC 的「会／还不会」）。 */
const achievementKind: FamilyStyle['kindOf'] = (value, options) => {
  if (value === null) return null;
  const max = Math.max(...options.map(o => (typeof o.value === 'number' ? o.value : -Infinity)));
  if (value === max) return 0;
  if (value === 0) return 2;
  return 1;
};

const ACHIEVEMENT: FamilyStyle = {
  kinds: ACHIEVEMENT_KINDS,
  kindOf: achievementKind,
  plain: ACHIEVEMENT_PLAIN,
  short: ACHIEVEMENT_SHORT,
  overall: achievementOverall,
  allSteady: achievementAllSteady,
};

/** 族 → 講法。D-3 只登記達成率族；其餘族（D-4、D-5）登記之前回 `null`。 */
const STYLES: Readonly<Record<string, FamilyStyle>> = {
  pct: ACHIEVEMENT,
  voc: ACHIEVEMENT,
  asq3: ACHIEVEMENT,
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
  const style = STYLES[bank.family];
  const display = SCALE_DISPLAY[bank.code];
  if (!style || !display) return null;
  const n = levelCount(bank);
  const asked = askedItems(bank, context);
  const optionsOf = (section: string): readonly KitV3Option[] => {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section);
    return sec ? bank.options[sec.options] ?? [] : [];
  };

  type Line = { item: KitV3Item; order: number; kind: AnswerKind };
  const linesOf = (facetKey: string): Line[] =>
    asked
      .filter(a => a.section === facetKey)
      .map((a, order) => ({ item: a.item, order, kind: style.kindOf(answers[a.item.key] ?? null, optionsOf(a.section)) }))
      .filter((l): l is Line => l.kind !== null);

  const facetLines = score.facets.filter(f => f.n > 0).map(f => ({ f, lines: linesOf(f.key) }));
  const facets: ScaleDetailFacet[] = facetLines.map(({ f, lines }) => ({
    key: f.key,
    name: f.name,
    plain: f.band === null ? null : style.plain[n][f.band] ?? null,
    fewItems: f.value === null,
    asked: lines.length,
    counts: [0, 1, 2].map(k => lines.filter(l => l.kind === k).length) as [number, number, number],
  }));
  for (const f of facets) if (f.fewItems) f.plain = FEW_ITEMS;

  // 最需要練的面向：頁面分段最差的先；同段（或這一支不分面向判）看最好那種作答的比例，低的先。
  const notBestRatio = (c: [number, number, number]) => (c[1] + c[2]) / Math.max(1, c[0] + c[1] + c[2]);
  const graded = facetLines.some(x => x.f.band !== null);
  const candidates = facetLines.filter(({ f, lines }) =>
    !(f.value === null) && lines.some(l => l.kind > 0) && (graded ? (f.band ?? 0) > 0 : (score.total.band ?? 0) > 0));
  candidates.sort((a, b) =>
    ((b.f.band ?? 0) - (a.f.band ?? 0)) ||
    (notBestRatio(facets.find(x => x.key === b.f.key)!.counts) - notBestRatio(facets.find(x => x.key === a.f.key)!.counts)));
  const texts = bank.texts?.facets ?? {};
  const focus: ScaleDetailFocus[] = candidates.slice(0, 2).map(({ f, lines }) => {
    const gaps = lines.filter(l => l.kind > 0);
    const byMonth = [...gaps].sort((a, b) => ((a.item.month ?? Infinity) - (b.item.month ?? Infinity)) || (a.order - b.order));
    const t = texts[f.key];
    return {
      key: f.key,
      name: f.name,
      plain: facets.find(x => x.key === f.key)!.plain,
      what: t ? adaptForParents(t.what) : '',
      items: gaps.map(l => ({ kind: l.kind as 1 | 2, text: l.item.text })),
      next: byMonth[0]?.item.text ?? null,
      tips: (t?.tips ?? []).map(adaptForParents).filter(Boolean),
    };
  });

  const total = facets.reduce((acc, f) => [acc[0] + f.counts[0], acc[1] + f.counts[1], acc[2] + f.counts[2]], [0, 0, 0]);
  const totalAsked = total[0] + total[1] + total[2];
  const band = score.total.band;
  const levelTxt = band === null ? '' : adaptForParents(bank.texts?.levels?.[band]?.txt ?? '');
  // 規格 §5：有需要練的面向時，不用「各面向都好」的那一段（它會被早就會的題撐高）；整支分段不是最好那段時，接上題庫那一段的建議。
  const overall = focus.length > 0
    ? style.overall(totalAsked, total[0], focus.map(f => ({ name: f.name, short: shortOf(style, n, facetLines.find(x => x.f.key === f.key)!.f.band) })))
      + (band !== null && band > 0 && levelTxt ? levelTxt : '')
    : (band === 0 && levelTxt) || style.allSteady(totalAsked, total[0]);

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
    flags: score.flags ?? [],
  };
}

function shortOf(style: FamilyStyle, n: 3 | 4, band: number | null): string {
  return band === null ? '' : style.short[n][band] ?? '';
}

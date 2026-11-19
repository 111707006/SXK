/**
 * 孩子的細項（ADR-0018）：報告快照 → 這個孩子身上的發現標籤。推送開一期時算一次、存在那一期上
 *（`PeriodPlan.childTags`），同一個方面裡活動標籤對得上的先推。
 *
 * - 完整版快照（`T2FindingsV3`）：快照存了每一支的作答與分數（`toolResults`），照 `facetTagsV3.ts` 的對照算。
 *   不改快照形狀 —— 2026-11-19 之前存的完整版報告一樣算得出來。
 * - 9/08 版與代填的快照（`T2Findings`）：每個維度本來就帶 `tags`（舊規則引擎產的、治療師勾的），直接收。
 *
 * **只給伺服器用**：要整套題庫（`KITV3_BANKS`），前端是一支一支延遲載入的。
 */

import { FACET_TAGS_V3, EXPRESSION_GAP_MIN_V3, TEMPERAMENT_CODE_V3, TEMPERAMENT_TAGS_V3, type FacetTagRules } from './facetTagsV3';
import { FINDING_TAGS, isFindingTag, type FindingTag } from './findingTags';
import { isFindingsV3 } from './findingsV3';
import { KITV3_BANKS } from './kitv3';
import { askedItems, type KitV3Score } from './kitv3/score';
import type { ToolResultV3 } from './kitv3/submit';
import type { KitV3Bank } from './kitv3/types';
import { scaleDetailOf, type ScaleDetailFacet } from './scaleDetail';

type FacetView = Pick<ScaleDetailFacet, 'key' | 'fewItems' | 'tone'> & { counts: [number, number, number] | null };

/**
 * 這個面向要不要貼（同量表详解挑「最需要練的面向」那一條，`scaleDetail.ts` 的 `candidates`）：
 * 有自己的分段 → 不在最好那一段；這一支不分面向判 → 整支不在最好那一段、而且這個面向有答得不好的題。題數太少的不判。
 */
export function facetNeedsCare(f: FacetView, score: Pick<KitV3Score, 'total'>): boolean {
  if (f.fewItems) return false;
  if (f.tone !== null) return f.tone > 0;
  return (score.total.band ?? 0) > 0 && (f.counts === null || f.counts[1] + f.counts[2] > 0);
}

function facetViews(bank: KitV3Bank, r: ToolResultV3): FacetView[] {
  const detail = scaleDetailOf({ bank, answers: r.answers, score: r.score, context: r.context });
  if (detail) return detail.facets.map(f => ({ key: f.key, fewItems: f.fewItems, tone: f.tone, counts: f.counts }));
  return r.score.facets.map(f => ({ key: f.key, fewItems: f.value === null, tone: f.band === null ? null : (Math.min(3, f.band) as 0 | 1 | 2 | 3), counts: null }));
}

/** 這一題答到「有狀況」那一邊沒有：M-CHAT 照計分的風險方向，其餘是 0 以上（ASR 0＝与年龄相符、SP 影響題 1＝有）。 */
function itemNeedsCare(bank: KitV3Bank, key: string, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (bank.family === 'mchat') {
    const riskIsYes = (bank.scoring as { riskIsYes?: string[] }).riskIsYes ?? [];
    return riskIsYes.includes(key) ? value === 1 : value === 0;
  }
  return value > 0;
}

function sectionItemKeys(bank: KitV3Bank, section: string): string[] {
  return bank.forms.flatMap(f => f.sections).filter(s => s.key === section).flatMap(s => s.items.map(i => i.key));
}

function tagsOfResult(r: ToolResultV3): FindingTag[] {
  const bank = KITV3_BANKS[r.toolId];
  if (!bank) return [];
  if (r.toolId === TEMPERAMENT_CODE_V3) return temperamentTags(bank, r);
  const rules: FacetTagRules | undefined = FACET_TAGS_V3[r.toolId];
  if (!rules) return [];
  const out: FindingTag[] = [];

  if (rules.facets) {
    for (const f of facetViews(bank, r)) {
      const tags = rules.facets[f.key];
      if (tags && facetNeedsCare(f, r.score)) out.push(...tags);
    }
  }
  if (rules.items) {
    for (const [key, tags] of Object.entries(rules.items)) if (itemNeedsCare(bank, key, r.answers[key])) out.push(...tags);
  }
  if (rules.anyYes) {
    for (const [section, tags] of Object.entries(rules.anyYes)) {
      if (sectionItemKeys(bank, section).some(k => r.answers[k] === 1)) out.push(...tags);
    }
  }
  if (rules.sectionGaps) {
    const asked = askedItems(bank, r.context);
    for (const [section, tags] of Object.entries(rules.sectionGaps)) {
      const keys = asked.filter(a => a.section === section).map(a => a.item.key);
      const low = keys.filter(k => r.answers[k] === 0).length;
      if (keys.length > 0 && low * 2 >= keys.length) out.push(...tags);
    }
  }
  if (rules.gaps) {
    const valueOf = (key: string) => r.score.facets.find(f => f.key === key)?.value ?? null;
    for (const g of rules.gaps) {
      const hi = valueOf(g.higher);
      const lo = valueOf(g.lower);
      if (hi !== null && lo !== null && hi - lo >= EXPRESSION_GAP_MIN_V3) out.push(...g.tags);
    }
  }
  return out;
}

/** 氣質：band 0 在 `poles[0]` 那一端、2 在 `poles[1]`；落在要留意的那一端才貼（三個表兩端順序不同，見 `TEMPERAMENT_TAGS_V3`）。 */
function temperamentTags(bank: KitV3Bank, r: ToolResultV3): FindingTag[] {
  const forms = (bank.scoring as { forms?: Record<string, { poles?: Record<string, [string, string]> }> }).forms ?? {};
  const poles = forms[r.score.form]?.poles ?? {};
  const out: FindingTag[] = [];
  for (const f of r.score.facets) {
    const rule = TEMPERAMENT_TAGS_V3[f.key];
    const pair = poles[f.key];
    if (!rule || !pair || f.band === null || f.band === 1) continue;
    if (rule.carePoles.includes(pair[f.band === 0 ? 0 : 1])) out.push(...rule.tags);
  }
  return out;
}

/** 完整版的結果 → 孩子的細項，去重、照 `FINDING_TAGS` 的順序。 */
export function childTagsV3Of(results: ReadonlyArray<ToolResultV3>): FindingTag[] {
  const got = new Set(results.flatMap(tagsOfResult));
  return FINDING_TAGS.filter(t => got.has(t));
}

/** 任何一種快照 → 孩子的細項（見檔頭）。讀不懂的快照回空陣列：推送照 ADR-0015 排，不會因為沒有細項排不出來。 */
export function childTagsOf(findings: unknown): FindingTag[] {
  if (typeof findings !== 'object' || findings === null) return [];
  const f = findings as { toolkitVersion?: unknown; toolResults?: unknown; dimensions?: unknown };
  if (isFindingsV3(f)) return Array.isArray(f.toolResults) ? childTagsV3Of(f.toolResults as ToolResultV3[]) : [];
  if (!Array.isArray(f.dimensions)) return [];
  const got = new Set<string>();
  for (const d of f.dimensions) {
    const tags = (d as { tags?: unknown }).tags;
    if (Array.isArray(tags)) for (const t of tags) if (typeof t === 'string' && isFindingTag(t)) got.add(t);
  }
  return FINDING_TAGS.filter(t => got.has(t));
}

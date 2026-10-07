/**
 * 「關切率」族（T2 v3 題庫規格 §4.2「SXK-ASB」「SXK-ASR」列）：題目是問題行為的頻率／程度，越高越要留意。
 *
 * 頁面的計分（探針確認）：
 * - 每題 0–3（ASB：很少或没有／偶尔／经常／总是；ASR：与年龄相符／轻度不同／中度不同／明显不同＋每題四個行為錨點）。
 * - ％＝round(Σ ÷ 計分題數×3 × 100)（`stat`）；ASR 有「不适用／未能观察（不计分）」，分子分母都不算，超過 12 題頁面不給出結果。
 * - 分段 `LEVELS` 用上限 `hi`（`levelFor`：第一個 p ≤ hi）：ASB 22／40／100、ASR 20／38／100。
 * - 能力倒退（4 項：語言、社交、遊戲、自理，必答）任一有 → 最差那段（`if(reg.length)lv=LEVELS[2]`）。
 *
 * 家長只填家長版：ASB 的 `P`（63 題，部分題有最低月齡，預設 18）；ASR 頁面寫治療師觀察，暫採家長依日常觀察答 24 題、
 * 不出 8 個觀察活動與整體臨床印象（R-17）。三段 → 0／1／3。
 */

import { assignedLiteral, namedLiteral } from '../literals';
import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Section } from '../../../src/t2/kitv3/types';
import type { ConcernScoring } from '../../../src/t2/kitv3/score';
import type { DimensionCode } from '../../../src/t2/types';

export function later<T>(src: V3Source, name: string): T {
  const v = src.consts.get(name)?.value ?? namedLiteral(src.scripts.join('\n'), name);
  if (v === undefined) throw new Error(`${src.file}：找不到純資料的 ${name}`);
  return v as T;
}

function regressSection(src: V3Source): KitV3Section {
  const reg = later<Array<[string, string]>>(src, 'REGRESS');
  if (reg.length !== 4) throw new Error(`${src.file}：REGRESS 應有 4 項`);
  return { key: 'REG', name: '能力倒退', options: 'hasnot', items: reg.map(([k, t], i) => ({ key: `reg.${i + 1}`, text: `${k}：${t}` })) };
}

export function levelsOf(src: V3Source) {
  const levels = later<Array<{ hi: number; key: string }>>(src, 'LEVELS');
  if (levels.length !== 3) throw new Error(`${src.file}：LEVELS 應有 3 段`);
  return levels.map(l => ({ max: l.hi, name: l.key }));
}

function commonProbes(src: V3Source) {
  probe(src, 'levelFor p<=hi', /function levelFor\(p\)\{return LEVELS\.find\(l=>p<=l\.hi\)\|\|LEVELS\[2\];\}/);
  probe(src, '倒退 → 最差段', /if\(reg\.length\)lv=LEVELS\[2\];/);
}

function buildAsb(src: V3Source): Omit<KitV3Bank<ConcernScoring>, 'code' | 'source'> {
  commonProbes(src);
  probe(src, 'stat ÷(n×max)', /function stat\(fid,li\)\{const mx=FORMS\[fid\]\.max;let sum=0;li\.forEach\(x=>sum\+=S\.ans\[fid\]\[x\.id\]\|\|0\);const max=li\.length\*mx;return \{n:li\.length,sum,max,pct:max\?Math\.round\(sum\/max\*100\):null/);
  probe(src, '家長版月齡（預設 18）', /if\(S\.months>=\(m\|\|18\)\)out\.push/);
  const secs = need<Array<{ key: string; name: string }>>(src, 'SECS');
  const pq = need<Record<string, Array<[string, string, number?]>>>(src, 'PQ');
  const opts = need<Array<[string, number]>>(src, 'OPTS');
  if (opts.map(o => o[1]).join() !== '0,1,2,3') throw new Error(`${src.file}：OPTS 應為 0–3`);
  const sections = secs.map(s => ({
    key: s.key,
    name: s.name,
    options: 'main',
    items: (pq[s.key] ?? []).map(([t, c, m], i) => ({ key: `${s.key}.${i + 1}`, text: t, month: m ?? 18, tags: [c] })),
  }));
  if (sections.flatMap(s => s.items).length !== 63) throw new Error(`${src.file}：家長版應有 63 題`);
  return {
    title: h1Title(src),
    family: 'concern',
    options: { main: opts.map(([l, v]) => ({ value: v, label: l })), hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }] },
    forms: [{ key: 'P', name: '家长版', sections: [regressSection(src), ...sections] }],
    scoring: scoringOf(src, 'SOC', null),
  };
}

function buildAsr(src: V3Source): Omit<KitV3Bank<ConcernScoring>, 'code' | 'source'> {
  commonProbes(src);
  probe(src, 'stat 不適用不計', /function stat\(li\)\{const sc=li\.filter\(x=>typeof S\.ans\[x\.id\]==='number'\);[\s\S]*?pct:sc\.length\?Math\.round\(sum\/\(sc\.length\*3\)\*100\):null\};\}/);
  const [naLimit] = probe(src, '不適用上限', /if\(ITEMS\.filter\(x=>S\.ans\[x\.id\]==='na'\)\.length>(\d+)\)/);
  const [naLabel] = probe(src, '不適用的字', /setA\('\$\{x\.id\}','na',this\)">([^<]+)<\/label>/);
  const secs = need<Array<{ key: string; name: string; items?: Array<[string, string, string[]]> }>>(src, 'SECS');
  // 第一個面向的題目寫在 SECS 裡，其餘四個用 `SECS[n].items=[...]` 補（頁面註解「补 CM / PL / RB / ER 项目」）
  const script = src.scripts.join('\n');
  secs.forEach((s, i) => {
    if (s.items) return;
    const items = assignedLiteral(script, `SECS[${i}].items`);
    if (!Array.isArray(items)) throw new Error(`${src.file}：${s.key} 的題目找不到（SECS[${i}].items）`);
    s.items = items as Array<[string, string, string[]]>;
  });
  const opts = later<Array<[string, number]>>(src, 'OPTS');
  if (opts.map(o => o[1]).join() !== '0,1,2,3') throw new Error(`${src.file}：OPTS 應為 0–3`);
  const sections = secs.map(s => ({
    key: s.key,
    name: s.name,
    options: 'main',
    items: s.items!.map(([t, c, anchors], i) => {
      if (!Array.isArray(anchors) || anchors.length !== 4) throw new Error(`${src.file}：${s.key} 第 ${i + 1} 題的錨點不是 4 個`);
      return { key: `${s.key}.${i + 1}`, text: t, anchors, tags: [c] };
    }),
  }));
  if (sections.flatMap(s => s.items).length !== 24) throw new Error(`${src.file}：應有 24 題`);
  return {
    title: h1Title(src),
    family: 'concern',
    options: {
      main: [...opts.map(([l, v]) => ({ value: v, label: l })), { value: null, label: naLabel }],
      hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }],
    },
    forms: [{ key: 'P', name: '家长依日常观察', sections: [regressSection(src), ...sections] }],
    scoring: scoringOf(src, 'SOC', Number(naLimit)),
  };
}

function scoringOf(src: V3Source, dim: DimensionCode, naLimit: number | null): ConcernScoring {
  return { dim, levels: levelsOf(src), perItemMax: 3, naLimit, grade: [0, 1, 3] };
}

export const CONCERN_RECIPES: V3Recipe[] = [
  { code: 'SXK-ASB', slug: 'sxk-asb', file: '森心康_自闭行为量表_完整版_SXK-ASB.html', build: buildAsb },
  { code: 'SXK-ASR', slug: 'sxk-asr', file: '森心康_社交沟通行为量表_完整版_SXK-ASR.html', build: buildAsr },
];

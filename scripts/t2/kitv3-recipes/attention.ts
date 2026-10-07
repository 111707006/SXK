/**
 * 注意力的兩支「關切率」工具（T2 v3 題庫規格 §4.2「SXK-AB」「SXK-ATT」列）：計分同 ASB／ASR 那一族（`concern.ts`），
 * 沒有能力倒退；多一段「功能影響」5 列（0–3）要答、**不計分、不改分段**（頁面 `impMax` 只進建議文字）。
 *
 * SXK-AB（探針確認）：
 * - 家長版 6 面向 × 8 題，題目 `[字, 最低月齡]`，月齡沒寫＝36（`items`）；每題 0–3。
 * - ％＝round(Σ ÷ 題數×3 × 100)（`stat`）；整支取各表最重（`mx`），我們只開家長版。
 * - `LEVELS` 用上限 `hi`：33／50／100（`levelFor`：第一個 p ≤ hi）→ 0／1／3。
 *
 * SXK-ATT（探針確認）：
 * - 家長版 6 個情境 × 8 題，題目 `[字, 類型, 最低月齡]`，月齡沒寫＝48（`sitItems`）；未滿 72 月課堂、作業換學前的名稱（`sitName`）。
 * - 家長版的課堂、作業可以整段勾「这个情境无法观察」：那一段不出、不算缺答、分子分母都不算（`activeItems`、`sitStat`）。
 * - ％ 同 AB（`formOverall`），`LEVELS` 25／42／100 → 0／1／3。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import { later, levelsOf } from './concern';
import type { KitV3Bank, KitV3Option, KitV3Section } from '../../../src/t2/kitv3/types';
import type { ConcernScoring } from '../../../src/t2/kitv3/score';

const LEVEL_PROBE = /function levelFor\(p\)\{return LEVELS\.find\(l=>p<=l\.hi\)\|\|LEVELS\[2\];\}/;

function zeroToThree(src: V3Source, name: string): KitV3Option[] {
  const opts = later<Array<[string, number]>>(src, name);
  if (opts.map(o => o[1]).join() !== '0,1,2,3') throw new Error(`${src.file}：${name} 應為 0–3`);
  return opts.map(([l, v]) => ({ value: v, label: l }));
}

/** 功能影響 5 列（每張表都要答，頁面 `nextForm` 擋）。 */
function impactSection(src: V3Source): KitV3Section {
  const rows = later<Array<[string, string]>>(src, 'IMPACT');
  if (rows.length !== 5) throw new Error(`${src.file}：IMPACT 應有 5 列`);
  return { key: 'IMP', name: '功能影响', options: 'impact', items: rows.map(([t, d], i) => ({ key: `imp.${i + 1}`, text: t, hint: d })) };
}

function scoring(src: V3Source): ConcernScoring {
  return { dim: 'ATT', levels: levelsOf(src), perItemMax: 3, naLimit: null, grade: [0, 1, 3] };
}

function buildAb(src: V3Source): Omit<KitV3Bank<ConcernScoring>, 'code' | 'source'> {
  probe(src, 'levelFor p<=hi', LEVEL_PROBE);
  probe(src, '家長版月齡（預設 36）', /PQ\[s\.key\][\s\S]{0,80}?L\.forEach\(\(\[t,m\],i\)=>\{if\(S\.months>=\(m\|\|36\)\)out\.push/);
  probe(src, 'stat ÷(n×3)', /function stat\(fid,li\)\{let sum=0;li\.forEach\(x=>sum\+=S\.ans\[fid\]\[x\.id\]\|\|0\);const max=li\.length\*3;return \{n:li\.length,sum,max,pct:max\?Math\.round\(sum\/max\*100\):null\};\}/);
  probe(src, '各表取最重', /const ovPct=mx\(S\.forms\.map\(k=>fs\[k\]\.pct\)\);const lv=levelFor\(ovPct\);/);
  const secs = need<Array<{ key: string; name: string; grp: string }>>(src, 'SECS');
  const pq = need<Record<string, Array<[string, number?]>>>(src, 'PQ');
  const sections: KitV3Section[] = secs.map(s => ({
    key: s.key,
    name: s.name,
    options: 'main',
    items: (pq[s.key] ?? []).map(([t, m], i) => ({ key: `${s.key}.${i + 1}`, text: t, month: m ?? 36, tags: [s.grp] })),
  }));
  if (sections.flatMap(s => s.items).length !== 48) throw new Error(`${src.file}：家長版應有 48 題`);
  return {
    title: h1Title(src),
    family: 'concern',
    options: { main: zeroToThree(src, 'OPTS'), impact: zeroToThree(src, 'IMPOPTS') },
    forms: [{ key: 'P', name: '家长版', sections: [...sections, impactSection(src)] }],
    scoring: scoring(src),
  };
}

function buildAtt(src: V3Source): Omit<KitV3Bank<ConcernScoring>, 'code' | 'source'> {
  probe(src, 'levelFor p<=hi', LEVEL_PROBE);
  probe(src, '情境題月齡（預設 48）', /function sitItems\(s\)\{return s\.items\.map\(\(\[t,ty,m\],i\)=>\(\{id:s\.key\+i,s,t,ty,m:m\|\|48\}\)\)\.filter\(x=>S\.months>=x\.m\);\}/);
  probe(src, '學前換名（< 72）', /const pre=\(\)=>S\.months<72;\s*function sitName\(s\)\{return pre\(\)&&s\.pre\?s\.pre:s\.name;\}/);
  probe(src, '無法觀察的情境不算', /function activeItems\(fid\)\{return formSits\(fid\)\.filter\(s=>!S\.na\[fid\]\[s\.key\]\)\.flatMap\(sitItems\);\}/);
  probe(src, 'formOverall ÷(n×3)', /function formOverall\(fid\)\{const its=activeItems\(fid\);let sum=0;its\.forEach\(x=>sum\+=S\.ans\[fid\]\[x\.id\]\|\|0\);const max=its\.length\*3;return \{n:its\.length,sum,max,pct:max\?Math\.round\(sum\/max\*100\):0/);
  probe(src, '各表取最重', /const ovPct=comb\(k=>ov\[k\]\.pct\);const lv=levelFor\(ovPct\);/);
  const [naKeys, naLabel] = probe(src, '只有家長版的課堂、作業能勾', /fid==='P'&&\(s\.key==='(\w+)'\|\|s\.key==='\w+'\)\?`[^`]*?onchange="setNA\('\$\{s\.key\}',this\.checked\)"> ([^<]+)<\/label>/);
  const [na2] = probe(src, '第二個能勾的情境', /fid==='P'&&\(s\.key==='\w+'\|\|s\.key==='(\w+)'\)/);
  const naSits = new Set([naKeys, na2]);
  const sits = later<Array<{ key: string; name: string; pre?: string; forms: string[]; items: Array<[string, string, number?]> }>>(src, 'SITS');
  const sections: KitV3Section[] = sits
    .filter(s => s.forms.includes('P'))
    .map(s => ({
      key: s.key,
      name: s.name,
      options: 'main',
      items: s.items.map(([t, ty, m], i) => ({ key: `${s.key}.${i + 1}`, text: t, month: m ?? 48, tags: [ty] })),
      ...(naSits.has(s.key) ? { naLabel: naLabel.trim() } : {}),
      ...(s.pre ? { preName: { belowM: 72, name: s.pre } } : {}),
    }));
  if (sections.flatMap(s => s.items).length !== 48) throw new Error(`${src.file}：家長版應有 48 題`);
  if (sections.filter(s => s.naLabel).map(s => s.key).join() !== 'CL,HW') throw new Error(`${src.file}：能勾「无法观察」的應是 CL、HW`);
  return {
    title: h1Title(src),
    family: 'concern',
    options: { main: zeroToThree(src, 'OPTS'), impact: zeroToThree(src, 'IMPOPTS') },
    forms: [{ key: 'P', name: '家长版', sections: [...sections, impactSection(src)] }],
    scoring: scoring(src),
  };
}

export const ATTENTION_RECIPES: V3Recipe[] = [
  { code: 'SXK-AB', slug: 'sxk-ab', file: '森心康_注意力及行为观察量表_完整版_SXK-AB.html', build: buildAb },
  { code: 'SXK-ATT', slug: 'sxk-att', file: '森心康_注意力及多动量表_完整版_SXK-ATT.html', build: buildAtt },
];

/**
 * 學習障礙兩支（T2 v3 題庫規格 §4.2「SXK-LDP」「SXK-LDS」列，`ld` 族）：依**年級**挑題，不看月齡。
 *
 * 頁面的計分（探針確認）：
 * - 題目 `{t, g（起始年級）, x（截止年級，選填）}`，`inGrade`：g ≤ 年級 ≤ x；題號是七個面向累計（年級換了也不變）。
 * - 困難指數＝round(Σ ÷ 已答題數×3 × 100)（`domPct`／`totPct`），每題 0–3。
 * - `LEVELS` 用下限 `min`（`band`：第一個 p ≥ min，頁面由壞到好排）：<17／17–33／34–49／≥50 → 0–3。
 * - 多份表取平均（`combinedTot`）；我們只開家長版（規格 §3.4）。
 *
 * 年級：LDP 一年級–高三（1–12）、LDS 初一–高三（7–12）；月齡推年級是我們定的（規格 §4.3、R-27，`defaultGrade`）。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { LdScoring } from '../../../src/t2/kitv3/score';

function build(src: V3Source, range: [number, number], items: number): Omit<KitV3Bank<LdScoring>, 'code' | 'source'> {
  probe(src, 'inGrade', /function inGrade\(it,g\)\{return g>=it\.g&&\(!it\.x\|\|g<=it\.x\)\}/);
  probe(src, '題號累計', /SECS\.forEach\(function\(s,si\)\{\s*s\.items\.forEach\(function\(it(?:,ii)?\)\{\s*no\+\+;\s*if\(inGrade\(it,g\)\)ITEMS\.push\(\{no:no,/);
  probe(src, 'totPct 只算已答', /function totPct\(fk\)\{\s*var A=S\.ans\[fk\];\s*var ansd=ITEMS\.filter\(function\(x\)\{return A\[x\.no\]!==undefined\}\);\s*if\(!ansd\.length\)return null;[\s\S]{0,120}?\/\(ansd\.length\*3\)\*100\);/);
  probe(src, 'band 第一個 ≥ min', /function band\(p\)\{for\(var i=0;i<LEVELS\.length;i\+\+\)if\(p>=LEVELS\[i\]\.min\)return LEVELS\[i\];/);
  const forms = need<Array<{ k: string }>>(src, 'FORMS');
  if (!forms.some(f => f.k === 'p')) throw new Error(`${src.file}：沒有家長版`);
  const secs = need<Array<{ key: string; name: string; items: Array<{ t: string; g: number; x?: number }> }>>(src, 'SECS');
  const opts = need<Array<{ t: string; d: string; v: number }>>(src, 'OPTS');
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  if (opts.map(o => o.v).join() !== '0,1,2,3') throw new Error(`${src.file}：OPTS 應為 0–3`);
  if (levels.length !== 4) throw new Error(`${src.file}：LEVELS 應有 4 段`);
  let no = 0;
  const sections = secs.map(s => ({
    key: s.key,
    name: s.name,
    options: 'main',
    items: s.items.map(it => {
      no++;
      if (it.g < range[0] || it.g > range[1] || (it.x !== undefined && it.x < it.g)) throw new Error(`${src.file}：第 ${no} 題的年級 ${it.g}–${it.x ?? ''} 不對`);
      return { key: `${s.key}.${no}`, text: it.t, minGrade: it.g, ...(it.x !== undefined ? { maxGrade: it.x } : {}) };
    }),
  }));
  if (no !== items) throw new Error(`${src.file}：應有 ${items} 題，拿到 ${no}`);
  return {
    title: h1Title(src),
    family: 'ld',
    options: { main: opts.map(o => ({ value: o.v, label: o.t, hint: o.d })) },
    forms: [{ key: 'p', name: '家长版', sections }],
    // 頁面由壞到好排，存成好 → 壞
    scoring: { dim: 'LEARN', levels: [...levels].reverse().map(l => ({ min: l.min, name: l.key })), gradeRange: range },
  };
}

export const LD_RECIPES: V3Recipe[] = [
  { code: 'SXK-LDP', slug: 'sxk-ldp', file: '森心康_学习障碍量表_完整版_SXK-LDP.html', build: src => build(src, [1, 12], 80) },
  { code: 'SXK-LDS', slug: 'sxk-lds', file: '森心康_学习障碍量表_中学完整版_SXK-LDS.html', build: src => build(src, [7, 12], 84) },
];

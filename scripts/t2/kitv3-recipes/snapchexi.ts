/**
 * SNAP-IV 與 CHEXI（T2 v3 題庫規格 §4.2 兩列）：兩支都是公開量表的中文版，題目照錄，各有自己的計分（不是關切率）。
 *
 * SNAP-IV（`snap` 族，探針確認）：
 * - 26 題分三個分量表（注意力不足 1–9、过动与冲动 10–18、对立违抗 19–26），每題 0–3，沒有月齡挑題。
 * - 分量表平均分 ARI＝Σ ÷ 已答題數（`sub`）；家長版參考點 `REF.P`：> 1.2 高于关注、> 1.8 高于诊断（嚴格大於，`level`）。
 * - 頁面沒有總分；整支取三個分量表最重的那一級（規格 §4.2：含对立违抗，同頁面 postMessage）→ 0／1／3。
 * - 頁面在 6–18 歲外不套參考點；窗口由送卷檢查擋（規格 §3.3），計分不另判。
 *
 * CHEXI（`chexi` 族，探針確認）：
 * - 24 題原題序，每題 1–5（越高越困難），四個副量表（工作記憶、計劃力、調節力、抑制力）。
 * - 總分 24–120（`total`）對官方總分表 `PRTAB`：≤ 51 正常範圍、52–72 需要注意、≥ 73 明顯問題 → 0／1／3（規格 §4.2）。
 * - 兩個因素分（工作記憶＝wm＋pl，切點 29／35；抑制力＝rg＋ib，33／40；`facBand`）只進報告（facets）。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { ChexiScoring, SnapScoring } from '../../../src/t2/kitv3/score';

function buildSnap(src: V3Source): Omit<KitV3Bank<SnapScoring>, 'code' | 'source'> {
  probe(src, 'ARI＝Σ÷已答', /function sub\(ans,s\)\{const v=s\.ids\.map\(id=>ans\[id\]\)\.filter\(x=>x!==undefined\);const sum=v\.reduce\(\(a,b\)=>a\+b,0\);return \{sum,ari:v\.length\?sum\/v\.length:null/);
  const [diag, care, low] = probe(
    src,
    '嚴格大於參考點',
    /const p=REF\[fid\]\[key\];if\(p\[1\]!==null&&ari>p\[1\]\)return \{k:'([^']+)',hex:'[^']+',lv:2\};if\(ari>p\[0\]\)return \{k:'([^']+)',hex:'[^']+',lv:1\};return \{k:'([^']+)',hex:'[^']+',lv:0\};/,
  );
  const secs = need<Array<{ key: string; name: string; ids: number[] }>>(src, 'SECS');
  const q = need<Record<string, string>>(src, 'Q');
  const opts = need<Array<[string, number]>>(src, 'OPTS');
  const ref = need<Record<string, Record<string, unknown>>>(src, 'REF');
  if (opts.map(o => o[1]).join() !== '0,1,2,3') throw new Error(`${src.file}：OPTS 應為 0–3`);
  if (secs.map(s => s.key).join() !== 'IA,HI,OD') throw new Error(`${src.file}：分量表應為 IA、HI、OD`);
  const ids = secs.flatMap(s => s.ids);
  if (ids.length !== 26 || ids.some((id, i) => id !== i + 1)) throw new Error(`${src.file}：應為 1–26 題依序`);
  const parentRef = Object.fromEntries(
    secs.map(s => {
      const p = ref.P?.[s.key];
      if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') throw new Error(`${src.file}：REF.P.${s.key} 應為兩個數`);
      return [s.key, p as [number, number]];
    }),
  );
  return {
    title: h1Title(src),
    family: 'snap',
    options: { main: opts.map(([l, v]) => ({ value: v, label: l })) },
    forms: [
      {
        key: 'P',
        name: '家长版',
        sections: secs.map(s => ({
          key: s.key,
          name: s.name,
          options: 'main',
          items: s.ids.map(id => {
            if (typeof q[id] !== 'string') throw new Error(`${src.file}：第 ${id} 題沒有字`);
            return { key: `${s.key}.${id}`, text: q[id] };
          }),
        })),
      },
    ],
    scoring: { dim: 'ATT', ref: parentRef, levels: [low, care, diag], grade: [0, 1, 3] },
  };
}

function buildChexi(src: V3Source): Omit<KitV3Bank<ChexiScoring>, 'code' | 'source'> {
  probe(src, '總分＝24 題相加', /function total\(fk\)\{var A=S\.ans\[fk\];return ITEMS\.reduce\(function\(a,i\)\{return a\+\(A\[i\.id\]\|\|0\)\},0\)\}/);
  probe(src, '總分表取最後一列 raw ≤ 總分', /for\(var i=0;i<PRTAB\.length;i\+\+\)if\(t>=PRTAB\[i\]\.raw\)r=PRTAB\[i\];/);
  probe(src, '因素分段第一個 ≥ min', /function facBand\(f,s\)\{for\(var i=0;i<f\.cut\.length;i\+\+\)if\(s>=f\.cut\[i\]\.min\)return f\.cut\[i\];/);
  const items = need<Array<{ id: number; sub: string; t: string }>>(src, 'ITEMS');
  const opts = need<Array<{ v: number; t: string }>>(src, 'OPTS');
  const subs = need<Array<{ k: string; n: string; ids: number[] }>>(src, 'SUBS');
  const factors = need<Array<{ k: string; n: string; subs: string[]; cut: Array<{ min: number; key: string }> }>>(src, 'FACTORS');
  const prtab = need<Array<{ raw: number; key: string }>>(src, 'PRTAB');
  if (opts.map(o => o.v).join() !== '1,2,3,4,5') throw new Error(`${src.file}：OPTS 應為 1–5`);
  if (items.length !== 24 || items.some((it, i) => it.id !== i + 1)) throw new Error(`${src.file}：應為 1–24 題依序`);
  for (const s of subs) for (const id of s.ids) if (items[id - 1].sub !== s.k) throw new Error(`${src.file}：第 ${id} 題的副量表對不上 SUBS`);

  // 總分表的三級：每一級第一次出現的 raw 就是那一級的下限（第一級從 0 起；頁面低於表頭也是正常範圍）
  const levels: Array<{ min: number; name: string }> = [];
  for (const row of prtab) if (levels.at(-1)?.name !== row.key) levels.push({ min: levels.length ? row.raw : 0, name: row.key });
  if (levels.length !== 3) throw new Error(`${src.file}：PRTAB 應分三級，拿到 ${levels.map(l => l.name).join('／')}`);

  return {
    title: h1Title(src),
    family: 'chexi',
    options: { main: opts.map(o => ({ value: o.v, label: o.t })) },
    forms: [{ key: 'P', name: '家长版', sections: [{ key: 'Q', name: '执行功能', options: 'main', items: items.map(it => ({ key: `Q.${it.id}`, text: it.t, tags: [it.sub] })) }] }],
    scoring: {
      dim: 'ATT',
      levels,
      factors: factors.map(f => ({
        key: f.k,
        name: f.n,
        subs: f.subs,
        // 頁面由壞到好排，存成好 → 壞
        cuts: [...f.cut].reverse().map(c => ({ min: c.min, name: c.key })),
      })),
      subNames: Object.fromEntries(subs.map(s => [s.k, s.n])),
      grade: [0, 1, 3],
    },
  };
}

export const SNAP_CHEXI_RECIPES: V3Recipe[] = [
  { code: 'SNAP-IV', slug: 'snap-iv', file: '森心康_SNAP-IV评量表_完整版.html', build: buildSnap },
  { code: 'CHEXI', slug: 'chexi', file: 'CHEXI_儿童执行功能量表_完整版_SXK.html', build: buildChexi },
];

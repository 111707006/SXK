/**
 * 情緒行為的兩支（T2 v3 題庫規格 §4.2「SXK-EMO」「SXK-TIC」列）。
 *
 * SXK-EMO（`emo` 族，探針確認）：
 * - 7 面向 × 6 題，每題 0–3，另有「未观察到」（不進分母，`dimStat`／`symStat`）；功能影響 6 項 0–3，另有「不适用」（`impStat`）。
 * - 症狀％、影響％＝round(Σ ÷ 已評題數×3 × 100)。症狀分段 `SYMB` 0／15／30／50，影響分段 `IMPB` 0／20／40（第一個 p ≥ min）。
 * - 判讀矩陣（`verdict`）：症狀 ≥ 30 為高、影響 ≥ 20 為高；任一沒有已評題 → 「资料不足」。
 * - 0–3（規格 §4.2、§4.3）：症狀四段直接當 0–3；「症狀低、影響高」那一格抬到 2；资料不足不給。矩陣的四句不進家長端。
 * - 持續時間（必填、不計分）要問；安全篩檢三題頁面寫「由专业人员填写」，不問家長（R-21）。
 *
 * SXK-TIC（`tic` 族，探針確認）：只開家長報告版 `p`（臨床評定版、本人自評版這一輪不開，R-25）。
 * - 運動型、發聲型各 5 個維度（數量、頻率、強度、複雜度、干擾），每項 0–5 帶 6 個錨點；嚴重度＝兩型相加 0–50（`sevScore`）。
 * - 生活影響 4 項 0–5（`impScore`，只進報告）；前驅衝動 1 項（不計分）。
 * - `LEVELS` 0／13／26／38（`band`：最後一個 sev ≥ min）→ 0–3。
 * - 需要優先處理的情形（9 項勾選）不改分級；自傷、頸部、呼吸吞嚥、突發四項 → 報告出轉介句（`refer`），其餘 → `priority`。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Option, KitV3Section } from '../../../src/t2/kitv3/types';
import type { EmoScoring, TicScoring } from '../../../src/t2/kitv3/score';

const ascending = (rows: Array<{ min: number; key: string }>) => [...rows].sort((a, b) => a.min - b.min).map(r => ({ min: r.min, name: r.key }));

function buildEmo(src: V3Source): Omit<KitV3Bank<EmoScoring>, 'code' | 'source'> {
  probe(src, '症狀 ÷ 已評×3', /pct:tested>0\?Math\.round\(sum\/\(tested\*3\)\*100\):null\};\s*\}\s*function symStat\(\)/);
  probe(src, '未观察到 −1 不進分母', /if\(v===-1\)\{na\+\+;return\}\s*tested\+\+;sum\+=v;/);
  const [hiS, hiI] = probe(src, '判讀矩陣', /if\(s\.pct==null\|\|m\.pct==null\)return null;\s*var hiS=s\.pct>=(\d+),hiI=m\.pct>=(\d+);/);
  const [naSym] = probe(src, '症狀「未观察到」', /data-v="-1">([^<]+)<\/label>/);
  const [naImp] = probe(src, '影響「不适用」', /min-width:100px;text-align:center">([^<]+)<\/label><\/div><\/div>';/);
  const [durLabel] = probe(src, '持續時間的題目', /<h2>([^<]+)<span class="muted"[^>]*>　必填<\/span><\/h2>\s*<p class="muted"><b>持续多久/, 'html');
  const freq = need<Array<{ v: number; t: string; d: string }>>(src, 'FREQ');
  const dims = need<Array<{ k: string; n: string; items: string[] }>>(src, 'DIMS');
  const imp = need<Array<{ k: string; n: string; d: string }>>(src, 'IMP');
  const impa = need<Array<{ v: number; t: string }>>(src, 'IMPA');
  const dur = need<Array<{ v: number; t: string }>>(src, 'DUR');
  const symb = need<Array<{ min: number; key: string }>>(src, 'SYMB');
  const impb = need<Array<{ min: number; key: string }>>(src, 'IMPB');
  if (freq.map(o => o.v).join() !== '0,1,2,3' || impa.map(o => o.v).join() !== '0,1,2,3') throw new Error(`${src.file}：選項應為 0–3`);
  if (dims.length !== 7 || dims.some(d => d.items.length !== 6)) throw new Error(`${src.file}：應為 7 面向 × 6 題`);
  if (symb.length !== 4 || impb.length !== 3) throw new Error(`${src.file}：症狀應分 4 段、影響 3 段`);
  const sections: KitV3Section[] = [
    ...dims.map(d => ({ key: d.k, name: d.n, options: 'freq', items: d.items.map((t, i) => ({ key: `${d.k}.${i + 1}`, text: t })) })),
    { key: 'IMP', name: '功能影响', options: 'impact', items: imp.map(x => ({ key: `imp.${x.k}`, text: x.n, hint: x.d })) },
    { key: 'DUR', name: durLabel.trim(), options: 'dur', items: [{ key: 'dur', text: durLabel.trim() }] },
  ];
  return {
    title: h1Title(src),
    family: 'emo',
    options: {
      freq: [...freq.map(o => ({ value: o.v, label: o.t, hint: o.d })), { value: null, label: naSym.trim() }],
      impact: [...impa.map(o => ({ value: o.v, label: o.t })), { value: null, label: naImp.trim() }],
      dur: dur.map(o => ({ value: o.v, label: o.t })),
    },
    forms: [{ key: 'p', name: '家长版', sections }],
    scoring: {
      dim: 'EMO',
      symptomSections: dims.map(d => d.k),
      impactSection: 'IMP',
      symLevels: ascending(symb),
      impLevels: ascending(impb),
      hiSym: Number(hiS),
      hiImp: Number(hiI),
      liftTo: 2,
    },
  };
}

function buildTic(src: V3Source): Omit<KitV3Bank<TicScoring>, 'code' | 'source'> {
  probe(src, '嚴重度＝運動＋發聲', /function sevScore\(fk\)\{return secScore\(fk,"M"\)\.got\+secScore\(fk,"V"\)\.got\}/);
  probe(src, 'band 最後一個 ≥ min', /function band\(sev\)\{\s*var out=LEVELS\[0\];\s*LEVELS\.forEach\(function\(l\)\{if\(sev>=l\.min\)out=l\}\);/);
  probe(src, '自傷、呼吸吞嚥、頸部不能等待', /其中<b>自伤性抽动、影响呼吸或吞咽、颈部剧烈抽动伴疼痛或手部无力<\/b>属于不能等待的状况/);
  const secs = need<Array<{ key: string; name: string; dims: Array<{ k: string; n: string; d: string; a: string[] }> }>>(src, 'SECS');
  const impact = need<Array<{ k: string; n: string; d: string; a: string[] }>>(src, 'IMPACT');
  const urge = need<{ k: string; n: string; d: string; a: string[] }>(src, 'URGE');
  const flags = need<Array<{ k: string; t: string }>>(src, 'FLAGS');
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  if (secs.map(s => s.key).join() !== 'M,V' || secs.some(s => s.dims.length !== 5)) throw new Error(`${src.file}：應為運動、發聲各 5 維度`);
  const anchored = (k: string, n: string, d: string, a: string[]) => {
    if (a.length !== 6) throw new Error(`${src.file}：${k} 的錨點不是 6 個`);
    return { key: k, text: n, hint: d, anchors: a };
  };
  const r05: KitV3Option[] = [0, 1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }));
  const urgent = ['harm', 'neck', 'breath', 'sudden'];
  for (const k of urgent) if (!flags.some(f => f.k === k)) throw new Error(`${src.file}：FLAGS 少了 ${k}`);
  const sections: KitV3Section[] = [
    ...secs.map(s => ({ key: s.key, name: s.name, options: 'r05', items: s.dims.map(d => anchored(`${s.key}.${d.k}`, d.n, d.d, d.a)) })),
    { key: 'IMP', name: '生活影响', options: 'r05', items: impact.map(x => anchored(`imp.${x.k}`, x.n, x.d, x.a)) },
    { key: 'URGE', name: urge.n, options: 'r05', items: [anchored('urge', urge.n, urge.d, urge.a)] },
    { key: 'FLAGS', name: '需要优先处理的情形', options: 'hasnot', optional: true, items: flags.map(f => ({ key: `flag.${f.k}`, text: f.t })) },
  ];
  return {
    title: h1Title(src),
    family: 'tic',
    options: { r05, hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }] },
    forms: [{ key: 'p', name: '家长报告版', sections }],
    scoring: { dim: 'EMO', severitySections: ['M', 'V'], impactSection: 'IMP', levels: ascending(levels), flagSection: 'FLAGS', urgent: urgent.map(k => `flag.${k}`) },
  };
}

export const EMO_TIC_RECIPES: V3Recipe[] = [
  { code: 'SXK-EMO', slug: 'sxk-emo', file: '森心康_儿童情绪与焦虑筛查量表_完整版_SXK-EMO.html', build: buildEmo },
  { code: 'SXK-TIC', slug: 'sxk-tic', file: '森心康_抽动严重程度评估量表_完整版_SXK-TIC.html', build: buildTic },
];

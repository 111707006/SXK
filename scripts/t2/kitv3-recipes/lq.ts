/**
 * SXK-LQ（兒童語言發展家長問卷，T2 v3 題庫規格 §4.2「SXK-LQ」列）。
 *
 * 頁面的計分（探針確認）：
 * - 56 題（4 面向 × 7 個月齡參考帶 × 2 題）**全部出**，不依月齡挑題。選項 3 已经可以／2 偶尔可以／1 还不行／-1 不确定。
 * - 面向％＝Σ值 ÷（作答且不是「不确定」的題數 × 3）四捨五入（`domStat`）—— 只進後台，**不用來分級**。
 * - 最高穩定達成帶（`domBand`）：從 B1 往上，「該帶與以下的每一題都是已经可以」才算過；有一題不是、或「不确定」，就停在上一帶。
 * - 帶差（`gapOf`）＝實足月齡所在的帶 − 最高穩定達成帶（負的當 0）；月齡在 12 以下或 72 以上沒有帶差。
 * - 結論（`verdict`）：任一紅旗勾選 → 「有需要特别注意的情形」凌駕；否則最大帶差 0／1／≥2。
 *
 * 0–3（規格 §4.2）：最大帶差 0→0、1→1、2→2、≥3→3；紅旗 → 至少 2（§4.3 暫採，同 T1「紅旗題答还不能 → 至少 2」）。
 * 口腔進食 6 題獨立、選答、不進語言分數（頁面原話「绝不并入语言分数」）。
 */

import { namedLiteral } from '../literals';
import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Option } from '../../../src/t2/kitv3/types';
import type { LqScoring } from '../../../src/t2/kitv3/score';

interface RawItem { k: unknown; d: unknown; b: unknown; t: unknown; o?: unknown }

function later<T>(src: V3Source, name: string): T {
  const v = namedLiteral(src.scripts.join('\n'), name);
  if (v === undefined) throw new Error(`${src.file}：找不到純資料的 ${name}`);
  return v as T;
}

function build(src: V3Source): Omit<KitV3Bank<LqScoring>, 'code' | 'source'> {
  probe(src, 'domBand 該帶以下全部已经可以', /function domBand\(d\)\{[\s\S]*?if\(x\.d!==d\|\|x\.b>L\)return;[\s\S]*?if\(!r\|\|r\.v===undefined\|\|r\.v===-1\)na\+\+;\s*else if\(r\.v!==MAXV\)bad\+\+;[\s\S]*?if\(na===0&&bad===0\)\{res=L;continue\}/);
  probe(src, 'gapOf 帶差', /function gapOf\(d\)\{[\s\S]*?if\(ab==null\|\|ab===0\|\|ab===8\)return null;\s*var g=ab-domBand\(d\)\.lv;\s*return g<0\?0:g;/);
  probe(src, 'verdict 紅旗凌駕、2／1／0', /function verdict\(\)\{\s*if\(FLAGS\.some\(function\(f\)\{return S\.flags\[f\.k\]\}\)\)return ruleOf\("flag"\);\s*var m=maxGap\(\);\s*if\(m==null\)return null;\s*if\(m>=2\)return ruleOf\("g2"\);\s*if\(m===1\)return ruleOf\("g1"\);/);
  probe(src, 'MAXV=3', /var MAXV=3;/);

  const bands = need<Array<{ v: number; k: string; min: number; max: number }>>(src, 'BANDS');
  const dims = need<Array<{ k: string; n: string }>>(src, 'DIMS');
  const items = later<RawItem[]>(src, 'ITEMS');
  const resp = later<Array<{ v: number; n: string; d: string }>>(src, 'RESP');
  const oral = later<Array<{ k: string; t: string }>>(src, 'ORAL');
  const ofreq = later<Array<{ v: number; n: string }>>(src, 'OFREQ');
  const flags = later<Array<{ k: string; t: string }>>(src, 'FLAGS');
  const rules = later<Array<{ k: string; n: string }>>(src, 'RULES');

  if (resp.map(r => r.v).join() !== '3,2,1,-1') throw new Error(`${src.file}：RESP 應為 3／2／1／-1`);
  if (items.length !== 56) throw new Error(`${src.file}：ITEMS 應有 56 題，拿到 ${items.length}`);
  const options: Record<string, KitV3Option[]> = {
    main: resp.map(r => ({ value: r.v === -1 ? null : r.v, label: r.n, hint: r.d })),
    oral: ofreq.map(o => ({ value: o.v === -1 ? null : o.v, label: o.n })),
    yesno: [{ value: 1, label: '有' }, { value: 0, label: '没有' }],
  };
  const rule = (k: string) => {
    const r = rules.find(x => x.k === k);
    if (!r) throw new Error(`${src.file}：RULES 沒有 ${k}`);
    return r.n;
  };

  return {
    title: h1Title(src),
    family: 'lq',
    options,
    forms: [
      {
        key: 'main',
        name: '主要照顾者',
        sections: [
          ...dims.map(d => ({
            key: d.k,
            name: d.n,
            options: 'main',
            items: items
              .filter(x => x.d === d.k)
              .map(x => {
                if (typeof x.k !== 'string' || typeof x.t !== 'string' || typeof x.b !== 'number') throw new Error(`${src.file}：ITEMS 有一題不是 {k, d, b, t}`);
                return { key: x.k, text: x.t, ...(typeof x.o === 'string' ? { hint: x.o } : {}), tags: [`B${x.b}`] };
              }),
          })),
          { key: 'FLAGS', name: '需要特别注意的情形', options: 'yesno', items: flags.map(f => ({ key: `flag.${f.k}`, text: f.t })) },
          { key: 'ORAL', name: '口腔进食与吞咽', options: 'oral', optional: true, items: oral.map(o => ({ key: `oral.${o.k}`, text: o.t })) },
        ],
      },
    ],
    scoring: {
      dim: 'LANG',
      bands: bands.map(b => ({ level: b.v, min: b.min, max: b.max })),
      itemBand: Object.fromEntries(items.map(x => [x.k as string, x.b as number])),
      maxValue: 3,
      rules: [rule('g0'), rule('g1'), rule('g2'), rule('flag')],
    },
  };
}

export const LQ_RECIPES: V3Recipe[] = [
  { code: 'SXK-LQ', slug: 'sxk-lq', file: '森心康_儿童语言发展家长问卷_完整版_SXK-LQ.html', build },
];

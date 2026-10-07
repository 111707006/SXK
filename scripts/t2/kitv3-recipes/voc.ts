/**
 * SXK-VOC（0–3 詞彙量檢核表，T2 v3 題庫規格 §4.2「SXK-VOC」列、R-19）：出 A 里程碑與 C（18 個月前手勢、之後句子）；
 * B 詞表（362 字）先不出。
 *
 * 頁面的計分（探針確認）：
 * - A：30 題（V1 理解／V2 表達／V3 詞類），實足月齡 ≥ 題目月齡才出（`aItems`）；2／1／0。A％＝round(Σ ÷ 題數×2 × 100)。
 * - C：未滿 18 個月是 18 項手勢（有／沒有，數有幾項）；18 個月起是 12 題句子（会／还不会，依月齡出）。
 * - 頁面的 6 條旗標裡，我們算得到 3 條：24 個月以上不會兩詞組合（C 第 1 題）、12–17 個月手勢少於 6 項、V1 理解％ < 60。
 *   另外 3 條要 B 詞表（表達詞數 < 50、< 10）或句子樣本（最長句 < 3 詞）—— 沒出那兩段，不算（R-19）。
 * - 結論（原文）：旗標 ≥ 2 或 A％ < 60 → 「建议进一步评估」；旗標 1 或 A％ < 80 → 「部分项目待加强」；其餘「发展中符合预期」。
 *
 * 0–3（規格 §4.2）：三段 → 0／1／3。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { VocScoring } from '../../../src/t2/kitv3/score';

function build(src: V3Source): Omit<KitV3Bank<VocScoring>, 'code' | 'source'> {
  probe(src, 'aItems 月齡', /function aItems\(\)\{const out=\[\];MILE\.forEach\(s=>s\.items\.forEach\(\(\[t,m\],i\)=>\{if\(S\.months>=m\)out\.push/);
  probe(src, 'A％', /const aPct=its\.length\?Math\.round\(got\/\(its\.length\*2\)\*100\):0;/);
  probe(src, '兩詞組合旗標', /if\(M>=24&&two===false\)flags\.push/);
  probe(src, '手勢旗標', /if\(M<18&&g!==null&&g<6&&M>=12\)flags\.push/);
  probe(src, '理解旗標', /if\(secA\(MILE\[0\]\)\.pct!==null&&secA\(MILE\[0\]\)\.pct<60\)flags\.push/);
  probe(src, '結論', /const level=flags\.length>=2\|\|aPct<60\?LEVELS\[2\]:flags\.length===1\|\|aPct<80\?LEVELS\[1\]:LEVELS\[0\];/);
  probe(src, 'two＝句子第 1 題', /const two=M>=18\?S\.gram\[0\]===1:null;/);

  const mile = need<Array<{ key: string; name: string; items: Array<[string, number]> }>>(src, 'MILE');
  const gest = need<string[]>(src, 'GEST');
  const gram = need<Array<[string, number]>>(src, 'GRAM');
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  if (mile.flatMap(s => s.items).length !== 30) throw new Error(`${src.file}：A 里程碑應有 30 題`);
  if (levels.length !== 3) throw new Error(`${src.file}：LEVELS 應有 3 段`);
  return {
    title: h1Title(src),
    family: 'voc',
    options: {
      main: [
        { value: 2, label: '已经会' },
        { value: 1, label: '偶尔会' },
        { value: 0, label: '还不会' },
      ],
      hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }],
      can: [{ value: 1, label: '会' }, { value: 0, label: '还不会' }],
    },
    forms: [
      {
        key: 'main',
        name: '填表人',
        sections: [
          ...mile.map(s => ({ key: s.key, name: s.name, options: 'main', items: s.items.map(([t, m], i) => ({ key: `${s.key}.${i + 1}`, text: t, month: m })) })),
          { key: 'GEST', name: '手势与沟通行为', options: 'hasnot', items: gest.map((t, i) => ({ key: `gest.${i + 1}`, text: t, maxMonth: 17 })) },
          { key: 'GRAM', name: '词组与句子', options: 'can', items: gram.map(([t, m], i) => ({ key: `gram.${i + 1}`, text: t, month: m })) },
        ],
      },
    ],
    scoring: {
      dim: 'LANG',
      levels: levels.map(l => ({ min: l.min, name: l.key })),
      grade: [0, 1, 3],
    },
  };
}

export const VOC_RECIPES: V3Recipe[] = [{ code: 'SXK-VOC', slug: 'sxk-voc', file: '森心康_0-3词汇量检核表_完整版_SXK-VOC.html', build }];

/**
 * SXK-QOL（兒童生活質量量表，T2 v3 題庫規格 §4.2「SXK-QOL」列）：客規 `primary: []` —— **不出 0–3、不進維度判定**，報告一段。
 *
 * 頁面的計分（探針確認）：依月齡挑表（`bandForms`：[ageMin, ageMax)）；只用家長版（P24、P57、P812、P1318）。
 * 5 面向（體力、情緒、同伴、園所與學校生活〔有上學才出〕、家庭參與）；選項 0–3，越高越困擾。
 * 面向與總的困擾率＝round(Σ ÷ 題數×3 × 100)（`secScore`／`formScore`）；分段 `LEVELS` lo／hi：0–28／29–36／37–45／46–100。
 */

import { namedLiteral } from '../literals';
import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { QolScoring } from '../../../src/t2/kitv3/score';

function build(src: V3Source): Omit<KitV3Bank<QolScoring>, 'code' | 'source'> {
  probe(src, 'bandForms [min,max)', /function bandForms\(months\)\{return FORMS\.filter\(f=>months>=f\.ageMin&&months<f\.ageMax\);\}/);
  probe(src, 'secScore ÷(n×3)', /const max=f\[k\]\.length\*3;return \{sum,n,max,pct:max\?Math\.round\(sum\/max\*100\):0\};\}/);
  probe(src, 'activeSecs 上學才出', /function activeSecs\(\)\{return SECS\.filter\(s=>!s\.gate\|\|S\.f\.school==='yes'\);\}/);
  const secs = need<Array<{ key: string; name: string; gate?: unknown }>>(src, 'SECS');
  const opts = need<Array<[string, number]>>(src, 'OPTS4');
  const script = src.scripts.join('\n');
  // FORMS 裡的 `opts:OPTS4` 是識別字，純資料檢查不讓過 —— 把那一個欄位換成字串再抽（只換這一個寫法，別的識別字照擋）
  const formsRaw = /const FORMS=(\[[\s\S]*?\n\]);/.exec(script);
  if (!formsRaw) throw new Error(`${src.file}：找不到 FORMS`);
  const forms = namedLiteral(`const FORMS=${formsRaw[1].replace(/opts:OPTS([34])/g, "opts:'OPTS$1'")};`, 'FORMS') as Array<
    Record<string, unknown> & { id: string; title: string; ageMin: number; ageMax: number; rater: string; opts: string }
  >;
  if (!forms) throw new Error(`${src.file}：FORMS 讀不成純資料`);
  const levels = namedLiteral(script, 'LEVELS') as Array<{ lo: number; hi: number; key: string }> | undefined;
  if (!levels || levels.length !== 4) throw new Error(`${src.file}：LEVELS 應有 4 段`);
  const gated = secs.filter(s => s.gate).map(s => s.key);
  if (gated.join() !== 'SC') throw new Error(`${src.file}：只有 SC 應該看上學，拿到 ${gated.join()}`);

  const parent = forms.filter(f => f.rater === 'parent');
  if (parent.map(f => f.id).join() !== 'P24,P57,P812,P1318') throw new Error(`${src.file}：家長版應為 P24、P57、P812、P1318`);
  return {
    title: h1Title(src),
    family: 'qol',
    options: { main: opts.map(([l, v]) => ({ value: v, label: l })) },
    forms: parent.map(f => {
      if (f.opts !== 'OPTS4') throw new Error(`${src.file}：${f.id} 的選項不是 OPTS4`);
      return {
        key: f.id,
        name: f.title,
        minM: f.ageMin,
        maxM: f.ageMax - 1,
        sections: secs.map(s => {
          const items = f[s.key];
          if (!Array.isArray(items) || items.some(t => typeof t !== 'string')) throw new Error(`${src.file}：${f.id} ${s.key} 不是字串陣列`);
          return { key: s.key, name: s.name, options: 'main', items: (items as string[]).map((t, i) => ({ key: `${f.id}.${s.key}.${i + 1}`, text: t })) };
        }),
      };
    }),
    scoring: { levels: levels.map(l => ({ min: l.lo, max: l.hi, name: l.key })), schoolSection: 'SC' },
  };
}

export const QOL_RECIPES: V3Recipe[] = [{ code: 'SXK-QOL', slug: 'sxk-qol', file: '森心康_儿童生活质量量表_完整版_SXK-QOL.html', build }];

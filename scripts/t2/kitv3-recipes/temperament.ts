/**
 * 嬰幼兒氣質（T2 v3 題庫規格 §4.2「ITQ/TTS/BSQ」列，`temperament` 族）：客規沒有主維度，**不出 0–3**、不進維度判定；
 * 頁面不回傳結果，我們照頁面的 `score` 算九個向度（R-23）。
 *
 * 頁面的計分（探針確認）：
 * - 三份表：ITQ（95 題、6 點）、TTS（97 題、6 點）、BSQ（72 題、7 點）；每題另有「不适用／无此经验」（不進平均）。
 * - 向度平均＝Σ(正向題原分、反向題 points+1−原分) ÷ 已答題數。
 * - 有常模（ITQ、BSQ，依性別）：z＝(平均 − 常模平均) ÷ 標準差，> 1 高、< −1 低；沒有常模（TTS）：≥ 中點＋1 高、≤ 中點−1 低。
 * - 「高」對應的極端各表不同（`poles`，BSQ 的方向與 ITQ／TTS 相反），報告要照 `poles` 講，不能把「高」當同一件事。
 *
 * 挑表（規格 §4.3、R-23）：頁面讓家長自己點；我們依月齡：4–11 月 ITQ（9–11 月是頁面的空窗）、12–36 月 TTS、37–84 月 BSQ（36 月兩表重疊取 TTS）。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Form } from '../../../src/t2/kitv3/types';
import type { TemperamentScoring } from '../../../src/t2/kitv3/score';

interface PageScale {
  code: string;
  name: string;
  ageMin: number;
  ageMax: number;
  points: number;
  labels: string[];
  poles: Record<string, [string, string]>;
  aFactorHigh: Record<string, boolean>;
  norms: Record<string, Record<string, [number, number]>> | null;
  key: Record<string, Array<[number, number]>>;
  items: string[];
}

/** 我們的月齡窗（R-23）；頁面的 ageMin／ageMax 只用來核對沒抄錯。 */
const WINDOWS: Record<string, { page: [number, number]; ours: [number, number]; items: number }> = {
  ITQ: { page: [4, 8], ours: [4, 11], items: 95 },
  TTS: { page: [12, 36], ours: [12, 36], items: 97 },
  BSQ: { page: [36, 84], ours: [37, 84], items: 72 },
};

function build(src: V3Source): Omit<KitV3Bank<TemperamentScoring>, 'code' | 'source'> {
  probe(src, '反向題 points+1−v、不适用不算', /if\(v===undefined\|\|v==='NA'\)\{na\+\+;continue;\}sum\+=fwd\?v:\(s\.points\+1-v\);n\+\+;\}\s*const mean=n\?sum\/n:null;/);
  probe(src, '常模 z > 1／< −1', /z=\(mean-nm\[0\]\)\/nm\[1\];band=z>1\?'hi':z<-1\?'lo':'mid';/);
  probe(src, '沒常模 中點 ±1', /const mid=\(1\+s\.points\)\/2;band=mean>=mid\+1\?'hi':mean<=mid-1\?'lo':'mid';/);
  const [naLabel] = probe(src, '不适用', /onclick="setA\(\$\{q\},'NA',this\)">([^<]+)<small>/);
  const dims = need<string[]>(src, 'DIMS');
  const scales = need<Record<string, PageScale>>(src, 'SCALES');
  if (Object.keys(scales).join() !== 'ITQ,TTS,BSQ') throw new Error(`${src.file}：應為 ITQ、TTS、BSQ`);

  const forms: KitV3Form[] = [];
  const options: Record<string, Array<{ value: number | null; label: string }>> = {};
  const perForm: TemperamentScoring['forms'] = {};
  for (const [code, w] of Object.entries(WINDOWS)) {
    const s = scales[code];
    if (s.ageMin !== w.page[0] || s.ageMax !== w.page[1]) throw new Error(`${src.file}：${code} 的月齡改了（${s.ageMin}–${s.ageMax}）`);
    if (s.items.length !== w.items) throw new Error(`${src.file}：${code} 應有 ${w.items} 題`);
    if (s.labels.length !== s.points) throw new Error(`${src.file}：${code} 選項數不對`);
    // 每一題恰好屬於一個向度
    const seen = dims.flatMap(d => s.key[d].map(([q]) => q)).sort((a, b) => a - b);
    if (seen.length !== s.items.length || seen.some((q, i) => q !== i + 1)) throw new Error(`${src.file}：${code} 的計分表沒有涵蓋每一題恰好一次`);
    const opt = `p${s.points}`;
    options[opt] = [...s.labels.map((l, i) => ({ value: i + 1, label: l })), { value: null, label: naLabel.trim() }];
    forms.push({
      key: code,
      name: s.name,
      minM: w.ours[0],
      maxM: w.ours[1],
      sections: [{ key: 'Q', name: s.name, options: opt, items: s.items.map((t, i) => ({ key: `${code}.${i + 1}`, text: t })) }],
    });
    perForm[code] = {
      points: s.points,
      key: Object.fromEntries(dims.map(d => [d, s.key[d].map(([q, fwd]) => ({ item: `${code}.${q}`, forward: fwd === 1 }))])),
      norms: s.norms ? { male: s.norms['男'], female: s.norms['女'] } : null,
      poles: s.poles,
      aFactorHigh: s.aFactorHigh,
    };
  }
  return { title: h1Title(src), family: 'temperament', options, forms, scoring: { dims, forms: perForm } };
}

export const TEMPERAMENT_RECIPES: V3Recipe[] = [{ code: 'ITQ/TTS/BSQ', slug: 'temperament', file: '森心康_婴幼儿气质评估问卷_ITQ-TTS-BSQ.html', build }];

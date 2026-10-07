/**
 * 感覺處理記錄兩支（T2 v3 題庫規格 §4.2「SXK-SP」「SXK-SPb」列）：計分同「關切率」族（`concern.ts`），只開家庭版。
 *
 * 頁面的計分（探針確認）：
 * - 依月齡挑表（`bandForms`：[ageMin, ageMax)）；每表 9 面向 × 7 題，每題 0–3，沒有月齡挑題。
 * - ％＝round(Σ ÷ 題數×3 × 100)（`secScore`／`formScore`）；`LEVELS` 閉區間 lo／hi：0–28／29–45／46–100（`levelFor`）→ 0／1／3。
 * - 「有沒有影響到日常參與」4 項（`IMPACT`）要答、不計分、不改分段（頁面只進建議文字）。
 *
 * 表：SP 只用幼兒家庭版 H25（客規 24–59 月）；SPb 用學齡家庭版 H512 與青少年家庭版 H1215。
 * SPb 頁面擋 60–71 個月，客規要它從 60 起：暫採 60–71 月也用 H512（R-20；H512 與 SP 的學齡表逐題相同）。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Form, KitV3Section } from '../../../src/t2/kitv3/types';
import type { ConcernScoring } from '../../../src/t2/kitv3/score';

type PageForm = Record<string, unknown> & { id: string; title: string; ageMin: number; ageMax: number; setting: string };

function build(src: V3Source, ids: string[], firstMin?: number): Omit<KitV3Bank<ConcernScoring>, 'code' | 'source'> {
  probe(src, 'bandForms [min,max)', /function bandForms\(months\)\{return FORMS\.filter\(f=>months>=f\.ageMin&&months<f\.ageMax\);\}/);
  probe(src, 'secScore ÷(n×3)', /function secScore\(f,k\)\{[\s\S]{0,160}?\}\);const max=f\[k\]\.length\*3;return \{sum,max,hi,pct:Math\.round\(sum\/max\*100\)\};\}/);
  probe(src, 'levelFor lo–hi', /function levelFor\(p\)\{return LEVELS\.find\(l=>p>=l\.lo&&p<=l\.hi\)\|\|LEVELS\[LEVELS\.length-1\];\}/);
  const secs = need<Array<{ key: string; name: string }>>(src, 'SECS');
  const opts = need<Array<[string, number]>>(src, 'OPTS');
  const impact = need<Array<[string, string]>>(src, 'IMPACT');
  const levels = need<Array<{ lo: number; hi: number; key: string }>>(src, 'LEVELS');
  const pageForms = need<PageForm[]>(src, 'FORMS');
  if (opts.map(o => o[1]).join() !== '0,1,2,3') throw new Error(`${src.file}：OPTS 應為 0–3`);
  if (levels.length !== 3 || levels[0].lo !== 0) throw new Error(`${src.file}：LEVELS 應為從 0 起的 3 段`);
  if (impact.length !== 4) throw new Error(`${src.file}：IMPACT 應有 4 項`);

  const impSection: KitV3Section = { key: 'IMP', name: '有没有影响到日常参与', options: 'hasnot', items: impact.map(([k, t]) => ({ key: `imp.${k}`, text: t })) };
  const forms: KitV3Form[] = ids.map((id, i) => {
    const f = pageForms.find(x => x.id === id);
    if (!f || f.setting !== 'home') throw new Error(`${src.file}：找不到家庭版 ${id}`);
    const sections: KitV3Section[] = secs.map(s => {
      const items = f[s.key];
      if (!Array.isArray(items) || items.length !== 7 || items.some(t => typeof t !== 'string')) throw new Error(`${src.file}：${id} ${s.key} 應為 7 個字串`);
      return { key: s.key, name: s.name, options: 'main', items: (items as string[]).map((t, j) => ({ key: `${id}.${s.key}.${j + 1}`, text: t })) };
    });
    return { key: id, name: f.title, minM: i === 0 && firstMin !== undefined ? firstMin : f.ageMin, maxM: f.ageMax - 1, sections: [...sections, impSection] };
  });
  return {
    title: h1Title(src),
    family: 'concern',
    options: { main: opts.map(([l, v]) => ({ value: v, label: l })), hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }] },
    forms,
    scoring: { dim: 'SEN', levels: levels.map(l => ({ max: l.hi, name: l.key })), perItemMax: 3, naLimit: null, grade: [0, 1, 3] },
  };
}

export const SP_RECIPES: V3Recipe[] = [
  { code: 'SXK-SP', slug: 'sxk-sp', file: '森心康_感觉处理记录量表_完整版_SXK-SP.html', build: src => build(src, ['H25']) },
  // R-20：60–71 月也用 H512（頁面從 72 起）
  { code: 'SXK-SPb', slug: 'sxk-spb', file: '森心康_感觉处理记录量表_学龄完整版_SXK-SPb.html', build: src => build(src, ['H512', 'H1215'], 60) },
];

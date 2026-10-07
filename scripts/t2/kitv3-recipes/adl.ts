/**
 * SXK-ADL 生活自理功能量表（T2 v3 題庫規格 §4.2「SXK-ADL」列，`adl` 族）。
 *
 * 頁面的計分（探針確認）：
 * - 7 領域 62 題，題目 `[字, 起始月齡, 方式類型?]`，月齡 ≥ 起始才出（`allItems`；早產 < 24 月用矯正月齡，由送卷端給）。
 * - 選項七級，**7 最好**（完全自己做）到 1（完全由大人做）；獨立率＝round((Σ − 題數) ÷ (題數×6) × 100)（`overall`／`secStat`）。
 * - `LEVELS` 用下限（`levelFor`：第一個 p ≥ min）：≥ 72／45–71／< 45 → 0／1／3（越高越好，段的順序就是好 → 壞）。
 * - 領域不到 2 題不單獨判（頁面「题数偏少，仅供参考」）。方式（步行／輪椅……）、輔具、與病況有關嗎都不計分，不出。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { AdlScoring } from '../../../src/t2/kitv3/score';

function build(src: V3Source): Omit<KitV3Bank<AdlScoring>, 'code' | 'source'> {
  probe(src, 'allItems 月齡 ≥ 起始', /function allItems\(M\)\{const out=\[\];SECS\.forEach\(s=>s\.items\.forEach\(\(\[t,m,md\],i\)=>\{if\(M>=m\)out\.push/);
  probe(src, '獨立率 (Σ−n)÷6n', /function overall\(ans,its\)\{[\s\S]{0,120}?pct:n\?Math\.round\(\(got-n\)\/\(n\*6\)\*100\):0\};\}/);
  probe(src, '領域同式', /pct:its\.length\?Math\.round\(\(got-its\.length\)\/\(its\.length\*6\)\*100\):null\};\}/);
  probe(src, 'levelFor 第一個 ≥ min', /function levelFor\(p\)\{return LEVELS\.find\(l=>p>=l\.min\)\|\|LEVELS\[2\];\}/);
  probe(src, '領域 ≥ 2 題才判', /st\.n>=2/);
  const secs = need<Array<{ key: string; name: string; items: Array<[string, number, string?]> }>>(src, 'SECS');
  const opts = need<Array<[number, string, string]>>(src, 'OPTS');
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  if (opts.map(o => o[0]).join() !== '7,6,5,4,3,2,1') throw new Error(`${src.file}：OPTS 應為 7→1`);
  if (levels.length !== 3 || levels[2].min !== 0) throw new Error(`${src.file}：LEVELS 應為三段、最後從 0 起`);
  const sections = secs.map(s => ({
    key: s.key,
    name: s.name,
    options: 'main',
    items: s.items.map(([t, m], i) => ({ key: `${s.key}.${i + 1}`, text: t, month: m })),
  }));
  if (sections.flatMap(s => s.items).length !== 62) throw new Error(`${src.file}：應有 62 題`);
  return {
    title: h1Title(src),
    family: 'adl',
    options: { main: opts.map(([v, l, d]) => ({ value: v, label: l, hint: d.replace(/<\/?b>/g, '') })) },
    forms: [{ key: 'main', name: '生活自理', sections }],
    scoring: { dim: 'ADL', levels: levels.map(l => ({ min: l.min, name: l.key })), minItems: 2, grade: [0, 1, 3] },
  };
}

export const ADL_RECIPES: V3Recipe[] = [{ code: 'SXK-ADL', slug: 'sxk-adl', file: '森心康_生活自理功能量表_完整版_SXK-ADL.html', build }];

/**
 * SXK-ASQ3（分齡發育綜合評估，T2 v3 題庫規格 §4.2「SXK-ASQ3」列、§4.3）。
 *
 * 頁面的計分（探針確認）：
 * - 21 個月齡題組（`SETS`，區間 [lo, hi) 月），依（矯正）月齡挑一組（`pickSet`）；每組 5 領域 × 6 題＝30 題。
 * - 選項 10 已经会／5 偶尔会／0 还不会。領域％＝round(Σ ÷ 60 × 100)（`domScore`）、總％＝round(Σ ÷ 300 × 100)。
 * - 分段 `LEVELS` 85／70／55／0（`levelFor`），領域與總分同一套。
 * - 整體問題 `OVERALL`（9 題是／否，部分有起始月齡）與分齡紅旗 `RED_BANDS`：**不改分數**，只決定頁面的
 *   「建议转介」（`refer`：任一紅旗、聽力／視力／倒退／動作答了警示的那一邊、或任一領域 < 55）。
 *
 * 我們的月齡是整數：題組 [lo, hi) 換成整數月的 [ceil(lo), ceil(hi) − 1]；紅旗段同理。頁面可以手改題組，我們不給改（§4.3）。
 * 0–3（規格 §4.2）：溝通 → LANG、粗大＋精細 → MOT（取重）、解決問題 → COG、個人社交 → SOC；各領域分段 0–3。
 * `refer` 不改各領域的 0–3，報告最上方出一句轉介（暫採）。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Form } from '../../../src/t2/kitv3/types';
import type { Asq3Scoring } from '../../../src/t2/kitv3/score';
import type { DimensionCode } from '../../../src/t2/types';

const DIM_OF: Record<string, DimensionCode> = { cm: 'LANG', gm: 'MOT', fm: 'MOT', ps: 'COG', so: 'SOC' };

function build(src: V3Source): Omit<KitV3Bank<Asq3Scoring>, 'code' | 'source'> {
  probe(src, 'pickSet [lo,hi)', /function pickSet\(dec\)\{return SETS\.find\(s=>dec>=s\.lo&&dec<s\.hi\)\|\|null;\}/);
  probe(src, 'domScore ÷60', /function domScore\(k\)\{[\s\S]*?return \{got,n,max:60,pct:Math\.round\(got\/60\*100\)\};\}/);
  probe(src, '總％ ÷300', /totPct=Math\.round\(tot\/300\*100\)/);
  probe(src, 'levelFor', /function levelFor\(p\)\{return LEVELS\.find\(l=>p>=l\.min\)\|\|LEVELS\[LEVELS\.length-1\];\}/);
  probe(src, '選項 10／5／0', /\[\[10,'已经会'\],\[5,'偶尔会'\],\[0,'还不会'\]\]/);
  const [referIds, referPct] = probe(src, 'refer', /const refer=flagged\.length>0\|\|ovWarn\.some\(o=>\[([^\]]+)\]\.includes\(o\.id\)\)\|\|st\.some\(x=>x\.sc\.pct<(\d+)\);/);
  probe(src, 'OVERALL 依起始月齡出', /OVERALL\.filter\(o=>!o\.min\|\|um>=o\.min\)/);

  const domains = need<Array<{ key: string; name: string }>>(src, 'DOMAINS');
  const sets = need<Array<Record<string, unknown> & { id: number; label: string; lo: number; hi: number }>>(src, 'SETS');
  const overall = need<Array<{ id: string; q: string; warn: 'yes' | 'no'; min?: number }>>(src, 'OVERALL');
  const red = need<Array<{ lo: number; hi: number; label: string; flags: string[] }>>(src, 'RED_BANDS');
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  if (sets.length !== 21) throw new Error(`${src.file}：SETS 應有 21 組，拿到 ${sets.length}`);
  if (levels.length !== 4) throw new Error(`${src.file}：LEVELS 應有 4 段`);

  const intRange = (lo: number, hi: number) => ({ min: Math.ceil(lo), max: Math.ceil(hi) - 1 });
  const extras = [
    {
      key: 'OVERALL',
      name: '整体情况',
      options: 'yesno',
      items: overall.map(o => ({ key: `ov.${o.id}`, text: o.q, ...(o.min ? { month: o.min } : {}) })),
    },
    {
      key: 'RED',
      name: '需要特别留意的情形（有就选「有」）',
      options: 'hasnot',
      items: red.flatMap((b, bi) => {
        const r = intRange(b.lo, b.hi);
        return b.flags.map((t, i) => ({ key: `red.${bi + 1}.${i + 1}`, text: t, month: r.min, maxMonth: r.max }));
      }),
    },
  ];

  const forms: KitV3Form[] = sets.map(s => {
    const r = intRange(s.lo, s.hi);
    return {
      key: String(s.id),
      name: `${s.label}题组`,
      minM: r.min,
      maxM: r.max,
      sections: [
        ...domains.map(d => {
          const items = s[d.key];
          if (!Array.isArray(items) || items.length !== 6 || items.some(t => typeof t !== 'string')) throw new Error(`${src.file}：${s.label} ${d.key} 不是 6 題`);
          return { key: d.key, name: d.name, options: 'main', items: (items as string[]).map((t, i) => ({ key: `${s.id}.${d.key}.${i + 1}`, text: t })) };
        }),
        ...extras,
      ],
    };
  });

  return {
    title: h1Title(src),
    family: 'asq3',
    options: {
      main: [
        { value: 10, label: '已经会' },
        { value: 5, label: '偶尔会' },
        { value: 0, label: '还不会' },
      ],
      yesno: [{ value: 1, label: '是' }, { value: 0, label: '否' }],
      hasnot: [{ value: 1, label: '有' }, { value: 0, label: '没有' }],
    },
    forms,
    scoring: {
      levels: levels.map(l => ({ min: l.min, name: l.key })),
      domainDim: Object.fromEntries(domains.map(d => {
        if (!DIM_OF[d.key]) throw new Error(`${src.file}：不認識的領域 ${d.key}`);
        return [d.key, DIM_OF[d.key]];
      })),
      perItemMax: 10,
      overallWarn: Object.fromEntries(overall.map(o => [`ov.${o.id}`, o.warn === 'yes' ? 1 : 0])),
      referOverall: referIds.split(',').map(x => `ov.${x.trim().replace(/'/g, '')}`),
      referBelow: Number(referPct),
    },
  };
}

export const ASQ3_RECIPES: V3Recipe[] = [
  { code: 'SXK-ASQ3', slug: 'sxk-asq3', file: '森心康_分龄发育综合评估_完整版_SXK-ASQ3.html', build },
];

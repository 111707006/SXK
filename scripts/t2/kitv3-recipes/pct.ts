/**
 * 「達成率」族（T2 v3 題庫規格 §4.2 第一、二列）：SXK-GM、SXK-SOC、SXK-ADP、SXK-PLC（同一份模板）與 SXK-LANG。
 *
 * 頁面的計分（GM 的 `domStat`／`totPct`／`band`，LANG 的 `domScore`／`overall`／`band`；探針確認公式沒變）：
 * - 題目帶月齡 `m`，**實足月齡 ≥ m 的題全部計分**（`buildItems` 的 `ok = age >= it.m`）；LANG 另有面向的 `xmax`
 *   （前語言 PL 過了 60 個月不出，`inAge`）。
 * - 選項 2 已经会／1 偶尔会／0 还不会。
 * - 面向％＝實得 ÷（題數 × 2）四捨五入；面向題數 < `MIN_ITEMS` 不單獨判。總％＝全部計分題合在一起算（不是面向平均）。
 * - 分段 `LEVELS`（由高到低的 `min`）：第一個 `p >= min` 的那段。四段 → 0–3。
 *
 * 家長只填「家长报告版」（`FORMS` 的 `p`）：兩份題目逐字相同，我們只出一份（題庫規格 §2.3）。
 */

import { h1Title, need, num, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank, KitV3Option } from '../../../src/t2/kitv3/types';
import type { PctScoring } from '../../../src/t2/kitv3/score';
import type { DimensionCode } from '../../../src/t2/types';

interface RawSec { key: string; name: string; xmax?: number; items: Array<{ t: unknown; m: unknown }> }
interface RawLevel { min: unknown; key: unknown }

/** 頁面計分公式的探針：公式改了就停下來讓人看，不安靜地照舊算。 */
function assertFormula(src: V3Source, family: 'gm' | 'lang') {
  if (family === 'gm') {
    probe(src, 'domStat 達成率', /function domStat\(fk,key\)\{[\s\S]*?max=its\.length\*2;[\s\S]*?pct:max\?Math\.round\(got\/max\*100\):null,[\s\S]*?scored:its\.length>=MIN_ITEMS/);
    probe(src, 'totPct 全部題合算', /function totPct\(fk\)\{[\s\S]*?max=its\.length\*2;[\s\S]*?return max\?Math\.round\(got\/max\*100\):null;/);
    probe(src, 'buildItems 月齡累積', /var ok=age>=it\.m;/);
  } else {
    probe(src, 'domScore 達成率', /function domScore\(key\)\{[\s\S]*?var max=its\.length\*2;[\s\S]*?pct:max\?Math\.round\(got\/max\*100\):null,[\s\S]*?scored:its\.length>=MIN_ITEMS/);
    probe(src, 'overall 全部題合算', /function overall\(\)\{[\s\S]*?max=its\.length\*2;[\s\S]*?pct:max\?Math\.round\(got\/max\*100\):0\}/);
    probe(src, 'inAge 月齡與 xmax', /function inAge\(sec,it,age\)\{return age>=it\.m&&\(!sec\.xmax\|\|age<=sec\.xmax\)\}/);
  }
  probe(src, 'band 取第一個 p>=min', /function band\(p\)\{for\(var i=0;i<LEVELS\.length;i\+\+\)if\(p>=LEVELS\[i\]\.min\)return LEVELS\[i\];return LEVELS\[LEVELS\.length-1\]\}/);
}

function levelsOf(src: V3Source) {
  const raw = need<RawLevel[]>(src, 'LEVELS');
  if (raw.length !== 4) throw new Error(`${src.file}：LEVELS 應有 4 段，拿到 ${raw.length}`);
  return raw.map((l, i) => {
    if (typeof l.min !== 'number' || typeof l.key !== 'string') throw new Error(`${src.file}：LEVELS 第 ${i + 1} 段不是 {min, key}`);
    if (i > 0 && (raw[i - 1].min as number) <= l.min) throw new Error(`${src.file}：LEVELS 不是由高到低`);
    return { min: l.min, name: l.key };
  });
}

function build(src: V3Source, dim: DimensionCode, family: 'gm' | 'lang'): Omit<KitV3Bank<PctScoring>, 'code' | 'source'> {
  assertFormula(src, family);
  const secs = need<RawSec[]>(src, 'SECS');
  let options: KitV3Option[];
  let minItems: number;
  if (family === 'gm') {
    const opts = need<Array<{ v: unknown; t: unknown; d: unknown }>>(src, 'OPTS');
    options = opts.map((o, i) => {
      if (typeof o.v !== 'number' || typeof o.t !== 'string') throw new Error(`${src.file}：OPTS 第 ${i + 1} 個不是 {v, t}`);
      return typeof o.d === 'string' ? { value: o.v, label: o.t, hint: o.d } : { value: o.v, label: o.t };
    });
    minItems = need<number>(src, 'MIN_ITEMS');
    const forms = need<Array<{ k: string }>>(src, 'FORMS');
    if (!forms.some(f => f.k === 'p')) throw new Error(`${src.file}：FORMS 沒有家長版 p`);
  } else {
    // LANG 的選項寫在畫面模板裡：['还不会','偶尔会','已经会'] 依索引 0／1／2
    const [labels] = probe(src, '選項模板', /\[('还不会','偶尔会','已经会')\]\.map\(function\(lb,k\)/);
    options = labels.split(',').map((l, k) => ({ value: k, label: l.replace(/'/g, '') })).reverse();
    minItems = num(probe(src, 'MIN_ITEMS', /var MIN_ITEMS=(\d+);/)[0]);
  }
  if (options.map(o => o.value).join() !== '2,1,0') throw new Error(`${src.file}：選項值應為 2／1／0，拿到 ${options.map(o => o.value).join()}`);

  return {
    title: h1Title(src),
    family: 'pct',
    options: { main: options },
    forms: [
      {
        key: 'p',
        name: '家长报告版',
        sections: secs.map(s => ({
          key: s.key,
          name: s.name,
          options: 'main',
          items: s.items.map((it, i) => {
            if (typeof it.t !== 'string' || typeof it.m !== 'number') throw new Error(`${src.file}：${s.key} 第 ${i + 1} 題不是 {t, m}`);
            return { key: `${s.key}.${i + 1}`, text: it.t, month: it.m };
          }),
        })),
      },
    ],
    scoring: {
      dim,
      levels: levelsOf(src),
      minItems,
      sectionMaxMonth: Object.fromEntries(secs.filter(s => typeof s.xmax === 'number').map(s => [s.key, s.xmax as number])),
    },
  };
}

export const PCT_RECIPES: V3Recipe[] = [
  { code: 'SXK-GM', slug: 'sxk-gm', file: '森心康_粗大动作发展量表_完整版_SXK-GM.html', build: src => build(src, 'MOT', 'gm') },
  { code: 'SXK-SOC', slug: 'sxk-soc', file: '森心康_社会能力发展量表_完整版_SXK-SOC.html', build: src => build(src, 'SOC', 'gm') },
  { code: 'SXK-ADP', slug: 'sxk-adp', file: '森心康_适应能力发展量表_完整版_SXK-ADP.html', build: src => build(src, 'COG', 'gm') },
  { code: 'SXK-PLC', slug: 'sxk-plc', file: '森心康_语言前能力发展量表_完整版_SXK-PLC.html', build: src => build(src, 'LANG', 'gm') },
  { code: 'SXK-LANG', slug: 'sxk-lang', file: '森心康_语言能力发展量表_完整版_SXK-LANG.html', build: src => build(src, 'LANG', 'lang') },
];

import { describe, it, expect } from 'vitest';
import { askedItems, scoreKitV3, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as VOC } from '../src/t2/kitv3/sxk-voc';
import { SXK_VOC } from '../src/t2/toolkit/sxk-voc';

/**
 * SXK-VOC（T2 v3 題庫規格 §4.2、R-19）。期望值照頁面 `aItems`、A％、旗標與結論那一行（見配方檔頭）；三段 → 0／1／3。
 */

const keysOf = (ageM: number, sec?: string) => askedItems(VOC, { ageM }).filter(a => !sec || a.section === sec).map(a => a.item.key);

/** A 全答 v、手勢全「有」、句子全「会」，`over` 蓋過。 */
function answers(ageM: number, v = 2, over: Record<string, number> = {}): KitV3Answers {
  const out: Record<string, number> = {};
  for (const a of askedItems(VOC, { ageM })) out[a.item.key] = a.section === 'GEST' || a.section === 'GRAM' ? 1 : v;
  return { ...out, ...over };
}

describe('SXK-VOC：題目', () => {
  it('A 里程碑 30 題、月齡同 9/08 舊版逐題一樣；盤點逐月：12 個月 4 題、18 月 17、24 月 24、36 月 30', () => {
    const items = VOC.forms[0].sections.filter(s => s.options === 'main').flatMap(s => s.items);
    const old = SXK_VOC.sections.flatMap(s => s.items);
    expect(items.map(i => [i.text, i.month])).toEqual(old.map(o => [o.text, o.startMonth]));
    expect([12, 18, 24, 36].map(m => keysOf(m).filter(k => k.startsWith('V')).length)).toEqual([4, 17, 24, 30]);
  });

  it('C：未滿 18 個月出 18 項手勢、18 個月起出句子（依月齡）', () => {
    expect(keysOf(17, 'GEST')).toHaveLength(18);
    expect(keysOf(17, 'GRAM')).toHaveLength(0);
    expect(keysOf(18, 'GEST')).toHaveLength(0);
    expect(keysOf(18, 'GRAM')).toEqual(['gram.1']);
    expect(keysOf(33, 'GRAM')).toHaveLength(12);
  });
});

describe('SXK-VOC：結論與 0–3', () => {
  it('全部已经会、手勢與句子都有 → 「发展中符合预期」→ 0', () => {
    const r = scoreKitV3(VOC, answers(30), { ageM: 30 });
    expect(r.total).toMatchObject({ value: 100, band: 0 });
    expect(r.grade03).toEqual({ LANG: 0 });
    expect(r.flags).toBeUndefined();
  });

  it('A％ < 80 → 1、< 60 → 3', () => {
    const keys = keysOf(36, undefined).filter(k => k.startsWith('V'));
    const mk = (pctTarget: number) => {
      // 前 n 題 2、其餘 0，讓 A％ 落在想要的區間
      const n = Math.round((keys.length * pctTarget) / 100);
      return answers(36, 2, Object.fromEntries(keys.map((k, i) => [k, i < n ? 2 : 0])));
    };
    expect(scoreKitV3(VOC, mk(80), { ageM: 36 }).grade03).toEqual({ LANG: 0 });
    expect(scoreKitV3(VOC, mk(70), { ageM: 36 }).grade03).toEqual({ LANG: 1 });
    expect(scoreKitV3(VOC, mk(50), { ageM: 36 }).grade03).toEqual({ LANG: 3 });
  });

  it('一條旗標 → 1：24 個月以上不會兩詞組合', () => {
    const r = scoreKitV3(VOC, answers(26, 2, { 'gram.1': 0 }), { ageM: 26 });
    expect(r.flags).toEqual(['two']);
    expect(r.grade03).toEqual({ LANG: 1 });
  });

  it('兩條旗標 → 3：12–17 個月手勢少於 6 項＋理解％ < 60', () => {
    const gest = Object.fromEntries(keysOf(15, 'GEST').map(k => [k, 0]));
    const v1 = Object.fromEntries(keysOf(15, 'V1').map(k => [k, 0]));
    const r = scoreKitV3(VOC, answers(15, 2, { ...gest, ...v1 }), { ageM: 15 });
    expect(r.flags).toEqual(['gest', 'v1']);
    expect(r.grade03).toEqual({ LANG: 3 });
  });
});

import { describe, it, expect } from 'vitest';
import { lqAgeBand, scoreKitV3, type KitV3Answers, type LqScoring } from '../src/t2/kitv3/score';
import { BANK as LQ } from '../src/t2/kitv3/sxk-lq';

/**
 * SXK-LQ（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/lq.ts` 檔頭）。期望值照頁面的
 * `domStat`（％）、`domBand`（最高穩定達成帶）、`gapOf`（帶差）、`verdict`（紅旗凌駕）算；0–3 照規格 §4.2／§4.3。
 */

const S = LQ.scoring as LqScoring;
const sections = LQ.forms[0].sections;
const dimItems = sections.filter(s => s.options === 'main').flatMap(s => s.items);
const flagItems = sections.find(s => s.key === 'FLAGS')!.items;

/** 全部答 v（紅旗全沒有），`over` 蓋過指定題。 */
function answers(v: number | null, over: Record<string, number | null> = {}): KitV3Answers {
  return {
    ...Object.fromEntries(dimItems.map(it => [it.key, v])),
    ...Object.fromEntries(flagItems.map(it => [it.key, 0])),
    ...over,
  };
}
/** 某面向某帶的第一題。 */
const itemAt = (dim: string, band: number) => sections.find(s => s.key === dim)!.items.find(it => S.itemBand[it.key] === band)!.key;

describe('SXK-LQ：題目', () => {
  it('56 題：四個面向各 14 題、每個面向每帶 2 題；選項 3／2／1／不确定（null）', () => {
    expect(dimItems).toHaveLength(56);
    for (const dim of ['L1', 'L2', 'L3', 'L4']) {
      const its = sections.find(s => s.key === dim)!.items;
      expect(its).toHaveLength(14);
      for (let b = 1; b <= 7; b++) expect(its.filter(it => S.itemBand[it.key] === b), `${dim} B${b}`).toHaveLength(2);
    }
    expect(LQ.options.main.map(o => o.value)).toEqual([3, 2, 1, null]);
    expect(flagItems).toHaveLength(8);
  });

  it('月齡所在的帶：12–18 B1……61–72 B7；12 以下 0、72 以上 8', () => {
    expect([11, 12, 18, 19, 36, 37, 48, 49, 72, 73].map(m => lqAgeBand(S, m))).toEqual([0, 1, 1, 2, 4, 5, 5, 6, 7, 8]);
  });
});

describe('SXK-LQ：帶差與 0–3', () => {
  it('36 個月、全部已经可以 → 帶差 0、0', () => {
    const r = scoreKitV3(LQ, answers(3), { ageM: 36 });
    expect(r.facets.map(f => f.detail)).toEqual(Array(4).fill({ lv: 7, gap: 0 }));
    expect(r.grade03).toEqual({ LANG: 0 });
  });

  it('年齡帶以上的題答「还不行」不影響（36 個月 B5–B7 全部 1）', () => {
    const over = Object.fromEntries(dimItems.filter(it => S.itemBand[it.key] >= 5).map(it => [it.key, 1]));
    expect(scoreKitV3(LQ, answers(3, over), { ageM: 36 }).grade03).toEqual({ LANG: 0 });
  });

  it('B1 有一題「偶尔可以」→ 那個面向停在未達 B1，36 個月帶差 4 → 3', () => {
    const r = scoreKitV3(LQ, answers(3, { [itemAt('L1', 1)]: 2 }), { ageM: 36 });
    expect(r.facets.find(f => f.key === 'L1')!.detail).toEqual({ lv: 0, gap: 4 });
    expect(r.grade03).toEqual({ LANG: 3 });
  });

  it('「不确定」一樣會卡住那條鏈（頁面的 blocked）', () => {
    const r = scoreKitV3(LQ, answers(3, { [itemAt('L2', 2)]: null }), { ageM: 36 });
    expect(r.facets.find(f => f.key === 'L2')!.detail).toEqual({ lv: 1, gap: 3 });
  });

  it('最大帶差 1 → 1、2 → 2', () => {
    expect(scoreKitV3(LQ, answers(3, { [itemAt('L3', 4)]: 2 }), { ageM: 36 }).grade03).toEqual({ LANG: 1 });
    expect(scoreKitV3(LQ, answers(3, { [itemAt('L3', 3)]: 2 }), { ageM: 36 }).grade03).toEqual({ LANG: 2 });
  });

  it('紅旗勾了 → 結論是「有需要特别注意的情形」、0–3 至少 2', () => {
    const r = scoreKitV3(LQ, answers(3, { [flagItems[0].key]: 1 }), { ageM: 36 });
    expect(r.total.bandName).toBe(S.rules[3]);
    expect(r.grade03).toEqual({ LANG: 2 });
  });

  it('％：「不确定」不進分母（只進後台）', () => {
    const r = scoreKitV3(LQ, answers(3, { [itemAt('L4', 7)]: null }), { ageM: 60 });
    expect(r.facets.find(f => f.key === 'L4')!.value).toBe(100);
  });

  it('口腔 6 題選答：沒答不算缺答；紅旗 8 題要答', () => {
    const a = answers(3);
    expect(scoreKitV3(LQ, a, { ageM: 36 }).missing).toEqual([]);
    const { [flagItems[0].key]: _, ...noFlag } = a;
    expect(scoreKitV3(LQ, noFlag, { ageM: 36 }).missing).toEqual([flagItems[0].key]);
  });
});

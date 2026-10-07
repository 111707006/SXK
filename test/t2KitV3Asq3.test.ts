import { describe, it, expect } from 'vitest';
import { askedItems, formFor, scoreKitV3, type Asq3Scoring, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as ASQ3 } from '../src/t2/kitv3/sxk-asq3';

/**
 * SXK-ASQ3（T2 v3 題庫規格 §4.2、§4.3；頁面公式見 `scripts/t2/kitv3-recipes/asq3.ts` 檔頭）。
 * 期望值照頁面 `pickSet`、`domScore`（÷60）、總％（÷300）、`levelFor`、`refer`。
 */

const S = ASQ3.scoring as Asq3Scoring;
const DOMAINS = ['cm', 'gm', 'fm', 'ps', 'so'];

/** 某個月齡：五個領域全部答 v（`by` 可以逐領域指定），整體問題全答「不警示」、紅旗全「没有」。 */
function answers(ageM: number, v = 10, by: Record<string, number[]> = {}, over: Record<string, number> = {}): KitV3Answers {
  const out: Record<string, number> = {};
  for (const a of askedItems(ASQ3, { ageM })) {
    if (a.section === 'OVERALL') out[a.item.key] = S.overallWarn[a.item.key] === 1 ? 0 : 1;
    else if (a.section === 'RED') out[a.item.key] = 0;
    else {
      const i = Number(a.item.key.split('.').pop()) - 1;
      out[a.item.key] = by[a.section]?.[i] ?? v;
    }
  }
  return { ...out, ...over };
}

describe('SXK-ASQ3：題組與題目', () => {
  it('21 個題組；1–66 個月每個整數月剛好落在一個題組（1–2 月用 3 個月那一組，R-28），0 與 67 個月沒有', () => {
    expect(ASQ3.forms).toHaveLength(21);
    expect(formFor(ASQ3, 1).key).toBe('3');
    for (let m = 1; m <= 66; m++) {
      expect(ASQ3.forms.filter(f => m >= f.minM! && m <= f.maxM!), `${m}`).toHaveLength(1);
    }
    expect(() => formFor(ASQ3, 0)).toThrow();
    expect(() => formFor(ASQ3, 67)).toThrow();
  });

  it('題組邊界照頁面的 [lo, hi)：36→36、38→36、39→42、25→24、26→27、57→60', () => {
    expect([36, 38, 39, 25, 26, 57].map(m => formFor(ASQ3, m).key)).toEqual(['36', '36', '42', '24', '27', '60']);
  });

  it('每個題組 5 領域 × 6 題＝30 題；選項 10／5／0', () => {
    for (const f of ASQ3.forms) expect(f.sections.filter(s => DOMAINS.includes(s.key)).flatMap(s => s.items), f.key).toHaveLength(30);
    expect(ASQ3.options.main.map(o => o.value)).toEqual([10, 5, 0]);
  });

  it('整體問題依起始月齡出（盤點：12 個月 7 題、36／60 個月 9 題）', () => {
    const ov = (m: number) => askedItems(ASQ3, { ageM: m }).filter(a => a.section === 'OVERALL').length;
    expect([12, 36, 60].map(ov)).toEqual([7, 9, 9]);
  });

  it('紅旗依月齡段出：12 個月 7 條、25 個月（13–24 段）8 條、26 個月（25–42 段）8 條', () => {
    const red = (m: number) => askedItems(ASQ3, { ageM: m }).filter(a => a.section === 'RED').map(a => a.item.key);
    expect(red(12)).toHaveLength(7);
    expect(red(25).every(k => k.startsWith('red.3.'))).toBe(true);
    expect(red(26).every(k => k.startsWith('red.4.'))).toBe(true);
  });
});

describe('SXK-ASQ3：分數與 0–3', () => {
  it('全部已经会 → 每個領域 100、總 100、每個主維度 0、不轉介', () => {
    const r = scoreKitV3(ASQ3, answers(36), { ageM: 36 });
    expect(r.facets.map(f => f.value)).toEqual([100, 100, 100, 100, 100]);
    expect(r.total).toMatchObject({ value: 100, band: 0 });
    expect(r.grade03).toEqual({ LANG: 0, MOT: 0, COG: 0, SOC: 0 });
    expect(r.flags).toBeUndefined();
    expect(r.missing).toEqual([]);
  });

  // 每題只有 0／5／10，領域％只能是 60 的 5 倍數：55→92、50→83、45→75、40→67、35→58、30→50
  it.each([
    [[10, 10, 10, 10, 10, 5], 92, 0],
    [[10, 10, 10, 10, 10, 0], 83, 1],
    [[10, 10, 10, 5, 5, 5], 75, 1],
    [[10, 10, 10, 10, 0, 0], 67, 2],
    [[10, 10, 5, 5, 5, 0], 58, 2],
    [[10, 10, 10, 0, 0, 0], 50, 3],
  ])('溝通 %j → %i％、0–3 的 LANG 是 %i', (cm, pct, grade) => {
    const r = scoreKitV3(ASQ3, answers(36, 10, { cm }), { ageM: 36 });
    expect(r.facets.find(f => f.key === 'cm')!.value).toBe(pct);
    expect(r.grade03.LANG).toBe(grade);
  });

  it('粗大與精細都進 MOT，取重的', () => {
    const r = scoreKitV3(ASQ3, answers(36, 10, { gm: [10, 10, 10, 10, 10, 0], fm: [10, 10, 10, 0, 0, 0] }), { ageM: 36 });
    expect(r.grade03.MOT).toBe(3);
  });

  it('總％＝五領域合算 ÷ 300', () => {
    const r = scoreKitV3(ASQ3, answers(36, 10, { cm: [0, 0, 0, 0, 0, 0] }), { ageM: 36 });
    expect(r.total.value).toBe(Math.round((240 / 300) * 100));
  });

  it('轉介：任一紅旗、聽力／視力／倒退／動作答警示、或任一領域 < 55；「担心」答是不算', () => {
    const red = askedItems(ASQ3, { ageM: 36 }).find(a => a.section === 'RED')!.item.key;
    expect(scoreKitV3(ASQ3, answers(36, 10, {}, { [red]: 1 }), { ageM: 36 }).flags).toEqual(['refer']);
    expect(scoreKitV3(ASQ3, answers(36, 10, {}, { 'ov.hear': 0 }), { ageM: 36 }).flags).toEqual(['refer']);
    expect(scoreKitV3(ASQ3, answers(36, 10, {}, { 'ov.worry': 1 }), { ageM: 36 }).flags).toBeUndefined();
    expect(scoreKitV3(ASQ3, answers(36, 10, { so: [10, 10, 10, 0, 0, 0] }), { ageM: 36 }).flags).toEqual(['refer']);
    expect(S.referOverall).toEqual(['ov.hear', 'ov.see', 'ov.regress', 'ov.move']);
  });

  it('沒答的題列在 missing；別的題組、月齡沒到的整體問題不算', () => {
    const a = answers(12);
    const first = askedItems(ASQ3, { ageM: 12 })[0].item.key;
    const { [first]: _, ...rest } = a;
    expect(scoreKitV3(ASQ3, rest, { ageM: 12 }).missing).toEqual([first]);
  });
});

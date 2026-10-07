import { describe, it, expect } from 'vitest';
import { formFor, scoreKitV3, type KitV3Answers, type TemperamentScoring } from '../src/t2/kitv3/score';
import { BANK as TEMP } from '../src/t2/kitv3/temperament';

/**
 * ITQ/TTS/BSQ（T2 v3 題庫規格 §4.2、§4.3、R-23；頁面公式見 `scripts/t2/kitv3-recipes/temperament.ts` 檔頭）。
 * 不出 0–3；九向度的平均與偏向（常模 z ±1，沒常模用中點 ±1）。
 */

const S = TEMP.scoring as TemperamentScoring;

/** 每一題答到「計分後」是 `scored`（反向題倒回原分）。 */
function scoredAll(form: string, scored: number): KitV3Answers {
  const f = S.forms[form];
  const out: Record<string, number> = {};
  for (const dim of S.dims) for (const { item, forward } of f.key[dim]) out[item] = forward ? scored : f.points + 1 - scored;
  return out;
}

describe('ITQ/TTS/BSQ', () => {
  it('依月齡挑表：4、11 → ITQ；12、36 → TTS；37、84 → BSQ（R-23）', () => {
    expect([4, 11, 12, 36, 37, 84].map(m => formFor(TEMP, m).key)).toEqual(['ITQ', 'ITQ', 'TTS', 'TTS', 'BSQ', 'BSQ']);
  });

  it('題數 95／97／72；ITQ 九向度 13／12／11／11／10／10／8／10／10（盤點）', () => {
    expect(TEMP.forms.map(f => f.sections[0].items.length)).toEqual([95, 97, 72]);
    expect(S.dims.map(d => S.forms.ITQ.key[d].length)).toEqual([13, 12, 11, 11, 10, 10, 8, 10, 10]);
    expect(TEMP.options.p6.at(-1)).toEqual({ value: null, label: '不适用' });
    expect(TEMP.options.p7.map(o => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, null]);
  });

  it('不出 0–3、沒有整體分級', () => {
    const r = scoreKitV3(TEMP, scoredAll('TTS', 4), { ageM: 24 });
    expect(r.grade03).toEqual({});
    expect(r.total).toEqual({ value: null, band: null, bandName: null });
  });

  it('反向題倒回：每題原分都答 6 → 正向題 6、反向題 1', () => {
    const raw = Object.fromEntries(TEMP.forms[0].sections[0].items.map(i => [i.key, 6]));
    const r = scoreKitV3(TEMP, raw, { ageM: 6, sex: 'male' });
    for (const dim of S.dims) {
      const k = S.forms.ITQ.key[dim];
      const want = k.reduce((n, x) => n + (x.forward ? 6 : 1), 0) / k.length;
      expect(r.facets.find(f => f.key === dim)!.value, dim).toBe(Math.round(want * 100) / 100);
    }
  });

  it.each([
    [5, 2],
    [4, 1],
    [2, 0],
  ])('TTS 沒常模：計分後全 %i → 偏向 %i（中點 3.5 ±1）', (v, band) => {
    const r = scoreKitV3(TEMP, scoredAll('TTS', v), { ageM: 24 });
    expect(r.facets.every(f => f.band === band)).toBe(true);
    expect(r.flags).toBeUndefined();
  });

  it('ITQ 有常模：男生活動量常模 4／0.65 → 平均 5 是 z 1.54 偏高、平均 4 是 z 0 中等', () => {
    expect(S.forms.ITQ.norms!.male['活动量']).toEqual([4, 0.65]);
    const hi = scoreKitV3(TEMP, scoredAll('ITQ', 5), { ageM: 6, sex: 'male' }).facets.find(f => f.key === '活动量')!;
    expect(hi).toMatchObject({ value: 5, band: 2, detail: { z: 1.54 } });
    const mid = scoreKitV3(TEMP, scoredAll('ITQ', 4), { ageM: 6, sex: 'male' }).facets.find(f => f.key === '活动量')!;
    expect(mid).toMatchObject({ value: 4, band: 1, detail: { z: 0 } });
  });

  it('有常模卻不知道性別 → 退回中點 ±1、標 no_norm', () => {
    const r = scoreKitV3(TEMP, scoredAll('ITQ', 5), { ageM: 6 });
    expect(r.flags).toEqual(['no_norm']);
    expect(r.facets.every(f => f.band === 2 && f.detail!.z === null)).toBe(true);
  });

  it('「不适用」不進平均；整個向度都不适用 → 那一向度沒有結果', () => {
    const ans: Record<string, number | null> = { ...scoredAll('TTS', 5) };
    for (const { item } of S.forms.TTS.key['活动量']) ans[item] = null;
    const r = scoreKitV3(TEMP, ans, { ageM: 24 });
    expect(r.facets.find(f => f.key === '活动量')).toMatchObject({ value: null, band: null });
    expect(r.missing).toEqual([]);
  });

  it('BSQ 的方向與 ITQ 相反（報告要照 poles 講）', () => {
    expect(S.forms.ITQ.poles['规律性']).toEqual(['有规律', '无规律']);
    expect(S.forms.BSQ.poles['规律性']).toEqual(['无规律', '有规律']);
  });
});

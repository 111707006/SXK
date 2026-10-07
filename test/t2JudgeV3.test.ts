import { describe, it, expect } from 'vitest';
import { judgeDimensionV3, judgeDimensionsV3, type JudgeV3Input } from '../src/t2/judgeV3';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor, type Grade03 } from '../src/t2/kitv3/score';
import { scoreToolV3, type ToolResultV3 } from '../src/t2/kitv3/submit';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag } from '../src/t2/types';

/**
 * 完整版題庫的維度判定（題庫規格 §5.1），每一條一個測試。
 */

const T1_GREEN = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, T1Flag>;
const t1 = (over: Partial<Record<DimensionCode, T1Flag>>) => ({ ...T1_GREEN, ...over });

/** 假的一筆：只有 `score.grade03` 與工具代碼是判定會看的。 */
function fake(toolId: string, grade03: Partial<Record<DimensionCode, Grade03>>): ToolResultV3 {
  return {
    toolkitVersion: 'kit-20260923',
    toolId,
    assessedAgeMonth: 48,
    rater: 'mother',
    context: { ageM: 48 },
    answers: {},
    score: { code: toolId, form: 'x', facets: [], total: { value: null, band: null, bandName: null }, grade03, missing: [] },
    computedAt: '2026-10-07T00:00:00.000Z',
  };
}

const input = (over: Partial<JudgeV3Input>): JudgeV3Input => ({ ageMonth: 48, t1: T1_GREEN, recommended: [], results: [], ...over });

describe('§5.1 第 0 條：不篩', () => {
  it('學習 0–36、注意力 0–11 → not_screened（T1 紅、有結果也一樣）', () => {
    expect(judgeDimensionV3('LEARN', input({ ageMonth: 36, t1: t1({ LEARN: 2 }), results: [fake('SXK-LDP', { LEARN: 3 })] })).band).toBe('not_screened');
    expect(judgeDimensionV3('ATT', input({ ageMonth: 11, t1: t1({ ATT: 2 }) })).band).toBe('not_screened');
    expect(judgeDimensionV3('ATT', input({ ageMonth: 12, t1: t1({ ATT: 2 }) })).band).not.toBe('not_screened');
  });
});

describe('§5.1 第 1 條：沒有一筆有 0–3', () => {
  it('推了主維度含它的量表、沒做 → T1 紅 partial、黃 not_assessed、綠 clear', () => {
    const rec = ['SXK-AB'];
    expect(judgeDimensionV3('ATT', input({ t1: t1({ ATT: 2 }), recommended: rec })).band).toBe('partial');
    expect(judgeDimensionV3('ATT', input({ t1: t1({ ATT: 1 }), recommended: rec })).band).toBe('not_assessed');
    expect(judgeDimensionV3('ATT', input({ recommended: rec })).band).toBe('clear');
  });

  it('一支都沒推 → T1 紅或黃 no_tool、綠 clear', () => {
    expect(judgeDimensionV3('SEN', input({ t1: t1({ SEN: 2 }) })).band).toBe('no_tool');
    expect(judgeDimensionV3('SEN', input({ t1: t1({ SEN: 1 }) })).band).toBe('no_tool');
    expect(judgeDimensionV3('SEN', input({})).band).toBe('clear');
  });

  it('只推了「次維度」含它的量表不算推了（ASQ3 的主維度沒有 ATT）', () => {
    expect(RECOMMEND_CONFIG.tools['SXK-ASQ3'].primary).not.toContain('ATT');
    expect(judgeDimensionV3('ATT', input({ t1: t1({ ATT: 2 }), recommended: ['SXK-ASQ3'] })).band).toBe('no_tool');
  });

  it('做了但沒有判定（EMO 资料不足、QOL、氣質）不算數', () => {
    const r = judgeDimensionV3('EMO', input({ t1: t1({ EMO: 2 }), recommended: ['SXK-EMO'], results: [fake('SXK-EMO', {}), fake('SXK-QOL', {})] }));
    expect(r).toMatchObject({ band: 'partial', grade03: null, tools: [] });
  });
});

describe('§5.1 第 2 條：有 0–3 → 取最重', () => {
  it.each([
    [0, 'clear'],
    [1, 'watch'],
    [2, 'watch'],
    [3, 'refer'],
  ] as const)('0–3 是 %i → %s', (g, band) => {
    expect(judgeDimensionV3('ATT', input({ t1: t1({ ATT: 2 }), recommended: ['SXK-AB'], results: [fake('SXK-AB', { ATT: g })] }))).toMatchObject({ band, grade03: g, drivenBy: 'SXK-AB' });
  });

  it('同一維兩份取較重（R-12）；同分取先交的', () => {
    const results = [fake('SXK-AB', { ATT: 1 }), fake('SNAP-IV', { ATT: 3 }), fake('CHEXI', { ATT: 3 })];
    expect(judgeDimensionV3('ATT', input({ results }))).toMatchObject({ band: 'refer', grade03: 3, drivenBy: 'SNAP-IV', tools: ['SXK-AB', 'SNAP-IV', 'CHEXI'] });
  });

  it('沒推、但做過的也算；多看一份不會變輕', () => {
    expect(judgeDimensionV3('ATT', input({ recommended: [], results: [fake('SXK-AB', { ATT: 3 })] })).band).toBe('refer');
    const both = input({ recommended: ['SXK-AB'], results: [fake('SXK-AB', { ATT: 3 }), fake('CHEXI', { ATT: 0 })] });
    expect(judgeDimensionV3('ATT', both).band).toBe('refer');
  });

  it('ASQ3 一份餵四個維度，各維各自取', () => {
    const r = judgeDimensionsV3(input({ results: [fake('SXK-ASQ3', { MOT: 3, LANG: 1, COG: 0, SOC: 2 })] }));
    expect(Object.fromEntries(r.map(x => [x.dimensionId, x.band]))).toMatchObject({ MOT: 'refer', LANG: 'watch', COG: 'clear', SOC: 'watch', ATT: 'clear' });
  });
});

describe('九維都在、順序照 DIMENSION_CODES', () => {
  it('judgeDimensionsV3', () => {
    expect(judgeDimensionsV3(input({})).map(x => x.dimensionId)).toEqual([...DIMENSION_CODES]);
  });
});

describe('題庫的 0–3 只出在客規的主維度上', () => {
  it('24 支答滿算出來的 grade03，鍵都在那一支的 primary 裡', () => {
    for (const [code, bank] of Object.entries(KITV3_BANKS)) {
      const { minM, maxM, primary } = RECOMMEND_CONFIG.tools[code];
      const age = Math.round((minM + maxM) / 2);
      const form = formFor(bank, age);
      const answers: Record<string, number | null> = {};
      for (const a of askedItems(bank, { ageM: age })) answers[a.item.key] = bank.options[form.sections.find(s => s.key === a.section)!.options][0].value;
      const r = scoreToolV3({ toolId: code, assessedAgeMonth: age, rater: 'mother', answers }, { sex: 'male', inSchool: true });
      expect(r.ok, code).toBe(true);
      if (r.ok) for (const d of Object.keys(r.result.score.grade03)) expect(primary, `${code} ${d}`).toContain(d);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  PUSH_ORDER,
  colorFromT1Score,
  dimensionColors,
  participants,
  shiftColor,
  sortByPush,
  type DimensionColor,
  type PushColor,
} from '../src/t2/trainingPush';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionBand, DimensionCode, DimensionFinding, T1Flag } from '../src/t2/types';

/**
 * 線上干預的推送規則（T2 v3 規格 `t2-v3-training-push-2026-10-06.md`）。
 * 客戶《推送规则说明书》每一個「算给你看」都是這裡的一條，原文例子照抄進測試名稱。
 */

type Dim = Pick<DimensionFinding, 'dimensionId' | 'band' | 't1Flag'>;

/** 九個維度，沒指定的是 `clear`、T1 綠。 */
function dims(over: Partial<Record<DimensionCode, DimensionBand | [DimensionBand, T1Flag]>> = {}): Dim[] {
  return DIMENSION_CODES.map(d => {
    const v = over[d] ?? 'clear';
    const [band, t1Flag] = Array.isArray(v) ? v : [v, 0 as T1Flag];
    return { dimensionId: d, band, t1Flag };
  });
}

const colorsOf = (list: ReadonlyArray<DimensionColor>) => Object.fromEntries(list.map(c => [c.dimension, `${c.color}/${c.source}`]));

describe('第一關：顏色', () => {
  it('T2 判定 → 顏色：refer 紅、watch 橙、clear 綠，來源標「T2 分级」', () => {
    const c = colorsOf(dimensionColors(dims({ LANG: 'refer', MOT: 'watch' })));
    expect(c.LANG).toBe('red/t2');
    expect(c.MOT).toBe('orange/t2');
    expect(c.COG).toBe('green/t2');
  });

  it('T1 推定：88 以上綠、56–87 橙、56 以下紅 → 8 分綠、5–7 分橙、0–4 分紅（7 分是 87.5，取橙）', () => {
    const got = Array.from({ length: 9 }, (_, s) => colorFromT1Score(s));
    expect(got).toEqual(['red', 'red', 'red', 'red', 'red', 'orange', 'orange', 'orange', 'green']);
    expect(() => colorFromT1Score(9)).toThrow();
    expect(() => colorFromT1Score(3.5)).toThrow();
  });

  it('沒做量表的（partial／not_assessed／no_tool）用 T1 分數推定，來源標「T1 推定」', () => {
    const c = colorsOf(dimensionColors(dims({ LANG: 'partial', MOT: 'not_assessed', SEN: 'no_tool' }), { LANG: 4, MOT: 7, SEN: 8 }));
    expect([c.LANG, c.MOT, c.SEN]).toEqual(['red/t1', 'orange/t1', 'green/t1']);
  });

  it('沒有 T1 分數時退回 T1 標記（紅 2 → 紅、黃 1 → 橙、綠 0 → 綠）', () => {
    const c = colorsOf(dimensionColors(dims({ LANG: ['not_assessed', 2], MOT: ['partial', 1], SEN: ['no_tool', 0] })));
    expect([c.LANG, c.MOT, c.SEN]).toEqual(['red/t1', 'orange/t1', 'green/t1']);
  });

  it('不篩的維度（not_screened）不參加：不在回傳裡', () => {
    const list = dimensionColors(dims({ LEARN: 'not_screened', ATT: 'not_screened' }));
    expect(list.map(c => c.dimension)).not.toContain('LEARN');
    expect(list).toHaveLength(7);
  });

  it('移一檔：好往輕、困難往重，兩端停住', () => {
    const ladder: PushColor[] = ['red', 'orange', 'green'];
    expect(ladder.map(c => shiftColor(c, 'lighter'))).toEqual(['orange', 'green', 'green']);
    expect(ladder.map(c => shiftColor(c, 'heavier'))).toEqual(['red', 'red', 'orange']);
  });
});

describe('第二關：順序', () => {
  it('固定順序：语言 → 动作 → 认知 → 注意力 → 感觉处理 → 学习 → 社交 → 情绪 → 日常生活', () => {
    expect(PUSH_ORDER).toEqual(['LANG', 'MOT', 'COG', 'ATT', 'SEN', 'LEARN', 'SOC', 'EMO', 'ADL']);
    expect([...PUSH_ORDER].sort()).toEqual([...DIMENSION_CODES].sort());
  });

  it('原文例子：语言判绿、动作判红、情绪判红 → 动作、情绪、语言（颜色永远大过顺序）', () => {
    const sorted = sortByPush(dimensionColors(dims({ MOT: 'refer', EMO: 'refer' })));
    expect(sorted.slice(0, 3).map(c => c.dimension)).toEqual(['MOT', 'EMO', 'LANG']);
  });

  it('參加分配的：所有紅、橙（排好）；綠的不參加', () => {
    const p = participants(dimensionColors(dims({ SEN: 'watch', LANG: 'refer', COG: 'refer', ATT: 'watch' })));
    expect(p.map(c => c.dimension)).toEqual(['LANG', 'COG', 'ATT', 'SEN']);
  });

  it('九個全綠 → 取順序前三名（语言、动作、认知）维持', () => {
    expect(participants(dimensionColors(dims())).map(c => [c.dimension, c.color])).toEqual([
      ['LANG', 'green'],
      ['MOT', 'green'],
      ['COG', 'green'],
    ]);
  });

  it('全綠而且语言不篩時，往後遞補（不篩的不算名額）', () => {
    const p = participants(dimensionColors(dims({ LANG: 'not_screened' })));
    expect(p.map(c => c.dimension)).toEqual(['MOT', 'COG', 'ATT']);
  });
});

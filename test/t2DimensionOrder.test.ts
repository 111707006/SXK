import { describe, it, expect } from 'vitest';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, DimensionFinding } from '../src/t2/types';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { functionOrderOf } from '../src/t2/routing';
import { FIXED_DIMENSION_ORDER, dimensionOrderOf, prioritizeDimensions } from '../src/t2/dimensionOrder';

/**
 * §8 的維度排序：band 最重的在前；同 band 取 T1 標記較重者；再依客戶的「功能處理順序」
 * （有診斷方向、且客戶表那一格非空時）或固定順序。活動配對（§7.3 第 3 條「依 §8 的維度排序」）
 * 與 SMART 目標（§8）共用。
 */

/** 共用的 fixture（`test/helpers/t2Fixtures.ts`），SMART 目標那支測試用同一份。 */
const findings = t2FindingsFixture;

const ids = (fs: ReadonlyArray<DimensionFinding>) => fs.map(f => f.dimensionId);

describe('固定順序（§8）', () => {
  it('LANG, SOC, ATT, MOT, COG, SEN, ADL, EMO, LEARN —— 九個都在', () => {
    expect(FIXED_DIMENSION_ORDER).toEqual(['LANG', 'SOC', 'ATT', 'MOT', 'COG', 'SEN', 'ADL', 'EMO', 'LEARN']);
    expect([...FIXED_DIMENSION_ORDER].sort()).toEqual([...DIMENSION_CODES].sort());
  });

  it('沒有診斷方向 → 固定順序', () => {
    expect(dimensionOrderOf(findings({}))).toEqual(FIXED_DIMENSION_ORDER);
  });
});

describe('客戶的功能處理順序（附錄 B.2）', () => {
  it('有診斷方向 → 客戶的順序在前，客戶沒列的（ADL）依固定順序補在後面', () => {
    const order = dimensionOrderOf(findings({}, { diagnosisDirection: 'cp' }));
    expect(order.slice(0, 8)).toEqual(functionOrderOf('cp'));
    expect(order).toEqual(['MOT', 'COG', 'LANG', 'SEN', 'ATT', 'EMO', 'SOC', 'LEARN', 'ADL']);
    // 抽動症客戶只列七個：缺 MOT 與 ADL，依固定順序 MOT 先
    expect(dimensionOrderOf(findings({}, { diagnosisDirection: 'tic' })).slice(7)).toEqual(['MOT', 'ADL']);
  });

  it('選了、但客戶表那一格是空的（學習障礙 0–36）→ 固定順序，與 planT2 同一條', () => {
    const f = findings({}, { diagnosisDirection: 'ld', child: { assessedAgeMonth: 24 } });
    expect(dimensionOrderOf(f)).toEqual(FIXED_DIMENSION_ORDER);
    // 37 個月起那一格有東西 → 客戶順序
    expect(dimensionOrderOf({ ...f, child: { assessedAgeMonth: 40 } }).slice(0, 2)).toEqual(['LEARN', 'ATT']);
  });

  it('回傳的是新陣列', () => {
    const a = dimensionOrderOf(findings({}));
    a.push('LANG');
    expect(dimensionOrderOf(findings({}))).toHaveLength(9);
  });
});

describe('prioritizeDimensions：band → T1 標記 → 順序', () => {
  it('refer 在 watch 前，watch 在其餘（clear／partial／not_assessed／no_tool）前', () => {
    const f = findings({
      LANG: { band: 'watch' }, SOC: { band: 'partial' }, ATT: { band: 'refer' },
      MOT: { band: 'no_tool' }, COG: { band: 'not_assessed', t1Flag: 1 }, SEN: { band: 'refer' },
    });
    expect(ids(prioritizeDimensions(f)).slice(0, 3)).toEqual(['ATT', 'SEN', 'LANG']);
    // 其餘六個照固定順序，band 不是三級之一的不再細分
    expect(ids(prioritizeDimensions(f)).slice(3)).toEqual(['SOC', 'MOT', 'COG', 'ADL', 'EMO', 'LEARN']);
  });

  it('同 band 取 T1 標記較重者，再依固定順序', () => {
    const f = findings({
      LANG: { band: 'watch', t1Flag: 1 }, SOC: { band: 'watch', t1Flag: 2 },
      ATT: { band: 'watch', t1Flag: 0 }, MOT: { band: 'watch', t1Flag: 2 },
    });
    expect(ids(prioritizeDimensions(f)).slice(0, 4)).toEqual(['SOC', 'MOT', 'LANG', 'ATT']);
  });

  it('有診斷方向時第三鍵是客戶的順序', () => {
    const f = findings({ LANG: { band: 'refer' }, MOT: { band: 'refer' } }, { diagnosisDirection: 'cp' });
    expect(ids(prioritizeDimensions(f)).slice(0, 2)).toEqual(['MOT', 'LANG']);
  });

  it('回傳九個、每個都是輸入裡的那筆（不複製）', () => {
    const f = findings({ LANG: { band: 'refer' } });
    const out = prioritizeDimensions(f);
    expect(out).toHaveLength(9);
    expect(out[0]).toBe(f.dimensions.find(d => d.dimensionId === 'LANG'));
  });
});

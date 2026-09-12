import { RULES_VERSION } from '../../src/t2/scoring';
import { TOOLKIT_VERSION } from '../../src/t2/toolkit';
import type { ToolId } from '../../src/t2/toolkit';
import { DIMENSION_CODES } from '../../src/t2/types';
import type {
  DimensionBand,
  DimensionCode,
  DimensionFinding,
  T1Flag,
  T2Findings,
} from '../../src/t2/types';

/**
 * 手捏一份 `T2Findings`，給只測「彙整之後」那幾層的測試用（§8 的維度排序、SMART 目標、
 * 活動配對）。它們要的是「九個維度各是什麼 band」，不是「怎麼從作答算到 band」——
 * 後者是 `test/t2Findings.test.ts` 與各支規則表測試的事，走真的 `scoreTool`。
 *
 * 兩個以上的測試檔要同一份 fixture，所以放在這裡：`T2Findings` 再加一個欄位時
 * （`version` 有一天會變 4）只有這裡要改，不會有哪一個測試檔留在舊形狀上繼續跑。
 */
export function t2FindingsFixture(
  dims: Partial<Record<DimensionCode, { band: DimensionBand; t1Flag?: T1Flag; drivenBy?: ToolId }>>,
  over: Partial<T2Findings> = {},
): T2Findings {
  const dimensions: DimensionFinding[] = DIMENSION_CODES.map(d => {
    const spec = dims[d] ?? { band: 'clear' as const };
    return {
      dimensionId: d,
      band: spec.band,
      drivenBy: spec.drivenBy ?? null,
      tags: [],
      caveats: [],
      tools: [],
      // 沒指定就照 band 推：clear 的維度 T1 沒標記，其餘是紅的。
      t1Flag: spec.t1Flag ?? (spec.band === 'clear' ? 0 : 2),
    };
  });
  const t1 = {} as Record<DimensionCode, T1Flag>;
  for (const f of dimensions) t1[f.dimensionId] = f.t1Flag;

  return {
    version: 3,
    toolkitVersion: TOOLKIT_VERSION,
    rulesVersion: RULES_VERSION,
    child: { assessedAgeMonth: 48 },
    t1,
    diagnosisDirection: null,
    dimensions,
    toolResults: [],
    computedAt: '2026-09-12T00:00:00.000Z',
    ...over,
  };
}

/**
 * 「只有 T1」的評估結果快照（客戶 10/22，規格三，issue #92，開關 `TRAINING_PLAN`）。
 *
 * 買了訓練計劃的家長做完 T1、還沒做 T2 時，居家訓練要當天就排得出活動 —— 推送規則（`trainingPush.ts`）本來就會對
 * 「沒做量表的維度」用 T1 推定顏色，所以這份快照九個方面都是 `not_assessed`、帶著 T1 標記，推送規則一行不動。
 * 之後家長做了 T2、生成的報告就是更新的快照，下一期改照它排。
 */
import { T1_ONLY_TOOLKIT } from './snapshotKinds';
import { DIMENSION_CODES, type DimensionCode, type T1Flag, type T2Findings } from './types';

export const T1_ONLY_RULES_VERSION = 't1-only-1';

export function t1OnlyFindings(input: {
  t1Flags: Record<DimensionCode, T1Flag>;
  assessedAgeMonth: number;
  sex?: 'boy' | 'girl';
  now: Date;
}): T2Findings {
  return {
    version: 3,
    toolkitVersion: T1_ONLY_TOOLKIT,
    rulesVersion: T1_ONLY_RULES_VERSION,
    child: { assessedAgeMonth: input.assessedAgeMonth, ...(input.sex ? { sex: input.sex } : {}) },
    t1: { ...input.t1Flags },
    diagnosisDirection: null,
    dimensions: DIMENSION_CODES.map(d => ({
      dimensionId: d,
      band: 'not_assessed' as const,
      drivenBy: null,
      tags: [],
      caveats: [],
      tools: [],
      t1Flag: input.t1Flags[d],
    })),
    toolResults: [],
    computedAt: input.now.toISOString(),
  };
}

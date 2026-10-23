/**
 * 居家訓練使用權的伺服器端流程（#91，開關 `TRAINING_PLAN`）：查一位家長今天有沒有效、到哪天；順手發 T2 附送的一個月。
 * 資料層由 `server.ts` 注入（測試換成記憶體裡的一份），規則在 `trainingPass.ts`。
 */
import { coveredThrough, nextPassRange, type TrainingPass } from './trainingPass';
import type { TrainingPassInsert } from '../db/trainingPasses';

export interface TrainingPassDeps {
  list: (userId: number) => Promise<TrainingPass[]>;
  insert: (userId: number, pass: TrainingPassInsert) => Promise<boolean>;
  /** 有沒有一份量表交卷生成的 T2 報告。 */
  hasScaleT2Report: (userId: number) => Promise<boolean>;
}

export interface TrainingPassState {
  active: boolean;
  /** 有效時是「接得上的最後一天」；無效時是 null。 */
  endsOn: string | null;
  /** 拿過使用權的話，最晚的那一個迄日（到期了畫「已经到期」，從沒拿過畫「还没有开通」）。 */
  lastEndsOn: string | null;
}

/**
 * 今天的狀態。家長有 T2 報告、從沒拿過附送的一個月：先發一段（接在既有使用權後面；沒有就從今天起），
 * 這同時涵蓋「開關打開之前就買過 T2」的家長。附送靠 `unique_key` 只發一次（兩個請求同時進來也是）。
 */
export async function trainingPassState(deps: TrainingPassDeps, userId: number, today: string): Promise<TrainingPassState> {
  let passes = await deps.list(userId);
  if (!passes.some(p => p.source === 't2_bonus') && (await deps.hasScaleT2Report(userId))) {
    const range = nextPassRange(passes, today, 1);
    await deps.insert(userId, { ...range, months: 1, source: 't2_bonus', refId: null, uniqueKey: `t2_bonus:${userId}` });
    passes = await deps.list(userId);
  }
  const endsOn = coveredThrough(passes, today);
  const lastEndsOn = passes.reduce<string | null>((max, p) => (max === null || p.endsOn > max ? p.endsOn : max), null);
  return { active: endsOn !== null, endsOn, lastEndsOn };
}

/** 加一段（付款、兌換碼、代填）：接在既有的後面。`uniqueKey` 撞到（同一件事發過了）回 false。 */
export async function grantTrainingPass(
  deps: Pick<TrainingPassDeps, 'list' | 'insert'>,
  userId: number,
  today: string,
  grant: { months: 1 | 3 | 6; source: 'payment' | 'code' | 'proxy'; refId: number | null; uniqueKey: string | null },
): Promise<boolean> {
  const passes = await deps.list(userId);
  const range = nextPassRange(passes, today, grant.months);
  return deps.insert(userId, { ...range, ...grant });
}

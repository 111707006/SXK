/**
 * `t2_training_periods` 的資料層（T2 v3 規格 §6.1）：線上干預的「一期」。
 *
 * 【這張表的規矩】
 * 一期開始時由 `planPeriod` 一次排好，整份存進 `plan`；之後只有一種改法：某一週要寫進每週活動時，
 * 那幾格的活動已被停用，補下一支（`replaceInactive`）並把整份 `plan` 寫回（`updatePeriodPlan`）。
 * 不重排整期。
 *
 * 【壞資料的處置】
 * `plan` 讀不成形狀時回 `null` 的 plan（`periodFromRow` 的 `plan: null`），由端點當成「這一期壞了」
 * 開下一期 —— 不讓一列壞資料讓家長每次都 500。認不得的維度碼、格子形狀不對的整份不收：一期是一個整體，
 * 缺一格的話「第幾週」「x/3」都會錯位。
 *
 * 【為什麼獨立一檔】與 `t2WeeklyPlans.ts` 同一個理由：替身資料層的 HTTP 測試才補得齊匯出。
 */

import { getPool } from './mysql';
import { DIMENSION_CODES } from '../t2/types';
import type { DimensionCode } from '../t2/types';
import type { PeriodAdjustment, PeriodDimension, PeriodPlan, PeriodSlot } from '../t2/trainingPush';

/** 存進 `plan` 欄的部分（`adjustment`、`ageMonth` 是自己的欄位）。 */
export type StoredPeriodPlan = Pick<PeriodPlan, 'perWeek' | 'sampleOnly' | 'dimensions' | 'weeks'>;

export interface TrainingPeriodRecord {
  id: number;
  findingsId: number;
  periodNo: number;
  firstWeekStart: string;
  ageMonth: number;
  adjustment: PeriodAdjustment;
  /** 上一期的完成率（0–1）；第 1 期是 `null`。 */
  completion: number | null;
  /** 讀不成形狀時是 `null`（檔頭「壞資料」）。 */
  plan: StoredPeriodPlan | null;
  rulesVersion: string;
  createdAt: string | null;
}

export interface TrainingPeriodInsert {
  findingsId: number;
  periodNo: number;
  firstWeekStart: string;
  ageMonth: number;
  adjustment: PeriodAdjustment;
  completion: number | null;
  plan: StoredPeriodPlan;
  rulesVersion: string;
}

export function storedPlanOf(plan: PeriodPlan): StoredPeriodPlan {
  return { perWeek: plan.perWeek, sampleOnly: plan.sampleOnly, dimensions: plan.dimensions, weeks: plan.weeks };
}

export async function insertTrainingPeriod(userId: number, input: TrainingPeriodInsert): Promise<number> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [res] = await p.execute(
    `INSERT INTO t2_training_periods (user_id, findings_id, period_no, first_week_start, age_month, adjustment, completion, plan, rules_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.findingsId,
      input.periodNo,
      input.firstWeekStart,
      input.ageMonth,
      input.adjustment,
      input.completion,
      JSON.stringify(input.plan),
      input.rulesVersion,
    ],
  );
  return Number((res as { insertId: number }).insertId);
}

/** 這位家長、這份快照最新的一期（`period_no` 最大的）；沒有回 `null`。 */
export async function latestTrainingPeriod(userId: number, findingsId: number): Promise<TrainingPeriodRecord | null> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  const [rows] = await p.execute(
    `SELECT id, findings_id, period_no, first_week_start, age_month, adjustment, completion, plan, rules_version, created_at
       FROM t2_training_periods
      WHERE user_id = ? AND findings_id = ?
      ORDER BY period_no DESC
      LIMIT 1`,
    [userId, findingsId],
  );
  const row = (rows as any[])[0];
  return row ? trainingPeriodFromRow(row) : null;
}

/** 停用補位之後把整份 `plan` 寫回（只認自己的那一列）。 */
export async function updateTrainingPeriodPlan(userId: number, id: number, plan: StoredPeriodPlan): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('MySQL pool is not available');
  await p.execute(`UPDATE t2_training_periods SET plan = ? WHERE id = ? AND user_id = ?`, [JSON.stringify(plan), id, userId]);
}

// ── 讀回來的形狀 ──

const DIMENSION_SET: ReadonlySet<string> = new Set<string>(DIMENSION_CODES);
const COLORS: ReadonlySet<string> = new Set(['red', 'orange', 'green']);
const SOURCES: ReadonlySet<string> = new Set(['t2', 't1']);
const VARIANTS: ReadonlySet<string> = new Set(['easy', 'standard', 'hard']);
const ADJUSTMENTS: ReadonlySet<string> = new Set(['none', 'good', 'stable', 'hard']);

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isRange = (x: unknown): x is [number, number] =>
  Array.isArray(x) && x.length === 2 && x.every(n => typeof n === 'number' && Number.isFinite(n));

function dimensionFrom(raw: unknown): PeriodDimension | null {
  if (!isObject(raw)) return null;
  const { dimension, color, source, windowColor, window, monthWindows, quota, modules } = raw;
  if (typeof dimension !== 'string' || !DIMENSION_SET.has(dimension)) return null;
  if (typeof color !== 'string' || !COLORS.has(color) || typeof windowColor !== 'string' || !COLORS.has(windowColor)) return null;
  if (typeof source !== 'string' || !SOURCES.has(source)) return null;
  if (!isRange(window) || !Array.isArray(monthWindows) || monthWindows.length !== 3 || !monthWindows.every(isRange)) return null;
  if (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 1) return null;
  if (!Array.isArray(modules) || !modules.every(m => Number.isInteger(m) && m >= 1 && m <= 15)) return null;
  return raw as unknown as PeriodDimension;
}

function slotFrom(raw: unknown): PeriodSlot | null {
  if (!isObject(raw)) return null;
  const { week, dimension, activityId, variant, reason } = raw;
  if (typeof week !== 'number' || !Number.isInteger(week) || week < 1) return null;
  if (typeof dimension !== 'string' || !DIMENSION_SET.has(dimension)) return null;
  if (activityId !== null && (typeof activityId !== 'string' || activityId === '')) return null;
  if (typeof variant !== 'string' || !VARIANTS.has(variant)) return null;
  if (!isObject(reason) || typeof reason.color !== 'string' || !COLORS.has(reason.color)) return null;
  if (typeof reason.source !== 'string' || !SOURCES.has(reason.source) || !isRange(reason.window)) return null;
  if (typeof reason.relaxed !== 'boolean') return null;
  if (reason.module !== null && !(Number.isInteger(reason.module) && (reason.module as number) >= 1 && (reason.module as number) <= 15)) return null;
  return raw as unknown as PeriodSlot;
}

export function planFrom(raw: unknown): StoredPeriodPlan | null {
  const parsed = parseJson(raw);
  if (!isObject(parsed)) return null;
  const { perWeek, sampleOnly, dimensions, weeks } = parsed;
  if (typeof perWeek !== 'number' || !Number.isInteger(perWeek) || perWeek < 1) return null;
  if (typeof sampleOnly !== 'boolean') return null;
  if (!Array.isArray(dimensions) || !Array.isArray(weeks) || weeks.length !== 12) return null;
  const dims = dimensions.map(dimensionFrom);
  if (dims.some(d => d === null)) return null;
  const known = new Set(dims.map(d => d!.dimension as DimensionCode));
  const grid: PeriodSlot[][] = [];
  for (const [i, w] of weeks.entries()) {
    if (!Array.isArray(w) || w.length !== perWeek) return null;
    const slots = w.map(slotFrom);
    if (slots.some(s => s === null || s.week !== i + 1 || !known.has(s.dimension))) return null;
    grid.push(slots as PeriodSlot[]);
  }
  return { perWeek, sampleOnly, dimensions: dims as PeriodDimension[], weeks: grid };
}

function dateOnly(raw: unknown): string {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw ?? '').slice(0, 10);
}

function isoOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function trainingPeriodFromRow(row: any): TrainingPeriodRecord {
  const completion = row.completion === null || row.completion === undefined ? null : Number(row.completion);
  return {
    id: Number(row.id),
    findingsId: Number(row.findings_id),
    periodNo: Number(row.period_no),
    firstWeekStart: dateOnly(row.first_week_start),
    ageMonth: Number(row.age_month),
    adjustment: ADJUSTMENTS.has(String(row.adjustment)) ? (row.adjustment as PeriodAdjustment) : 'none',
    completion: completion === null || Number.isNaN(completion) ? null : completion,
    plan: planFrom(row.plan),
    rulesVersion: String(row.rules_version ?? ''),
    createdAt: isoOf(row.created_at),
  };
}

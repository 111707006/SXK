/**
 * 居家訓練使用權（客戶 10/22，規格 `docs/specs/client-changes-2026-10-22-3-plan.md`，ADR-0013，issue #91，開關 `TRAINING_PLAN`）。
 *
 * 一段使用權＝一列 `training_passes`：起日、迄日（都是 Asia/Shanghai 的日曆日，頭尾都含）、月數、來源。
 * 「今天有沒有效」＝有一段起日 ≤ 今天 ≤ 迄日。新加一段時接在最晚的迄日後面（還在有效期內續買不重疊、不浪費），
 * 過期了就從今天起。長度對齊推送規則的排期：一個月＝4 週（28 天）、三個月＝一期 12 週（84 天）、六個月＝兩期（168 天）。
 *
 * 純函式，伺服器與畫面共用；日期算法用 `weeks.ts` 那一套（當成 UTC 午夜推，不經本地時區）。
 */
import { addCalendarDays, isCalendarDate } from './weeks';

export const PASS_MONTHS = [1, 3, 6] as const;
export type PassMonths = (typeof PASS_MONTHS)[number];

export const PASS_DAYS: Record<PassMonths, number> = { 1: 28, 3: 84, 6: 168 };

/**
 * 一段使用權從哪裡來：付款買的、兌換碼、推薦人代填、T2 附送一個月。
 * `t2_bonus` 一位家長只會有一段（資料庫的 `unique_key` 擋著）。
 */
export const PASS_SOURCES = ['payment', 'code', 'proxy', 't2_bonus'] as const;
export type PassSource = (typeof PASS_SOURCES)[number];

export interface TrainingPass {
  startsOn: string;
  endsOn: string;
  months: PassMonths;
  source: PassSource;
}

export function isPassMonths(value: unknown): value is PassMonths {
  return typeof value === 'number' && (PASS_MONTHS as readonly number[]).includes(value);
}

/** 今天（`YYYY-MM-DD`）落在哪一段裡；落在好幾段時取迄日最晚的那一段（畫面寫「到哪天」）。沒有回 null。 */
export function activePassOn(passes: ReadonlyArray<TrainingPass>, today: string): TrainingPass | null {
  let best: TrainingPass | null = null;
  for (const p of passes) {
    if (p.startsOn <= today && today <= p.endsOn && (!best || p.endsOn > best.endsOn)) best = p;
  }
  return best;
}

/**
 * 「有效到哪天」：今天有效時，從今天那一段起一路接上去、沒有斷開的最後一天（續買接在後面的也算）。
 * 今天無效回 null。畫面的「还剩 N 天」與「已开通，到 X 月 X 日」都看這一個。
 */
export function coveredThrough(passes: ReadonlyArray<TrainingPass>, today: string): string | null {
  const active = activePassOn(passes, today);
  if (!active) return null;
  let end = active.endsOn;
  let moved = true;
  while (moved) {
    moved = false;
    const next = addCalendarDays(end, 1);
    for (const p of passes) {
      // 起日不晚於「接到的那一天的隔天」、迄日更晚：接得上，延長。
      if (p.startsOn <= next && p.endsOn > end) {
        end = p.endsOn;
        moved = true;
      }
    }
  }
  return end;
}

/** 新加一段（`months`）的起訖：起日＝max(今天, 最晚的迄日＋1)。 */
export function nextPassRange(passes: ReadonlyArray<TrainingPass>, today: string, months: PassMonths): { startsOn: string; endsOn: string } {
  if (!isCalendarDate(today)) throw new Error(`trainingPass：今天要是 YYYY-MM-DD，拿到 ${JSON.stringify(today)}`);
  const latestEnd = passes.reduce<string | null>((max, p) => (max === null || p.endsOn > max ? p.endsOn : max), null);
  const startsOn = latestEnd !== null && addCalendarDays(latestEnd, 1) > today ? addCalendarDays(latestEnd, 1) : today;
  return { startsOn, endsOn: addCalendarDays(startsOn, PASS_DAYS[months] - 1) };
}

/** 從今天到迄日還剩幾天（含今天）；迄日就是今天時是 1。 */
export function daysLeft(today: string, endsOn: string): number {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1;
}

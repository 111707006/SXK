/**
 * 打卡與提醒的形狀與輸入檢查（Keep 規格 K06、K07、§4.4、§5.3）。純函式，伺服器與畫面共用。
 *
 * 【為什麼獨立一檔】
 * 端點（`practiceRoutes.ts`）要檢查輸入，畫面（票 6–8）要同一組選項：心情三選一、提醒的四個時間、
 * 星期幾怎麼編號。兩邊各寫一份的話，畫面多一個「21:30」、伺服器不認，家長按了「加到打卡日历」
 * 拿到一個 400 而看不出為什麼。這一檔不 import express 也不碰資料庫，瀏覽器載得進來。
 *
 * 【打卡是家長自己按的】
 * T2 沒有治療師在場。一筆打卡記的是「家長說做完了一次」，心情與進步都是家長自己勾的
 * （CONTEXT.md「打卡」）。**現在只記錄，不影響之後配哪幾支活動**（§9 第 6 題，暫採）。
 */

import { addCalendarDays, isCalendarDate } from './weeks';
import type { Activity } from './types';

/** 「孩子今天玩得怎样？」三選一（§3.6）：很投入／还可以／不太想玩。與資料庫的 ENUM 同序同字。 */
export const CHECKIN_MOODS = ['engaged', 'ok', 'reluctant'] as const;
export type CheckinMood = (typeof CHECKIN_MOODS)[number];

/** 一筆打卡，API 回的形狀（`t2_checkins` 的一列）。 */
export interface Checkin {
  id: number;
  activityId: string;
  /** 打卡當下這位家長最新的報告快照；還沒生成過報告是 `null`。 */
  findingsId: number | null;
  /** Asia/Shanghai 的日曆日，伺服器算的（不收前端送來的日期）。 */
  checkinDate: string;
  /** 那一週的星期一（`weeks.ts`）。 */
  weekStart: string;
  mood: CheckinMood | null;
  /**
   * 勾了腳本「怎么看出有进步」的第幾條（0 起，由小到大、不重複）。
   *
   * ⚠️ 存的是**位置**，不是那一句話：後台改了那幾條的順序或刪掉一條，舊的打卡會對到另一條。
   */
  progress: number[];
  /** 讀不成時間時是 `null`（不編一個日期）。 */
  createdAt: string | null;
}

/** 提醒只收這四個時間（§3.8「加到日曆」）。 */
export const REMINDER_TIMES = ['08:30', '12:30', '19:30', '20:30'] as const;
export type ReminderTime = (typeof REMINDER_TIMES)[number];

/** 星期幾的編號：0 = 星期一 … 6 = 星期日（與 `weeks.ts` 的一週從星期一開始一致）。 */
export const REMINDER_DAY_COUNT = 7;

/**
 * 提醒的設定（`t2_practice_prefs` 的一列）。
 * 兩樣要嘛都有、要嘛都沒有：`{ reminderDays: [], reminderTime: null }` 就是「還沒設提醒」。
 */
export interface PracticePrefs {
  /** 由小到大、不重複。 */
  reminderDays: number[];
  reminderTime: ReminderTime | null;
}

/** 設了提醒沒有（`.ics` 沒設提醒回 404）。 */
export function hasReminder(prefs: PracticePrefs | null): prefs is PracticePrefs & { reminderTime: ReminderTime } {
  return prefs !== null && prefs.reminderDays.length > 0 && prefs.reminderTime !== null;
}

/** 一次查打卡最多幾天（含頭尾）。日曆一次看一個月，外加前後溢出的幾天，兩個月一定夠。 */
export const MAX_CHECKIN_RANGE_DAYS = 62;

// ── 輸入檢查 ──
//
// 回 `{ ok: false }` 時帶的 `error` 是家長看得到的句子（簡體中文，過 `parentWording` 掃描），
// `code` 是給畫面分辨的。

export type Read<T> = { ok: true; value: T } | { ok: false; code: string; error: string };

const fail = (code: string, error: string): { ok: false; code: string; error: string } => ({ ok: false, code, error });

const ACTIVITY_ID_PATTERN = /^[A-Za-z0-9]{1,8}$/;

/**
 * `POST /api/t2/checkins` 的 body：只認 `activityId`。
 * 日期、userId 之類的其他欄位**一律不讀**：日期由伺服器算，身分取自 token。
 */
export function readCheckinCreate(body: unknown): Read<{ activityId: string }> {
  const raw = isObject(body) ? body.activityId : undefined;
  if (typeof raw !== 'string' || !ACTIVITY_ID_PATTERN.test(raw)) {
    return fail('ACTIVITY_ID_INVALID', '没有指明是哪一个活动。');
  }
  return { ok: true, value: { activityId: raw } };
}

export interface CheckinPatch {
  /** 帶了才改；`null` 是清掉。 */
  mood?: CheckinMood | null;
  /** 帶了才改；由小到大。 */
  progress?: number[];
}

/**
 * `PATCH /api/t2/checkins/:id` 的 body：`mood`、`progress` 帶了才改，兩樣都沒帶是 400。
 * `progress` 在這裡只驗形狀（非負整數、不重複）；「小於那支活動的條數」要有活動才驗得了，
 * 見 `progressFitsActivity`。
 */
export function readCheckinPatch(body: unknown): Read<CheckinPatch> {
  if (!isObject(body)) return fail('CHECKIN_PATCH_EMPTY', '没有要修改的内容。');
  const patch: CheckinPatch = {};

  if ('mood' in body) {
    const mood = body.mood;
    if (mood !== null && !(typeof mood === 'string' && (CHECKIN_MOODS as ReadonlyArray<string>).includes(mood))) {
      return fail('MOOD_INVALID', '心情只能是三个选项之一。');
    }
    patch.mood = mood as CheckinMood | null;
  }

  if ('progress' in body) {
    const progress = body.progress;
    if (!Array.isArray(progress) || progress.some(i => !Number.isInteger(i) || i < 0)) {
      return fail('PROGRESS_INVALID', '勾选的进步项目不正确。');
    }
    if (new Set(progress).size !== progress.length) {
      return fail('PROGRESS_INVALID', '勾选的进步项目不正确。');
    }
    patch.progress = [...(progress as number[])].sort((a, b) => a - b);
  }

  if (patch.mood === undefined && patch.progress === undefined) {
    return fail('CHECKIN_PATCH_EMPTY', '没有要修改的内容。');
  }
  return { ok: true, value: patch };
}

/**
 * 勾的每一條都要在那支活動腳本的「怎么看出有进步」裡（第幾條 < 條數）。
 * 沒有腳本的活動（`guide` 是 `null`，模組一以外的 280 支）只收空陣列。
 */
export function progressFitsActivity(progress: ReadonlyArray<number>, activity: Pick<Activity, 'guide'> | null): boolean {
  const count = activity?.guide?.progress.length ?? 0;
  return progress.every(i => i < count);
}

/**
 * `GET /api/t2/checkins?from=&to=`：兩個都要、都是 `YYYY-MM-DD`、`from` 不晚於 `to`，
 * 頭尾含在內最多 `MAX_CHECKIN_RANGE_DAYS` 天。
 */
export function readCheckinRange(query: { from?: unknown; to?: unknown }): Read<{ from: string; to: string }> {
  const { from, to } = query;
  if (typeof from !== 'string' || typeof to !== 'string' || !isCalendarDate(from) || !isCalendarDate(to)) {
    return fail('RANGE_INVALID', '日期格式不正确，请用 2026-09-07 这样的写法。');
  }
  if (from > to) return fail('RANGE_INVALID', '开始日期不能晚于结束日期。');
  if (addCalendarDays(from, MAX_CHECKIN_RANGE_DAYS - 1) < to) {
    return fail('RANGE_TOO_LONG', `一次最多查 ${MAX_CHECKIN_RANGE_DAYS} 天。`);
  }
  return { ok: true, value: { from, to } };
}

/**
 * `PUT /api/t2/practice-prefs` 的 body：`reminderDays`（0–6，可複選）與 `reminderTime`（四選一）。
 * 兩樣要嘛都有、要嘛都清掉（`[]` 與 `null`）—— 只有星期沒有時間、或反過來，日曆上畫不出來、
 * `.ics` 也排不出來，不存這種半套的。
 */
export function readPracticePrefs(body: unknown): Read<PracticePrefs> {
  if (!isObject(body)) return fail('PREFS_INVALID', '提醒的设定不正确。');
  const { reminderDays, reminderTime } = body;

  if (!Array.isArray(reminderDays) || reminderDays.some(d => !Number.isInteger(d) || d < 0 || d >= REMINDER_DAY_COUNT)) {
    return fail('PREFS_INVALID', '提醒的星期只能选星期一到星期日。');
  }
  if (reminderTime !== null && !(typeof reminderTime === 'string' && (REMINDER_TIMES as ReadonlyArray<string>).includes(reminderTime))) {
    return fail('PREFS_INVALID', `提醒的时间只能选 ${REMINDER_TIMES.join('、')}。`);
  }
  const days = [...new Set(reminderDays as number[])].sort((a, b) => a - b);
  if ((days.length === 0) !== (reminderTime === null)) {
    return fail('PREFS_INCOMPLETE', '请同时选好星期几和时间。');
  }
  return { ok: true, value: { reminderDays: days, reminderTime: reminderTime as ReminderTime | null } };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

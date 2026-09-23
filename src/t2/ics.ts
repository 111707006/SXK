/**
 * 提醒的 `.ics`（Keep 規格 K07、§3.8、§5.3）。純函式，沒有 I/O。
 *
 * 【提醒不是我們發的】
 * 網頁做不到可靠的推播（§1）。家長選好每週哪幾天、幾點練，下載這個檔案加進手機日曆，
 * 到時間跳通知的是手機日曆。所以這一檔的輸出直接決定家長會不會被提醒 —— 而它出錯的地方
 * 在家長的手機上，我們看不到。格式照 RFC 5545 寫，逐條釘在 `test/t2Ics.test.ts`：
 * - 換行一律 CRLF；一行超過 75 個**位元組**就摺（CRLF＋一個空白）。中文一字三個位元組，
 *   照字元數摺會把一個字切成兩半，手機日曆讀到的就是亂碼。
 * - 時間帶 `TZID=Asia/Shanghai` 並附 VTIMEZONE：不帶時區的 19:30 是「手機所在地的 19:30」，
 *   家長出國或手機時區設錯就會在半夜被叫醒。中國沒有日光節約時間，VTIMEZONE 只要一段 +0800。
 * - 每週重複：`RRULE:FREQ=WEEKLY;BYDAY=…`，沒有結束日 —— 家長改提醒時重新下載一份，
 *   `UID` 固定，日曆會當成同一個事件的新版本（多數日曆如此；iPhone 實機未驗）。
 * - 第一次（DTSTART）落在選的星期幾上：RFC 5545 說 DTSTART 與 RRULE 不同步時結果未定義，
 *   有的日曆會在 DTSTART 那天多跳一次。「今天」照上海算（`weeks.ts`）。
 */

import { addCalendarDays, calendarDateOf, weekStartOf } from './weeks';
import { hasReminder } from './practice';
import type { PracticePrefs } from './practice';

/** 手機日曆上那個事件的標題。 */
export const PRACTICE_EVENT_TITLE = '陪孩子做家庭活动';

/** 事件的說明（手冊「每天陪伴 10–15 分钟」）。 */
export const PRACTICE_EVENT_DESCRIPTION = '每次陪孩子做 10–15 分钟，做完回到家庭活动计划打卡。';

/** 事件長度（分鐘）：手冊的「10–15 分钟」取上緣。 */
const EVENT_MINUTES = 15;

/** 0 = 星期一 … 6 = 星期日（`practice.ts` 的編號）→ RFC 5545 的星期代碼。 */
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

/** RFC 5545 §3.1：一行（不含 CRLF）最多 75 個位元組。 */
const MAX_LINE_OCTETS = 75;

const CRLF = '\r\n';

export interface PracticeIcsInput {
  prefs: PracticePrefs;
  /** 事件的 UID。同一位家長每次下載要一樣，日曆才認得是同一個事件。 */
  uid: string;
  /** 產生的時刻：決定 DTSTAMP 與「從哪一天開始」。 */
  now: Date;
}

/**
 * 依提醒產生整份 `.ics`（CRLF 換行、已摺行）。
 * 沒設提醒（`hasReminder` 為假）丟錯 —— 端點先擋成 404，走到這裡是呼叫端的錯。
 */
export function buildPracticeIcs({ prefs, uid, now }: PracticeIcsInput): string {
  if (!hasReminder(prefs)) throw new Error('ics：沒設提醒，沒有東西可以排進日曆');

  const days = [...new Set(prefs.reminderDays)].sort((a, b) => a - b);
  const first = firstOccurrence(calendarDateOf(now), days);
  const time = prefs.reminderTime.replace(':', '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SenXinKang//T2 Home Practice//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=Asia/Shanghai:${first.replace(/-/g, '')}T${time}00`,
    `DURATION:PT${EVENT_MINUTES}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map(d => BYDAY[d]).join(',')}`,
    `SUMMARY:${escapeIcsText(PRACTICE_EVENT_TITLE)}`,
    `DESCRIPTION:${escapeIcsText(PRACTICE_EVENT_DESCRIPTION)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(PRACTICE_EVENT_TITLE)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** 今天（含）起第一個落在選的星期幾上的日子。 */
function firstOccurrence(today: string, days: ReadonlyArray<number>): string {
  const monday = weekStartOf(today);
  let weekday = 0;
  while (addCalendarDays(monday, weekday) !== today) weekday += 1;
  for (let k = 0; k < 7; k += 1) {
    if (days.includes((weekday + k) % 7)) return addCalendarDays(today, k);
  }
  throw new Error('ics：沒有選任何一天');
}

/** `20260923T040000Z`。 */
function utcStamp(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

/** RFC 5545 §3.3.11 的 TEXT：反斜線、分號、逗號、換行要跳脫。 */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 的摺行：超過 75 個位元組就在那之前斷開，續行以一個空白開頭（空白也算進
 * 那一行的 75 個位元組）。逐字元累加 UTF-8 的長度，**只在字元之間斷**。
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current);
      current = ' ';
      octets = 1;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join(CRLF);
}

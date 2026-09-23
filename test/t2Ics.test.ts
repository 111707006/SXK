import { describe, it, expect } from 'vitest';
import { PRACTICE_EVENT_TITLE, buildPracticeIcs, escapeIcsText, foldIcsLine } from '../src/t2/ics';

/**
 * 提醒的 `.ics`（Keep 規格 K07、§3.8、§5.3）。
 *
 * 【這裡在防什麼】
 * 提醒不是我們發的，是手機日曆照這個檔案發的。檔案格式錯一點，iPhone 的日曆不是拒收就是
 * 排錯時間 —— 而那發生在家長的手機上，我們看不到。所以格式照 RFC 5545 逐條釘：
 * 1. 換行一律 CRLF；一行超過 75 個位元組要摺（CRLF＋一個空白），**不能把一個中文字切成兩半**
 *    （中文一字三個位元組，照字元數摺會切壞）。
 * 2. 時間帶 `TZID=Asia/Shanghai` 且附 VTIMEZONE：不帶時區的「19:30」在美國的手機上會變成美國的 19:30。
 * 3. 每週重複：`RRULE:FREQ=WEEKLY;BYDAY=…`；星期 0 = 星期一 … 6 = 星期日。
 * 4. 第一次（DTSTART）要落在選的星期幾上（RFC 5545：DTSTART 與 RRULE 不同步時結果未定義），
 *    而且是照**上海的今天**往後找 —— 上海週一 00:01 在 UTC 還是週日。
 *
 * iPhone 實機打不打得開這裡驗不到（回報寫「未實機驗」）。
 */

/** 上海 2026-09-23（三）12:00 ＝ 04:00Z。 */
const WED_NOON = new Date('2026-09-23T04:00:00.000Z');

const build = (reminderDays: number[], reminderTime: '08:30' | '12:30' | '19:30' | '20:30', now = WED_NOON) =>
  buildPracticeIcs({ prefs: { reminderDays, reminderTime }, uid: 't2-practice-7@senxinkang', now });

/** 把摺過的行接回來（RFC 5545 §3.1 的 unfolding），拆成一行一行。 */
function unfoldedLines(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter(line => line !== '');
}

describe('檔案的骨架', () => {
  const ics = build([0, 2, 4], '19:30');
  const lines = unfoldedLines(ics);

  it('每一行都以 CRLF 結尾，沒有單獨的 LF 或 CR', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('VCALENDAR 包著 VTIMEZONE 與 VEVENT，VEVENT 裡有 VALARM；BEGIN／END 成對', () => {
    const blocks = lines.filter(l => /^(BEGIN|END):/.test(l));
    expect(blocks).toEqual([
      'BEGIN:VCALENDAR',
      'BEGIN:VTIMEZONE',
      'BEGIN:STANDARD',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'BEGIN:VALARM',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some(l => l.startsWith('PRODID:'))).toBe(true);
  });

  it('時區：TZID=Asia/Shanghai，固定 +0800（中國沒有日光節約時間）', () => {
    expect(lines).toContain('TZID:Asia/Shanghai');
    expect(lines).toContain('TZOFFSETFROM:+0800');
    expect(lines).toContain('TZOFFSETTO:+0800');
  });

  it('標題「陪孩子做家庭活动」；UID 固定（重新下載是同一個事件，不是多一個）；DTSTAMP 是 UTC', () => {
    expect(PRACTICE_EVENT_TITLE).toBe('陪孩子做家庭活动');
    expect(lines).toContain('SUMMARY:陪孩子做家庭活动');
    expect(lines).toContain('UID:t2-practice-7@senxinkang');
    expect(lines).toContain('DTSTAMP:20260923T040000Z');
  });

  it('到時間跳提醒：VALARM 在事件開始那一刻', () => {
    expect(lines).toContain('ACTION:DISPLAY');
    expect(lines).toContain('TRIGGER:PT0M');
  });
});

describe('每週重複與第一次', () => {
  it('一、三、五 19:30 → BYDAY=MO,WE,FR；今天（三）就是第一次', () => {
    const lines = unfoldedLines(build([0, 2, 4], '19:30'));
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260923T193000');
  });

  it('只選星期一 → 第一次是下週一；四個時間照選的寫', () => {
    const lines = unfoldedLines(build([0], '08:30'));
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260928T083000');
  });

  it('七天全選 → BYDAY 七個，由週一排到週日', () => {
    const lines = unfoldedLines(build([6, 5, 4, 3, 2, 1, 0], '20:30'));
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU');
    expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260923T203000');
  });

  it('有長度：DURATION 15 分鐘（手冊「每天陪伴 10–15 分钟」）', () => {
    expect(unfoldedLines(build([2], '12:30'))).toContain('DURATION:PT15M');
  });

  describe('時區邊界：第一次照上海的今天找', () => {
    it('上海週日 23:59 選週日 → 就是今天（09-20）', () => {
      const lines = unfoldedLines(build([6], '19:30', new Date('2026-09-20T15:59:00.000Z')));
      expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260920T193000');
    });

    it('上海週一 00:01 選週日 → 下一個週日（09-27）；照 UTC 算會寫成已經過去的 09-20', () => {
      const lines = unfoldedLines(build([6], '19:30', new Date('2026-09-20T16:01:00.000Z')));
      expect(lines).toContain('DTSTART;TZID=Asia/Shanghai:20260927T193000');
    });
  });

  it('沒設提醒 → 丟錯（端點回 404，不產一個沒有日子的檔案）', () => {
    expect(() => buildPracticeIcs({ prefs: { reminderDays: [], reminderTime: null }, uid: 'x', now: WED_NOON })).toThrow();
  });
});

describe('摺行（RFC 5545 §3.1）', () => {
  const byteLength = (s: string) => new TextEncoder().encode(s).length;

  it('整份檔案每一行不超過 75 個位元組', () => {
    for (const line of build([0, 2, 4], '19:30').split('\r\n')) {
      expect(byteLength(line), line).toBeLessThanOrEqual(75);
    }
  });

  it('長的中文行：每段不超過 75 個位元組、續行以一個空白開頭、接回來一字不差、沒有切壞的字', () => {
    const line = `DESCRIPTION:${'陪孩子做家庭活动，每次十来分钟。'.repeat(6)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part, i) => {
      expect(byteLength(part)).toBeLessThanOrEqual(75);
      if (i > 0) expect(part.startsWith(' ')).toBe(true);
      // 切壞的字在 TextDecoder 會變成 U+FFFD
      expect(part).not.toContain('�');
    });
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('剛好 75 個位元組不摺；76 個才摺', () => {
    expect(foldIcsLine('A'.repeat(75))).toBe('A'.repeat(75));
    expect(foldIcsLine('A'.repeat(76))).toBe(`${'A'.repeat(75)}\r\n A`);
  });

  it('檔案裡真的有一行被摺過（說明那一行夠長，摺行在實際輸出上有被走到）', () => {
    expect(build([0, 2, 4], '19:30')).toMatch(/\r\n /);
  });
});

describe('文字跳脫（RFC 5545 §3.3.11）', () => {
  it('反斜線、分號、逗號、換行', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('中文的全形逗號不是分隔符號，不跳脫', () => {
    expect(escapeIcsText('每次十来分钟，做完打卡')).toBe('每次十来分钟，做完打卡');
  });
});

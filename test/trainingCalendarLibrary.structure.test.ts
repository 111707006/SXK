import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 打卡日曆與示範片庫（Keep 規格 §3.7、§3.9，K15）的結構護欄。專案沒有 jsdom，畫面上出現什麼只能讀
 * 原始碼；會算的那幾樣在 `test/trainingCalendar.test.ts`、`test/trainingLibrary.test.ts`，字在
 * `test/trainingCalendarLibraryCopy.test.ts`，返回鍵在 `test/trainingLayerStack.test.ts`。
 * 沒有中文字、不搬樣品、只經 `nav` 導覽，由 `test/trainingView.structure.test.ts` 整個資料夾一起守。
 *
 * 這裡釘的是「資料來自 API、空狀態有說法、讀不出來不寫 0」。
 */

const ROOT = path.resolve(__dirname, '..');
const DIR = 'src/components/training';

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('打卡日曆（§3.7）', () => {
  const screen = read(`${DIR}/CalendarScreen.tsx`);
  const hook = read(`${DIR}/useCalendarData.ts`);

  it('打卡一個月一個月從 API 查（每段在 62 天以內），活動名從每週活動或單支讀取來', () => {
    expect(hook).toContain('monthFetchRange(month, today)');
    expect(hook).toContain('/api/t2/checkins?from=');
    // 單支讀走詳情那一份快取（`useActivity.ts` → `GET /api/t2/activities/:id`）
    expect(hook).toContain('loadActivity(id)');
    expect(hook).toContain('calendarSummary(months, today)');
    expect(screen).toContain('activityInfo(c.activityId, plan, fetched)');
  });

  it('三個數字：本月與連續天數走 calendarSummary，x/4 走 planWeekPractice（與計劃頁同一個 weekPractice）；讀不出來不寫 0', () => {
    expect(screen).toContain('statValue(summary.monthDays, loading)');
    expect(screen).toContain('statValue(summary.streak, loading)');
    expect(screen).toContain('planWeekPractice(months, plan, today)');
    expect(screen).toContain('`${week.planPracticed}/${week.planTotal}`');
    expect(screen).not.toMatch(/\?\? 0\b/);
  });

  it('提醒從 API 來（data.loadPrefs → GET /api/t2/practice-prefs），提醒列開「加到日历」抽屜（票 7 的 ReminderSheet）', () => {
    expect(read(`${DIR}/trainingApi.ts`)).toContain("authFetch('/api/t2/practice-prefs')");
    expect(screen).toContain('loadPrefs()');
    expect(screen).toContain("data.prefsStatus === 'ready' ? data.prefs : null");
    expect(screen).toContain('reminderLine(prefs)');
    expect(screen).toContain("nav.openSheet({ kind: 'calendar' })");
  });

  it('第 12 週末（再評估）與計劃頁同一個起點（plan.firstWeekStart）', () => {
    expect(screen).toContain('reassessDayOf(planPositionOf(plan).firstWeekStart)');
  });

  it('月曆的日期照上海時間（weeks.ts），不用瀏覽器的本地時區', () => {
    expect(screen).toContain('calendarDateOf(new Date())');
    const all = [screen, hook, read(`${DIR}/calendarData.ts`)].join('\n');
    expect(all).not.toMatch(/\.getDate\(\)|\.getMonth\(\)|\.getDay\(\)|\.getFullYear\(\)/);
  });
});

describe('示範片庫（§3.9）', () => {
  const screen = read(`${DIR}/LibraryScreen.tsx`);

  it('片庫從 API 來（與詳情的系列列同一次讀取）；還在讀、讀不出來、空的各有一句話', () => {
    expect(read(`${DIR}/trainingApi.ts`)).toContain("authFetch('/api/t2/library')");
    expect(screen).toContain('useLibraryLoad(true)');
    expect(screen).toContain('library.entries.length === 0');
    expect(screen).toContain('LIBRARY.loading');
    expect(screen).toContain('LIBRARY.error');
    expect(screen).toContain('LIBRARY.empty');
  });

  it('依模組分組、三個篩選、本週／換著玩的標記都走 libraryData', () => {
    expect(screen).toContain('groupByModule(list)');
    expect(screen).toContain('filterLibrary(all, filter, ageMonth)');
    expect(screen).toContain('libraryMark(a.id, plan)');
    expect(screen).toContain('moduleHeading(g.moduleNo)');
  });

  it('點了進詳情（from: library）；片庫只放封面、不載片（§6.3）', () => {
    expect(screen).toContain("nav.openPage({ name: 'detail', id: a.id, from: 'library' })");
    expect(screen).not.toMatch(/<video|videoUrl/);
  });

  it('底下那一句照規格', () => {
    expect(screen).toContain('libraryFootnote(childName)');
  });
});

describe('接上堆疊', () => {
  const overlay = read(`${DIR}/TrainingOverlay.tsx`);

  it('library、calendar 兩條 route 是真的頁；提醒列開的「加到日历」是票 7 的抽屜', () => {
    expect(overlay).toMatch(/case 'library':\s*return <LibraryScreen \/>;/);
    expect(overlay).toMatch(/case 'calendar':\s*return <CalendarScreen \/>;/);
    expect(overlay).toMatch(/case 'calendar':\s*return <ReminderSheet \/>;/);
    // 「即将开放」只剩認不得的頁（default）
    expect(overlay.match(/<ComingSoonScreen \/>/g)).toHaveLength(1);
    expect(overlay).toMatch(/default:\s*return <ComingSoonScreen \/>;/);
  });
});

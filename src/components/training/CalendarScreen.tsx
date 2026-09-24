/**
 * 打卡日曆（Keep 規格 §3.7；K15）：蓋在報告上的一層，從報告入口的「打卡」分頁點進來
 *；票 7 的詳情「练过 N」、打卡成功「看打卡日历」也開它。
 *
 * 版面照樣品的 `CalendarScreen`（Keep 的「日程」）：三個數字 → 月曆（可切上／下個月）→ 圖例 →
 * 提醒列 → 最近的打卡。
 *
 * 【資料】
 * - 本月練了幾天、連續天數、最近 8 筆：一個月一個月查的打卡（`useCalendarData` → `calendarSummary`）。
 *   「本月」是今天所在的那個月，**不跟著翻頁變**：標題寫的是「本月」，翻到上個月時它若變成上個月的
 *   天數，就是一個標錯的數字（樣品跟著翻頁變，這裡不照搬）。
 * - 本週練過的計劃活動 x/4：計劃頁底部同一份（`data.practice`，`practiceStats.weekPractice`）。
 * - 提醒：`data.prefs`（`GET /api/t2/practice-prefs`，用到才讀：`data.loadPrefs()`）；提醒列開「加到日历」抽屜
 *   （票 7 的 `ReminderSheet`）。抽屜存好時換掉的是同一份 `data.prefs`，提醒列與虛線跟著變。
 * - 第 12 週末（再評估）：每週活動回應的 `plan.firstWeekStart`（§8、v2.1 S14），與計劃頁 STEP 4 最後一格
 *   同一天。
 * 讀不出來的數字不寫 0（與計劃頁同一個規矩）：還在讀是「…」，讀不出來是「–」並說一句。
 *
 * 【沒搬的】樣品的配圖（最近的打卡的封面用活動庫的 `posterUrl`，沒有就是無圖的色塊）。
 */
import { useEffect, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Crown } from 'lucide-react';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { monthDayLabel } from '../../t2/weeklyCopy';
import { calendarDateOf } from '../../t2/weeks';
import {
  CALENDAR,
  MOOD_LABEL,
  WEEKDAYS,
  calendarMonthLabel,
  progressSeen,
  reminderLine,
  unknownActivityTitle,
} from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { activityInfo, monthGrid, monthOf, reassessDayOf, shiftMonth, type CalendarDay } from './calendarData';
import { planPositionOf } from './trainingData';
import { useCalendarData } from './useCalendarData';
import { Cover, LightNav } from './ui';

/** 還在讀「…」、讀不出來「–」：不寫 0。 */
function statValue(value: string | number | null, loading: boolean): string {
  if (value !== null) return String(value);
  return loading ? '…' : '–';
}

function dayClass(d: CalendarDay): string {
  // 今天練過了：實心，外面仍留一圈（圖例說外框是今天，練過了也要找得到今天在哪）
  if (d.done) return `bg-brand-forest text-white font-bold ${d.today ? 'ring-2 ring-offset-2 ring-brand-moss' : ''}`;
  if (d.today) return 'ring-2 ring-brand-moss text-brand-forest font-bold';
  if (d.reassess) return 'bg-brand-sand text-brand-clay font-bold ring-1 ring-brand-clay/50';
  if (d.reminder) return 'border border-dashed border-brand-moss text-brand-forest';
  return 'text-brand-charcoal/80';
}

export default function CalendarScreen() {
  const { data, nav } = useTraining();
  const [today] = useState(() => calendarDateOf(new Date()));
  const [cursor, setCursor] = useState(() => monthOf(today));
  const plan = data.plan;
  const { months, summary, fetched } = useCalendarData(today, cursor, plan);
  const { loadPrefs } = data;

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const prefs = data.prefsStatus === 'ready' ? data.prefs : null;
  const shown = months[cursor];
  const grid = monthGrid(cursor, {
    practiced: new Set(Array.isArray(shown) ? shown.map(c => c.checkinDate) : []),
    today,
    reminderDays: prefs && prefs.reminderTime ? prefs.reminderDays : [],
    reassessDay: plan ? reassessDayOf(planPositionOf(plan).firstWeekStart) : null,
  });
  // 還有月份在讀（含連續天數往前補查的那個月）就是「…」，都讀完了還是 null 才是「–」
  const loading = months[monthOf(today)] === undefined || Object.values(months).includes('loading');
  const practice = data.practice;
  const stats = [
    statValue(summary.monthDays, loading),
    statValue(summary.streak, loading),
    practice ? `${practice.planPracticed}/${practice.planTotal}` : statValue(null, data.status === 'loading'),
  ];
  const showReassess = grid.days.some(d => d.reassess);
  // 還在讀時不說「还没设提醒」（那可能不是真的）
  const reminderText =
    data.prefsStatus === 'error' ? CALENDAR.reminderError : data.prefsStatus === 'ready' ? reminderLine(prefs) : '…';

  return (
    <div className="h-full flex flex-col bg-brand-cream" data-testid="training-calendar">
      <LightNav title={CALENDAR.title} onBack={nav.back} />
      <div className="flex-1 overflow-y-auto training-no-scrollbar pb-10">
        <div className="bg-white px-4 pt-2 pb-5">
          {/* 三個數字 */}
          <div className="grid grid-cols-3 gap-2" data-testid="calendar-stats">
            {CALENDAR.stats.map((label, i) => (
              <div key={label} className="rounded-xl bg-brand-sage py-3 text-center">
                <p className="text-[24px] font-black text-brand-forest tabular-nums leading-none">{stats[i]}</p>
                <p className="mt-1.5 text-[11px] text-brand-charcoal/60">{label}</p>
              </div>
            ))}
          </div>

          {/* 月曆 */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              aria-label={CALENDAR.prevMonth}
              onClick={() => setCursor(m => shiftMonth(m, -1))}
              className="w-9 h-9 grid place-items-center text-brand-forest cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <p className="text-[17px] font-bold text-brand-forest tabular-nums" data-testid="calendar-month">
              {calendarMonthLabel(cursor)}
            </p>
            <button
              type="button"
              aria-label={CALENDAR.nextMonth}
              onClick={() => setCursor(m => shiftMonth(m, 1))}
              className="w-9 h-9 grid place-items-center text-brand-forest cursor-pointer"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[12px] text-brand-charcoal/50">
            {WEEKDAYS.map(d => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-y-2 text-center">
            {Array.from({ length: grid.leadingBlanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {grid.days.map(d => (
              <span key={d.date} className="grid place-items-center">
                <span
                  data-day={d.date}
                  data-done={d.done || undefined}
                  data-reminder={d.reminder || undefined}
                  className={`relative w-9 h-9 rounded-full grid place-items-center text-[14px] tabular-nums ${dayClass(d)}`}
                >
                  {d.day}
                  {d.reassess && <Crown size={11} aria-hidden="true" className="absolute -top-1.5 -right-1 text-brand-clay" />}
                </span>
              </span>
            ))}
          </div>
          {shown === 'error' && <p className="mt-3 text-[12px] text-brand-charcoal/60">{CALENDAR.checkinsError}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-brand-charcoal/60">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-forest" />
              {CALENDAR.legend.done}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-dashed border-brand-moss" />
              {CALENDAR.legend.reminder}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full ring-2 ring-brand-moss" />
              {CALENDAR.legend.today}
            </span>
            {showReassess && (
              <span className="flex items-center gap-1.5">
                <Crown size={12} className="text-brand-clay" />
                {CALENDAR.legend.reassess}
              </span>
            )}
          </div>
        </div>

        {/* 提醒列 → 加到日历抽屜 */}
        <button
          type="button"
          onClick={() => nav.openSheet({ kind: 'calendar' })}
          className="mt-2 w-full bg-white px-4 py-4 flex items-center gap-3 text-left cursor-pointer"
          data-testid="calendar-reminder"
        >
          <CalendarPlus size={22} className="text-brand-moss shrink-0" />
          <span className="flex-1 min-w-0 text-[15px] text-brand-forest">{reminderText}</span>
          <ChevronRight size={18} className="text-brand-charcoal/30 shrink-0" />
        </button>

        {/* 最近的打卡 */}
        <section className="mt-2 bg-white px-4 pt-5 pb-4" data-testid="calendar-recent">
          <h3 className="text-[17px] font-bold text-brand-forest">{CALENDAR.recentTitle}</h3>
          {summary.recent === null ? (
            // 這個月讀不出來：月曆底下已經說過一次（正在看這個月時），這裡不再重複
            months[monthOf(today)] === 'error' &&
            cursor !== monthOf(today) && <p className="mt-3 text-[13px] text-brand-charcoal/60">{CALENDAR.checkinsError}</p>
          ) : summary.recent.length === 0 ? (
            <p className="mt-3 text-[13px] text-brand-charcoal/60">{CALENDAR.recentEmpty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-brand-stone/60">
              {summary.recent.map(c => {
                const a = activityInfo(c.activityId, plan, fetched) ?? { title: unknownActivityTitle(c.activityId), posterUrl: null, dimensions: [] };
                const meta = [
                  monthDayLabel(c.checkinDate),
                  a.dimensions.map(d => SITE_DIMENSION_NAME[d]).join('、'),
                  c.progress.length > 0 ? progressSeen(c.progress.length) : '',
                ].filter(Boolean);
                return (
                  <li key={c.id} className="py-3 flex items-center gap-3">
                    <Cover src={a.posterUrl} className="w-12 h-12 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-brand-forest truncate">{a.title}</p>
                      <p className="mt-0.5 text-[12px] text-brand-charcoal/55 truncate">{meta.join(' · ')}</p>
                    </div>
                    {c.mood && (
                      <span className="shrink-0 text-[12px] text-brand-forest bg-brand-sage rounded-full px-2.5 py-1">{MOOD_LABEL[c.mood]}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

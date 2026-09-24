/**
 * 加到日曆（Keep 規格 §3.8，票 7）：選每週哪幾天（可複選）、幾點（四選一）→「加到打卡日历」存到伺服器
 *（`PUT /api/t2/practice-prefs`，打卡日曆上標出來）；「也加到手机日历（.ics）」讓手機日曆每週提醒。
 *
 * 【提醒是手機日曆發的，不是我們發的】網頁做不到可靠的推播（§1），所以說法是「加到手机日历，到时间手机会
 * 提醒你」，不是樣品的「到时间提醒你」。
 *
 * 【.ics 怎麼下載】
 * `.ics` 那一支要身分，而手機「加入日曆」是瀏覽器自己去開網址（`location.href`）——那一次請求帶不了
 * 通行證。所以先存好提醒、換一條 10 分鐘有效的連結（`POST /api/t2/practice-prefs/ics-link`，
 * `src/t2/icsLink.ts`），再用 `location.href` 開它。不做成 blob：iPhone Safari 對 blob 不一定給「加入日曆」。
 * 微信內建瀏覽器下載不了檔案：認出微信時不放那顆按鈕，改說明先「在浏览器打开」。
 */
import { useEffect, useState } from 'react';
import { CalendarPlus, CircleCheck, Download, Info, Loader2 } from 'lucide-react';
import { REMINDER_TIMES, hasReminder, type PracticePrefs, type ReminderTime } from '../../t2/practice';
import { REMINDER_SHEET, WEEKDAYS, reminderLabel, reminderSaved } from '../../t2/trainingCopy';
import { isWeChatBrowser } from './device';
import { useTraining } from './TrainingContext';
import { fetchIcsLink } from './trainingApi';
import { Sheet } from './ui';

/** 還沒設過提醒時先勾好的樣子（照樣品：一、三、五 19:30）。 */
const DEFAULT_DRAFT: { days: number[]; time: ReminderTime } = { days: [0, 2, 4], time: '19:30' };

type Status = 'idle' | 'saving' | 'saved' | 'saveFailed' | 'ics' | 'icsFailed';

export default function ReminderSheet() {
  const { data, nav } = useTraining();
  const { loadPrefs, savePrefs, prefs } = data;
  const [draft, setDraft] = useState<{ days: number[]; time: ReminderTime } | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const inWeChat = typeof navigator !== 'undefined' && isWeChatBrowser(navigator.userAgent);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // 家長還沒動過：照伺服器上存的（讀到之前先用預設）；動過就用他選的
  const stored = hasReminder(prefs) ? { days: prefs.reminderDays, time: prefs.reminderTime } : null;
  const shown = draft ?? stored ?? DEFAULT_DRAFT;
  const canSave = shown.days.length > 0;
  const busy = status === 'saving' || status === 'ics';

  const change = (next: { days: number[]; time: ReminderTime }) => {
    setDraft(next);
    setStatus('idle');
  };
  const toggleDay = (d: number) =>
    change({ ...shown, days: shown.days.includes(d) ? shown.days.filter(x => x !== d) : [...shown.days, d].sort((a, b) => a - b) });

  const asPrefs = (): PracticePrefs => ({ reminderDays: shown.days, reminderTime: shown.time });
  const sameAsStored = stored !== null && stored.time === shown.time && stored.days.join() === shown.days.join();

  const save = async () => {
    setStatus('saving');
    try {
      await savePrefs(asPrefs());
      setDraft(null);
      setStatus('saved');
    } catch (err) {
      console.warn('Failed to save practice prefs:', err);
      setStatus('saveFailed');
    }
  };

  // 先存（手機日曆裡的提醒與打卡日曆上的要是同一組），再換連結、交給瀏覽器開
  const addToPhone = async () => {
    setStatus('ics');
    try {
      if (!sameAsStored) {
        await savePrefs(asPrefs());
        setDraft(null);
      }
      window.location.href = await fetchIcsLink();
      setStatus('saved');
    } catch (err) {
      console.warn('Failed to open practice ics:', err);
      setStatus('icsFailed');
    }
  };

  const chip = (on: boolean) =>
    `h-11 rounded-xl text-[15px] font-bold cursor-pointer ${on ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-charcoal/80'}`;

  return (
    <Sheet onClose={nav.back}>
      <div data-testid="sheet-reminder">
        <h2 className="text-[24px] font-black text-brand-forest">{REMINDER_SHEET.title}</h2>
        <p className="mt-1.5 pr-12 text-[14px] text-brand-charcoal/60 leading-relaxed">{REMINDER_SHEET.sub}</p>

        <p className="mt-5 text-[14px] font-bold text-brand-forest">{REMINDER_SHEET.days}</p>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, d) => (
            <button key={w} type="button" aria-pressed={shown.days.includes(d)} onClick={() => toggleDay(d)} className={chip(shown.days.includes(d))}>
              {w}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[14px] font-bold text-brand-forest">{REMINDER_SHEET.time}</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {REMINDER_TIMES.map(t => (
            <button key={t} type="button" aria-pressed={shown.time === t} onClick={() => change({ ...shown, time: t })} className={`${chip(shown.time === t)} tabular-nums`}>
              {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!canSave || busy}
          onClick={save}
          className="mt-7 w-full h-12 rounded-full bg-brand-forest text-white font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
        >
          {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <CalendarPlus size={18} />}
          {status === 'saving' ? REMINDER_SHEET.saving : REMINDER_SHEET.save}
        </button>
        {status === 'saved' && (
          <p className="mt-2 text-[13px] text-brand-forest flex items-center justify-center gap-1" role="status">
            <CircleCheck size={15} className="text-brand-moss" />
            {reminderSaved(reminderLabel(shown.days, shown.time))}
          </p>
        )}
        {status === 'saveFailed' && (
          <p role="alert" className="mt-2 text-center text-[13px] text-brand-clay">
            {REMINDER_SHEET.saveFailed}
          </p>
        )}

        {inWeChat ? (
          <p className="mt-4 rounded-xl bg-brand-sand p-3 text-[13px] text-brand-charcoal leading-relaxed flex gap-2" data-testid="reminder-wechat">
            <Info size={16} className="text-brand-clay shrink-0 mt-0.5" />
            <span>{REMINDER_SHEET.wechat}</span>
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={addToPhone}
              className="mt-3 w-full h-11 rounded-full border border-brand-stone text-brand-forest font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              {status === 'ics' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {status === 'ics' ? REMINDER_SHEET.icsOpening : REMINDER_SHEET.ics}
            </button>
            {status === 'icsFailed' && (
              <p role="alert" className="mt-2 text-center text-[13px] text-brand-clay">
                {REMINDER_SHEET.icsFailed}
              </p>
            )}
            <p className="mt-2.5 text-[12px] text-brand-charcoal/55 leading-relaxed">{REMINDER_SHEET.icsNote}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/**
 * 打卡成功（Keep 規格 §3.6，票 7）。取代播放器那一層：在這裡按返回回到詳情，不回播放器。
 *
 * 版面照樣品的 `CheckinOverlay`（大勾、兩個數字、本週七天、心情、進步、兩顆按鈕）。**資料重寫**：
 * - 「第 N 次」：POST 回來的 `timesForActivity`（這一支一共第幾次，不分週），記在這一層上。
 * - 兩個數字與七天格：`checkinSummary`（剛打的這一筆＋手上的打卡清單，照 `practiceStats`）；
 *   打卡清單讀不出來時整組不出（不寫 0）。x/4 只算那一週的四支，換著玩與片庫的算進次數。
 * - 心情三選一、進步可複選（只有有腳本的活動有那三條）：都選填、可改，每改一次 PATCH 一次，
 *   依序送（連點兩下，後一次不會被先一次蓋掉）；存不上就說一句、回到伺服器上的樣子。
 * - 說明句是「都是选填，会记在打卡日历里」：配對現在不看心情與進步（§9 第 6 題），樣品那句
 *  「下周安排活动时会参考」不用。
 * - 「看打卡日历」（票 8 之前是「即将开放」）；「回到计划」：堆疊裡有計劃頁就退到它，沒有（從報告的
 *   活動卡直接進來）就退到第一層換成計劃頁（`returnToPage`）。
 */
import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { CHECKIN_MOODS, type Checkin, type CheckinMood, type CheckinPatch } from '../../t2/practice';
import { CHECKIN, MOOD_LABEL, WEEKDAYS, checkinSub } from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { patchCheckin } from './trainingApi';
import { checkinSummary, nextMood, toggleProgress } from './trainingData';
import { useActivity } from './useActivity';

export default function CheckinScreen({ id, checkinId, times, date }: { id: string; checkinId: number; times: number; date: string }) {
  const { data, nav } = useTraining();
  const load = useActivity(id);
  const activity = load.status === 'ready' ? load.activity : null;
  const record: Checkin | undefined = data.checkins?.find(c => c.id === checkinId);

  // 畫面上的心情與進步：家長這次動過的用他動過的，沒動過的照伺服器上那一筆（重讀之後才有）
  const [edits, setEdits] = useState<CheckinPatch>({});
  const [failed, setFailed] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mood = edits.mood !== undefined ? edits.mood : record?.mood ?? null;
  const progress = edits.progress ?? record?.progress ?? [];

  const summary = checkinSummary(data.checkins, { id: checkinId, activityId: id, checkinDate: date }, data.plan);
  const progressItems = activity?.guide?.progress ?? [];

  const save = (patch: CheckinPatch) => {
    setFailed(false);
    setEdits(e => ({ ...e, ...patch }));
    queue.current = queue.current
      .then(() => patchCheckin(checkinId, patch))
      .then(
        () => data.reloadCheckins(),
        err => {
          console.warn('Failed to update check-in:', err);
          setFailed(true);
          // 回到伺服器上的樣子：丟掉這一欄的改動，重讀一次
          setEdits(e => {
            const next = { ...e };
            for (const key of Object.keys(patch) as Array<keyof CheckinPatch>) delete next[key];
            return next;
          });
          return data.reloadCheckins();
        },
      );
  };

  const pickMood = (m: CheckinMood) => save({ mood: nextMood(mood, m) });
  const pickProgress = (i: number) => save({ progress: toggleProgress(progress, i) });

  return (
    <div className="h-full bg-white flex flex-col training-fade" data-testid="training-checkin">
      <div className="flex-1 overflow-y-auto training-no-scrollbar px-5 pt-12 text-center">
        <div className="mx-auto w-24 h-24 rounded-full bg-brand-moss grid place-items-center text-white training-pop shadow-[0_12px_30px_rgba(61,75,59,0.3)]">
          <Check size={52} strokeWidth={3} />
        </div>
        <p className="mt-6 text-[28px] font-black text-brand-forest">{CHECKIN.title}</p>
        {activity && <p className="mt-1.5 text-[15px] text-brand-charcoal/60">{checkinSub(activity.title, times)}</p>}

        {summary && (
          <>
            <div className={`mt-6 grid gap-2.5 ${summary.plan ? 'grid-cols-2' : 'grid-cols-1'}`} data-testid="checkin-numbers">
              <div className="rounded-xl bg-brand-cream py-3">
                <p className="text-[24px] font-black text-brand-forest tabular-nums">{summary.sessions}</p>
                <p className="text-[12px] text-brand-charcoal/60 mt-0.5">{CHECKIN.weekSessions}</p>
              </div>
              {summary.plan && (
                <div className="rounded-xl bg-brand-cream py-3">
                  <p className="text-[24px] font-black text-brand-forest tabular-nums">
                    {summary.plan.practiced}/{summary.plan.total}
                  </p>
                  <p className="text-[12px] text-brand-charcoal/60 mt-0.5">{CHECKIN.planPracticed}</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5">
              {summary.days.map((d, i) => (
                <div key={d.date} className="flex flex-col items-center gap-1" data-day={d.date} data-done={d.done || undefined}>
                  <span className="text-[11px] text-brand-charcoal/50">{WEEKDAYS[i]}</span>
                  <span
                    className={`w-9 h-9 rounded-full grid place-items-center ${
                      d.done ? 'bg-brand-forest text-white' : d.today ? 'ring-2 ring-brand-moss' : 'bg-brand-cream'
                    }`}
                  >
                    {d.done && <Check size={16} strokeWidth={3} />}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mt-8 text-[16px] font-bold text-brand-forest">{CHECKIN.moodQuestion}</p>
        <div className="mt-3 flex justify-center gap-2">
          {CHECKIN_MOODS.map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => pickMood(m)}
              className={`px-4 h-10 rounded-full text-[14px] font-bold cursor-pointer ${
                mood === m ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-charcoal/80'
              }`}
            >
              {MOOD_LABEL[m]}
            </button>
          ))}
        </div>

        {progressItems.length > 0 && (
          <div className="mt-7 text-left" data-testid="checkin-progress">
            <p className="text-[16px] font-bold text-brand-forest text-center">{CHECKIN.progressTitle}</p>
            <p className="mt-1 text-[12px] text-brand-charcoal/50 text-center">{CHECKIN.progressSub}</p>
            <ul className="mt-3 space-y-2">
              {progressItems.map((t, i) => {
                const on = progress.includes(i);
                return (
                  <li key={`${i}-${t}`}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickProgress(i)}
                      className={`w-full rounded-xl border p-3 flex items-start gap-2.5 text-left cursor-pointer ${
                        on ? 'border-brand-moss bg-brand-sage' : 'border-brand-stone'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-md grid place-items-center shrink-0 ${
                          on ? 'bg-brand-forest text-white' : 'border border-brand-stone'
                        }`}
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="text-[13px] text-brand-charcoal leading-relaxed">{t}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {failed && (
          <p role="alert" className="mt-3 text-[13px] text-brand-clay">
            {CHECKIN.saveFailed}
          </p>
        )}
        <p className="mt-3 mb-4 text-[12px] text-brand-charcoal/50">{CHECKIN.optional}</p>
      </div>
      <div className="shrink-0 px-5 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => nav.openPage({ name: 'calendar' })}
          className="h-12 rounded-full border border-brand-stone text-brand-forest font-bold cursor-pointer"
        >
          {CHECKIN.toCalendar}
        </button>
        <button
          type="button"
          onClick={() => nav.returnToPage({ name: 'plan' })}
          className="h-12 rounded-full bg-brand-forest text-white font-bold cursor-pointer"
          data-testid="checkin-to-plan"
        >
          {CHECKIN.toPlan}
        </button>
      </div>
    </div>
  );
}

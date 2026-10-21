/**
 * Ledo 版的線上干預入口（設計稿第 10 頁）：打招呼標題、計劃插畫大卡、維度膠囊、本週活動一行一個
 * （示範片縮圖＋播放鈕）、換著玩兩欄小卡、問專家一條。
 *
 * 資料、篩選、點下去推哪一層，全部與舊版 `ReportEntry` 同一套（`useTraining`、`trainingData` 的函式）；
 * 這一檔只換畫法。舊版的照片大卡壓白字（深色漸層）在這一版拿掉：字一律放在白底或粉彩底上。
 */
import { useState } from 'react';
import { CalendarDays, Loader2, MessageCircle, UserRound } from 'lucide-react';
import { ServiceNote, serviceChoices } from '../serviceChoices';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { PREPARING_SENTENCE, ageBandLabel, weekRangeLabel } from '../../t2/weeklyCopy';
import { ENTRY, LEDO_ENTRY, planTitle, practicedTimes, swapCount, swapHeading, swapSub, weekAgeLine } from '../../t2/trainingCopy';
import type { DimensionCode } from '../../t2/types';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, PlayButton, RoundArrow, SectionHead } from '../ledo/ui';
import { useTraining } from './TrainingContext';
import { alternateRows, filterDimensions, planPositionOf } from './trainingData';
import { SHOW_LIBRARY } from './visibility';

export default function LedoEntry() {
  const { data, nav, childName, onBookService } = useTraining();
  const [chip, setChip] = useState<'all' | DimensionCode>('all');

  if (data.status === 'unavailable') return null;
  if (data.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-ledo-ink-2">
        <Loader2 size={14} className="animate-spin" />
        {ENTRY.loading}
      </div>
    );
  }
  if (data.status === 'error' || !data.plan) return <p className="py-6 text-xs text-ledo-ink-2">{ENTRY.error}</p>;

  const plan = data.plan;
  const practice = data.practice;
  const position = planPositionOf(plan);
  const dims = filterDimensions(plan);
  const picks = chip === 'all' ? plan.activities : plan.activities.filter(p => p.dimension === chip);
  const swaps = alternateRows(plan).filter(r => chip === 'all' || r.dimension === chip);
  const range = weekRangeLabel(plan.weekStart, plan.weekEnd);

  return (
    <div className="space-y-4" data-testid="training-entry">
      <Greeting
        small={`${range ? `${range} · ` : ''}${LEDO_ENTRY.week(position.weekIndex, position.totalWeeks)}`}
        title={ENTRY.title}
        right={
          <button
            type="button"
            aria-label={ENTRY.tabs.calendar}
            onClick={() => nav.openPage({ name: 'calendar' })}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ledo-line bg-white text-ledo-ink cursor-pointer"
          >
            <CalendarDays size={16} />
          </button>
        }
      />
      <p className="-mt-2 text-xs leading-relaxed text-ledo-ink-2">
        {ENTRY.subtitle}。{weekAgeLine(plan.ageMonth, ageBandLabel(plan.ageKey), plan.reportAgeMonth)}
      </p>

      {plan.activities.length > 0 && (
        <button
          type="button"
          onClick={() => nav.openPage({ name: 'plan' })}
          className="relative block aspect-video w-full overflow-hidden rounded-[28px] bg-ledo-accent-soft text-left cursor-pointer active:scale-[0.99] transition"
        >
          <img src={LEDO_ART.training} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <Chip tone="white">
              {planTitle(childName)}
              {practice ? LEDO_ENTRY.practiced(practice.sessions) : ''}
            </Chip>
            <PlayButton />
          </span>
        </button>
      )}

      {dims.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 training-no-scrollbar">
          <button type="button" onClick={() => setChip('all')} className="shrink-0 cursor-pointer">
            <Chip on={chip === 'all'}>{ENTRY.chipAll}</Chip>
          </button>
          {dims.map(code => (
            <button key={code} type="button" onClick={() => setChip(code)} className="shrink-0 cursor-pointer">
              <Chip on={chip === code}>{SITE_DIMENSION_NAME[code]}</Chip>
            </button>
          ))}
        </div>
      )}

      {plan.activities.length === 0 ? (
        <p className="text-xs leading-relaxed text-ledo-ink-2">{ENTRY.noActivities}</p>
      ) : (
        <>
          <SectionHead
            title={LEDO_ENTRY.thisWeek(picks.length)}
            action={SHOW_LIBRARY ? ENTRY.tabs.library : undefined}
            onAction={SHOW_LIBRARY ? () => nav.openPage({ name: 'library' }) : undefined}
          />
          <div className="space-y-2.5">
            {picks.map(({ activity, dimension }) => (
              <ListRow
                key={activity.id}
                avatar={activity.posterUrl ? <Avatar img={activity.posterUrl} /> : <Avatar tone="acc" text={activity.title.slice(0, 1)} />}
                title={activity.title}
                sub={`${SITE_DIMENSION_NAME[dimension]}${practice ? ` · ${practicedTimes(practice.timesByActivity[activity.id] ?? 0)}` : ''}`}
                right={<PlayButton size="sm" />}
                onClick={() => nav.openPage({ name: 'detail', id: activity.id, from: 'plan' })}
              />
            ))}
          </div>
        </>
      )}

      {/* 配不到活動的維度（票 #60 的行為） */}
      {plan.preparing.length > 0 && (chip === 'all' || plan.preparing.includes(chip)) && (
        <div className="space-y-2 rounded-3xl bg-ledo-mild p-3.5 text-ledo-mild-ink">
          <p className="text-xs leading-relaxed">
            「{plan.preparing.map(d => SITE_DIMENSION_NAME[d]).join('、')}」{PREPARING_SENTENCE}。
          </p>
          <div className="flex flex-wrap gap-2">
            {serviceChoices({ book: onBookService, inTraining: true }).map(c => (
              <button
                key={c.descriptor.type}
                type="button"
                disabled={!c.onSelect}
                onClick={c.onSelect ?? undefined}
                className={`flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-left text-xs font-bold text-ledo-ink cursor-pointer disabled:cursor-default ${
                  c.state === 'soon' ? 'disabled:opacity-50' : ''
                }`}
              >
                <UserRound size={12} className="shrink-0" />
                {c.descriptor.label}
                <ServiceNote state={c.state} className="text-ledo-ink-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {swaps.map((row, i) => (
        <section key={row.dimension} className="space-y-2.5" data-testid="training-swaps">
          <SectionHead title={swapHeading(SITE_DIMENSION_NAME[row.dimension])} action={swapCount(row.activities.length)} />
          <p className="-mt-1.5 text-xs text-ledo-ink-2">{swapSub(childName)}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {row.activities.map((a, j) => (
              <button
                key={a.id}
                type="button"
                onClick={() => nav.openPage({ name: 'detail', id: a.id, from: 'swap' })}
                className={`flex min-w-0 flex-col gap-2 rounded-[22px] p-2.5 text-left cursor-pointer ${(i + j) % 2 === 0 ? 'bg-ledo-ok' : 'bg-ledo-mild'}`}
              >
                <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-white">
                  {a.posterUrl && <img src={a.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <span className="flex items-center justify-between gap-1.5">
                  <b className="truncate text-[13px] font-bold text-ledo-ink">{a.title}</b>
                  <RoundArrow />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3 rounded-3xl bg-ledo-accent-soft p-3.5">
        <MessageCircle size={20} className="shrink-0 text-ledo-accent-soft-ink" />
        <p className="flex-1 text-sm font-bold text-ledo-ink">{ENTRY.bannerText}</p>
        <button
          type="button"
          onClick={() => nav.openSheet({ kind: 'expert' })}
          className="shrink-0 rounded-full bg-ledo-accent px-3.5 py-2 text-xs font-black text-white cursor-pointer"
        >
          {ENTRY.bannerAction}
        </button>
      </div>
    </div>
  );
}

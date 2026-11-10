/**
 * Ledo 版的線上干預入口（設計稿第 10 頁）：打招呼標題、計劃插畫大卡、維度膠囊、本週活動一行一個
 * （示範片縮圖＋播放鈕）、換著玩兩欄小卡、問專家一條。
 *
 * 資料、篩選、點下去推哪一層，全部與舊版 `ReportEntry` 同一套（`useTraining`、`trainingData` 的函式）；
 * 這一檔只換畫法。舊版的照片大卡壓白字（深色漸層）在這一版拿掉：字一律放在白底或粉彩底上。
 */
import { useState } from 'react';
import { PRODUCT } from '../../productConfig';
import { CalendarDays, ChevronRight, Loader2, MessageCircle, UserRound } from 'lucide-react';
import { ServiceNote, serviceChoices } from '../serviceChoices';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { PREPARING_SENTENCE, ageBandLabel, weekRangeLabel } from '../../t2/weeklyCopy';
import { ENTRY, ENTRY_1103, LEDO_ENTRY, PLAN_HERO, practicedTimes, swapCount, swapHeading, swapSub, weekAgeLine } from '../../t2/trainingCopy';
import type { Activity, DimensionCode } from '../../t2/types';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, PlayButton, RoundArrow, SectionHead } from '../ledo/ui';
import { useTraining } from './TrainingContext';
import { alternateRows, filterDimensions, planPositionOf } from './trainingData';
import { SHOW_LIBRARY } from './visibility';
import { useLastWeek } from './useLastWeek';
import { useDesktopLayout } from '../../desktop/useDesktopLayout';

/**
 * 本週／上週一行一支（客戶 11/10 簡報：左邊示範片、中間題目與說明、右邊播放）。
 * 說明用手冊的「练什么」；底下那行維度與已練次數的小標籤拿掉。
 */
function WeekRow({ activity, badge, onClick }: { activity: Activity; badge?: { text: string; tone: 'more' | 'ok' }; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left cursor-pointer active:scale-[0.99] transition">
      <span className="relative block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-ledo-field">
        {activity.posterUrl && <img src={activity.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {badge && (
          <span className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-xs font-black ${badge.tone === 'more' ? 'bg-ledo-more text-ledo-more-ink' : 'bg-white text-ledo-ok-ink'}`}>
            {badge.text}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-black text-ledo-ink">{activity.title}</b>
        {activity.trains && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ledo-ink-2">{activity.trains}</span>}
      </span>
      <PlayButton size="sm" />
    </button>
  );
}

/** 配不到活動的維度（票 #60 的行為），兩版共用。 */
function Preparing({ preparing, onBookService }: { preparing: DimensionCode[]; onBookService: Parameters<typeof serviceChoices>[0]['book'] }) {
  return (
    <div className="space-y-2 rounded-3xl bg-ledo-mild p-3.5 text-ledo-mild-ink">
      <p className="text-xs leading-relaxed">
        「{preparing.map(d => SITE_DIMENSION_NAME[d]).join('、')}」{PREPARING_SENTENCE}。
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
  );
}

function ExpertBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-ledo-accent-soft p-3.5">
      <MessageCircle size={20} className="shrink-0 text-ledo-accent-soft-ink" />
      <p className="flex-1 text-sm font-bold text-ledo-ink">{ENTRY.bannerText}</p>
      <button type="button" onClick={onOpen} className="shrink-0 rounded-full bg-ledo-accent px-3.5 py-2 text-xs font-black text-white cursor-pointer">
        {ENTRY.bannerAction}
      </button>
    </div>
  );
}

export default function LedoEntry() {
  return PRODUCT.features.ui1022 ? <Entry1103 /> : <LedoEntryV1 />;
}

/**
 * 1022（簡報 11/03 第 24–25 頁，使用者 2026-11-06）：固定副標題、家長常問（按鈕，點開看說明）、
 * 本週與上週各一列一支（示範片、題目與「练什么」、播放；客戶 11/10）；拿掉維度膠囊與按維度分的「换着玩」，不再用標籤分組。
 */
function Entry1103() {
  const { data, nav, childName, onBookService } = useTraining();
  const [faq, setFaq] = useState<number | null>(null);
  const desk = useDesktopLayout();
  // 第一期第 1 週一定沒有上一週：不去問，免得每次打開都在 console 留一條 404（2026-11-10 清單第 29 條）。
  // 換期後的第 1 週照問（上一週是舊一期的最後一週）。
  const pos = data.plan?.plan;
  const firstEverWeek = pos?.weekIndex === 1 && (!('periodNo' in pos) || pos.periodNo === 1);
  const last = useLastWeek(firstEverWeek ? null : data.plan?.weekStart ?? null);

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
  const range = weekRangeLabel(plan.weekStart, plan.weekEnd);

  const entryHead = (
    <>
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
      <p id="training-subtitle" className="-mt-2 text-xs leading-relaxed text-ledo-ink-2">{ENTRY_1103.subtitle}</p>
    </>
  );
  const entryHero = (
    <>
      {plan.activities.length > 0 && (
        <button
          type="button"
          onClick={() => nav.openPage({ name: 'plan' })}
          className="block w-full overflow-hidden rounded-[28px] border border-ledo-line bg-white text-left cursor-pointer active:scale-[0.99] transition"
        >
          <span className="relative block aspect-video w-full bg-ledo-accent-soft">
            <img src={LEDO_ART.training} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </span>
          {/* 底下白色一條（2026-11-10 使用者）：「查看英英的活动计划」＋點擊按鈕。 */}
          <span className="flex items-center justify-between gap-3 bg-white px-4 py-3">
            <span className="min-w-0 text-sm font-black text-ledo-ink">{PLAN_HERO.label(childName)}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ledo-bar px-4 py-2 text-xs font-black text-white">
              {PLAN_HERO.button}
              <ChevronRight size={14} />
            </span>
          </span>
        </button>
      )}
    </>
  );
  const entryFaq = (
    <>
      {/* 家長常問（會議：「以按钮形式置于显眼位置并展示解释」） */}
      <section id="training-faq" className="space-y-2">
        <h3 className="text-sm font-black text-ledo-ink">{ENTRY_1103.faqTitle}</h3>
        <div className="flex flex-wrap gap-1.5">
          {ENTRY_1103.faq.map((f, i) => (
            <button key={f.q} type="button" aria-expanded={faq === i} onClick={() => setFaq(o => (o === i ? null : i))} className="cursor-pointer">
              <Chip on={faq === i}>{f.q}</Chip>
            </button>
          ))}
        </div>
        {faq !== null && (
          <p id="training-faq-answer" className="rounded-2xl bg-ledo-field px-3.5 py-2.5 text-xs leading-relaxed text-ledo-ink">{ENTRY_1103.faq[faq].a}</p>
        )}
      </section>
    </>
  );
  const entryWeek = (
    <>
      {plan.activities.length === 0 ? (
        <p className="text-xs leading-relaxed text-ledo-ink-2">{ENTRY.noActivities}</p>
      ) : (
        <section id="training-this-week" className="space-y-2.5 rounded-[28px] bg-ledo-mild p-3">
          <SectionHead
            title={ENTRY_1103.thisWeek(plan.activities.length)}
            action={SHOW_LIBRARY ? ENTRY.tabs.library : undefined}
            onAction={SHOW_LIBRARY ? () => nav.openPage({ name: 'library' }) : undefined}
          />
          <div className="space-y-2">
            {plan.activities.map(({ activity }) => (
              <WeekRow key={activity.id} activity={activity} onClick={() => nav.openPage({ name: 'detail', id: activity.id, from: 'plan' })} />
            ))}
          </div>
        </section>
      )}
    </>
  );
  const entryLast = (
    <>
      {last && (
        <section id="training-last-week" className="space-y-2.5 rounded-[28px] bg-ledo-field p-3">
          <SectionHead title={ENTRY_1103.lastWeek(last.picks.length)} />
          <p className="-mt-1.5 px-1 text-xs text-ledo-ink-2">{ENTRY_1103.lastWeekSub}</p>
          <div className="space-y-2">
            {last.picks.map(({ activity }) => {
              const done = last.practiced.has(activity.id);
              return (
                <WeekRow
                  key={activity.id}
                  activity={activity}
                  badge={done ? { text: ENTRY_1103.practiced, tone: 'ok' } : { text: ENTRY_1103.notPracticed, tone: 'more' }}
                  onClick={() => nav.openPage({ name: 'detail', id: activity.id, from: 'swap' })}
                />
              );
            })}
          </div>
        </section>
      )}
    </>
  );
  const entryPrep = (
    <>
      {plan.preparing.length > 0 && <Preparing preparing={plan.preparing} onBookService={onBookService} />}
    </>
  );
  const entryBanner = <ExpertBanner onOpen={() => nav.openSheet({ kind: 'expert' })} />;

  if (desk) {
    // 電腦版（VITE_DESKTOP_LAYOUT）：左邊計畫大卡、家長常問、問專家；右邊本週與上週的活動，一排三張。
    return (
      <div className="space-y-5" data-testid="training-entry">
        {entryHead}
        <div className="grid grid-cols-12 items-start gap-6">
          <div className="col-span-5 min-w-0 space-y-4">{entryHero}{entryFaq}{entryPrep}{entryBanner}</div>
          <div className="col-span-7 min-w-0 space-y-4">{entryWeek}{entryLast}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="training-entry">
      {entryHead}{entryHero}{entryFaq}{entryWeek}{entryLast}{entryPrep}
      {entryBanner}
    </div>
  );
}

function LedoEntryV1() {
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
          className="block w-full overflow-hidden rounded-[28px] border border-ledo-line bg-white text-left cursor-pointer active:scale-[0.99] transition"
        >
          <span className="relative block aspect-video w-full bg-ledo-accent-soft">
            <img src={LEDO_ART.training} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </span>
          {/* 底下白色一條（2026-11-10 使用者）：「查看英英的活动计划」＋點擊按鈕。 */}
          <span className="flex items-center justify-between gap-3 bg-white px-4 py-3">
            <span className="min-w-0 text-sm font-black text-ledo-ink">{PLAN_HERO.label(childName)}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ledo-bar px-4 py-2 text-xs font-black text-white">
              {PLAN_HERO.button}
              <ChevronRight size={14} />
            </span>
          </span>
        </button>
      )}

      {dims.length > 0 && (
        <div className={PRODUCT.features.ui1022 ? 'flex flex-wrap gap-1.5' : '-mx-1 flex gap-1.5 overflow-x-auto px-1 training-no-scrollbar'}>
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

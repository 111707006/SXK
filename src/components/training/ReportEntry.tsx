/**
 * 報告入口（Keep 規格 §3.1）：報告第六段，取代票 #60 的 `T2WeeklyPlan` 清單。
 *
 * 版面照樣品的 `ReportScreen`（Keep「計劃」分頁：一排分頁字、維度篩選、計劃大卡、活動卡、換著玩、
 * 片庫入口、底部橫幅），但它**不是一整頁**：它就排在報告裡（報告上半部的縮影、「深度评估报告」
 * 導覽列是樣品用來示意位置的，不搬）。點計劃大卡、活動卡，才推一層蓋在報告上（`layerStack.ts`）。
 *
 * 【資料】全部來自 `useTrainingData`（每週活動＋打卡），這一檔不配對、不重算、不寫死任何活動。
 * 【沒搬的】樣品的配圖（計劃大卡的照片、「学声音」「叫名字」兩張封面）、「筛选」佔位按鈕（§1 不做）。
 *
 * 【保留票 #60 的兩件事】
 * - 配不到活動的維度列「準備中」並導向專家（`PREPARING_SENTENCE`）。
 * - 配對用的實足月齡與報告的測評月齡不同時說一句（`AGE_SPLIT_NOTE`，經 `weekAgeLine`）。
 *
 * 【片庫與打卡日曆（票 8）】在那之前兩個入口顯示「即将开放」、不能點——不放點了會壞或空白的按鈕。
 */
import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, LayoutGrid, ListVideo, Loader2, MessageCircle, Play, Shuffle, UserRound, X } from 'lucide-react';
import { serviceTypeDescriptors } from '../../utils/serviceTypes';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { PREPARING_SENTENCE, ageBandLabel, weekRangeLabel } from '../../t2/weeklyCopy';
import {
  CLIP_STATE,
  COMMON,
  ENTRY,
  planCardMeta,
  planTitle,
  practicedTimes,
  swapCount,
  swapHeading,
  swapSub,
  weekAgeLine,
} from '../../t2/trainingCopy';
import type { Activity, DimensionCode } from '../../t2/types';
import { useTraining } from './TrainingContext';
import { alternateRows, hasClip, weekDimensions } from './trainingData';
import { Cover, Tag } from './ui';

/**
 * 橫向捲動的那兩排（篩選、換著玩）伸到報告卡片的邊緣，與樣品伸到螢幕邊緣同一個意思。
 * 負邊界對的是 `T2Report.tsx` 外框的 `p-5 md:p-8`；`scroll-px` 讓換著玩的 snap 停在內距上，不貼著卡片邊。
 */
const BLEED = '-mx-5 px-5 scroll-px-5 md:-mx-8 md:px-8 md:scroll-px-8';

/**
 * 樣品的照片大卡。有封面時照片＋深色漸層；沒有封面（現在全部）時是淡綠底的無圖版面。
 *
 * 手冊的「练什么」與「本周已练 N 次」分兩行（票 7 順手修）：「练什么」是客戶原文、句尾常有「。」，
 * 照樣品接成一行會變成「……的基础。 · 本周已练 1 次」；原文不改字，所以不去句號、改成換行。
 */
function ActivityCard({ activity, dimension, lead, practiced, onClick }: {
  activity: Activity;
  dimension: DimensionCode;
  lead: string;
  /** 「本周已练 N 次」；打卡讀不出來時是空字串（不寫 0 次）。 */
  practiced: string;
  onClick: () => void;
}) {
  const photo = activity.posterUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full min-h-[148px] rounded-md overflow-hidden text-left cursor-pointer active:scale-[0.99] transition ${
        photo ? 'bg-brand-forest' : 'bg-gradient-to-br from-brand-sage to-brand-cream border border-brand-moss/20'
      }`}
    >
      {photo && (
        <>
          <img src={photo} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-forest/95 via-brand-forest/70 to-brand-forest/10" />
        </>
      )}
      {!photo && <Play size={96} aria-hidden="true" className="absolute -right-3 -bottom-4 text-brand-moss/15" />}
      <div className="relative h-full px-5 py-5 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag tone="custom">{ENTRY.weekTag}</Tag>
          <Tag tone={photo ? 'dark' : 'soft'}>{SITE_DIMENSION_NAME[dimension]}</Tag>
          <span className={`text-[13px] ml-1 ${photo ? 'text-white/70' : 'text-brand-charcoal/60'}`}>{lead}</span>
        </div>
        <p className={`mt-3 text-[23px] font-black tracking-tight leading-tight ${photo ? 'text-white' : 'text-brand-forest'}`}>{activity.title}</p>
        {activity.trains && (
          <p className={`mt-2 text-[13px] leading-relaxed ${photo ? 'text-white/60' : 'text-brand-charcoal/70'}`}>{activity.trains}</p>
        )}
        {practiced && (
          <p className={`mt-1 text-[12px] font-bold ${photo ? 'text-white/75' : 'text-brand-forest/80'}`} data-testid="entry-practiced">
            {practiced}
          </p>
        )}
      </div>
    </button>
  );
}

/** 標題列右邊的分頁字；`disabled` 的底下掛一行「即将开放」（票 8 之前的片庫、打卡日曆）。 */
function TabWord({ label, onClick, disabled = false }: { label: string; onClick?: () => void; disabled?: boolean }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="relative text-[16px] font-bold text-brand-charcoal/25 leading-none whitespace-nowrap">
        {label}
        <span className="absolute left-0 top-full mt-1 text-[9px] font-bold text-brand-charcoal/45 whitespace-nowrap">{COMMON.comingSoon}</span>
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className="text-[16px] font-bold text-brand-charcoal/50 hover:text-brand-forest leading-none whitespace-nowrap cursor-pointer">
      {label}
    </button>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 text-[11px] text-brand-charcoal/60 py-6">{children}</div>;
}

export default function ReportEntry() {
  const { data, nav, childName, onBookService } = useTraining();
  const [chip, setChip] = useState<'all' | DimensionCode>('all');
  const [bannerOpen, setBannerOpen] = useState(true);

  if (data.status === 'unavailable') return null;
  if (data.status === 'loading') {
    return (
      <Status>
        <Loader2 size={14} className="animate-spin" />
        {ENTRY.loading}
      </Status>
    );
  }
  if (data.status === 'error' || !data.plan) return <Status>{ENTRY.error}</Status>;

  const plan = data.plan;
  const practice = data.practice;
  const dims = weekDimensions(plan.activities);
  const picks = chip === 'all' ? plan.activities : plan.activities.filter(p => p.dimension === chip);
  const swaps = alternateRows(plan).filter(r => chip === 'all' || r.dimension === chip);
  const range = weekRangeLabel(plan.weekStart, plan.weekEnd);
  const chipClass = (on: boolean) =>
    `shrink-0 h-9 px-4 rounded-full flex items-center gap-1.5 text-[14px] cursor-pointer ${
      on ? 'bg-brand-forest text-white' : 'border border-brand-stone text-brand-charcoal'
    }`;

  return (
    <div className="space-y-4" data-testid="training-entry">
      {/* 1. 標題列與三個分頁字 */}
      <div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 pb-3">
          <h3 className="relative text-[24px] font-black text-brand-forest leading-none">
            <span className="relative z-10">{ENTRY.title}</span>
            <span aria-hidden="true" className="absolute left-0 right-0 -bottom-0.5 h-2.5 rounded-sm bg-brand-moss/50" />
          </h3>
          <TabWord label={ENTRY.tabs.library} disabled />
          <TabWord label={ENTRY.tabs.calendar} disabled />
          <TabWord label={ENTRY.tabs.expert} onClick={() => nav.openSheet({ kind: 'expert' })} />
        </div>
        <p className="mt-1 text-[13px] text-brand-charcoal/60">{ENTRY.subtitle}</p>
        <p className="mt-1 text-[11px] text-brand-charcoal/55 leading-relaxed">
          {range && `${range} · `}
          {weekAgeLine(plan.ageMonth, ageBandLabel(plan.ageKey), plan.reportAgeMonth)}
        </p>
      </div>

      {/* 2. 維度篩選：全部＋本週有活動的維度 */}
      {dims.length > 0 && (
        <div className={`flex gap-2 overflow-x-auto training-no-scrollbar ${BLEED}`}>
          <button type="button" onClick={() => setChip('all')} className={chipClass(chip === 'all')}>
            <LayoutGrid size={15} />
            {ENTRY.chipAll}
          </button>
          {dims.map(code => (
            <button key={code} type="button" onClick={() => setChip(code)} className={chipClass(chip === code)}>
              {SITE_DIMENSION_NAME[code]}
            </button>
          ))}
        </div>
      )}

      {plan.activities.length === 0 ? (
        <p className="text-[12px] text-brand-charcoal/70 leading-relaxed">{ENTRY.noActivities}</p>
      ) : (
        <div className="space-y-3">
          {/* 3. 計劃大卡 */}
          {chip === 'all' && (
            <button
              type="button"
              onClick={() => nav.openPage({ name: 'plan' })}
              className="relative block w-full min-h-[168px] rounded-md overflow-hidden text-left bg-brand-forest cursor-pointer active:scale-[0.99] transition"
            >
              <CalendarDays size={150} aria-hidden="true" className="absolute -right-6 -bottom-8 text-white/10" />
              <div className="relative h-full px-5 py-6 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag tone="custom">{ENTRY.planTags[0]}</Tag>
                  <Tag tone="hot">{ENTRY.planTags[1]}</Tag>
                  <Tag tone="dark">{ENTRY.planTags[2]}</Tag>
                  <span className="text-[13px] text-white/70 ml-1">{ENTRY.planLead}</span>
                </div>
                <p className="mt-3 text-[25px] font-black text-white tracking-tight leading-tight">{planTitle(childName)}</p>
                <p className="mt-2 text-[13px] text-white/60">{planCardMeta(plan.activities.length, practice ? practice.sessions : null)}</p>
              </div>
            </button>
          )}

          {/* 4. 本週活動卡 */}
          {picks.map(({ activity, dimension }) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              dimension={dimension}
              lead={hasClip(activity) ? CLIP_STATE.has : CLIP_STATE.none}
              practiced={practice ? practicedTimes(practice.timesByActivity[activity.id] ?? 0) : ''}
              onClick={() => nav.openPage({ name: 'detail', id: activity.id, from: 'plan' })}
            />
          ))}
        </div>
      )}

      {/* 配不到活動的維度（票 #60 的行為） */}
      {plan.preparing.length > 0 && (chip === 'all' || plan.preparing.includes(chip)) && (
        <div className="rounded-2xl border border-brand-moss/20 bg-brand-sage/60 p-3.5 space-y-2">
          <p className="text-[12px] text-brand-charcoal/80 leading-relaxed">
            「{plan.preparing.map(d => SITE_DIMENSION_NAME[d]).join('、')}」{PREPARING_SENTENCE}。
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {serviceTypeDescriptors().map(d => (
              <button
                key={d.type}
                type="button"
                onClick={() => onBookService(d.type)}
                className="px-3 py-2 rounded-xl border border-brand-moss/30 bg-white/70 hover:bg-white text-brand-forest text-[11px] font-bold transition active:scale-[0.99] cursor-pointer text-left flex items-center gap-1.5"
              >
                <UserRound size={12} className="shrink-0" />
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. 換著玩：一個維度一列（舊週次沒有 alternates → 不出） */}
      {swaps.map(row => (
        <section key={row.dimension} className="pt-2" data-testid="training-swaps">
          <div className="flex items-end justify-between gap-2">
            <h4 className="text-[17px] font-bold text-brand-forest flex items-center gap-1.5">
              <Shuffle size={16} className="text-brand-moss" />
              {swapHeading(SITE_DIMENSION_NAME[row.dimension])}
            </h4>
            <span className="text-[12px] text-brand-charcoal/50 shrink-0">{swapCount(row.activities.length)}</span>
          </div>
          <p className="mt-1 text-[12px] text-brand-charcoal/55">{swapSub(childName)}</p>
          <div className={`mt-3 flex gap-2.5 overflow-x-auto training-no-scrollbar snap-x ${BLEED}`}>
            {row.activities.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => nav.openPage({ name: 'detail', id: a.id, from: 'swap' })}
                className="snap-start shrink-0 w-[168px] text-left cursor-pointer"
              >
                <Cover src={a.posterUrl} className="h-[104px] rounded-md">
                  {!a.posterUrl && <Play size={40} aria-hidden="true" className="absolute right-2 top-2 text-brand-moss/25" />}
                  <span className="absolute left-1.5 bottom-1.5 rounded bg-black/60 text-white text-[10px] px-1.5 py-px flex items-center gap-0.5">
                    {hasClip(a) && <Play size={9} fill="currentColor" />}
                    {hasClip(a) ? CLIP_STATE.badgeClip : CLIP_STATE.badgePictures}
                  </span>
                </Cover>
                <p className="mt-1.5 text-[15px] font-bold text-brand-forest truncate">{a.title}</p>
                {a.trains && <p className="text-[12px] text-brand-charcoal/55 truncate">{a.trains}</p>}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* 6. 示範片庫入口（票 8 之前：即将开放） */}
      <div aria-disabled="true" className="w-full rounded-xl bg-brand-cream px-4 py-3.5 flex items-center gap-3 text-left">
        <ListVideo size={22} className="text-brand-moss shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-brand-forest">{ENTRY.libraryTitle}</span>
          <span className="block text-[12px] text-brand-charcoal/55">{ENTRY.librarySub}</span>
        </span>
        <span className="shrink-0 text-[11px] font-bold text-brand-charcoal/55 border border-brand-stone rounded-full px-2 py-0.5">
          {COMMON.comingSoon}
        </span>
      </div>

      {/* 7. 可關的橫幅 → 問專家（四種服務 → 既有的預約表） */}
      {bannerOpen && (
        <div className="rounded-xl bg-brand-sand border border-brand-clay/30 px-4 py-3 flex items-center gap-2.5">
          <MessageCircle size={22} className="text-brand-clay shrink-0" />
          <p className="text-[14px] font-bold text-brand-forest flex-1">{ENTRY.bannerText}</p>
          <button
            type="button"
            onClick={() => nav.openSheet({ kind: 'expert' })}
            className="shrink-0 h-9 px-4 rounded-full bg-white text-[14px] text-brand-forest font-bold cursor-pointer flex items-center"
          >
            {ENTRY.bannerAction}
            <ChevronRight size={14} />
          </button>
          <button type="button" aria-label={COMMON.close} onClick={() => setBannerOpen(false)} className="shrink-0 text-brand-charcoal/50 cursor-pointer">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

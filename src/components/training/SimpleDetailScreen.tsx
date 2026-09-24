/**
 * 活動詳情的**簡單版**（票 6 的退路；票 7 換成 Keep 規格 §3.3 的完整詳情＋GO＋打卡）。
 *
 * 內容與票 #60 的 `T2WeeklyPlan` 每一支顯示的相同，一樣不少：標題、時長、「因為……所以練……」、
 * 要準備、分解步驟（有幾則列幾則；圖選填，沒圖放序號方塊，ADR-0008）、示範連結（有才出），
 * 再加手冊的「练什么」「小提醒」（客戶原文，照原樣顯示）。
 *
 * 活動從每週活動那一份找：本週四支（`from: 'plan'`）或換著玩（`from: 'swap'`）。示範片庫的單支讀取
 *（`GET /api/t2/activities/:id`）等票 8 的片庫一起接；找不到就說一句，回上一層。
 */
import type { ReactNode } from 'react';
import { Clock, Play, PlayCircle } from 'lucide-react';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { BELOW_WINDOW_NOTE, reasonSentence } from '../../t2/weeklyCopy';
import { CLIP_STATE, DETAIL, aboutMinutes, swapReason } from '../../t2/trainingCopy';
import type { Activity, DimensionCode } from '../../t2/types';
import type { DetailSource } from './layerStack';
import { useTraining } from './TrainingContext';
import type { WeeklyPick, WeeklyPlanResponse } from './trainingData';
import { Cover, LightNav, StepImage } from './ui';

type Found =
  | { kind: 'plan'; pick: WeeklyPick }
  | { kind: 'swap'; activity: Activity; dimension: DimensionCode };

/** 在每週活動那一份裡找這一支。`from` 只決定先找哪一邊；兩邊都找，找不到回 `null`。 */
export function findActivity(plan: WeeklyPlanResponse | null, id: string, from: DetailSource): Found | null {
  if (!plan) return null;
  const inPlan = (): Found | null => {
    const pick = plan.activities.find(p => p.activity.id === id);
    return pick ? { kind: 'plan', pick } : null;
  };
  const inSwaps = (): Found | null => {
    for (const [dimension, list] of Object.entries(plan.alternates ?? {}) as Array<[DimensionCode, Activity[]]>) {
      const activity = list.find(a => a.id === id);
      if (activity) return { kind: 'swap', activity, dimension };
    }
    return null;
  };
  return from === 'swap' ? inSwaps() ?? inPlan() : inPlan() ?? inSwaps();
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 mt-6">
      <h2 className="text-[17px] font-black text-brand-forest">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function SimpleDetailScreen({ id, from }: { id: string; from: DetailSource }) {
  const { data, nav, childName } = useTraining();
  const found = findActivity(data.plan, id, from);

  if (!found) {
    return (
      <div className="h-full flex flex-col bg-white">
        <LightNav onBack={nav.back} />
        <p className="mx-6 mt-10 text-[14px] text-brand-charcoal/70 leading-relaxed">{DETAIL.notFound}</p>
      </div>
    );
  }

  const activity = found.kind === 'plan' ? found.pick.activity : found.activity;
  const dimension = found.kind === 'plan' ? found.pick.dimension : found.dimension;
  const why =
    found.kind === 'plan'
      ? `${reasonSentence(dimension, found.pick.reason)}${found.pick.reason.belowWindow ? `${BELOW_WINDOW_NOTE}。` : ''}`
      : swapReason(SITE_DIMENSION_NAME[dimension], childName);
  const clip = typeof activity.videoUrl === 'string' && activity.videoUrl.trim() !== '' ? activity.videoUrl : null;
  const need = activity.need || activity.equipment.join('、');

  return (
    <div className="h-full flex flex-col bg-white" data-testid="training-detail">
      <LightNav onBack={nav.back} />
      <div className="flex-1 overflow-y-auto training-no-scrollbar pb-16">
        <div className="px-4">
          {/* 有封面才給大圖的比例；沒有封面（現在全部）時是一條矮的色塊，不讓一片空白佔掉半個螢幕 */}
          <Cover src={activity.posterUrl} className={`rounded-md ${activity.posterUrl ? 'aspect-[4/3]' : 'h-28'}`}>
            {!activity.posterUrl && <Play size={44} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-moss/25" />}
            {!clip && <span className="absolute left-3 top-3 text-[12px] px-2 py-1 rounded bg-black/55 text-white">{CLIP_STATE.none}</span>}
          </Cover>
        </div>

        <div className="mx-4 mt-4">
          <h1 className="text-[22px] font-black text-brand-forest leading-snug">
            {[activity.title, activity.people].filter(Boolean).join(' · ')}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="rounded-full bg-brand-sage text-brand-forest font-bold px-2 py-0.5">{SITE_DIMENSION_NAME[dimension]}</span>
            {activity.ageLabel && <span className="rounded-full border border-brand-stone text-brand-charcoal/70 px-2 py-0.5">{activity.ageLabel}</span>}
            {activity.durationMin > 0 && (
              <span className="inline-flex items-center gap-1 text-brand-charcoal/60 px-1">
                <Clock size={12} />
                {aboutMinutes(activity.durationMin)}
              </span>
            )}
          </div>
          {clip && (
            <a
              href={clip}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-brand-forest hover:text-brand-moss transition"
            >
              <PlayCircle size={15} />
              {DETAIL.watchClip}
            </a>
          )}
        </div>

        {activity.trains && (
          <Block title={DETAIL.trainsTitle}>
            <p className="text-[14px] text-brand-charcoal leading-relaxed">{activity.trains}</p>
          </Block>
        )}

        <Block title={DETAIL.whyTitle}>
          <p className="text-[14px] text-brand-charcoal/85 leading-relaxed">{why}</p>
        </Block>

        {need && (
          <Block title={DETAIL.needTitle}>
            <p className="text-[14px] text-brand-charcoal leading-relaxed">{need}</p>
          </Block>
        )}

        {activity.steps.length > 0 && (
          <Block title={DETAIL.stepsTitle}>
            <ol className="space-y-3">
              {activity.steps.map((step, i) => (
                <li key={`${activity.id}-${i}`} className="flex items-start gap-3">
                  <StepImage src={step.imageUrl} n={i + 1} className={`shrink-0 rounded-xl ${step.imageUrl ? 'w-20 h-20' : 'w-11 h-11'}`} />
                  <p className="text-[14px] text-brand-charcoal leading-relaxed pt-1">
                    {step.imageUrl && <span className="font-bold text-brand-moss mr-1">{i + 1}.</span>}
                    {step.instruction}
                  </p>
                </li>
              ))}
            </ol>
          </Block>
        )}

        {(activity.tip || activity.deeper) && (
          <section className="mx-4 mt-6 rounded-2xl bg-brand-sand p-4">
            <h2 className="text-[17px] font-black text-brand-forest">{DETAIL.tipTitle}</h2>
            {activity.tip && <p className="mt-2 text-[14px] text-brand-charcoal leading-relaxed">{activity.tip}</p>}
            {activity.deeper && (
              <p className="mt-2 text-[13px] text-brand-charcoal/75 leading-relaxed">
                {DETAIL.deeperPrefix}
                {activity.deeper}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

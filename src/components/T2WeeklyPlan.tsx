import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock, Loader2, PlayCircle, Package, UserRound } from 'lucide-react';
import { authFetch } from '../utils/api';
import { serviceTypeDescriptors, type ServiceType } from '../utils/serviceTypes';
import { SITE_DIMENSION_NAME } from '../t2/dimensionMap';
import {
  AGE_SPLIT_NOTE,
  BELOW_WINDOW_NOTE,
  PREPARING_SENTENCE,
  ageBandLabel,
  reasonSentence,
  weekRangeLabel,
} from '../t2/weeklyCopy';
import type { PickReason } from '../t2/activityMatch';
import type { Activity, DimensionCode } from '../t2/types';

/** `GET /api/t2/weekly-plan` 的回應。 */
interface WeeklyPlanResponse {
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  findingsId: number;
  /** 配對用的實足月齡與它落在哪一個年齡段。 */
  ageMonth: number;
  ageKey: string;
  /** 報告用的測評月齡。與 `ageMonth` 不同時畫面要說明。 */
  reportAgeMonth: number;
  activities: Array<{ activity: Activity; dimension: DimensionCode; reason: PickReason }>;
  preparing: DimensionCode[];
}

interface T2WeeklyPlanProps {
  /** 配不到活動的維度導向四種服務：開預約表、預選那一種。 */
  onBookService: (type: ServiceType) => void;
  /** 哪一週（`YYYY-MM-DD`，那一天所在的那一週）。不給就是這一週。 */
  week?: string;
}

/**
 * 這一週的四支活動 —— **家長端專屬**（票 #60，規格 §7.3、§9.2）。
 *
 * 【這一塊在畫面上的位置】
 * 報告頁的第六段（票 #61 把它嵌進去），也可以單獨顯示。舊的干預包元件由它承接（ADR-0005，票 #63）。
 *
 * 【四支從哪裡來】
 * 全部是伺服器算好存下來的（`/api/t2/weekly-plan` → `matchWeeklyActivities`），這一檔**不配對、
 * 不重算、不排序**。一週一筆：家長這一週重整幾次都是同樣四支 —— 昨天記下「這週要練這一支」的
 * 家長，今天打開要找得到它。
 *
 * 【每一支顯示什麼】
 * 標題、時長、器材、圖文步驟（**有幾則就顯示幾則**，不補、不截）、示範連結（有才顯示）、
 * 以及那句「因為……所以練……」（`src/t2/weeklyCopy.ts`，不在這裡手寫）。
 *
 * 【兩個月齡】
 * 配對用實足月齡、報告用測評月齡。年齡段標在最上面；兩個月齡不同時（孩子跨段了）多一句說明 ——
 * 家長看到「報告說 47 個月、活動說 48 個月」而沒有解釋的話，會以為其中一個是錯的。
 *
 * 【配不到活動】
 * 該維度列在「準備中」並導向專家。這是今天正式站的行為（活動庫的 `targetMonth` 一支都還沒填），
 * 不是退步 —— 往上取一支孩子做不到的活動，家長會以為孩子又失敗了一次。
 */
export default function T2WeeklyPlan({ onBookService, week }: T2WeeklyPlanProps) {
  const [plan, setPlan] = useState<WeeklyPlanResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const query = week ? `?week=${encodeURIComponent(week)}` : '';
        const resp = await authFetch(`/api/t2/weekly-plan${query}`);
        const ct = resp.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) throw new Error('bad content type');
        // 401（還沒登入）與 404（還沒生成報告）都當「這裡沒東西好顯示」：這一塊本來就在
        // 報告頁裡，真的碰到只代表資料還沒同步，不是要對家長解釋的事。
        if (resp.status === 401 || resp.status === 404) {
          if (!cancelled) setStatus('unavailable');
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as WeeklyPlanResponse;
        if (cancelled) return;
        setPlan(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 weekly plan:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [week]);

  if (status === 'unavailable') return null;

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-brand-charcoal/60 py-6">
        <Loader2 size={14} className="animate-spin" />
        正在准备这一周的活动…
      </div>
    );
  }

  if (status === 'error' || !plan) {
    return (
      <p className="text-[11px] text-brand-charcoal/60 py-6">
        这一周的活动暂时读不出来，请稍后再打开这一页。
      </p>
    );
  }

  const range = weekRangeLabel(plan.weekStart, plan.weekEnd);
  const band = ageBandLabel(plan.ageKey);
  const ageSplit = plan.ageMonth !== plan.reportAgeMonth;

  const serviceButtons = (
    <div className="flex flex-wrap gap-2 pt-1">
      {serviceTypeDescriptors().map(d => (
        <button
          key={d.type}
          type="button"
          onClick={() => onBookService(d.type)}
          className="px-3 py-2 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-[11px] font-bold transition active:scale-[0.99] cursor-pointer text-left flex items-center gap-1.5"
        >
          <UserRound size={12} className="shrink-0" />
          {d.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
          <CalendarDays size={15} className="shrink-0" />
          这一周的活动{range && <span className="font-bold text-brand-charcoal/60">（{range}）</span>}
        </h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          按孩子现在 {plan.ageMonth} 个月{band && `、${band}这一段`}安排。
          {ageSplit && `${AGE_SPLIT_NOTE}（答题时 ${plan.reportAgeMonth} 个月）。`}
        </p>
      </div>

      {plan.activities.length === 0 ? (
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
          这一周还没有排得上的活动。下面可以先约专家聊聊这一周在家可以做什么。
        </p>
      ) : (
        <ul className="space-y-3">
          {plan.activities.map(({ activity, dimension, reason }) => {
            const open = openSteps[activity.id] === true;
            return (
              <li key={activity.id} className="rounded-2xl border border-brand-moss/20 bg-white/70 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-brand-forest">{activity.title}</p>
                    <p className="text-[10px] font-bold text-brand-moss">{SITE_DIMENSION_NAME[dimension]}</p>
                  </div>
                  {activity.durationMin > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-brand-charcoal/60">
                      <Clock size={11} />
                      约 {activity.durationMin} 分钟
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-brand-charcoal/75 leading-relaxed">
                  {reasonSentence(dimension, reason)}
                  {reason.belowWindow && `${BELOW_WINDOW_NOTE}。`}
                </p>

                {activity.equipment.length > 0 && (
                  <p className="text-[10px] text-brand-charcoal/60 flex items-start gap-1.5">
                    <Package size={11} className="shrink-0 mt-0.5" />
                    <span>要准备：{activity.equipment.join('、')}</span>
                  </p>
                )}

                {activity.steps.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenSteps(prev => ({ ...prev, [activity.id]: !open }))}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-forest hover:text-brand-moss transition cursor-pointer"
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      怎么做（{activity.steps.length} 步）
                    </button>
                    {open && (
                      <ol className="mt-2 space-y-2">
                        {activity.steps.map((step, i) => (
                          <li key={`${activity.id}-${i}`} className="flex items-start gap-2.5">
                            <img
                              src={step.imageUrl}
                              alt=""
                              loading="lazy"
                              className="w-16 h-16 rounded-xl object-cover border border-brand-moss/15 shrink-0 bg-brand-sage/10"
                            />
                            <p className="text-[11px] text-brand-charcoal/80 leading-relaxed pt-0.5">
                              <span className="font-bold text-brand-moss mr-1">{i + 1}.</span>
                              {step.instruction}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {activity.videoUrl && (
                  <a
                    href={activity.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-forest hover:text-brand-moss transition"
                  >
                    <PlayCircle size={12} />
                    看示范
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {plan.preparing.length > 0 && (
        <div className="rounded-2xl border border-brand-moss/20 bg-brand-sage/10 p-3.5 space-y-2">
          <p className="text-[11px] text-brand-charcoal/75 leading-relaxed">
            「{plan.preparing.map(d => SITE_DIMENSION_NAME[d]).join('、')}」{PREPARING_SENTENCE}。
          </p>
          {serviceButtons}
        </div>
      )}
    </div>
  );
}

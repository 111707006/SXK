/**
 * 計劃頁（Keep 規格 §3.2）：蓋在報告上的第一層，從報告入口的計劃大卡點進來。
 *
 * 版面照樣品的 `PlanScreen`（Keep「腹肌撕裂計劃」往下滑那一頁）：頭 → 我的计划安排 → 这周练哪几块 →
 * 我的评估结果 → 本周活动 → 家长最常问的四件事 → STEP 1–4 → 约专家 → 底部固定列。
 *
 * 【資料】
 * - 第幾週：每週活動回應的 `plan`（§4.5，伺服器算）；過了 12 週寫「已满 12 周，建议再评估一次」。
 * - 本週四支、佔比、「本周练：……」：每週活動那一份。
 * - 評估結果：報告快照（`resultSummary`，狀態經 `dimensionStatus` → `statusWording.ts`）。
 * - 已練幾次、x/4、12 週的打卡格：打卡（`practiceStats.ts`）；讀不出來時這些數字整個不出。
 * - 四種服務：`serviceChoices()` 並列（2026-09-29）→ 線上諮詢說明開既有的預約表，线上干预训练指导就是這一頁，其餘「暂未开放」。
 *
 * 【改過的地方】樣品寫 4 週的全改 12 週；「难度 入门」換成「从做得到的开始」；STEP 3 第三條不再說
 * 「下周安排会参考」（配對不看心情）；頭圖、常見問題的人像不上（來源與授權不明，§9 第 4 題）。
 */
import { useRef, type ReactNode } from 'react';
import { ChevronRight, CircleCheck, Clock, Crown, MessagesSquare, Play, UserRound } from 'lucide-react';
import { STATUS_WORDING } from '../../utils/statusWording';
import { ServiceNote, serviceChoices } from '../serviceChoices';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { dimensionStatus } from '../../t2/reportCopy';
import { weekRangeLabel } from '../../t2/weeklyCopy';
import {
  CLIP_STATE,
  ENTRY,
  MOOD_LABEL,
  PLAN_PAGE,
  WEEKDAYS,
  itemCount,
  othersLabel,
  othersValue,
  planGreeting,
  planTitle,
  planWeekLabel,
  practicedBadge,
  thisWeekPractice,
} from '../../t2/trainingCopy';
import { CHECKIN_MOODS } from '../../t2/practice';
import type { AssessmentStatus } from '../../types';
import type { DimensionCode, DimensionFinding } from '../../t2/types';
import { useTraining } from './TrainingContext';
import {
  dimensionShares,
  hasClip,
  nextToStart,
  planGrid,
  planPositionOf,
  pushPositionOf,
  resultSummary,
  staircaseStage,
  type PushPosition,
  type WeeklyPick,
} from './trainingData';
import { PUSH_PAGE, VARIANT_LABEL, abilityRow, guidanceLines, referralLine } from '../../t2/pushCopy';
import { Cover, DarkNav, StepImage } from './ui';

/**
 * 三級的字色與儀表的色，與報告九宮格同一組（綠／黃／紅，ADR-0007）。沒有判定的照 `dimensionStatus` 的
 * `tone`：沒做的帶 T1 的紅／黃、`no_tool` 是灰（v2.1 S02），與九宮格同一個出口。
 */
const STATUS_TEXT: Record<AssessmentStatus | 'state', string> = {
  normal: 'text-emerald-700',
  borderline: 'text-amber-700',
  delay: 'text-rose-700',
  state: 'text-brand-charcoal/60',
};

/** 佔比條的色：品牌色依序取（維度沒有固定色，四支最多四塊）。 */
const SHARE_BAR = ['bg-brand-forest', 'bg-brand-moss', 'bg-brand-clay', 'bg-brand-charcoal/40'];

function statusText(d: DimensionFinding, ageMonth: number): string {
  const s = dimensionStatus(d, ageMonth);
  return STATUS_TEXT[s.kind === 'band' ? s.status : s.tone];
}

function titlesOf(picks: ReadonlyArray<WeeklyPick>, dimension: DimensionCode): string[] {
  return picks.filter(p => p.dimension === dimension).map(p => p.activity.title);
}

function ShareBar({ picks }: { picks: ReadonlyArray<WeeklyPick> }) {
  const parts = dimensionShares(picks);
  return (
    <div>
      <div className="mt-3 flex gap-1.5">
        {parts.map((x, i) => (
          <span key={x.dimension} className={`h-3 rounded-full ${SHARE_BAR[i % SHARE_BAR.length]}`} style={{ flexGrow: x.count }} />
        ))}
      </div>
      <div className="mt-2.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, parts.length)}, minmax(0, 1fr))` }}>
        {parts.map((x, i) => (
          <div key={x.dimension} className={i === 0 ? '' : i === parts.length - 1 ? 'text-right' : 'text-center'}>
            <p className="text-[13px] font-bold text-brand-forest">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${SHARE_BAR[i % SHARE_BAR.length]}`} />
              <span className="tabular-nums">{x.percent}%</span> {SITE_DIMENSION_NAME[x.dimension]}
            </p>
            <p className="text-[11px] text-brand-charcoal/55 mt-0.5">{x.titles.join('、')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keep 的半圓儀表：三段是三級，段上寫這份報告有幾項落在那一級。 */
function Gauge({ counts, focus, focusNote, ageMonth }: {
  counts: Record<AssessmentStatus, number>;
  focus: DimensionFinding | null;
  focusNote: string;
  ageMonth: number;
}) {
  const cx = 150;
  const cy = 150;
  const r = 110;
  const pt = (deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  const arc = (a1: number, a2: number) => {
    const [x1, y1] = pt(a1);
    const [x2, y2] = pt(a2);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const segs = [
    { a1: 180, a2: 123, n: counts.normal, stroke: 'stroke-emerald-200', fill: 'fill-emerald-800' },
    { a1: 119, a2: 61, n: counts.borderline, stroke: 'stroke-amber-200', fill: 'fill-amber-800' },
    { a1: 57, a2: 0, n: counts.delay, stroke: 'stroke-rose-300', fill: 'fill-rose-900' },
  ];
  const focusStatus = focus ? dimensionStatus(focus, ageMonth) : null;
  return (
    // 桌機上報告那一欄有 768px，儀表跟著撐滿會比整個螢幕還高；上限約一支手機的寬
    <div className="relative max-w-[360px] mx-auto">
      <svg viewBox="0 0 300 160" className="w-full" aria-hidden="true">
        {segs.map(s => (
          <path key={s.a1} d={arc(s.a1, s.a2)} className={s.stroke} strokeWidth={46} fill="none" />
        ))}
        {segs.map(s => {
          const [x, y] = pt((s.a1 + s.a2) / 2);
          return (
            <text key={`t${s.a1}`} x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" className={s.fill}>
              {itemCount(s.n)}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center px-10">
        {focus && focusStatus ? (
          <p className="text-[14px] text-brand-charcoal">
            {SITE_DIMENSION_NAME[focus.dimensionId]} <b className={`text-[17px] ${statusText(focus, ageMonth)}`}>{focusStatus.label}</b>
          </p>
        ) : (
          <p className="text-[14px] text-brand-charcoal">{othersValue(counts.normal, STATUS_WORDING.normal.label)}</p>
        )}
        {focusNote && <p className="mt-0.5 text-[12px] text-brand-charcoal/55 truncate">{focusNote}</p>}
      </div>
    </div>
  );
}

function ResultCard({ label, value, valueClass, note }: { label: string; value: string; valueClass: string; note: string }) {
  return (
    <div className="rounded-xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-3">
      <p className="text-[13px] text-brand-charcoal leading-snug">
        {label} <b className={`text-[15px] ${valueClass}`}>{value}</b>
      </p>
      {note && <p className="mt-1.5 text-[12px] text-brand-charcoal/55 leading-snug">{note}</p>}
    </div>
  );
}

function StepBlock({ n, title, children, anchor }: { n: number; title: string; children: ReactNode; anchor: (el: HTMLElement | null) => void }) {
  return (
    <section ref={anchor} className="bg-white mt-2 pt-7 pb-6 scroll-mt-2">
      <p className="text-center text-[15px] tracking-[0.06em] text-brand-charcoal/60">STEP {n}</p>
      <h3 className="text-center text-[21px] font-bold text-brand-forest mt-1 px-4">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * STEP 1：按月的階梯（第 1 个月先熟悉……第 12 周末再评估）。「你在这里」照第幾週。
 * v3（`push`）時前三階的字換成本月做法（简单版 → 标准做法 → 难一点，客戶第七節）。
 */
function Staircase({ weekIndex, push }: { weekIndex: number; push: boolean }) {
  const here = staircaseStage(weekIndex);
  const heights = [64, 94, 124, 154];
  const stairs = push
    ? PLAN_PAGE.staircase.map((w, i) => (i < PUSH_PAGE.staircase.length ? { ...w, ...PUSH_PAGE.staircase[i] } : w))
    : PLAN_PAGE.staircase;
  return (
    <div className="mx-4 h-[250px] flex items-end gap-2">
      {stairs.map((w, i) => {
        const now = i === here;
        const last = i === stairs.length - 1;
        return (
          <div key={w.t1} className="flex-1 flex flex-col items-center justify-end">
            {last && <Crown size={18} className="text-brand-clay mb-1" />}
            {now && <span className="mb-1 text-[11px] font-bold text-brand-forest">{PLAN_PAGE.youAreHere}</span>}
            <span
              className={`w-12 h-12 rounded-full grid place-items-center text-white leading-none ${
                now ? 'bg-brand-moss ring-4 ring-brand-moss/25' : 'bg-brand-forest'
              }`}
            >
              <span className="text-center">
                <span className="block tabular-nums text-[16px] font-bold">{w.n}</span>
                <span className="block text-[9px] mt-0.5">{w.unit}</span>
              </span>
            </span>
            <div
              className="mt-2 w-full rounded-t-lg bg-gradient-to-b from-brand-stone/70 to-brand-cream flex flex-col items-center pt-2.5 text-center"
              style={{ height: heights[i] }}
            >
              <p className="text-[13px] text-brand-forest font-bold">{w.t1}</p>
              <p className="text-[11px] text-brand-charcoal/60 mt-0.5 px-1">{w.t2}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * v3 的能力表（規格 P17、§5.3、§5.4）：這一期哪幾塊、各自的狀態與來源（按深度评估／按筛查推估）、每月幾個、
 * 這個月練幾個月的內容；有「需要较多支持」的加一句約專家；上一期調整過的說一句；底下是怎麼帶最有效。
 */
function AbilityTable({ push }: { push: PushPosition }) {
  const heavy = push.dimensions.filter(d => d.color === 'red').map(d => d.dimension);
  return (
    <section className="bg-white px-4 pt-3 pb-5" data-testid="plan-abilities">
      <h3 className="text-[19px] font-bold text-brand-forest">{PUSH_PAGE.abilityTitle}</h3>
      <p className="mt-1 text-[12px] text-brand-charcoal/55">{PUSH_PAGE.abilitySub}</p>
      {push.adjustment !== 'none' && (
        <p className="mt-2 rounded-lg bg-brand-sage px-3 py-2 text-[13px] text-brand-forest" data-testid="plan-adjusted">
          {PUSH_PAGE.adjusted[push.adjustment]}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {push.dimensions.map(d => {
          const row = abilityRow(d);
          return (
            <li key={d.dimension} className="rounded-xl bg-brand-cream px-3 py-2.5">
              <p className="text-[14px] font-bold text-brand-forest">
                {row.title}
                <span className="ml-1.5 text-[11px] font-normal text-brand-charcoal/55">{row.source}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-brand-charcoal/65">{row.detail}</p>
            </li>
          );
        })}
      </ul>
      {heavy.length > 0 && (
        <p className="mt-3 text-[13px] text-brand-charcoal/75 leading-relaxed" data-testid="plan-referral">
          {referralLine(heavy)}
        </p>
      )}
      {push.dimensions.some(d => d.source === 't1') && (
        <p className="mt-2 text-[12px] text-brand-charcoal/60 leading-relaxed" data-testid="plan-t1-evidence">{PUSH_PAGE.t1Evidence}</p>
      )}
      <h4 className="mt-4 text-[15px] font-bold text-brand-forest">{PUSH_PAGE.guidanceTitle}</h4>
      <ul className="mt-2 space-y-1.5">
        {guidanceLines(push.perWeek).map(line => (
          <li key={line} className="flex items-start gap-2 text-[13px] text-brand-charcoal/80 leading-relaxed">
            <CircleCheck size={15} className="text-brand-moss shrink-0 mt-0.5" />
            {line}
          </li>
        ))}
      </ul>
      <h4 className="mt-4 text-[15px] font-bold text-brand-forest">{PUSH_PAGE.periodEndTitle}</h4>
      <ul className="mt-2 space-y-1.5" data-testid="plan-period-end">
        {PUSH_PAGE.periodEndRows.map(r => (
          <li key={r.when} className="rounded-lg bg-brand-cream/70 px-3 py-2 text-[13px] text-brand-charcoal/80 leading-relaxed">
            <span className="font-bold text-brand-forest">{r.when}：</span>{r.then}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-brand-charcoal/60 leading-relaxed">{PUSH_PAGE.periodEndNote}</p>
      <p className="mt-3 text-[11px] text-brand-charcoal/50 leading-relaxed" data-testid="plan-boundary">{PUSH_PAGE.boundary}</p>
    </section>
  );
}

/** STEP 2：三支示意小手機（動作列表、活動、打卡日曆），用本週第一支活動的真內容。 */
function MiniPhones({ pick }: { pick: WeeklyPick }) {
  const a = pick.activity;
  return (
    <div className="relative h-[270px] overflow-hidden" aria-hidden="true">
      <div className="absolute left-[6%] top-12 w-[118px] h-[210px] rounded-[20px] border-[5px] border-brand-forest bg-white overflow-hidden -rotate-6 opacity-90 shadow-lg">
        <p className="px-2 pt-2 text-[10px] font-black text-brand-forest">{PLAN_PAGE.phoneActions}</p>
        {a.steps.slice(0, 4).map((s, i) => (
          <div key={i} className="px-2 mt-1.5 flex items-center gap-1.5">
            <StepImage src={s.imageUrl} n={i + 1} className="w-9 h-6 rounded-sm shrink-0 [&>span]:text-[11px]" />
            <p className="text-[7px] text-brand-charcoal leading-tight line-clamp-2">{s.instruction}</p>
          </div>
        ))}
      </div>
      <div className="absolute right-[6%] top-12 w-[118px] h-[210px] rounded-[20px] border-[5px] border-brand-forest bg-white overflow-hidden rotate-6 opacity-90 shadow-lg p-2">
        <p className="text-[10px] font-black text-brand-forest">{PLAN_PAGE.phoneCalendar}</p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={`aspect-square rounded-full ${[1, 2, 4, 8, 9, 11, 15, 16].includes(i) ? 'bg-brand-moss' : 'bg-brand-cream'}`} />
          ))}
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[158px] h-[290px] rounded-[26px] border-[6px] border-brand-forest bg-white overflow-hidden shadow-2xl">
        <Cover src={a.posterUrl} className="h-[92px]">
          {!a.posterUrl && <Play size={34} className="absolute inset-0 m-auto text-brand-moss/40" />}
        </Cover>
        <div className="p-2.5">
          <p className="text-[11px] font-black leading-tight text-brand-forest">{[a.title, a.people].filter(Boolean).join(' · ')}</p>
          {a.ageLabel && <p className="mt-1.5 text-[9px] text-brand-charcoal/60">{a.ageLabel}</p>}
          {a.trains && (
            <div className="mt-2 rounded-md bg-brand-cream p-1.5 text-[7px] text-brand-charcoal/80 leading-snug line-clamp-3">
              {PLAN_PAGE.phoneTrainsPrefix}
              {a.trains}
            </div>
          )}
          <div className="mt-3 mx-auto w-12 h-12 rounded-full bg-brand-moss text-white text-[16px] font-black italic grid place-items-center">GO</div>
        </div>
      </div>
    </div>
  );
}

/** STEP 4：12 週的打卡格。練過的日子實心、今天外框、最後一格是再評估。打卡讀不出來時不畫練過的日子。 */
function PlanWeekGrid({ firstWeekStart, today, practiced }: { firstWeekStart: string; today: string; practiced: ReadonlySet<string> | null }) {
  const grid = planGrid(firstWeekStart);
  return (
    <div className="mx-4">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-brand-charcoal/50">
        {WEEKDAYS.map(d => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {grid.map((week, w) => (
        <div key={week[0]} className="mt-1.5 grid grid-cols-7 gap-1.5">
          {week.map((iso, d) => {
            const done = practiced?.has(iso) ?? false;
            const last = w === grid.length - 1 && d === 6;
            return (
              <span
                key={iso}
                data-day={iso}
                data-done={done || undefined}
                className={`aspect-square max-h-11 rounded-full grid place-items-center text-[11px] tabular-nums mx-auto w-full max-w-11 ${
                  done
                    ? 'bg-brand-forest text-white'
                    : last
                      ? 'bg-brand-sand text-brand-clay'
                      : iso === today
                        ? 'ring-2 ring-brand-moss text-brand-forest'
                        : 'border border-dashed border-brand-stone text-brand-charcoal/35'
                }`}
              >
                {last && !done ? <Crown size={13} /> : Number(iso.slice(8))}
              </span>
            );
          })}
        </div>
      ))}
      {practiced && <p className="mt-3 text-center text-[12px] text-brand-charcoal/55">{PLAN_PAGE.step4Caption}</p>}
    </div>
  );
}

export default function PlanScreen() {
  const { data, nav, findings, childName, onBookService, onReassess } = useTraining();
  const steps = useRef<Array<HTMLElement | null>>([]);
  const plan = data.plan;
  if (!plan) {
    // 前進鍵把計劃頁開回來、而資料還在讀或讀不出來：留著導覽列與一句話，不給一整片白
    return (
      <div className="h-full flex flex-col bg-brand-cream" data-testid="training-plan">
        <DarkNav title={planTitle(childName)} onBack={nav.back} />
        <p className="mx-6 mt-10 text-[14px] text-brand-charcoal/70 leading-relaxed">
          {data.status === 'loading' ? ENTRY.loading : ENTRY.error}
        </p>
      </div>
    );
  }

  const position = planPositionOf(plan);
  const push = pushPositionOf(plan);
  const practice = data.practice;
  const picks = plan.activities;
  const next = nextToStart(picks, practice ? practice.timesByActivity : null);
  const summary = resultSummary(findings);
  const ageMonth = findings.child.assessedAgeMonth;
  const focus = summary.flagged[0] ?? null;
  const focusTitles = focus ? titlesOf(picks, focus.dimensionId) : [];
  const practicedDays = data.checkins ? new Set(data.checkins.map(c => c.checkinDate)) : null;
  const range = weekRangeLabel(plan.weekStart, plan.weekEnd);

  const noteFor = (dimension: DimensionCode) => {
    const titles = titlesOf(picks, dimension);
    if (titles.length > 0) return thisWeekPractice(titles);
    return plan.preparing.includes(dimension) ? PLAN_PAGE.preparingNote : '';
  };

  return (
    <div className="h-full flex flex-col bg-brand-cream" data-testid="training-plan">
      <DarkNav
        title={planTitle(childName)}
        onBack={nav.back}
        right={onReassess ? PLAN_PAGE.reassess : undefined}
        onRight={onReassess}
      />
      <div className="flex-1 overflow-y-auto training-no-scrollbar pb-28">
        {/* 頭（樣品的頭圖不上：沒有圖就是深綠底） */}
        <div className="relative bg-brand-forest text-white overflow-hidden">
          <CircleCheck size={180} aria-hidden="true" className="absolute -right-10 -top-6 text-white/5" />
          <div className="relative px-4 pt-3 pb-6">
            <p className="text-[15px] font-bold">{planGreeting(childName)}</p>
            <p className="mt-1.5 text-[31px] font-black tracking-tight leading-none">{PLAN_PAGE.heading}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/85">
              {PLAN_PAGE.checks.map(t => (
                <span key={t} className="flex items-center gap-1">
                  <CircleCheck size={12} />
                  {t}
                </span>
              ))}
              <span className="ml-auto text-white/70" data-testid="plan-week">
                {planWeekLabel(position)}
                {push ? PUSH_PAGE.periodSuffix(push.periodNo) : ''}
              </span>
            </div>
          </div>
        </div>

        {/* 我的计划安排 */}
        <section className="bg-white px-4 pt-5 pb-5">
          <h3 className="text-[19px] font-bold text-brand-forest">{PLAN_PAGE.arrangeTitle}</h3>
          <div className="mt-3 -mx-4 px-4 flex gap-3 overflow-x-auto training-no-scrollbar snap-x">
            {PLAN_PAGE.arrange.map((c, i) => (
              <div key={c.label} className="snap-start shrink-0 w-[164px] rounded-xl bg-white shadow-[0_2px_14px_rgba(0,0,0,0.08)] p-4">
                <p className="text-[13px] text-brand-charcoal/80 flex items-center gap-1">
                  {c.label}
                  {i === 0 && <Clock size={14} className="text-brand-moss" />}
                </p>
                <p className="mt-2 text-brand-forest">
                  <span className="text-[30px] font-black tabular-nums leading-none">{c.big}</span>
                  {c.unit && <span className="text-[13px] font-bold ml-1">{c.unit}</span>}
                </p>
                <p className="mt-2 text-[12px] text-brand-charcoal/60 whitespace-pre-line leading-snug">{c.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* v3：这一期练哪几块（能力表、约专家那一句、怎么带最有效） */}
        {push && <AbilityTable push={push} />}

        {/* 这周练哪几块 */}
        {picks.length > 0 && (
          <section className="bg-white px-4 pt-3 pb-5">
            <h3 className="text-[19px] font-bold text-brand-forest">{PLAN_PAGE.sharesTitle}</h3>
            <ShareBar picks={picks} />
          </section>
        )}

        {/* 我的评估结果（報告快照） */}
        <section className="bg-white px-4 pt-3 pb-5">
          <h3 className="text-[19px] font-bold text-brand-forest">{PLAN_PAGE.resultsTitle}</h3>
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-brand-sage via-white to-brand-sand px-4 pt-4 pb-3">
            <Gauge
              counts={summary.counts}
              focus={focus}
              focusNote={focusTitles.length > 0 ? thisWeekPractice(focusTitles) : ''}
              ageMonth={ageMonth}
            />
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-brand-charcoal/70">
              {(['normal', 'borderline', 'delay'] as const).map(s => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${s === 'normal' ? 'bg-emerald-300' : s === 'borderline' ? 'bg-amber-300' : 'bg-rose-400'}`} />
                  {STATUS_WORDING[s].label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {summary.flagged.map(d => (
              <ResultCard
                key={d.dimensionId}
                label={SITE_DIMENSION_NAME[d.dimensionId]}
                value={dimensionStatus(d, ageMonth).label}
                valueClass={statusText(d, ageMonth)}
                note={noteFor(d.dimensionId)}
              />
            ))}
            {summary.others.total > 0 && (
              <ResultCard
                label={othersLabel(summary.others.total)}
                value={othersValue(summary.others.stable, STATUS_WORDING.normal.label)}
                valueClass={STATUS_TEXT.normal}
                note={summary.others.unjudged.map(d => `${SITE_DIMENSION_NAME[d.dimensionId]}：${dimensionStatus(d, ageMonth).label}`).join('、')}
              />
            )}
          </div>
          <button type="button" onClick={() => nav.popTo(0)} className="mt-4 mx-auto text-[13px] text-brand-charcoal/60 flex items-center cursor-pointer">
            {PLAN_PAGE.fullReport}
            <ChevronRight size={14} />
          </button>
        </section>

        {/* 本周活动 */}
        <section className="bg-white mt-2 px-4 pt-5 pb-5">
          <div className="flex items-end justify-between gap-2">
            <h3 className="text-[19px] font-bold text-brand-forest">{PLAN_PAGE.weekTitle}</h3>
            {range && <span className="text-[12px] text-brand-charcoal/50">{range}</span>}
          </div>
          <ul className="mt-4 space-y-3.5">
            {picks.map(({ activity: a, dimension, push: mark }) => {
              const n = practice?.timesByActivity[a.id] ?? 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => nav.openPage({ name: 'detail', id: a.id, from: 'plan' })}
                    className="w-full flex items-center gap-3 text-left cursor-pointer"
                  >
                    <Cover src={a.posterUrl} className="w-[96px] h-[66px] rounded-lg shrink-0">
                      {!a.posterUrl && <Play size={26} aria-hidden="true" className="absolute inset-0 m-auto text-brand-moss/30" />}
                      {hasClip(a) && (
                        <span className="absolute left-1 bottom-1 rounded bg-black/60 text-white text-[10px] px-1 py-px flex items-center gap-0.5">
                          <Play size={9} fill="currentColor" />
                          {CLIP_STATE.badgeClip}
                        </span>
                      )}
                    </Cover>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-bold text-brand-forest truncate">{a.title}</p>
                      <p className="mt-1 text-[12px] text-brand-charcoal/55 truncate">
                        {[SITE_DIMENSION_NAME[dimension], mark ? VARIANT_LABEL[mark.variant] : '', a.trains].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {n > 0 ? (
                      <span className="shrink-0 text-[12px] font-bold text-brand-forest bg-brand-sage rounded-full px-2.5 py-1">{practicedBadge(n)}</span>
                    ) : (
                      <span className="shrink-0 text-[12px] text-brand-charcoal/70 border border-brand-stone rounded-full px-2.5 py-1">{PLAN_PAGE.go}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 家长最常问的四件事：四個問題當目錄（常見問題的人像不上） */}
        <section className="bg-white mt-2 pt-8 pb-4">
          <p className="text-center text-[14px] font-semibold tracking-[0.08em] text-brand-charcoal/70">{PLAN_PAGE.faqKicker}</p>
          <h3 className="text-center text-[25px] font-black text-brand-forest mt-1">{PLAN_PAGE.faqTitle}</h3>
          <div className="relative mt-4 h-[260px] mx-4">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-brand-sage grid place-items-center">
              <MessagesSquare size={64} aria-hidden="true" className="text-brand-moss" />
            </div>
            {PLAN_PAGE.faq.map((q, i) => {
              const right = i % 2 === 1;
              const pos = ['left-0 top-5', 'right-0 top-5', 'left-0 bottom-7', 'right-0 bottom-7'][i];
              return (
                <button
                  key={q.main}
                  type="button"
                  onClick={() => steps.current[q.step]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`absolute ${pos} ${right ? 'text-right' : 'text-left'} cursor-pointer`}
                >
                  <span className="block text-[12px] text-brand-charcoal/70">{q.sub}</span>
                  <span className="block text-[16px] font-bold text-brand-forest bg-white/80 rounded px-0.5">{q.main}</span>
                  <span className={`block mt-1 h-px w-[96px] bg-brand-charcoal/60 ${right ? 'ml-auto' : ''}`} />
                </button>
              );
            })}
          </div>
        </section>

        <StepBlock n={1} title={PLAN_PAGE.steps[0]} anchor={el => { steps.current[0] = el; }}>
          <Staircase weekIndex={position.weekIndex} push={push !== null} />
        </StepBlock>
        <StepBlock n={2} title={PLAN_PAGE.steps[1]} anchor={el => { steps.current[1] = el; }}>
          {picks[0] && <MiniPhones pick={picks[0]} />}
        </StepBlock>
        <StepBlock n={3} title={PLAN_PAGE.steps[2]} anchor={el => { steps.current[2] = el; }}>
          <ul className="mx-6 space-y-3">
            {PLAN_PAGE.step3.map(t => (
              <li key={t} className="flex items-start gap-2 text-[14px] text-brand-charcoal">
                <CircleCheck size={18} className="text-brand-moss shrink-0 mt-px" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
            {CHECKIN_MOODS.map((m, i) => (
              <span
                key={m}
                className={`px-3 py-1.5 rounded-full text-[13px] ${i === 0 ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-charcoal/80'}`}
              >
                {MOOD_LABEL[m]}
              </span>
            ))}
          </div>
        </StepBlock>
        <StepBlock n={4} title={PLAN_PAGE.steps[3]} anchor={el => { steps.current[3] = el; }}>
          <PlanWeekGrid firstWeekStart={position.firstWeekStart} today={data.today} practiced={practicedDays} />
        </StepBlock>

        {/* 有疑问 随时约专家：四種服務 → 既有的預約表 */}
        <section className="bg-white mt-2 px-4 pt-6 pb-8">
          <h3 className="text-[19px] font-bold text-brand-forest">{PLAN_PAGE.expertTitle}</h3>
          <p className="mt-1 text-[13px] text-brand-charcoal/55">{PLAN_PAGE.expertSub}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {serviceChoices({ book: onBookService, inTraining: true }).map(c => (
              <button
                key={c.descriptor.type}
                type="button"
                disabled={!c.onSelect}
                onClick={c.onSelect ?? undefined}
                className={`rounded-xl bg-brand-cream px-3 py-3 text-left cursor-pointer disabled:cursor-default ${
                  c.state === 'soon' ? 'disabled:opacity-50' : ''
                }`}
              >
                <p className="text-[14px] font-bold text-brand-forest flex items-center gap-1">
                  <UserRound size={13} className="shrink-0 text-brand-moss" />
                  {c.descriptor.label}
                </p>
                <p className="mt-1 text-[11px] text-brand-charcoal/55 leading-snug line-clamp-2">{c.description}</p>
                <ServiceNote state={c.state} className="mt-1.5 text-brand-moss" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 底部固定列：本周练过的活动 x/N（舊週次 4、v3 每週 3 或 2）＋ 开始今天的活动 */}
      {next && (
        <div className="absolute bottom-0 inset-x-0 bg-white border-t border-black/5 px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] flex items-center gap-4">
          {practice && (
            <div className="leading-tight" data-testid="plan-practiced">
              <p className="text-[22px] font-black text-brand-forest tabular-nums">
                {practice.planPracticed}/{practice.planTotal}
              </p>
              <p className="text-[11px] text-brand-charcoal/55">{PLAN_PAGE.barLabel}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => nav.openPage({ name: 'detail', id: next.activity.id, from: 'plan' })}
            className="flex-1 h-12 rounded-full bg-gradient-to-r from-brand-sand to-brand-clay text-brand-forest font-bold text-[16px] cursor-pointer active:scale-[0.99] transition"
          >
            {PLAN_PAGE.start}
          </button>
        </div>
      )}
    </div>
  );
}

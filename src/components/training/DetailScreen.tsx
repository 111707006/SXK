/**
 * 活動詳情（Keep 規格 §3.3，票 7）：取代票 6 的簡單版。
 *
 * 版面照樣品的 `DetailScreen`（Keep 課程詳情：大圖、系列列、標題、數字列、四個圖示、往下是內容、
 * 底部「跟练方式／GO／要准备」）。**資料重寫**：
 * - 內容：活動庫的欄位（手冊的练什么／需要什么／简单／难一点／小提醒、腳本 `guide`、步驟、
 *   示範片與封面），經 `useActivity` 從每週活動那一份或單支讀取拿到，照原文顯示。
 * - 「为什么这周排这一个」：本週四支用配對的理由（`reasonSentence`＋往前取的那句），換著玩用
 *   `swapReason`，片庫的一支用 `libraryReason`；「为什么练{維度}」是 `DIMENSION_WHY`。
 * - 已練幾次：打卡（`practiceStats`）；讀不出來時不寫數字。
 *
 * 【有腳本才有的幾區】開場白、原理、孩子卡住了怎麼辦、大人常做錯的三件事、邊做邊說。2026-10-06 起客戶總冊
 * 300 支都有；`guide` 是 `null`（內容遷移還沒跑、後台新增的）時那幾區整個不出（不是空的標題）。
 *
 * 【大圖】有示範片：靜音、自動、循環播（`playsinline` 三種寫法都加，微信 X5 認的是 `x5-playsinline`）；
 * **進入畫面、而且這一頁在最上面時才載片**（§6.3）：詳情上面蓋著播放器時，這一支不在背後偷偷播。
 * 沒有片：封面（沒有封面就是淡綠底）＋「示范片制作中」。
 *
 * 【沒搬的】右上「一起练／分享／更多」、「想练」（樣品裡是 toast 佔位，§1 不做）；「难度」（活動庫沒有
 * 難度欄位，目標月齡承擔難度）；「星晨儿童康复中心」（客戶 ASQ3 檔案上的院所名，出處寫「森心康」）。
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Cast,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Lightbulb,
  ListVideo,
  Loader2,
  MessageCircle,
  Play,
  Shuffle,
  SlidersHorizontal,
  Star,
  ToyBrick,
} from 'lucide-react';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { DIMENSION_WHY } from '../../t2/report/sentences';
import { BELOW_WINDOW_NOTE, reasonSentence } from '../../t2/weeklyCopy';
import { hasReminder } from '../../t2/practice';
import { timesForActivity } from '../../t2/practiceStats';
import {
  DETAIL,
  MODULE_TITLES_SC,
  aboutMinutes,
  ageReminder,
  detailHeadline,
  expandAll,
  libraryReason,
  planTitle,
  practicedIcon,
  practicedTimes,
  reactionIf,
  splitMinutes,
  swapReason,
  whyDimension,
} from '../../t2/trainingCopy';
import type { Activity } from '../../t2/types';
import { tryNativeCast } from './device';
import { followModeFor, readFollowMode } from './followMode';
import type { DetailSource } from './layerStack';
import { useTraining } from './TrainingContext';
import { ageFit, clipClock, detailSeries, hasClip, type DetailSeries, type PlanPlace } from './trainingData';
import { useActivity, useLibraryList } from './useActivity';
import { LightNav, StepImage } from './ui';

/** 在畫面裡沒有（捲到外面、或瀏覽器沒有 IntersectionObserver 時一律當作在畫面裡）。 */
function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => setInView(entries.some(e => e.isIntersecting)), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

/**
 * 大圖裡的示範片。`preload="metadata"`；進入畫面且這一頁在最上面才給 `src`（之後不收回，只暫停）。
 * 靜音自動循環：瀏覽器只放行靜音的自動播放，`muted` 用屬性與 property 各設一次（React 只設 property，
 * 有的 WebView 看的是屬性）。
 */
function HeroClip({ clip, poster, active, videoRef }: {
  clip: string;
  poster: string | null;
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const [loaded, setLoaded] = useState(false);
  const playing = inView && active;

  useEffect(() => {
    if (playing) setLoaded(true);
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    if (!loaded) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [loaded, playing, videoRef]);

  return (
    <div ref={box} className="absolute inset-0">
      <video
        ref={videoRef}
        src={loaded ? clip : undefined}
        poster={poster ?? undefined}
        muted
        autoPlay
        loop
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
}

function ActionIcon({ icon, label, onClick, active = false }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 cursor-pointer ${active ? 'text-brand-moss' : 'text-brand-forest'}`}
    >
      {icon}
      <span className="text-[13px] text-brand-charcoal/70">{label}</span>
    </button>
  );
}

function Section({ title, icon, children, tone = 'plain' }: { title: string; icon?: ReactNode; children: ReactNode; tone?: 'plain' | 'soft' }) {
  return (
    <section className={`mx-4 mt-6 ${tone === 'soft' ? 'rounded-2xl bg-brand-sage p-4' : ''}`}>
      <h2 className="text-[18px] font-black text-brand-forest flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** 系列列（Keep「系列 … 1/10」）：本週四支、換著玩的那個維度、或示範片庫。展開可以切到同一組的另一支。 */
function SeriesRow({ series, currentId, subtitle, onPick }: {
  series: DetailSeries;
  currentId: string;
  subtitle: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = series.kind === 'plan' ? CalendarDays : series.kind === 'swap' ? Shuffle : ListVideo;
  return (
    <div className="mx-4 mt-3 rounded-md bg-brand-sage" data-testid="detail-series">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full h-11 px-3 flex items-center gap-2 text-[14px] cursor-pointer">
        <span className="text-brand-forest font-black flex items-center gap-1 shrink-0">
          <Icon size={16} />
          {DETAIL.series[series.kind]}
        </span>
        <span className="text-brand-charcoal/70 truncate">{subtitle}</span>
        <span className="ml-auto text-brand-charcoal/70 tabular-nums shrink-0">
          {series.index + 1}/{series.items.length}
        </span>
        <ChevronDown size={16} className={`text-brand-charcoal/50 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="px-3 pb-2">
          {series.items.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (x.id !== currentId) onPick(x.id);
                }}
                className={`w-full py-2 flex items-center gap-2 text-left text-[14px] cursor-pointer ${
                  x.id === currentId ? 'text-brand-forest font-bold' : 'text-brand-charcoal'
                }`}
              >
                <span className="tabular-nums w-5 text-brand-charcoal/45">{i + 1}</span>
                <span className="flex-1 truncate">{x.title}</span>
                <span className="text-[12px] text-brand-charcoal/50">{x.hasClip ? DETAIL.clipBadge : DETAIL.picturesBadge}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPage({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="h-full flex flex-col bg-white" data-testid="training-detail">
      <LightNav onBack={onBack} />
      <div className="mx-6 mt-10 text-[14px] text-brand-charcoal/70 leading-relaxed flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function DetailScreen({ id, from, active }: { id: string; from: DetailSource; active: boolean }) {
  const { data, nav } = useTraining();
  const load = useActivity(id);
  const library = useLibraryList(from === 'library');
  const { loadPrefs } = data;

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  if (load.status === 'loading') {
    return (
      <StatusPage onBack={nav.back}>
        <Loader2 size={16} className="animate-spin shrink-0" />
        {DETAIL.loading}
      </StatusPage>
    );
  }
  if (load.status !== 'ready') {
    return <StatusPage onBack={nav.back}>{load.status === 'missing' ? DETAIL.notFound : DETAIL.error}</StatusPage>;
  }
  return <DetailBody activity={load.activity} place={load.place} from={from} active={active} series={detailSeries(from, id, data.plan, library)} />;
}

function DetailBody({ activity: a, place, from, active, series }: {
  activity: Activity;
  place: PlanPlace;
  from: DetailSource;
  active: boolean;
  series: DetailSeries | null;
}) {
  const { data, nav, childName } = useTraining();
  const [allPrinciples, setAllPrinciples] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const clip = hasClip(a) ? a.videoUrl : null;
  const guide = a.guide;
  const dimension = place.pick?.dimension ?? place.swapDimension ?? a.dimensions[0] ?? null;
  const childAge = data.plan ? data.plan.ageMonth : null;
  const fit = ageFit(a.ageMonths, childAge);
  const weekTimes = data.practice ? data.practice.timesByActivity[a.id] ?? 0 : null;
  const totalTimes = data.checkins ? timesForActivity(data.checkins, a.id) : null;
  const principles = guide ? (allPrinciples ? guide.principles : guide.principles.slice(0, 3)) : [];
  const easier = guide?.down || a.easier;
  const harder = guide?.up || a.harder;
  const length = guide ? splitMinutes(guide.length) : null;
  const clock = clip ? clipClock(a.videoSeconds) : '';

  const why = place.pick
    ? `${reasonSentence(place.pick.dimension, place.pick.reason)}${place.pick.reason.belowWindow ? `${BELOW_WINDOW_NOTE}。` : ''}`
    : place.swapDimension
      ? swapReason(SITE_DIMENSION_NAME[place.swapDimension], childName)
      : libraryReason(fit, a.ageLabel, childName, childAge);

  const seriesSubtitle = !series
    ? ''
    : series.kind === 'plan'
      ? `${planTitle(childName)} · ${DETAIL.seriesPlanSub}`
      : series.kind === 'swap' && series.dimension
        ? SITE_DIMENSION_NAME[series.dimension]
        : MODULE_TITLES_SC[a.moduleNo];

  const startGo = () => nav.openPage({ name: 'go', id: a.id, from, mode: followModeFor(readFollowMode(), clip !== null) });
  const cast = () => {
    if (!clip) {
      nav.openSheet({ kind: 'cast', hasVideo: false });
      return;
    }
    void tryNativeCast(videoRef.current).then(ok => {
      if (!ok) nav.openSheet({ kind: 'cast', hasVideo: true });
    });
  };

  const tags = [DETAIL.sourceTag[from], dimension ? SITE_DIMENSION_NAME[dimension] : '', DETAIL.atHome, a.people, a.ageLabel].filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-white" data-testid="training-detail">
      <LightNav onBack={nav.back} />
      <div className="flex-1 overflow-y-auto training-no-scrollbar pb-40">
        {/* 大圖：有示範片就靜音循環播；沒有就封面＋「示范片制作中」 */}
        <div className="px-4">
          <div
            className={`relative rounded-md overflow-hidden ${
              clip || a.posterUrl ? 'aspect-[4/3.2] bg-brand-forest' : 'aspect-[16/9] bg-gradient-to-br from-brand-sage to-brand-cream'
            }`}
          >
            {clip ? (
              <HeroClip clip={clip} poster={a.posterUrl} active={active} videoRef={videoRef} />
            ) : a.posterUrl ? (
              <img src={a.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Play size={64} aria-hidden="true" className="absolute right-6 top-6 text-brand-moss/25" />
            )}
            {!clip && <span className="absolute left-3 top-3 text-[12px] px-2 py-1 rounded bg-black/55 text-white">{DETAIL.clipMaking}</span>}
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={startGo}
                className="h-11 px-3 rounded-full bg-brand-forest/90 text-brand-sand font-bold text-[15px] flex items-center gap-1.5 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                {clip ? DETAIL.goWithClip : DETAIL.goPictures}
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => nav.openSheet({ kind: 'actions', id: a.id, from })}
                className="h-11 px-4 rounded-full bg-white/80 backdrop-blur text-brand-forest font-bold text-[15px] flex items-center gap-1.5 cursor-pointer"
              >
                <ListVideo size={18} />
                {DETAIL.actions}
              </button>
            </div>
          </div>
        </div>

        {series && (
          <SeriesRow
            series={series}
            currentId={a.id}
            subtitle={seriesSubtitle}
            onPick={next => nav.replacePage({ name: 'detail', id: next, from })}
          />
        )}

        <h1 className="px-4 mt-4 text-[24px] leading-[1.3] font-black text-brand-forest">{detailHeadline(a)}</h1>
        {fit === 'tooYoung' && childAge !== null && a.ageLabel && (
          <p className="mx-4 mt-3 rounded-lg bg-brand-sand px-3 py-2 text-[13px] text-brand-charcoal leading-relaxed" data-testid="detail-age-reminder">
            {ageReminder(a.ageLabel, childName, childAge, clip !== null)}
          </p>
        )}

        {/* 數字列：片長（有腳本時）、示範片長度；本周已练 N 次 · 做完就打卡 */}
        <div className="px-4 mt-4 flex items-start gap-7">
          {length && (
            <div className="shrink-0">
              <p className="text-[26px] font-black text-brand-forest tabular-nums leading-none">{length.big}</p>
              {length.unit && <p className="mt-1.5 text-[13px] text-brand-charcoal/60">{length.unit}</p>}
            </div>
          )}
          {!guide && a.durationMin > 0 && (
            <p className="shrink-0 text-[15px] font-bold text-brand-forest pt-1">{aboutMinutes(a.durationMin)}</p>
          )}
          {clock && (
            <div className="shrink-0">
              <p className="text-[26px] font-black text-brand-forest tabular-nums leading-none">{clock}</p>
              <p className="mt-1.5 text-[13px] text-brand-charcoal/60">{DETAIL.clipSeconds}</p>
            </div>
          )}
          <div className="ml-auto rounded-md bg-brand-sage px-3 py-2 text-center">
            {weekTimes !== null && <p className="text-brand-forest font-bold text-[14px]">{practicedTimes(weekTimes)}</p>}
            <p className="text-brand-forest/70 text-[11px] mt-0.5">{DETAIL.doneThenCheckin}</p>
          </div>
        </div>

        <div className="px-4 mt-5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-brand-forest text-white grid place-items-center text-[13px] font-bold">{DETAIL.sourceMark}</span>
          <span className="text-[16px] text-brand-charcoal/80">{DETAIL.source}</span>
        </div>
        {guide?.intro && <p className="px-4 mt-3 text-[14px] leading-relaxed text-brand-charcoal/75">{guide.intro}</p>}

        <div className="px-4 mt-3 flex gap-2 overflow-x-auto training-no-scrollbar">
          {tags.map((t, i) => (
            <span key={`${i}-${t}`} className="shrink-0 h-9 px-3 rounded-md border border-brand-stone text-[14px] text-brand-charcoal/80 flex items-center gap-1">
              {i === 0 && <Star size={14} className="text-brand-clay" fill="currentColor" />}
              {t}
            </span>
          ))}
        </div>

        <div className="px-3 mt-6 grid grid-cols-4">
          <ActionIcon
            icon={<CalendarPlus size={26} />}
            label={hasReminder(data.prefs) ? DETAIL.calendarAdded : DETAIL.addCalendar}
            active={hasReminder(data.prefs)}
            onClick={() => nav.openSheet({ kind: 'calendar' })}
          />
          <ActionIcon icon={<Cast size={26} />} label={DETAIL.cast} onClick={cast} />
          <ActionIcon icon={<MessageCircle size={26} />} label={DETAIL.expert} onClick={() => nav.openSheet({ kind: 'expert' })} />
          <ActionIcon icon={<CircleCheck size={26} />} label={practicedIcon(totalTimes)} onClick={() => nav.openPage({ name: 'calendar' })} />
        </div>

        {/* 這個活動練什麼：手冊一句＋腳本的原理＋為什麼這週排它＋為什麼練這一塊 */}
        <Section title={DETAIL.trainsTitle} tone="soft">
          {a.trains && <p className="text-[15px] font-bold text-brand-forest leading-relaxed">{a.trains}</p>}
          {principles.length > 0 && (
            <ol className="mt-2.5 space-y-1.5" data-testid="detail-principles">
              {principles.map((t, i) => (
                <li key={`${i}-${t}`} className="flex gap-2 text-[13px] leading-relaxed text-brand-charcoal/80">
                  <span className="tabular-nums text-brand-moss shrink-0">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          )}
          {guide && guide.principles.length > 3 && (
            <button type="button" onClick={() => setAllPrinciples(v => !v)} className="mt-2 text-[13px] text-brand-forest flex items-center gap-0.5 cursor-pointer">
              {allPrinciples ? DETAIL.collapse : expandAll(guide.principles.length)}
              <ChevronDown size={14} className={allPrinciples ? 'rotate-180' : ''} />
            </button>
          )}
          <div className="mt-3 pt-3 border-t border-black/5 space-y-2.5 text-[13px] leading-relaxed text-brand-charcoal/75">
            <p>
              <b className="text-brand-charcoal">{place.pick ? DETAIL.whyPlan : DETAIL.whyOther}</b>
              {why}
            </p>
            {dimension && (
              <p>
                <b className="text-brand-charcoal">{whyDimension(SITE_DIMENSION_NAME[dimension])}</b>
                {DIMENSION_WHY[dimension]}
              </p>
            )}
          </div>
        </Section>

        {a.steps.length > 0 && (
          <Section title={DETAIL.stepsTitle}>
            <ol className="space-y-3">
              {a.steps.map((step, i) => (
                <li key={`${a.id}-${i}`} className="flex gap-3 items-center">
                  <StepImage src={step.imageUrl} n={i + 1} className="w-[76px] h-[52px] rounded-lg shrink-0" />
                  <p className="text-[14px] text-brand-charcoal leading-snug">{step.instruction}</p>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => nav.openSheet({ kind: 'actions', id: a.id, from })}
              className="mt-3 text-[13px] text-brand-charcoal/60 flex items-center cursor-pointer"
            >
              {guide && guide.shots.length > 0 ? DETAIL.stepsMoreWithSay : DETAIL.stepsMore}
              <ChevronRight size={14} />
            </button>
          </Section>
        )}

        {guide && guide.reactions.length > 0 && (
          <Section title={DETAIL.reactionsTitle}>
            <ul className="space-y-2.5" data-testid="detail-reactions">
              {guide.reactions.map((r, i) => (
                <li key={`${i}-${r.if}`} className="rounded-xl bg-brand-cream p-3">
                  <p className="text-[14px] font-bold text-brand-forest">{reactionIf(r.if)}</p>
                  <p className="mt-1 text-[13px] text-brand-charcoal/75 leading-relaxed">{r.then}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {guide && guide.mistakes.length > 0 && (
          <Section title={DETAIL.mistakesTitle}>
            <ol className="space-y-2" data-testid="detail-mistakes">
              {guide.mistakes.map((m, i) => (
                <li key={`${i}-${m}`} className="flex gap-2 text-[13px] leading-relaxed text-brand-charcoal/80">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-sand text-brand-clay grid place-items-center text-[11px] font-bold">{i + 1}</span>
                  {m}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {(easier || harder) && (
          <Section title={DETAIL.levelTitle}>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-brand-sage p-3">
                <p className="text-[13px] font-bold text-brand-forest">{DETAIL.easier}</p>
                <p className="mt-1 text-[13px] text-brand-charcoal/80 leading-relaxed">{easier}</p>
              </div>
              <div className="rounded-xl bg-brand-sand p-3">
                <p className="text-[13px] font-bold text-brand-forest">{DETAIL.harder}</p>
                <p className="mt-1 text-[13px] text-brand-charcoal/80 leading-relaxed">{harder}</p>
              </div>
            </div>
          </Section>
        )}

        {(a.tip || a.deeper) && (
          <Section title={DETAIL.tipTitle} icon={<Lightbulb size={18} className="text-brand-clay" />}>
            {a.tip && <p className="text-[13px] text-brand-charcoal/80 leading-relaxed">{a.tip}</p>}
            {a.deeper && (
              <p className="mt-3 text-[12px] text-brand-charcoal/55 flex items-start gap-1">
                <BookOpen size={13} className="shrink-0 mt-0.5" />
                <span>
                  {DETAIL.deeperPrefix}
                  {a.deeper}
                </span>
              </p>
            )}
          </Section>
        )}
      </div>

      {/* 底部：跟練方式／GO／要準備（Keep：訓練模式／GO／裝備） */}
      <div className="absolute bottom-0 inset-x-0 h-[120px] bg-gradient-to-t from-white via-white/95 to-white/0 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] flex items-end justify-between">
        <button
          type="button"
          onClick={() => nav.openSheet({ kind: 'mode', id: a.id, from })}
          className="mb-5 h-[52px] px-4 rounded-full bg-brand-cream text-brand-forest font-bold text-[15px] flex items-center gap-1.5 cursor-pointer"
        >
          <SlidersHorizontal size={19} />
          {DETAIL.mode}
        </button>
        <button
          type="button"
          onClick={startGo}
          className="w-[104px] h-[104px] rounded-full bg-brand-moss text-white text-[40px] font-black italic tracking-tight shadow-[0_10px_28px_rgba(61,75,59,0.35)] active:scale-95 transition cursor-pointer"
        >
          {DETAIL.go}
        </button>
        <button
          type="button"
          onClick={() => nav.openSheet({ kind: 'equip', id: a.id, from })}
          className="mb-5 h-[52px] px-4 rounded-full bg-brand-cream text-brand-forest font-bold text-[15px] flex items-center gap-1.5 cursor-pointer"
        >
          <ToyBrick size={19} />
          {DETAIL.equip}
        </button>
      </div>
    </div>
  );
}

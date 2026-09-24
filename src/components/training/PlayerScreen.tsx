/**
 * 按 GO 之後（Keep 規格 §3.4、§3.5，票 7）：樣式 A 播放器與圖文模式。它是堆疊裡的一層（`go`）：
 * 瀏覽器返回鍵、Android 實體返回鍵、右上 ✕ 都是關掉它回到詳情，**不打卡**。
 *
 * 版面照樣品的 `PlayerLoop`、`PlayerPictures`（與 `PlayerTop`、`StepDots`、`SayList`）；樣式 B（章節）、
 * C（倒數跟練）不做（§0）。
 *
 * 【樣式 A】示範片在上方循環播；步驟一步一步往下；有腳本時列「边做边说」（`guide.shots[].say`）。
 * **先試帶聲音播 → 瀏覽器擋就靜音播 → 再擋就蓋一顆播放鈕等家長點**（點擊裡的 `play()` 瀏覽器才放行）。
 * `playsinline`、`webkit-playsinline`、`x5-playsinline` 都加（微信 Android 的 X5 認最後一個），
 * `preload="metadata"`。片子沒有旁白，開不開聲音現在都一樣（§6.3）；預設帶聲音是為了之後的片。
 *
 * 【圖文模式】沒有示範片、或「跟练方式」選了只看圖文（`mode` 在按 GO 那一刻決定，記在這一層上）。
 *
 * 【打卡】最後一步「做完了，打卡」→ `POST /api/t2/checkins` → 重讀打卡（入口與計劃頁的次數跟著變）→
 * 打卡成功**取代**這一層（`replacePage`），在打卡成功按返回回到詳情，不回播放器。打不上卡時留在這裡、
 * 說一句，家長再按一次。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cast, ChevronLeft, ChevronRight, Lightbulb, Loader2, Play, Volume2, VolumeX, X } from 'lucide-react';
import { COMMON, DETAIL, PLAYER, clipLoopLabel, stepNo, stepOf } from '../../t2/trainingCopy';
import type { Activity } from '../../t2/types';
import { tryNativeCast } from './device';
import type { DetailSource } from './layerStack';
import { useTraining } from './TrainingContext';
import { postCheckin } from './trainingApi';
import { clipClock, hasClip } from './trainingData';
import { useActivity } from './useActivity';
import { StepImage } from './ui';

function PlayerTop({ title, onClose, onCast, dark = true }: { title: string; onClose: () => void; onCast?: () => void; dark?: boolean }) {
  return (
    <div className={`h-12 shrink-0 px-2 flex items-center justify-between ${dark ? 'text-white' : 'text-brand-forest'}`}>
      <button type="button" aria-label={COMMON.close} onClick={onClose} className="w-10 h-10 grid place-items-center cursor-pointer">
        <X size={24} />
      </button>
      <p className="text-[15px] font-bold truncate px-2">{title}</p>
      {onCast ? (
        <button type="button" aria-label={DETAIL.cast} onClick={onCast} className="w-10 h-10 grid place-items-center cursor-pointer">
          <Cast size={22} />
        </button>
      ) : (
        <span className="w-10" />
      )}
    </div>
  );
}

function StepDots({ n, at, dark }: { n: number; at: number; dark: boolean }) {
  return (
    <div className="px-4 flex gap-1" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`flex-1 h-1.5 rounded-full ${i <= at ? 'bg-brand-moss' : dark ? 'bg-white/20' : 'bg-brand-stone'}`} />
      ))}
    </div>
  );
}

function SayList({ activity }: { activity: Activity }) {
  const shots = activity.guide?.shots.filter(s => s.say) ?? [];
  if (shots.length === 0) return null;
  return (
    <div className="mt-5 rounded-xl p-3 bg-white/[0.07]" data-testid="player-say">
      <p className="text-[12px] text-white/50">{PLAYER.sayTitle}</p>
      <ul className="mt-1.5 space-y-1">
        {shots.map((s, i) => (
          <li key={`${i}-${s.name}`} className="text-[14px] leading-snug text-white/85">
            「{s.say}」
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 「做完了，打卡」：POST、重讀打卡、打卡成功取代這一層。 */
function useFinish(activity: Activity) {
  const { data, nav } = useTraining();
  const [posting, setPosting] = useState(false);
  const [failed, setFailed] = useState(false);
  const finish = async () => {
    if (posting) return;
    setPosting(true);
    setFailed(false);
    try {
      const created = await postCheckin(activity.id);
      void data.reloadCheckins();
      nav.replacePage({
        name: 'checkin',
        id: activity.id,
        checkinId: created.id,
        times: created.timesForActivity,
        date: created.checkinDate,
      });
    } catch (err) {
      console.warn('Failed to check in:', err);
      setFailed(true);
      setPosting(false);
    }
  };
  return { posting, failed, finish };
}

function StepButtons({ i, n, onPrev, onNext, finish, posting, failed, dark }: {
  i: number;
  n: number;
  onPrev: () => void;
  onNext: () => void;
  finish: () => void;
  posting: boolean;
  failed: boolean;
  dark: boolean;
}) {
  const last = n === 0 || i === n - 1;
  return (
    <div className="shrink-0 px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
      {failed && (
        <p role="alert" className={`mb-2 text-center text-[13px] ${dark ? 'text-brand-sand' : 'text-brand-clay'}`}>
          {PLAYER.failed}
        </p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2.5">
        <button
          type="button"
          disabled={i === 0 || posting}
          onClick={onPrev}
          className={`h-12 px-5 rounded-full font-bold flex items-center gap-1 disabled:opacity-35 cursor-pointer ${
            dark ? 'bg-white/10 text-white' : 'bg-brand-cream text-brand-forest'
          }`}
        >
          <ChevronLeft size={18} />
          {PLAYER.prev}
        </button>
        <button
          type="button"
          disabled={posting}
          onClick={() => (last ? finish() : onNext())}
          data-testid={last ? 'player-done' : 'player-next'}
          className={`h-12 rounded-full font-bold text-[16px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-70 ${
            dark ? 'bg-brand-moss text-brand-forest' : 'bg-brand-forest text-white'
          }`}
        >
          {posting && <Loader2 size={18} className="animate-spin" />}
          {last ? (posting ? PLAYER.posting : PLAYER.done) : PLAYER.next}
          {!last && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}

/** 樣式 A：示範片循環＋圖文步驟。 */
function PlayerLoop({ activity: a, clip }: { activity: Activity; clip: string }) {
  const { nav } = useTraining();
  const ref = useRef<HTMLVideoElement>(null);
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const { posting, failed, finish } = useFinish(a);
  const n = a.steps.length;

  // 先試帶聲音播 → 擋就靜音播 → 再擋就等家長點
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setNeedsTap(true));
    });
  }, []);

  const tapToPlay = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    v.play().then(
      () => setNeedsTap(false),
      () => {
        v.muted = true;
        setMuted(true);
        v.play().then(() => setNeedsTap(false), () => {});
      },
    );
  };

  const toggleSound = () => {
    const v = ref.current;
    const next = !muted;
    setMuted(next);
    if (!v) return;
    v.muted = next;
    if (v.paused) tapToPlay();
  };

  const cast = () => {
    void tryNativeCast(ref.current).then(ok => {
      if (!ok) nav.openSheet({ kind: 'cast', hasVideo: true });
    });
  };

  return (
    <div className="h-full bg-neutral-950 text-white flex flex-col training-fade" data-testid="training-player">
      <PlayerTop title={a.title} onClose={nav.back} onCast={cast} />
      <div className="relative w-full aspect-video bg-black shrink-0">
        <video
          ref={ref}
          src={clip}
          poster={a.posterUrl ?? undefined}
          loop
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="metadata"
          muted={muted}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span className="absolute left-2 top-2 rounded bg-black/55 text-[11px] px-2 py-0.5">{clipLoopLabel(clipClock(a.videoSeconds))}</span>
        <button
          type="button"
          aria-label={muted ? PLAYER.soundOn : PLAYER.soundOff}
          onClick={toggleSound}
          className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-black/55 grid place-items-center cursor-pointer"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {needsTap && (
          <button type="button" onClick={tapToPlay} className="absolute inset-0 bg-black/45 grid place-items-center cursor-pointer" data-testid="player-tap">
            <span className="flex items-center gap-2 h-12 px-5 rounded-full bg-brand-moss text-brand-forest text-[16px] font-bold">
              <Play size={18} fill="currentColor" />
              {PLAYER.tapToPlay}
            </span>
          </button>
        )}
      </div>
      <div className="mt-4">
        <StepDots n={Math.max(1, n)} at={i} dark />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto training-no-scrollbar px-5 pt-5">
        {n > 0 ? (
          <>
            <p className="text-[13px] text-brand-moss font-bold">{stepOf(i + 1, n)}</p>
            <p className="mt-2 text-[23px] font-black leading-snug">{a.steps[i].instruction}</p>
          </>
        ) : (
          <p className="text-[16px] text-white/80 leading-relaxed">{PLAYER.noSteps}</p>
        )}
        <SayList activity={a} />
      </div>
      <StepButtons
        i={i}
        n={n}
        onPrev={() => setI(x => Math.max(0, x - 1))}
        onNext={() => setI(x => Math.min(n - 1, x + 1))}
        finish={finish}
        posting={posting}
        failed={failed}
        dark
      />
    </div>
  );
}

/** 圖文模式：一步一張卡，有圖放大圖、沒圖放序號方塊；最後一步附小提醒。 */
function PlayerPictures({ activity: a, clip }: { activity: Activity; clip: string | null }) {
  const { nav } = useTraining();
  const [i, setI] = useState(0);
  const { posting, failed, finish } = useFinish(a);
  const n = a.steps.length;
  const step = n > 0 ? a.steps[i] : null;
  const last = n === 0 || i === n - 1;
  return (
    <div className="h-full bg-white flex flex-col training-fade" data-testid="training-pictures">
      <PlayerTop title={n > 0 ? `${a.title} · ${i + 1} / ${n}` : a.title} onClose={nav.back} dark={false} />
      <StepDots n={Math.max(1, n)} at={i} dark={false} />
      <div className="flex-1 min-h-0 overflow-y-auto training-no-scrollbar px-4 pt-5">
        {step ? (
          <>
            <StepImage
              src={step.imageUrl}
              n={i + 1}
              className={step.imageUrl ? 'w-full aspect-[4/3] rounded-2xl' : 'w-full h-[140px] rounded-2xl [&>span]:text-[40px]'}
            />
            <p className="mt-5 text-[13px] text-brand-moss font-bold">{stepNo(i + 1)}</p>
            <p className="mt-1 text-[24px] font-black text-brand-forest leading-snug">{step.instruction}</p>
          </>
        ) : (
          <p className="text-[16px] text-brand-charcoal/80 leading-relaxed">{PLAYER.noSteps}</p>
        )}
        {last && a.tip && (
          <p className="mt-4 rounded-xl bg-brand-sand p-3 text-[13px] text-brand-charcoal leading-relaxed flex gap-2">
            <Lightbulb size={16} className="text-brand-clay shrink-0 mt-0.5" />
            <span>{a.tip}</span>
          </p>
        )}
        {!clip && <p className="mt-5 text-[12px] text-brand-charcoal/55">{PLAYER.noClipNote}</p>}
      </div>
      <StepButtons
        i={i}
        n={n}
        onPrev={() => setI(x => Math.max(0, x - 1))}
        onNext={() => setI(x => Math.min(n - 1, x + 1))}
        finish={finish}
        posting={posting}
        failed={failed}
        dark={false}
      />
    </div>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  const { nav } = useTraining();
  return (
    <div className="h-full bg-white flex flex-col">
      <PlayerTop title="" onClose={nav.back} dark={false} />
      <div className="mx-6 mt-10 text-[14px] text-brand-charcoal/70 leading-relaxed flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function PlayerScreen({ id, mode }: { id: string; from: DetailSource; mode: 'video' | 'pictures' }) {
  const load = useActivity(id);
  if (load.status === 'loading') {
    return (
      <Waiting>
        <Loader2 size={16} className="animate-spin shrink-0" />
        {DETAIL.loading}
      </Waiting>
    );
  }
  if (load.status !== 'ready') return <Waiting>{load.status === 'missing' ? DETAIL.notFound : DETAIL.error}</Waiting>;
  const a = load.activity;
  const clip = hasClip(a) ? a.videoUrl : null;
  // 按 GO 那一刻有片、選了看片 → 樣式 A；其餘（沒有片、或之後片子被拿掉）→ 圖文
  return mode === 'video' && clip ? <PlayerLoop activity={a} clip={clip} /> : <PlayerPictures activity={a} clip={clip} />;
}

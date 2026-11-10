import { useEffect, useRef, useState } from 'react';
import type { DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import { authFetch } from '../utils/api';
import { calendarDateOf, weekEndOf, weekStartOf } from '../t2/weeks';
import type { Checkin } from '../t2/practice';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, SectionHead, Tile, greetingFor } from '../components/ledo/ui';
import { BANNER, HOSPITAL_PHOTO } from './HomePage';
import { HOME_CARDS, HOME_CARDS_1022, HOME_COPY, HOME_TRAINING_CARD_1022, type HomeTarget } from './homeNav';
import { PRODUCT } from '../productConfig';
import { WORDING_1022 } from '../wording1022';
import HomeCarousel from './HomeCarousel';
import { TRAINING_PLAN_PAGE, planListPriceFen, planYuan } from '../t2/trainingPlanCopy';
import { homeCardImage, useHomeMedia } from './homeMediaClient';
import { useDesktopLayout } from '../desktop/useDesktopLayout';

/**
 * Ledo 版首頁（設計稿第 2 頁）：打招呼、示範片大卡、孩子的概況、三個去處改成清單行。
 *
 * 概況照設計稿排（使用者 2026-10-21：「首頁中間改成原先設計稿樣式」）：左邊兩格（發展穩定、需要較多支持，
 * 少量支持寫在後一格的小字，同評估面板），右邊一格高的「本周练过」配插畫，按了去線上干預。
 *
 * 跟設計稿不一樣的地方：
 * - 「本周练过」寫的是**這一週有打卡的天數**，不是稿上的「活動 2/4」。x/4 要讀每週活動，而
 *   `GET /api/t2/weekly-plan` 讀一次就會替這一週配活動（v3 是開一期、12 週從這一週起算）——
 *   家長只是打開首頁，不該把計劃的起點定下來。打卡只讀不寫。讀不到（沒登入、讀失敗）就不寫數字。
 * - 本週日期條還沒放。
 * - 大卡上的字寫示範片本身，不寫「今天练」—— 首頁不知道今天排了哪一支。
 */

export interface LedoHomeProps {
  onOpen: (target: HomeTarget) => void;
  /** 有 T1 成績才給（看報告） */
  onOpenReport?: () => void;
  /** 登入且有孩子檔案才給 */
  childName?: string;
  /** 這一次的 T1 成績（沒做過＝空陣列） */
  scores?: DimensionScore[];
  /** 登入前、視窗夠寬（`useDesktopWide()`，App 給）：沒有側欄外框，但同樣排成電腦版的兩欄 */
  wide?: boolean;
}

/** 色塊小字放不下「需要少量支持」的全名（375px 會折行）：「需要」縮成「需」，報告與面板照用全名。 */
const SHORT = {
  borderline: STATUS_WORDING.borderline.label.replace(/^需要/, '需'),
};

const CARD_IMG: Record<string, string> = {
  training: '/home/home-training.jpg',
  t1: '/home/home-t1.jpg',
  offline: HOSPITAL_PHOTO.jpg,
};

/** 1022 的兩張卡用 Ledo 插畫（使用者 2026-10-27：「用比較符合我們風格的 AI 畫」），不用照片。 */
const CARD_ART_1022: Record<string, string> = {
  t1: LEDO_ART.report,
  t2: LEDO_ART.deepAssessment,
  training: LEDO_ART.training,
};

function doneDate(scores: DimensionScore[]): string | null {
  const t = scores.map(s => Date.parse(s.completedAt)).filter(n => !Number.isNaN(n));
  if (t.length === 0) return null;
  const d = new Date(Math.max(...t));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/** 這一週（Asia/Shanghai，週一起）有打卡的天數；讀不到是 null。`enabled` 為假時不讀。 */
function useWeekPracticeDays(enabled: boolean): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const today = calendarDateOf(new Date());
    authFetch(`/api/t2/checkins?from=${weekStartOf(today)}&to=${weekEndOf(today)}`)
      .then(async resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = (await resp.json()) as { checkins?: Checkin[] };
        if (!Array.isArray(body.checkins)) throw new Error('bad checkins body');
        if (alive) setDays(new Set(body.checkins.map(c => c.checkinDate)).size);
      })
      .catch(() => {
        if (alive) setDays(null);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return days;
}

export default function LedoHomePage({ onOpen, onOpenReport, childName, scores = [], wide = false }: LedoHomeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // 同 HomePage：iOS 看的是 DOM 屬性，再設一次、再叫一次播放；播不了就停在封面。
    v.muted = true;
    v.defaultMuted = true;
    v.play()?.catch(() => {});
  }, []);

  // 首頁素材（`HOME_MEDIA`，#87）：後台有啟用中的輪播就畫輪播，沒有（或還沒讀到、讀失敗）照舊是固定示範片。
  const media = useHomeMedia();
  const banners = media?.banners ?? [];
  const oneMonthFen = useOneMonthPriceFen(PRODUCT.features.ui1022);

  const t1 = scores.filter(s => s.tierId === 'T1');
  const count = (st: DimensionScore['status']) => t1.filter(s => s.status === st).length;
  const date = doneDate(t1);
  // 1022 首頁不畫練習天數（簡報 11/03 第 13 頁），就不讀打卡。
  const practiceDays = useWeekPracticeDays(t1.length > 0 && !PRODUCT.features.ui1022);
  const cardSub1022 = (id: string): string => {
    if (id === 't1') return t1.length > 0 && date ? WORDING_1022.home.t1CardDone(date) : WORDING_1022.home.t1Card.subtitle;
    if (id === 't2') return t1.length > 0 ? WORDING_1022.home.t2Card.subtitle : WORDING_1022.home.t2CardNeedT1Sub;
    return '';
  };
  const sub: Record<string, string> = {
    training: '每周在家陪孩子做几个小活动',
    t1: date ? `${date}完成 · ${t1.length} 个方面` : '了解孩子的 9 个方面',
    offline: `${HOME_COPY.offline.hospital} · ${HOME_COPY.offline.status}`,
  };

  const inFrame = useDesktopLayout();
  const desk = (inFrame || wide) && PRODUCT.features.ui1022;

  const greeting = (
      <Greeting
        small={childName ? `${childName}的家长，${greetingFor(new Date())}` : `${greetingFor(new Date())}，欢迎使用`}
        title={PRODUCT.features.ui1022 ? WORDING_1022.home.heroTitle : '今天也陪孩子玩一下'}
      />
  );

  const hero = banners.length > 0 ? <HomeCarousel items={banners} /> : (
      <button
        type="button"
        onClick={() => onOpen('training')}
        className="relative block aspect-video w-full overflow-hidden rounded-[28px] bg-ledo-accent-soft cursor-pointer"
      >
        <video
          ref={videoRef}
          id="home-banner-video"
          className="absolute inset-0 h-full w-full object-cover"
          src={BANNER.video}
          poster={BANNER.poster}
          muted
          autoPlay
          loop
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="metadata"
          aria-hidden="true"
        />
        <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <Chip tone="white">示范片：小推车</Chip>
          <Chip on>{PRODUCT.features.ui1022 ? WORDING_1022.home.heroButton : '去线上干预'}</Chip>
        </span>
      </button>
  );

  /** 電腦版概況多一段：哪幾個方面落在哪一種判定（這一次 T1 成績的維度名，不另外算）。 */
  const namesOf = (st: DimensionScore['status']) => t1.filter(s => s.status === st).map(s => s.dimensionName);

  const overview = t1.length > 0 && (
            <section id="home-overview-block" className={desk ? 'flex flex-col gap-3 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)]' : 'space-y-3 rounded-[28px] bg-ledo-field p-3'}>
              <SectionHead title={childName ? `${childName}的概况` : '孩子的概况'} />
              <div id="home-overview" className="grid grid-cols-2 gap-2">
                <Tile tone="ok" value={count('normal')} label={`个方面${STATUS_WORDING.normal.label}`} />
                <Tile
                  tone="more"
                  value={count('delay')}
                  label={`个方面${STATUS_WORDING.delay.label}`}
                  note={count('borderline') > 0 ? `另有 ${count('borderline')} 个方面${SHORT.borderline}` : undefined}
                />
              </div>
              {desk && (namesOf('delay').length > 0 || namesOf('borderline').length > 0) && (
                <dl id="home-overview-names" className="space-y-1.5 rounded-2xl bg-ledo-field px-3.5 py-3 text-xs leading-relaxed text-ledo-ink-2">
                  {(['delay', 'borderline'] as const).map(st => namesOf(st).length > 0 && (
                    <div key={st} className="flex gap-2">
                      <dt className={`shrink-0 font-bold ${st === 'delay' ? 'text-ledo-more-ink' : 'text-ledo-mild-ink'}`}>{STATUS_WORDING[st].label}</dt>
                      <dd>{namesOf(st).join('、')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
  );

  const trainingCard = (
          <button
            type="button"
            id={`home-card-${HOME_TRAINING_CARD_1022.id}`}
            onClick={() => onOpen(HOME_TRAINING_CARD_1022.target)}
            className={desk ? 'flex w-full flex-1 overflow-hidden rounded-[28px] bg-ledo-accent-soft text-left transition hover:brightness-[0.98] cursor-pointer' : 'flex w-full overflow-hidden rounded-[28px] bg-ledo-accent-soft text-left transition active:scale-[0.99] cursor-pointer'}
          >
            <span className={desk ? 'relative min-h-[150px] w-[40%] shrink-0 overflow-hidden' : 'relative w-[38%] shrink-0 overflow-hidden'}>
              <img src={homeCardImage(media, 'training', CARD_ART_1022.training)} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </span>
            <span className={desk ? 'flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-5' : 'flex min-w-0 flex-1 flex-col gap-1 p-3.5'}>
              <span className={desk ? 'text-base font-black text-ledo-ink' : 'text-sm font-black text-ledo-ink'}>{HOME_TRAINING_CARD_1022.title}</span>
              <span className={desk ? 'text-sm leading-relaxed text-ledo-ink-2' : 'text-xs leading-relaxed text-ledo-ink-2'}>{HOME_TRAINING_CARD_1022.sub}</span>
              <TrainingCardPrice priceFen={oneMonthFen} />
              <span className="mt-1 self-start"><Chip on>{WORDING_1022.home.trainingPrice.cta}</Chip></span>
            </span>
          </button>
  );

  const assessCards = (
          <div className={desk ? 'grid grid-cols-2 gap-5' : 'grid grid-cols-2 gap-3 border-t border-ledo-line pt-4'}>
            {HOME_CARDS_1022.map(card => (
              <button
                key={card.id}
                type="button"
                id={`home-card-${card.id}`}
                onClick={() => onOpen(card.target)}
                className={desk ? 'group grid min-w-0 grid-cols-[minmax(0,44%)_1fr] overflow-hidden rounded-[28px] bg-white text-left shadow-[0_14px_34px_-26px_rgba(36,51,44,0.5)] transition hover:shadow-[0_18px_40px_-24px_rgba(36,51,44,0.55)] cursor-pointer' : 'group flex min-w-0 flex-col overflow-hidden rounded-3xl border-[1.5px] border-ledo-line bg-white text-left shadow-sm transition active:scale-[0.99] cursor-pointer'}
              >
                <span className={desk ? 'relative block min-h-[170px] overflow-hidden bg-ledo-accent-soft' : 'relative block aspect-[4/3] w-full overflow-hidden bg-ledo-accent-soft'}>
                  <img src={homeCardImage(media, card.id, CARD_ART_1022[card.id])} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  {!desk && (
                  <span className="absolute inset-x-2 bottom-2 flex">
                    <Chip on>{card.title}</Chip>
                  </span>
                  )}
                </span>
                {desk ? (
                  <span className="flex min-w-0 flex-col justify-center gap-2 p-5">
                    <span className="self-start"><Chip on>{card.title}</Chip></span>
                    <span className="text-sm leading-relaxed text-ledo-ink-2">{cardSub1022(card.id)}</span>
                  </span>
                ) : (
                <span className="px-3 py-2.5 text-xs leading-relaxed text-ledo-ink-2">{cardSub1022(card.id)}</span>
                )}
              </button>
            ))}
          </div>
  );

  if (desk) {
    // 電腦版（側欄工作台，VITE_DESKTOP_LAYOUT）：同一組區塊排成兩欄 —— 左邊示範片，右邊概況與訓練卡；T1、T2 一排兩張橫卡。
    return (
      <div id="home-page" className="mx-auto w-full max-w-6xl space-y-5 text-left animate-fade-in">
        <div className="px-1">{greeting}</div>
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-7 min-w-0 [&>*]:h-full [&>*]:aspect-auto [&>*]:min-h-[340px]">{hero}</div>
          <div className="col-span-5 flex min-w-0 flex-col gap-5">
            {overview}
            {trainingCard}
          </div>
        </div>
        {assessCards}
      </div>
    );
  }

  return (
    <div id="home-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      {greeting}

      {hero}

      {PRODUCT.features.ui1022 ? (
        // 1022 首頁三排（簡報 11/03 第 12–13 頁，使用者 2026-11-06）：①評估結果（綠、紅）②線上家庭個性化訓練寬卡（附價錢）③T1、T2。
        // 拿掉「看报告」與「本周练过的天数」；三塊各有自己的底色或分隔線。
        <>
          {overview}

          {trainingCard}

          {assessCards}
        </>
      ) : (
      <>
      {t1.length > 0 && (
        <div id="home-overview-block" className="contents">
          <SectionHead title={childName ? `${childName}的概况` : '孩子的概况'} action={onOpenReport ? '看报告' : undefined} onAction={onOpenReport} />
          <div id="home-overview" className="grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Tile tone="ok" value={count('normal')} label={`个方面${STATUS_WORDING.normal.label}`} className="flex-1" />
              <Tile
                tone="more"
                value={count('delay')}
                label={`个方面${STATUS_WORDING.delay.label}`}
                note={count('borderline') > 0 ? `另有 ${count('borderline')} 个方面${SHORT.borderline}` : undefined}
                className="flex-1"
              />
            </div>
            <button
              type="button"
              id="home-overview-training"
              onClick={() => onOpen('training')}
              className="flex min-w-0 flex-col gap-1 rounded-3xl bg-ledo-accent-soft p-3.5 text-left text-ledo-accent-soft-ink cursor-pointer"
            >
              {practiceDays !== null && (
                <span className="text-[28px] font-black leading-tight tabular-nums">
                  {practiceDays}
                  <span className="text-base font-bold"> / 7 天</span>
                </span>
              )}
              <span className="text-xs font-bold">{practiceDays !== null ? '本周练过的天数' : '本周的家庭活动'}</span>
              {/* 圖填滿左邊兩格撐出來的高度（同設計稿）；太矮時至少留 4:5 */}
              <span className="relative mt-1 min-h-[120px] flex-1 overflow-hidden rounded-2xl bg-white">
                <img src="/ledo/training.jpg" alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {HOME_CARDS.map(card => (
          <ListRow
            key={card.id}
            id={`home-card-${card.id}`}
            avatar={<Avatar img={CARD_IMG[card.id]} />}
            title={card.title}
            sub={sub[card.id]}
            onClick={() => onOpen(card.target)}
          />
        ))}
      </div>
      </>
      )}
    </div>
  );
}

/**
 * 首頁訓練卡的價錢：照方案頁同一個來源（`/api/training/plans` 的一個月 `priceFen`），原價照 `PLAN_LIST_PRICE_FEN`。
 * 以前數字寫死在 wording，方案頁照伺服器，兩邊會不一樣（2026-11-10 實際走一遍清單第 3 條）。
 * 讀不到（還沒回來、開關關著、價格待定）就不畫這一行，不拿一個可能不對的數字頂上。
 */
export function TrainingCardPrice({ priceFen }: { priceFen: number | null }) {
  if (priceFen === null) return null;
  const list = planListPriceFen(1, priceFen);
  return (
    <span id="home-training-price" className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-xl font-black text-ledo-coral-ink tabular-nums">{planYuan(priceFen)}</span>
      {list !== null && <span className="text-xs text-ledo-ink-2 line-through tabular-nums">{TRAINING_PLAN_PAGE.listPrice(planYuan(list))}</span>}
      <span className="text-xs text-ledo-ink-2">/ {WORDING_1022.home.trainingPrice.label}</span>
    </span>
  );
}

function useOneMonthPriceFen(enabled: boolean): number | null {
  const [fen, setFen] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch('/api/training/plans')
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const p = Array.isArray(body?.plans) ? body.plans.find((x: { months?: unknown }) => x?.months === 1) : null;
        if (alive) setFen(typeof p?.priceFen === 'number' && p.priceFen > 0 ? p.priceFen : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return fen;
}

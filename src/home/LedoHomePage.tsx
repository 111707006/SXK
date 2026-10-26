import { useEffect, useRef, useState } from 'react';
import type { DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import { authFetch } from '../utils/api';
import { calendarDateOf, weekEndOf, weekStartOf } from '../t2/weeks';
import type { Checkin } from '../t2/practice';
import { Avatar, Chip, Greeting, LEDO_ART, ListRow, SectionHead, Tile, greetingFor } from '../components/ledo/ui';
import { BANNER, HOSPITAL_PHOTO } from './HomePage';
import { HOME_CARDS, HOME_CARDS_1022, HOME_COPY, type HomeTarget } from './homeNav';
import { PRODUCT } from '../productConfig';
import { WORDING_1022 } from '../wording1022';
import HomeCarousel from './HomeCarousel';
import { useHomeMedia } from './homeMediaClient';

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
}

/** 色塊小字放不下「需要少量支持」的全名（375px 會折行）：去掉「需要」，報告與面板照用全名。 */
const SHORT = {
  borderline: STATUS_WORDING.borderline.label.replace(/^需要/, ''),
};

const CARD_IMG: Record<string, string> = {
  training: '/home/home-training.jpg',
  t1: '/home/home-t1.jpg',
  offline: HOSPITAL_PHOTO.jpg,
};

/** 1022 的兩張卡用 Ledo 插畫（使用者 2026-10-27：「用比較符合我們風格的 AI 畫」），不用照片。 */
const CARD_ART_1022: Record<string, string> = {
  t1: LEDO_ART.report,
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

export default function LedoHomePage({ onOpen, onOpenReport, childName, scores = [] }: LedoHomeProps) {
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

  const t1 = scores.filter(s => s.tierId === 'T1');
  const count = (st: DimensionScore['status']) => t1.filter(s => s.status === st).length;
  const date = doneDate(t1);
  const practiceDays = useWeekPracticeDays(t1.length > 0);
  const sub: Record<string, string> = {
    training: '每周几个在家陪孩子做的活动',
    t1: date ? `${date}完成 · ${t1.length} 个方面` : '了解孩子的 9 个方面',
    offline: `${HOME_COPY.offline.hospital} · ${HOME_COPY.offline.status}`,
  };

  return (
    <div id="home-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <Greeting
        small={childName ? `${childName}的家长，${greetingFor(new Date())}` : `${greetingFor(new Date())}，欢迎来看看`}
        title={PRODUCT.features.ui1022 ? WORDING_1022.home.heroTitle : '今天也陪孩子玩一下'}
      />

      {banners.length > 0 ? <HomeCarousel items={banners} /> : (
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
      )}

      {t1.length > 0 && (
        <>
          <SectionHead title={childName ? `${childName}的概况` : '孩子的概况'} action={onOpenReport ? '看报告' : undefined} onAction={onOpenReport} />
          <div id="home-overview" className="grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Tile tone="ok" value={count('normal')} label={`个方面${STATUS_WORDING.normal.label}`} className="flex-1" />
              <Tile
                tone="more"
                value={count('delay')}
                label={`个方面${STATUS_WORDING.delay.label}`}
                note={count('borderline') > 0 ? `另有 ${count('borderline')} 项${SHORT.borderline}` : undefined}
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
        </>
      )}

      {/* 1022（issue #84；使用者 2026-10-27 改成照片卡）：兩張一樣大的照片卡並排、T1 在前，副標是客戶的固定句；沒有線下服務點。 */}
      {PRODUCT.features.ui1022 ? (
        <div className="grid grid-cols-2 gap-3">
          {HOME_CARDS_1022.map(card => (
            <button
              key={card.id}
              type="button"
              id={`home-card-${card.id}`}
              onClick={() => onOpen(card.target)}
              className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border-[1.5px] border-ledo-line bg-white text-left shadow-sm transition active:scale-[0.99] cursor-pointer"
            >
              <span className="relative block aspect-[4/3] w-full overflow-hidden bg-ledo-accent-soft">
                <img src={CARD_ART_1022[card.id]} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-2 bottom-2 flex">
                  <Chip on>{card.title}</Chip>
                </span>
              </span>
              <span className="px-3 py-2.5 text-xs leading-relaxed text-ledo-ink-2">{card.sub}</span>
            </button>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}

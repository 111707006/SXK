import { useEffect, useRef } from 'react';
import type { DimensionScore } from '../types';
import { STATUS_WORDING } from '../utils/statusWording';
import { Avatar, Chip, Greeting, ListRow, SectionHead, Tile, greetingFor } from '../components/ledo/ui';
import { BANNER, HOSPITAL_PHOTO } from './HomePage';
import { HOME_CARDS, HOME_COPY, type HomeTarget } from './homeNav';

/**
 * Ledo 版首頁（設計稿第 2 頁）：打招呼、示範片大卡、孩子的概況（T1 三色數字）、三個去處改成清單行。
 *
 * 跟設計稿不一樣的地方（都是因為現在沒有資料來源，不畫假的）：
 * - 本週日期條與「本周练过的活动 2/4」要讀打卡紀錄，首頁不讀，先不放（線上干預那一頁有）。
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

/** 三格並排放不下「需要少量支持」（375px 會折成兩行）：色塊上去掉「需要」（同設計稿），報告與面板照用全名。 */
const SHORT = {
  borderline: STATUS_WORDING.borderline.label.replace(/^需要/, ''),
  delay: STATUS_WORDING.delay.label.replace(/^需要/, ''),
};

const CARD_IMG: Record<string, string> = {
  training: '/home/home-training.jpg',
  t1: '/home/home-t1.jpg',
  offline: HOSPITAL_PHOTO.jpg,
};

function doneDate(scores: DimensionScore[]): string | null {
  const t = scores.map(s => Date.parse(s.completedAt)).filter(n => !Number.isNaN(n));
  if (t.length === 0) return null;
  const d = new Date(Math.max(...t));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
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

  const t1 = scores.filter(s => s.tierId === 'T1');
  const count = (st: DimensionScore['status']) => t1.filter(s => s.status === st).length;
  const date = doneDate(t1);
  const sub: Record<string, string> = {
    training: '每周几个在家陪孩子做的活动',
    t1: date ? `${date}完成 · ${t1.length} 个方面` : '了解孩子的 9 个方面',
    offline: `${HOME_COPY.offline.hospital} · ${HOME_COPY.offline.status}`,
  };

  return (
    <div id="home-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <Greeting
        small={childName ? `${childName}的家长，${greetingFor(new Date())}` : `${greetingFor(new Date())}，欢迎来看看`}
        title="今天也陪孩子玩一下"
      />

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
          <Chip on>去线上干预</Chip>
        </span>
      </button>

      {t1.length > 0 && (
        <>
          <SectionHead title={childName ? `${childName}的概况` : '孩子的概况'} action={onOpenReport ? '看报告' : undefined} onAction={onOpenReport} />
          <div className="grid grid-cols-3 gap-2">
            <Tile tone="ok" value={count('normal')} label={STATUS_WORDING.normal.label} />
            <Tile tone="mild" value={count('borderline')} label={SHORT.borderline} />
            <Tile tone="more" value={count('delay')} label={SHORT.delay} />
          </div>
        </>
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
    </div>
  );
}

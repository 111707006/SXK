/**
 * 「线上家庭个性化训练」那張卡（1022 首頁，簡報 11/03 第 12–13 頁）：左圖、標題、一句說明、一個月的價錢、「选方案」。
 * 首頁與 T2 報告共用（使用者 2026-11-11：T2 報告缺這一塊）。點下去由呼叫端決定去哪（首頁與報告都到方案頁）。
 * 圖照首頁素材（`HOME_MEDIA` 的 `card_training`），沒設用內建插畫；價錢照 `/api/training/plans`。
 */
import { useEffect, useState } from 'react';
import { Chip, LEDO_ART } from '../components/ledo/ui';
import { HOME_TRAINING_CARD_1022 } from './homeNav';
import { WORDING_1022 } from '../wording1022';
import { TRAINING_PLAN_PAGE, planListPriceFen, planYuan } from '../t2/trainingPlanCopy';
import { homeCardImage, useHomeMedia } from './homeMediaClient';
import type { PublicHomeMedia } from '../homeMedia/shape';

/**
 * 訓練卡的價錢：照方案頁同一個來源（`/api/training/plans` 的一個月 `priceFen`），原價照 `PLAN_LIST_PRICE_FEN`。
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

export function useOneMonthPriceFen(enabled: boolean): number | null {
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

/**
 * 卡本身。首頁已經讀過素材與價錢就傳進來（不重複打）；報告沒傳就自己讀。
 * `desk`：電腦版的尺寸（首頁右欄撐滿高度用 `flex-1`）。
 */
export default function TrainingPromoCard({
  onOpen,
  desk = false,
  media,
  priceFen,
  id = `home-card-${HOME_TRAINING_CARD_1022.id}`,
}: {
  onOpen: () => void;
  desk?: boolean;
  media?: PublicHomeMedia | null;
  priceFen?: number | null;
  id?: string;
}) {
  const ownMedia = useHomeMedia();
  const ownFen = useOneMonthPriceFen(priceFen === undefined);
  const art = homeCardImage(media === undefined ? ownMedia : media, 'training', LEDO_ART.training);
  return (
    <button
      type="button"
      id={id}
      onClick={onOpen}
      className={desk ? 'flex w-full flex-1 overflow-hidden rounded-[28px] bg-ledo-accent-soft text-left transition hover:brightness-[0.98] cursor-pointer' : 'flex w-full overflow-hidden rounded-[28px] bg-ledo-accent-soft text-left transition active:scale-[0.99] cursor-pointer'}
    >
      <span className={desk ? 'relative min-h-[150px] w-[40%] shrink-0 overflow-hidden' : 'relative w-[38%] shrink-0 overflow-hidden'}>
        <img src={art} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </span>
      <span className={desk ? 'flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-5' : 'flex min-w-0 flex-1 flex-col gap-1 p-3.5'}>
        <span className={desk ? 'text-base font-black text-ledo-ink' : 'text-sm font-black text-ledo-ink'}>{HOME_TRAINING_CARD_1022.title}</span>
        <span className={desk ? 'text-sm leading-relaxed text-ledo-ink-2' : 'text-xs leading-relaxed text-ledo-ink-2'}>{HOME_TRAINING_CARD_1022.sub}</span>
        <TrainingCardPrice priceFen={priceFen === undefined ? ownFen : priceFen} />
        <span className="mt-1 self-start"><Chip on>{WORDING_1022.home.trainingPrice.cta}</Chip></span>
      </span>
    </button>
  );
}

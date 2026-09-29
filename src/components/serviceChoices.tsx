/**
 * 家長端四種服務的按鈕按下去做什麼（使用者 2026-09-29：「四種並列，沒做的按鈕先不給按」）。
 *
 * 能不能按的規則在 `serviceAvailability`（`src/utils/serviceTypes.ts`）；這裡把它接到每個畫面手上的動作：
 * 開預約表、去「线上干预」那一頁。T1 報告的預約卡與預約表、T2 入口、T2 報告、线上干预裡的三處都走這一個，
 * 樣式各自畫 —— 四種永遠一起列出來，不能按的也列，只是灰掉並寫出原因。
 */
import { ArrowRight } from 'lucide-react';
import { PRODUCT } from '../productConfig';
import {
  SERVICE_SOON_NOTE,
  serviceAvailability,
  serviceTypeDescriptors,
  type ServiceType,
  type ServiceTypeDescriptor,
} from '../utils/serviceTypes';

/**
 * - `book`：開預約表
 * - `training`：去「线上干预」那一頁
 * - `here`：人已經在「线上干预」那一頁上（线上干预训练指导就是這一頁），不用再去
 * - `soon`：還沒做，灰掉
 */
export type ServiceChoiceState = 'book' | 'training' | 'here' | 'soon';

export interface ServiceChoice {
  descriptor: ServiceTypeDescriptor;
  state: ServiceChoiceState;
  /** 按下去做什麼；`null` ＝ 不能按（還沒做，或人就在那一頁上）。 */
  onSelect: (() => void) | null;
}

/** 按鈕上那一個小字；開預約表的那一種不用多說。 */
export const SERVICE_NOTES: Record<ServiceChoiceState, string | null> = {
  book: null,
  training: '去线上干预',
  here: '就是这一页',
  soon: SERVICE_SOON_NOTE,
};

/**
 * @param on.book 開預約表（帶著這一種）。
 * @param on.openTraining 去「线上干预」那一頁；專案 A 在「线上干预」以外的畫面都要給。
 *   沒給的話那一種灰掉 —— 寧可少一條路，也不要一顆按下去沒反應的按鈕。
 * @param on.inTraining 這個畫面就在「线上干预」那一頁裡。
 */
export function serviceChoices(on: {
  book: (type: ServiceType) => void;
  openTraining?: () => void;
  inTraining?: boolean;
}): ServiceChoice[] {
  return serviceTypeDescriptors().map(descriptor => {
    const availability = serviceAvailability(descriptor.type, PRODUCT.features.tier2And3);
    if (availability === 'book') {
      return { descriptor, state: 'book', onSelect: () => on.book(descriptor.type) };
    }
    if (availability === 'training') {
      if (on.inTraining) return { descriptor, state: 'here', onSelect: null };
      if (on.openTraining) return { descriptor, state: 'training', onSelect: on.openTraining };
    }
    return { descriptor, state: 'soon', onSelect: null };
  });
}

/** 按鈕上的小字（「去线上干预 →」「就是这一页」「暂未开放」）；開預約表的那一種不畫。 */
export function ServiceNote({ state, className = '' }: { state: ServiceChoiceState; className?: string }) {
  const note = SERVICE_NOTES[state];
  if (!note) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 text-[10px] font-bold ${className}`}>
      {note}
      {state === 'training' && <ArrowRight size={10} />}
    </span>
  );
}

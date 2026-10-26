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
  /** 卡片上那一句說明：线上干预训练指导在 A 講的是「线上干预」那一頁，不是預約表上那一句。 */
  description: string;
  state: ServiceChoiceState;
  /** 按下去做什麼；`null` ＝ 不能按（還沒做，或人就在那一頁上）。 */
  onSelect: (() => void) | null;
}

/** 线上干预训练指导在 A 的說明（它就是「线上干预」那一頁）。B 照舊用 `serviceTypes.ts` 那一句。 */
export const TRAINING_PAGE_DESCRIPTION = '每周几个在家陪孩子做的活动：看示范、跟着做、记下每一次。';

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
  const all = serviceTypeDescriptors().map((descriptor): ServiceChoice => {
    const availability = serviceAvailability(descriptor.type, PRODUCT.features.tier2And3);
    const description = availability === 'training' ? TRAINING_PAGE_DESCRIPTION : descriptor.description;
    if (availability === 'book') {
      return { descriptor, description, state: 'book', onSelect: () => on.book(descriptor.type) };
    }
    if (availability === 'training') {
      if (on.inTraining) return { descriptor, description, state: 'here', onSelect: null };
      if (on.openTraining) return { descriptor, description, state: 'training', onSelect: on.openTraining };
    }
    return { descriptor, description, state: 'soon', onSelect: null };
  });
  // 1022（簡報第 24 頁，使用者 2026-10-27）：預約改成企業微信二維碼，灰掉的線下兩種與「就是这一页」不再列，
  // 只剩「加企业微信咨询」（按了出二維碼，`expertBookingIsQr`）與去线上干预。
  if (!PRODUCT.features.ui1022) return all;
  return all
    .filter(c => c.state === 'book' || c.state === 'training')
    .map(c => (c.state === 'book' ? { ...c, descriptor: { ...c.descriptor, label: WECOM_CONSULT_LABEL }, description: WECOM_CONSULT_DESCRIPTION } : c));
}

/** 1022：開預約表的那一種改叫這個（按了出企業微信二維碼）。 */
export const WECOM_CONSULT_LABEL = '加企业微信咨询专家';
export const WECOM_CONSULT_DESCRIPTION = '扫码添加企业微信，由儿童发展评估专家为您说明报告与接下来怎么做。';

/** 按鈕上的小字（「去线上干预 →」「就是这一页」「暂未开放」）；開預約表的那一種不畫。 */
export function ServiceNote({ state, className = '' }: { state: ServiceChoiceState; className?: string }) {
  const note = SERVICE_NOTES[state];
  if (!note) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 text-xs font-bold ${className}`}>
      {note}
      {state === 'training' && <ArrowRight size={10} />}
    </span>
  );
}

/**
 * 「问专家」抽屜（Keep 規格 §3.8 最後一列）：四種服務並列（2026-09-29）—— 線上諮詢說明開既有的預約表
 * （`onBookService`）；线上干预训练指导就是這一頁，寫「就是这一页」；線下兩種「暂未开放」。
 * 報告入口的「问专家」分頁與底部橫幅都開它；票 7 的詳情頁「问专家」圖示也用這一個。
 */
import { UserRound } from 'lucide-react';
import { ServiceNote, serviceChoices } from '../serviceChoices';
import { EXPERT_SHEET } from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { Sheet } from './ui';
import { WecomQrBlock, expertBookingIsQr } from '../WecomQr';
import { WORDING_1022 } from '../../wording1022';

export default function ExpertSheet() {
  const { nav, onBookService } = useTraining();
  // 1022（簡報 10/22 第 24 頁、11/03 第 21 頁「中间这个部分可以删除，直接二维码」）：抽屜裡直接是二維碼。
  if (expertBookingIsQr()) {
    return (
      <Sheet onClose={nav.back}>
        <h2 className="text-[22px] font-black text-brand-forest">{WORDING_1022.expertQr.title}</h2>
        <p className="mt-1.5 mb-4 text-[14px] text-brand-charcoal/80">{WORDING_1022.expertQr.sub}</p>
        <WecomQrBlock />
      </Sheet>
    );
  }
  return (
    <Sheet onClose={nav.back}>
      <h2 className="text-[22px] font-black text-brand-forest">{EXPERT_SHEET.title}</h2>
      <p className="mt-1.5 text-[14px] text-brand-charcoal/80">{EXPERT_SHEET.sub}</p>
      <ul className="mt-4 space-y-2.5">
        {serviceChoices({ book: onBookService, inTraining: true }).map(c => (
          <li key={c.descriptor.type}>
            <button
              type="button"
              disabled={!c.onSelect}
              onClick={c.onSelect ?? undefined}
              className={`w-full rounded-xl bg-brand-cream p-3.5 text-left flex items-start gap-3 cursor-pointer disabled:cursor-default ${
                c.state === 'soon' ? 'disabled:opacity-50' : ''
              }`}
            >
              <UserRound size={20} className="text-brand-moss shrink-0 mt-0.5" />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-brand-forest">{c.descriptor.label}</span>
                  <ServiceNote state={c.state} className="text-brand-moss" />
                </span>
                <span className="block mt-0.5 text-[13px] text-brand-charcoal/80 leading-snug">{c.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

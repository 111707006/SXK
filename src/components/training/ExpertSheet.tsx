/**
 * 「问专家」抽屜（Keep 規格 §3.8 最後一列）：四種服務 → 既有的預約表（`onBookService`）。
 * 報告入口的「问专家」分頁與底部橫幅都開它；票 7 的詳情頁「问专家」圖示也用這一個。
 */
import { UserRound } from 'lucide-react';
import { serviceTypeDescriptors } from '../../utils/serviceTypes';
import { EXPERT_SHEET } from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { Sheet } from './ui';

export default function ExpertSheet() {
  const { nav, onBookService } = useTraining();
  return (
    <Sheet onClose={nav.back}>
      <h2 className="text-[22px] font-black text-brand-forest">{EXPERT_SHEET.title}</h2>
      <p className="mt-1.5 text-[14px] text-brand-charcoal/60">{EXPERT_SHEET.sub}</p>
      <ul className="mt-4 space-y-2.5">
        {serviceTypeDescriptors().map(s => (
          <li key={s.type}>
            <button
              type="button"
              onClick={() => onBookService(s.type)}
              className="w-full rounded-xl bg-brand-cream p-3.5 text-left flex items-start gap-3 cursor-pointer"
            >
              <UserRound size={20} className="text-brand-moss shrink-0 mt-0.5" />
              <span>
                <span className="block text-[15px] font-bold text-brand-forest">{s.label}</span>
                <span className="block mt-0.5 text-[13px] text-brand-charcoal/60 leading-snug">{s.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

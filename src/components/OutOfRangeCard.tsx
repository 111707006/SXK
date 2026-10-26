import { AlertCircle, UserRound } from 'lucide-react';
import { WORDING_1022 } from '../wording1022';
import type { ServiceType } from '../utils/serviceTypes';
import { ServiceNote, serviceChoices } from './serviceChoices';

/**
 * T1 範圍外的孩子（12–180 個月以外，`isInT1Range`）在評估面板上看到的紅燈卡（客戶 10/22，issue #82）：
 * 不給一份不適合的題目，請家長找專業人士，四種服務照既有的規則列出來（`serviceChoices`）。
 */
export default function OutOfRangeCard({ childName, onBook, onOpenTraining }: {
  childName: string;
  onBook: (type: ServiceType) => void;
  onOpenTraining?: () => void;
}) {
  return (
    <div id="t1-out-of-range" className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-left space-y-3">
      <p className="flex items-center gap-2 text-base font-black text-rose-800">
        <AlertCircle size={18} className="shrink-0 text-rose-600" />
        {WORDING_1022.outOfRange.title}
      </p>
      <p className="text-sm leading-relaxed text-rose-950">
        {WORDING_1022.outOfRange.body(childName)}
      </p>
      <div className="grid grid-cols-1 gap-2">
        {serviceChoices({ book: onBook, openTraining: onOpenTraining }).map(c => (
          <button
            key={c.descriptor.type}
            type="button"
            disabled={!c.onSelect}
            onClick={c.onSelect ?? undefined}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-white text-rose-900 text-xs font-bold text-left flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserRound size={12} className="shrink-0" />
            <span className="flex-1">{c.descriptor.label}</span>
            <ServiceNote state={c.state} className="text-rose-900/70" />
          </button>
        ))}
      </div>
    </div>
  );
}

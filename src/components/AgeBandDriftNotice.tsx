import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { AgeBandDrift } from '../utils/ageBandDrift';
import { formatAge } from '../utils/dateUtils';

interface AgeBandDriftNoticeProps {
  /** `null` 代表沒跨段（或資料不足以判斷）—— 此時整個提示不渲染。 */
  drift: AgeBandDrift | null;
  onStartT1Screening: () => void;
}

/**
 * 「目前的結果是另一個年齡段測的」。
 *
 * 三件事刻意都不做：**不擋**（舊報告的入口一個都沒動）、**不標為過期**（那份結果
 * 仍是當時的有效記錄）、**不自動失效**（沒有任何資料被清掉或隱藏）。這裡只把一個
 * 家長讀不出來的事實說出來，並把重測放在手邊。
 *
 * 因此文案的最後一句是「舊報告不會消失」。少了它，一句「建議重新篩查」在家長眼裡
 * 就是「我之前那份不算了」—— 而他會來問紀錄是不是不見了。
 */
export default function AgeBandDriftNotice({ drift, onStartT1Screening }: AgeBandDriftNoticeProps) {
  if (!drift) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 border border-amber-200 rounded-3xl px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center gap-4 text-left"
    >
      <div className="flex-1 space-y-1.5">
        <h3 className="text-sm font-black text-amber-900 flex items-center gap-1.5">
          <AlertTriangle size={14} className="shrink-0 text-amber-600" />
          目前的结果不是这个年龄段测的
        </h3>
        <p className="text-xs leading-relaxed text-amber-900/80">
          孩子现在是 <span className="font-bold">{formatAge(drift.currentAgeMonth)}</span>（
          {drift.currentAgeMonth} 个月），属于
          <span className="font-bold">「{drift.currentBand.name}」</span>；
          目前看到的结果是在 <span className="font-bold">{drift.assessedAgeMonth} 个月</span>、
          <span className="font-bold">「{drift.assessedBand.name}」</span>时测的。
          两段的题目与判准不同，建议重新做一次筛查。
        </p>
        <p className="text-[10px] text-amber-900/55">
          旧的报告不会消失，也没有失效 —— 在「评估报告」里随时读得到。
        </p>
      </div>

      <button
        type="button"
        onClick={onStartT1Screening}
        className="shrink-0 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-[0.98] cursor-pointer"
      >
        <RefreshCw size={12} className="shrink-0" />
        重新筛查
      </button>
    </div>
  );
}

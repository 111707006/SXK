/**
 * 還沒做的那兩頁（示範片庫、打卡日曆，票 8）的退路。入口在報告上是「即将开放」、點不動；
 * 走到這裡只會是歷史上留著的那一格（前進鍵）或票 7 的詳情先連過來——給一句話與回上一層，不給空白頁。
 */
import { Hourglass } from 'lucide-react';
import { COMING_SOON } from '../../t2/trainingCopy';
import { useTraining } from './TrainingContext';
import { LightNav } from './ui';

export default function ComingSoonScreen() {
  const { nav } = useTraining();
  return (
    <div className="h-full flex flex-col bg-white" data-testid="training-coming-soon">
      <LightNav onBack={nav.back} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <Hourglass size={40} className="text-brand-moss" />
        <p className="mt-4 text-[20px] font-black text-brand-forest">{COMING_SOON.title}</p>
        <p className="mt-2 text-[14px] text-brand-charcoal/70 leading-relaxed">{COMING_SOON.body}</p>
        <button
          type="button"
          onClick={nav.back}
          className="mt-6 h-11 px-6 rounded-full border border-brand-stone text-[14px] font-bold text-brand-forest cursor-pointer"
        >
          {COMING_SOON.back}
        </button>
      </div>
    </div>
  );
}

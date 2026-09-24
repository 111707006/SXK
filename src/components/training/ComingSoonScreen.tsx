/**
 * 認不得的頁的退路：歷史上留著一格舊版本認得、這一版不認得的頁（部署之後按前進鍵）。
 * 給一句話與回上一層，不給空白頁。（票 6 時示範片庫、打卡日曆也落在這裡；票 8 換成真的頁。）
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

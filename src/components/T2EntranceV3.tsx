import { PRODUCT } from '../productConfig';
import { WORDING_1022 } from '../wording1022';
import React from 'react';
import { Info, Layers } from 'lucide-react';
import type { ParentPlanV3 } from '../t2/recommend/parentPlan';
import type { T2Pricing } from '../t2/pricing';
import { promoFromV3 } from '../t2/entrancePromo';
import T2PromoCard from './T2PromoCard';

interface T2EntranceV3Props {
  /** `completed`：近 90 天做完的（`GET /api/t2/plan` 回的那一份帶著）。 */
  plan: ParentPlanV3 & { completed?: ReadonlyArray<{ code: string }> };
  /** 未解鎖（`locked`／`demo`）時 CTA 是「解鎖」。 */
  locked: boolean;
  /** 這次的價錢（照幾項分檔，伺服器 plan 的 `pricing`）。 */
  pricing: T2Pricing | null;
  /** 免費期間：卡上照樣畫價錢當參考（見 `T2Entrance`）。 */
  freePeriod?: boolean;
  onUnlock: () => void;
  onStart: () => void;
  /** 四種服務的按鈕（`T2Entrance` 走 `serviceChoices` 組好傳進來，這裡不重抄）。 */
  serviceButtons: React.ReactNode;
}

/**
 * T2 入口的完整版（T2 v3，`T2_RECOMMEND_V3`；推薦規格 §5，客規 §13.2 的模板）—— `T2Entrance` 讀到 `version: 'v3'` 的 plan 改畫這裡。
 *
 * 只畫、不算：每一句都是伺服器 `parentPlanV3` 組好的（那一檔在用字掃描裡），這一檔只放框架字。
 * 推薦了問卷時畫成 T1 報告上的短卡（`T2PromoCard`，2026-10-11）：哪幾個方面、幾項、價錢、按鈕；卡底下是提示（安全、醫療、聽力……）
 * 與這個年齡沒有問卷的方面（導四種服務）。逐份清單不在報告上，按下去之後的作答頁才列。
 * `NO_T2`：入口不出現，只留那一句「目前不需要第二层检查……」（規格 §5，取代舊入口 `none` 的整塊不出）。
 * 量表名稱是客戶給的專有名詞，照用（規格 §5）。
 */
export default function T2EntranceV3({ plan, locked, pricing, freePeriod = false, onUnlock, onStart, serviceButtons }: T2EntranceV3Props) {
  // 規則觸發改成的提示（社交溝通警訊、抽動、情緒那一題，ADR-0011）底下附預約按鈕；有了這一組，缺口那一格就不再重複一組按鈕
  const bookAtNotices = plan.notices.some(n => n.book);
  const notices = plan.notices.length > 0 && (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2" id="t2v3-entrance-notices">
      <ul className="space-y-1.5">
        {plan.notices.map(n => (
          <li key={n.kind} className="text-xs text-brand-charcoal leading-relaxed flex gap-1.5">
            <Info size={12} className="text-amber-700 shrink-0 mt-0.5" />
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
      {bookAtNotices && serviceButtons}
    </div>
  );

  const badge = (
    <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-xs font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
      <Layers size={10} /> {PRODUCT.features.ui1022 ? WORDING_1022.t2Name : '第二层 · 深度评估'}
    </span>
  );

  if (plan.status === 'NO_T2') {
    return (
      <div className="bg-white rounded-2xl border border-brand-stone/60 p-5 shadow-sm text-left space-y-3">
        {badge}
        <p className="text-xs text-brand-charcoal/80 leading-relaxed">{plan.noT2Text}</p>
        {notices}
      </div>
    );
  }

  // 推薦了卻一份都沒有（只剩這個年齡沒有問卷的方面）：不收費、不開始，只導四種服務。
  if (plan.tools.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-3">
        {badge}
        {notices}
        {plan.gaps.map(g => (
          <p key={g.dimension} className="text-xs text-brand-charcoal/80 leading-relaxed">{g.text}</p>
        ))}
        {serviceButtons}
      </div>
    );
  }

  // 報告上只出一張短卡（使用者 2026-10-11：「客人看到这么多题也不想做了」）；逐份清單、分鐘、第一次／第二次在作答頁（T2AssessmentV3）。
  return (
    <T2PromoCard
      promo={promoFromV3(plan)}
      locked={locked}
      freePeriod={freePeriod}
      pricing={pricing}
      onUnlock={onUnlock}
      onStart={onStart}
      allDone={plan.tools.every(t => plan.completed?.some(c => c.code === t.code) ?? false)}
    >
      {notices}
      {plan.gaps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          {plan.gaps.map(g => (
            <p key={g.dimension} className="text-xs text-brand-charcoal/80 leading-relaxed">{g.text}</p>
          ))}
          {!bookAtNotices && serviceButtons}
        </div>
      )}
    </T2PromoCard>
  );
}

import React from 'react';
import { ChevronRight, Info, Layers, Lock } from 'lucide-react';
import { formatFen } from '../utils/price';
import type { ParentPlanTool, ParentPlanV3 } from '../t2/recommend/parentPlan';

interface T2EntranceV3Props {
  plan: ParentPlanV3;
  /** 未解鎖（`locked`／`demo`）時 CTA 是「解鎖」。 */
  locked: boolean;
  priceFen: number;
  onUnlock: () => void;
  onStart: () => void;
  /** 四種服務的按鈕（`T2Entrance` 走 `serviceChoices` 組好傳進來，這裡不重抄）。 */
  serviceButtons: React.ReactNode;
}

/**
 * T2 入口的完整版（T2 v3，`T2_RECOMMEND_V3`；推薦規格 §5，客規 §13.2 的模板）—— `T2Entrance` 讀到 `version: 'v3'` 的 plan 改畫這裡。
 *
 * 只畫、不算：每一句都是伺服器 `parentPlanV3` 組好的（那一檔在用字掃描裡），這一檔只放框架字。
 * 由上而下：提示（安全、醫療、聽力……）→ 每一份（名稱、為什麼、誰填、幾分鐘；第一次／第二次分組）→ 合計與「建议分 2 次」
 * → 這個年齡沒有問卷的方面（導四種服務）→ 解鎖／開始作答。
 * `NO_T2`：入口不出現，只留那一句「目前不需要第二层检查……」（規格 §5，取代舊入口 `none` 的整塊不出）。
 * 量表名稱是客戶給的專有名詞，照用（規格 §5）。
 */
export default function T2EntranceV3({ plan, locked, priceFen, onUnlock, onStart, serviceButtons }: T2EntranceV3Props) {
  // 規則觸發改成的提示（社交溝通警訊、抽動、情緒那一題，ADR-0011）底下附預約按鈕；有了這一組，缺口那一格就不再重複一組按鈕
  const bookAtNotices = plan.notices.some(n => n.book);
  const notices = plan.notices.length > 0 && (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2" id="t2v3-entrance-notices">
      <ul className="space-y-1.5">
        {plan.notices.map(n => (
          <li key={n.kind} className="text-[11px] text-brand-charcoal/85 leading-relaxed flex gap-1.5">
            <Info size={12} className="text-amber-700 shrink-0 mt-0.5" />
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
      {bookAtNotices && serviceButtons}
    </div>
  );

  const badge = (
    <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
      <Layers size={10} /> 第二层 · 深度评估
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
          <p key={g.dimension} className="text-[11px] text-brand-charcoal/80 leading-relaxed">{g.text}</p>
        ))}
        {serviceButtons}
      </div>
    );
  }

  const groups: Array<{ title: string; items: ParentPlanTool[] }> = [
    { title: plan.sessions === 2 ? '第一次填写' : '要填写的问卷', items: plan.tools.filter(t => t.session === 1) },
    { title: '第二次填写', items: plan.tools.filter(t => t.session === 2) },
  ].filter(g => g.items.length > 0);
  const minutesOf = (items: ParentPlanTool[]) => items.reduce((sum, t) => sum + t.minutes, 0);

  return (
    <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-4">
      <div className="space-y-1.5">
        {badge}
        <h3 className="text-sm font-extrabold text-brand-forest">
          建议填写 {plan.tools.length} 份问卷{plan.totalMinutes > 0 && <>，约 {plan.totalMinutes} 分钟</>}
        </h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
          依筛查结果和您填写的孩子情况安排；每份都可以分开填写，答完生成深度报告。
          {plan.sessions === 2 && <>{' '}问卷比较多，建议分 2 次填写。</>}
        </p>
      </div>

      {notices}

      {groups.map(g => (
        <section key={g.title} className="space-y-2">
          <div className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">
            {g.title}
            {plan.sessions === 2 && <span className="normal-case font-semibold"> · 约 {minutesOf(g.items)} 分钟</span>}
          </div>
          <ul className="space-y-2">
            {g.items.map(t => (
              <li key={t.code} className="p-3 rounded-xl border border-brand-stone/60 bg-brand-cream/15 space-y-0.5">
                <div className="text-xs font-semibold text-brand-forest">{t.name}</div>
                <div className="text-[11px] text-brand-charcoal/75 leading-relaxed">{t.reason}</div>
                <div className="text-[10px] text-brand-charcoal/50">{t.rater} · 约 {t.minutes} 分钟</div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.gaps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          {plan.gaps.map(g => (
            <p key={g.dimension} className="text-[11px] text-brand-charcoal/80 leading-relaxed">{g.text}</p>
          ))}
          {!bookAtNotices && serviceButtons}
        </div>
      )}

      <button
        type="button"
        id={locked ? 't2v3-unlock-btn' : 't2v3-start-btn'}
        onClick={locked ? onUnlock : onStart}
        className="w-full md:w-auto px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
      >
        {locked ? <Lock size={13} /> : null}
        {locked ? <>¥{formatFen(priceFen)} 解锁深度评估</> : '开始作答'}
        {!locked && <ChevronRight size={13} />}
      </button>
    </div>
  );
}

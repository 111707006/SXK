import React, { useEffect, useState } from 'react';
import { ChevronRight, Layers, Loader2, Lock, UserRound } from 'lucide-react';
import { authFetch } from '../utils/api';
import { formatFen } from '../utils/price';
import type { DimensionAccess } from '../utils/access';
import type { ServiceType } from '../utils/serviceTypes';
import { ServiceNote, serviceChoices } from './serviceChoices';
import { describePlan, describePlanItem, expertOnlyCopy, noToolNotes, type EntranceState } from '../t2/entrance';
import { SITE_DIMENSION_NAME } from '../t2/dimensionMap';
import type { DimensionCode, PlanItem, T1Flag, T2Plan } from '../t2/types';

/** `GET /api/t2/plan` 的回應：`planT2()` 的結果加兩樣附帶資料。 */
interface PlanResponse extends T2Plan {
  t1Flags: Record<DimensionCode, T1Flag>;
  entrance: EntranceState;
}

interface T2EntranceProps {
  /** 整份 T2 的權益狀態（`getT2Access`）。`needs_login` 時整塊不出現 —— 那時整個畫面本來就是登入頁。 */
  access: DimensionAccess;
  /** 單價（分），付費牆同一個來源。 */
  priceFen: number;
  /** 未解鎖時按「解鎖」→ App 導向付費牆。 */
  onUnlock: () => void;
  /** 已解鎖時按「開始作答」→ App 導向逐支作答（票 #58）。 */
  onStart: () => void;
  /** 沒有工具的維度導向四種服務：開預約表、預選那一種。 */
  onBookService: (type: ServiceType) => void;
  /** 「线上干预训练指导」那一顆 → 導覽列那一頁「线上干预」（2026-09-29：四種並列，它就是那一頁）。 */
  onOpenTraining?: () => void;
}

/**
 * T2 深度評估的入口 —— **家長端專屬**，放進 T1 報告本體的插槽（票 #56，規格 §4.3–4.5、§9.2）。
 *
 * 家長在付費前就看到：要答幾份、約幾題；哪些被標記的維度在這個年齡沒有工具（直接導向專家）。
 * 原本還有一格「医生是否已告知诊断方向」（十選一），2026-09-29 使用者要求前後端一起拿掉。
 * 全部被標記的維度都沒有工具時，入口不出現，只剩專家導向 —— 家長不該為一份答不了的東西付錢。
 *
 * 【題量與清單從哪裡來】
 * 全部是伺服器算的（`/api/t2/plan` → `planT2`），這裡不重算、不猜。清單上不寫工具名，
 * 只寫「為哪個維度、幾題」（理由見 `src/t2/entrance.ts` 檔頭）。
 *
 * 【沒有工具的維度怎麼講】
 * 句子在 `src/t2/entrance.ts`：一般是規格 §4.5 的原話；6 歲以上的認知、語言、動作換成客戶 9/21 工作單 #6
 * 的固定句（v2.1 S05，與報告同一個常數）。清單下方走 `noToolNotes`，只導專家時的標題走 `expertOnlyCopy`。
 *
 * 【解鎖之後】
 * 已解鎖的家長在這裡看到同一份清單，CTA 是「開始作答」→ 逐支作答畫面（`T2Assessment.tsx`，票 #58），
 * 那邊的工具清單就是這份 plan。
 */
export default function T2Entrance({ access, priceFen, onUnlock, onStart, onBookService, onOpenTraining }: T2EntranceProps) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');

  const enabled = access !== 'needs_login';

  /**
   * 讀 plan。401／404（沒篩查）都當「這裡沒東西好顯示」—— 報告頁本來就是篩查之後才到得了的地方，
   * 真的碰到只代表資料還沒同步，不是要對家長解釋的事。
   */
  const fetchPlan = async (): Promise<PlanResponse | null> => {
    const resp = await authFetch('/api/t2/plan');
    const ct = resp.headers.get('content-type');
    if (!ct || !ct.includes('application/json')) throw new Error('bad content type');
    if (resp.status === 401 || resp.status === 404) return null;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as PlanResponse;
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlan();
        if (cancelled) return;
        if (!data) {
          setStatus('unavailable');
          return;
        }
        setPlan(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 plan:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  if (!enabled || status === 'unavailable') return null;

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-brand-stone/60 p-5 shadow-sm text-left flex items-center gap-2 text-xs text-brand-charcoal/60">
        <Loader2 size={14} className="animate-spin text-brand-moss" />
        正在读取深度评估的安排...
      </div>
    );
  }

  if (status === 'error' || !plan) {
    return (
      <div className="bg-white rounded-2xl border border-brand-stone/60 p-5 shadow-sm text-left text-xs text-brand-charcoal/60">
        暂时读不到深度评估的安排，稍后再打开这份报告即可。
      </div>
    );
  }

  if (plan.entrance === 'none') return null;

  const serviceButtons = (
    <div className="grid grid-cols-2 gap-2">
      {serviceChoices({ book: onBookService, openTraining: onOpenTraining }).map(c => (
        <button
          key={c.descriptor.type}
          type="button"
          disabled={!c.onSelect}
          onClick={c.onSelect ?? undefined}
          className="px-3 py-2 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-[11px] font-bold transition active:scale-[0.99] cursor-pointer text-left flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-sage/10 disabled:active:scale-100"
        >
          <UserRound size={12} className="shrink-0" />
          <span className="flex-1">{c.descriptor.label}</span>
          <ServiceNote state={c.state} className="text-brand-charcoal/60" />
        </button>
      ))}
    </div>
  );

  /** 全部被標記的維度都沒有工具：不顯示入口，只剩專家導向（§4.5）。 */
  if (plan.entrance === 'expert_only') {
    const copy = expertOnlyCopy(plan);
    return (
      <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-3">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> 第二层 · 深度评估
        </span>
        <h3 className="text-sm font-extrabold text-brand-forest">{copy.headline}</h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
          筛查中被标记的方面：{plan.noTool.map(d => SITE_DIMENSION_NAME[d]).join('、')}。
          {copy.notes.map(note => <React.Fragment key={note}>{note}</React.Fragment>)}
          四种服务都可以约，专家会照这份报告逐项说明接下来可以怎么做。
        </p>
        {serviceButtons}
      </div>
    );
  }

  const text = describePlan(plan);
  const groups: Array<{ title: string; items: PlanItem[] }> = [
    { title: '必做', items: plan.required },
    { title: '选做', items: plan.optional },
    { title: '之后可能加测', items: plan.followup },
    { title: '补充问卷（不出判定）', items: plan.extras },
  ].filter(g => g.items.length > 0);
  const locked = access === 'locked' || access === 'demo';

  return (
    <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-4">
      <div className="space-y-1.5">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> 第二层 · 深度评估
        </span>
        <h3 className="text-sm font-extrabold text-brand-forest">{text.headline}</h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
          依筛查中被标记的方面安排要答的问卷，由家长填写；答完生成深度报告与每周家庭活动。
          {text.followup && <>{' '}{text.followup}。</>}
          {text.extras && <>{' '}{text.extras}。</>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map(g => (
          <div key={g.title} className="space-y-1">
            <div className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">{g.title}</div>
            <ul className="space-y-1">
              {g.items.map(item => (
                <li key={item.toolId} className="text-xs text-brand-charcoal/85 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-moss shrink-0" />
                  {describePlanItem(item)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 有工具的維度照上面走；沒工具的維度在入口就說清楚，直接導向四種服務（§4.5）。 */}
      {plan.noTool.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          {noToolNotes(plan).map(note => (
            <p key={note.sentence} className="text-[11px] text-brand-charcoal/80 leading-relaxed">{note.text}</p>
          ))}
          {serviceButtons}
        </div>
      )}

      {!locked && (
        <button
          type="button"
          onClick={onStart}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
        >
          开始作答
          <ChevronRight size={13} />
        </button>
      )}

      {locked && (
        <button
          type="button"
          onClick={onUnlock}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Lock size={13} />
          ¥{formatFen(priceFen)} 解锁深度评估
        </button>
      )}
    </div>
  );
}

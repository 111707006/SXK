import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers, Loader2, Lock, UserRound } from 'lucide-react';
import { authFetch } from '../utils/api';
import { formatFen } from '../utils/price';
import type { DimensionAccess } from '../utils/access';
import { serviceTypeDescriptors, type ServiceType } from '../utils/serviceTypes';
import { describePlan, describePlanItem, type EntranceState } from '../t2/entrance';
import { DIAGNOSIS_OPTIONS, DIAGNOSIS_QUESTION, NO_DIAGNOSIS_LABEL, isDiagnosisDirection } from '../t2/diagnosisOptions';
import { SITE_DIMENSION_NAME } from '../t2/dimensionMap';
import type { DiagnosisDirection, DimensionCode, PlanItem, T1Flag, T2Plan } from '../t2/types';

/** `GET /api/t2/plan` 的回應：`planT2()` 的結果加三樣附帶資料。 */
interface PlanResponse extends T2Plan {
  t1Flags: Record<DimensionCode, T1Flag>;
  diagnosisDirection: DiagnosisDirection | null;
  entrance: EntranceState;
}

interface T2EntranceProps {
  /** 整份 T2 的權益狀態（`getT2Access`）。`needs_login` 時整塊不出現 —— 那時整個畫面本來就是登入頁。 */
  access: DimensionAccess;
  /** 單價（分），付費牆同一個來源。 */
  priceFen: number;
  /** 未解鎖時按「解鎖」→ App 導向付費牆。 */
  onUnlock: () => void;
  /** 沒有工具的維度導向四種服務：開預約表、預選那一種。 */
  onBookService: (type: ServiceType) => void;
}

/** 這一句是規格 §4.5 的原話（簡體），`no_tool` 的維度與「全部沒工具」都用它。 */
const NO_TOOL_SENTENCE = '这个年龄目前没有适用的深度评估工具，建议直接预约专家';

/**
 * T2 深度評估的入口 —— **家長端專屬**，放進 T1 報告本體的插槽（票 #56，規格 §4.3–4.5、§9.2）。
 *
 * 家長在付費前就看到：要答幾份、約幾題（必做、選做、加測分開）；醫師是否已告知診斷方向
 * （十選一、可不填、選了畫面即時重算）；哪些被標記的維度在這個年齡沒有工具（直接導向專家）。
 * 全部被標記的維度都沒有工具時，入口不出現，只剩專家導向 —— 家長不該為一份答不了的東西付錢。
 *
 * 【題量與清單從哪裡來】
 * 全部是伺服器算的（`/api/t2/plan` → `planT2`），這裡不重算、不猜。清單上不寫工具名，
 * 只寫「為哪個維度、幾題」（理由見 `src/t2/entrance.ts` 檔頭）。
 *
 * 【診斷方向的字】
 * 十個選項與問句 import 自 `src/t2/diagnosisOptions.ts`，這一檔**不手抄任何一個**——它們是
 * 醫師講出口的名稱，主語是醫師不是孩子，所以那一檔不進家長用字掃描；這一檔進。
 * `test/t2EntranceCopy.structure.test.ts` 釘住「這裡沒有那些字」。沒填是「未告知」，
 * 一個正常答案；畫面上沒有「未提供」「未填寫」這種像缺漏的字樣（§4.3）。
 *
 * 【解鎖之後】
 * 已解鎖的家長在這裡看到同一份清單，沒有 CTA —— 逐支作答的入口是 #58 的事（那張票
 * 的「工具清單」就是這份 plan）。這一版刻意不放一顆按了沒有下一頁的按鈕。
 */
export default function T2Entrance({ access, priceFen, onUnlock, onBookService }: T2EntranceProps) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [diagnosis, setDiagnosis] = useState<DiagnosisDirection | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** 家長連續換選項時，只認最後一次的回應。 */
  const requestSeq = useRef(0);

  const enabled = access !== 'needs_login';

  /**
   * 讀 plan。`query` 帶 `?diagnosis=` 時伺服器以它為準（即時重算），不帶就用存的那一個。
   * 401／404（沒篩查）都當「這裡沒東西好顯示」—— 報告頁本來就是篩查之後才到得了的地方，
   * 真的碰到只代表資料還沒同步，不是要對家長解釋的事。
   */
  const fetchPlan = async (query = ''): Promise<PlanResponse | null> => {
    const resp = await authFetch(`/api/t2/plan${query}`);
    const ct = resp.headers.get('content-type');
    if (!ct || !ct.includes('application/json')) throw new Error('bad content type');
    if (resp.status === 401 || resp.status === 404) return null;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as PlanResponse;
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const seq = ++requestSeq.current;
    (async () => {
      try {
        const data = await fetchPlan();
        if (cancelled || seq !== requestSeq.current) return;
        if (!data) {
          setStatus('unavailable');
          return;
        }
        setPlan(data);
        setDiagnosis(data.diagnosisDirection);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load T2 plan:', err);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  /**
   * 換了選項：畫面**立刻**用查詢字串重算（不等存檔），同時把選擇存到伺服器。
   * 存失敗只提示「沒保存成功」，題量照新的選擇顯示 —— 數字對這個選擇是對的，
   * 錯的只是它還沒記下來，兩件事分開講。
   */
  const changeDiagnosis = async (raw: string) => {
    const next: DiagnosisDirection | null = isDiagnosisDirection(raw) ? raw : null;
    setDiagnosis(next);
    setSaveError(null);
    setRecomputing(true);
    const seq = ++requestSeq.current;
    const [planResult, saveResult] = await Promise.allSettled([
      fetchPlan(`?diagnosis=${encodeURIComponent(next ?? '')}`),
      authFetch('/api/t2/diagnosis', { method: 'PUT', body: JSON.stringify({ diagnosis: next }) }),
    ]);
    if (seq !== requestSeq.current) return;
    setRecomputing(false);
    if (planResult.status === 'fulfilled' && planResult.value) setPlan(planResult.value);
    const saved = saveResult.status === 'fulfilled' && saveResult.value.ok;
    if (!saved) setSaveError('这一项没有保存成功，题量已按您的选择显示，稍后可再选一次。');
  };

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
      {serviceTypeDescriptors().map(d => (
        <button
          key={d.type}
          type="button"
          onClick={() => onBookService(d.type)}
          className="px-3 py-2 rounded-xl border border-brand-moss/30 bg-brand-sage/10 hover:bg-brand-sage/30 text-brand-forest text-[11px] font-bold transition active:scale-[0.99] cursor-pointer text-left flex items-center gap-1.5"
        >
          <UserRound size={12} className="shrink-0" />
          {d.label}
        </button>
      ))}
    </div>
  );

  /** 全部被標記的維度都沒有工具：不顯示入口，只剩專家導向（§4.5）。 */
  if (plan.entrance === 'expert_only') {
    return (
      <div className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-3">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> 第二层 · 深度评估
        </span>
        <h3 className="text-sm font-extrabold text-brand-forest">{NO_TOOL_SENTENCE}</h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
          筛查中被标记的方面：{plan.noTool.map(d => SITE_DIMENSION_NAME[d]).join('、')}。
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
        <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-2">
          {text.headline}
          {recomputing && <Loader2 size={12} className="animate-spin text-brand-moss" />}
        </h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">
          依筛查中被标记的方面安排要答的问卷，由家长填写；答完生成深度报告与每周家庭活动。
          {text.followup && <>{' '}{text.followup}。</>}
          {text.extras && <>{' '}{text.extras}。</>}
        </p>
      </div>

      {/* 診斷方向（§4.3）：問醫師說了什麼，可不填，不填不擋。 */}
      <div className="rounded-xl border border-brand-stone/60 bg-brand-cream/30 p-3 space-y-2">
        <label htmlFor="t2-diagnosis" className="text-[11px] font-bold text-brand-charcoal/80 block">
          {DIAGNOSIS_QUESTION}
          <span className="font-medium text-brand-charcoal/50">（可不填；选了会重新计算题量）</span>
        </label>
        <div className="relative max-w-xs">
          <select
            id="t2-diagnosis"
            value={diagnosis ?? ''}
            onChange={e => changeDiagnosis(e.target.value)}
            className="w-full appearance-none cursor-pointer bg-white border border-brand-stone/60 rounded-xl px-3 py-2 pr-8 text-xs text-brand-charcoal transition focus:outline-none focus:ring-2 focus:ring-brand-moss/20 focus:border-brand-moss"
          >
            <option value="">{NO_DIAGNOSIS_LABEL}</option>
            {DIAGNOSIS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-charcoal/40 pointer-events-none" />
        </div>
        {saveError && <p className="text-[10px] text-amber-800">{saveError}</p>}
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
          <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">
            「{plan.noTool.map(d => SITE_DIMENSION_NAME[d]).join('、')}」{NO_TOOL_SENTENCE}。
          </p>
          {serviceButtons}
        </div>
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

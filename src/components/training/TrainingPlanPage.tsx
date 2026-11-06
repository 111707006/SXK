/**
 * 訓練計劃頁（客戶 10/22，#110，開關 `TRAINING_PLAN`）：首頁「线上家庭个性化训练」與續買入口在沒有有效使用權時到這裡。
 * 「VIP 兑换」一格（簡報 11/03 第 8 頁）＋三張方案卡（月數、價錢、一句說明）、付款鈕（微信支付沒設齊時「暂未开放」，#111）。
 * 兌換成功當場說「已开通，到 X 月 X 日」，按鈕帶去居家訓練。
 */
import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { TRAINING_PLAN_PAGE } from '../../t2/trainingPlanCopy';
import RedeemCodeForm from './RedeemCodeForm';

interface PlanCard {
  months: 1 | 3 | 6;
  priceFen: number | null;
  title: string;
  blurb: string;
}

export function readPlans(body: unknown): { plans: PlanCard[]; payAvailable: boolean } {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const plans = Array.isArray(b.plans)
    ? (b.plans as any[]).filter(p => [1, 3, 6].includes(p?.months) && typeof p.title === 'string' && typeof p.blurb === 'string')
        .map(p => ({ months: p.months, priceFen: typeof p.priceFen === 'number' && p.priceFen > 0 ? p.priceFen : null, title: p.title, blurb: p.blurb }))
    : [];
  return { plans, payAvailable: b.payAvailable === true };
}

const yuan = (fen: number) => `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : 1)}`;

export default function TrainingPlanPage({
  loggedIn,
  onActivated,
  onGoTraining,
  onPay,
  active,
}: {
  loggedIn: boolean;
  /** 現在已經有使用權：`endsOn` 是迄日（免費期沒有迄日＝null）。沒有使用權不給。 */
  active?: { endsOn: string | null };
  /** 兌換或付款成功：上層重讀使用權。 */
  onActivated: () => void;
  onGoTraining: () => void;
  /** 付款（#111）；沒給或 `payAvailable` 是 false 時按鈕不能按。 */
  onPay?: (months: 1 | 3 | 6) => void;
}) {
  const [data, setData] = useState<{ plans: PlanCard[]; payAvailable: boolean } | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [activatedTo, setActivatedTo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/training/plans')
      .then(r => (r.ok ? r.json() : null))
      .then(body => alive && setData(readPlans(body)))
      .catch(() => alive && setData({ plans: [], payAvailable: false }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div id="training-plan-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-xl font-black text-ledo-ink">{TRAINING_PLAN_PAGE.title}</h2>
        <p className="text-xs leading-relaxed text-ledo-ink-2">{TRAINING_PLAN_PAGE.sub}</p>
      </div>

      {/* 已經有使用權（例如免費期、兌換過）：上面先說開通到哪天，按鈕直接去線上家庭訓練。 */}
      {active && !activatedTo && (
        <div id="training-plan-active" className="space-y-3 rounded-3xl bg-ledo-ok p-4 text-ledo-ok-ink">
          <p className="text-sm font-black">{active.endsOn ? TRAINING_PLAN_PAGE.activated(active.endsOn) : TRAINING_PLAN_PAGE.activeNoEnd}</p>
          <button type="button" onClick={onGoTraining} className="w-full rounded-full bg-ledo-bar py-3 text-sm font-black text-white cursor-pointer">{TRAINING_PLAN_PAGE.goTraining}</button>
        </div>
      )}

      {activatedTo && (
        <div id="training-plan-activated" className="space-y-3 rounded-3xl bg-ledo-ok p-4 text-ledo-ok-ink">
          <p className="text-sm font-black">{TRAINING_PLAN_PAGE.activated(activatedTo)}</p>
          <button type="button" onClick={onGoTraining} className="w-full rounded-full bg-ledo-bar py-3 text-sm font-black text-white cursor-pointer">{TRAINING_PLAN_PAGE.goTraining}</button>
        </div>
      )}

      {/* 「VIP 兑换」一格（簡報 11/03 第 8 頁：參考圖「免费使用」那一格改成 VIP 兌換；取代原本右上角的「兑换码」小鈕）。 */}
      <div id="training-plan-vip" className="space-y-3 rounded-3xl border-[1.5px] border-ledo-accent bg-ledo-accent-soft/50 p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-1.5 text-base font-black text-ledo-ink"><Gift size={15} />{TRAINING_PLAN_PAGE.vipTitle}</p>
            <p className="text-xs leading-relaxed text-ledo-ink-2">{TRAINING_PLAN_PAGE.vipBlurb}</p>
          </div>
          <button type="button" id="training-plan-redeem-entry" onClick={() => setRedeemOpen(o => !o)}
            className="shrink-0 rounded-full bg-ledo-accent px-3.5 py-1.5 text-xs font-black text-white cursor-pointer">
            {TRAINING_PLAN_PAGE.redeemSubmit}
          </button>
        </div>
        {redeemOpen && !activatedTo && (
          <RedeemCodeForm loggedIn={loggedIn} onActivated={endsOn => { setActivatedTo(endsOn); onActivated(); }} />
        )}
      </div>

      {data === null ? (
        <Loader2 size={16} className="animate-spin text-ledo-ink-2" />
      ) : (
        <div className="space-y-2.5">
          {data.plans.map(p => (
            <div key={p.months} id={`training-plan-${p.months}`} className="flex items-center gap-3 rounded-3xl border-[1.5px] border-ledo-line p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-black text-ledo-ink">{p.title}</p>
                <p className="text-xs leading-relaxed text-ledo-ink-2">{p.blurb}</p>
              </div>
              <div className="shrink-0 space-y-1.5 text-right">
                <p className="text-lg font-black text-ledo-ink">{p.priceFen === null ? TRAINING_PLAN_PAGE.priceTbd : yuan(p.priceFen)}</p>
                <button
                  type="button"
                  disabled={!data.payAvailable || !onPay || p.priceFen === null}
                  onClick={() => onPay?.(p.months)}
                  className="rounded-full bg-ledo-accent px-3.5 py-1.5 text-xs font-black text-white disabled:bg-ledo-field disabled:text-ledo-ink-2 cursor-pointer disabled:cursor-default"
                >
                  {data.payAvailable && onPay && p.priceFen !== null ? TRAINING_PLAN_PAGE.pay : TRAINING_PLAN_PAGE.payUnavailable}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

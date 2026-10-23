/**
 * 訓練計劃頁（客戶 10/22，#110，開關 `TRAINING_PLAN`）：首頁「线上家庭个性化训练」與續買入口在沒有有效使用權時到這裡。
 * 三張方案卡（月數、價錢、一句說明）、付款鈕（微信支付沒設齊時「暂未开放」，#111）、角落「兑换码」。
 * 兌換成功當場說「已开通，到 X 月 X 日」，按鈕帶去居家訓練。
 */
import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { authFetch } from '../../utils/api';
import { TRAINING_PLAN_PAGE } from '../../t2/trainingPlanCopy';

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
}: {
  loggedIn: boolean;
  /** 兌換或付款成功：上層重讀使用權。 */
  onActivated: () => void;
  onGoTraining: () => void;
  /** 付款（#111）；沒給或 `payAvailable` 是 false 時按鈕不能按。 */
  onPay?: (months: 1 | 3 | 6) => void;
}) {
  const [data, setData] = useState<{ plans: PlanCard[]; payAvailable: boolean } | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) return setMessage(TRAINING_PLAN_PAGE.redeemNeedLogin);
    setBusy(true);
    setMessage(null);
    try {
      const resp = await authFetch('/api/training/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok && typeof body.endsOn === 'string') {
        setActivatedTo(body.endsOn);
        onActivated();
      } else {
        setMessage(resp.status === 429 ? TRAINING_PLAN_PAGE.redeemTooMany : resp.status === 401 ? TRAINING_PLAN_PAGE.redeemNeedLogin : TRAINING_PLAN_PAGE.redeemInvalid);
      }
    } catch {
      setMessage(TRAINING_PLAN_PAGE.redeemInvalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="training-plan-page" className="mx-auto w-full max-w-xl space-y-4 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-ledo-ink">{TRAINING_PLAN_PAGE.title}</h2>
          <p className="text-xs leading-relaxed text-ledo-ink-2">{TRAINING_PLAN_PAGE.sub}</p>
        </div>
        <button type="button" id="training-plan-redeem-entry" onClick={() => setRedeemOpen(o => !o)}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-ledo-line px-3 py-1.5 text-xs font-bold text-ledo-ink cursor-pointer">
          <Gift size={12} />{TRAINING_PLAN_PAGE.redeemEntry}
        </button>
      </div>

      {activatedTo ? (
        <div id="training-plan-activated" className="space-y-3 rounded-3xl bg-ledo-ok p-4 text-ledo-ok-ink">
          <p className="text-sm font-black">{TRAINING_PLAN_PAGE.activated(activatedTo)}</p>
          <button type="button" onClick={onGoTraining} className="w-full rounded-full bg-ledo-bar py-3 text-sm font-black text-white cursor-pointer">{TRAINING_PLAN_PAGE.goTraining}</button>
        </div>
      ) : redeemOpen && (
        <form id="training-plan-redeem" onSubmit={redeem} className="space-y-2 rounded-3xl bg-ledo-field p-4">
          <input
            id="training-plan-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={TRAINING_PLAN_PAGE.redeemPlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={20}
            className="w-full rounded-[18px] border-[1.5px] border-ledo-line bg-white px-3.5 py-2.5 text-base font-bold tracking-widest text-ledo-ink"
          />
          {message && <p className="text-xs font-bold text-ledo-more-ink">{message}</p>}
          <button type="submit" disabled={busy || code.trim() === ''} className="w-full rounded-full bg-ledo-bar py-3 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
            {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : TRAINING_PLAN_PAGE.redeemSubmit}
          </button>
        </form>
      )}

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

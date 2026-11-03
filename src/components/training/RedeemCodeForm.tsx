/**
 * 兌換碼的輸入框（#110）：訓練計劃頁角落與個人中心（使用者 2026-11-03：「加入口」—— 免費期間家長不會被帶到訓練計劃頁）共用。
 * 碼大小寫與分隔符不拘，伺服器 `POST /api/training/redeem` 再正規化；錯的、用過的、作廢的都是同一句。
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authFetch } from '../../utils/api';
import { TRAINING_PLAN_PAGE } from '../../t2/trainingPlanCopy';

export default function RedeemCodeForm({ loggedIn, onActivated, idPrefix = 'training-plan' }: {
  loggedIn: boolean;
  /** 兌換成功（`endsOn`＝接得上的最後一天）；上層重讀使用權。 */
  onActivated: (endsOn: string) => void;
  /** 兩處同時在畫面上時 id 不撞（`training-plan-code`／`profile-redeem-code`）。 */
  idPrefix?: string;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) return setMessage(TRAINING_PLAN_PAGE.redeemNeedLogin);
    setBusy(true);
    setMessage(null);
    try {
      const resp = await authFetch('/api/training/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok && typeof body.endsOn === 'string') {
        onActivated(body.endsOn);
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
    <form id={`${idPrefix}-redeem`} onSubmit={redeem} className="space-y-2 rounded-3xl bg-ledo-field p-4">
      <input
        id={`${idPrefix}-code`}
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
  );
}

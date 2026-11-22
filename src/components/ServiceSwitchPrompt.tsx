/**
 * 換人提示（#120，ADR-0020 第 6 點）：「你目前由 X 服务，要换成 Y 吗？」兩個按鈕。
 *
 * 提示從三處來（`promptStore`）：登入驗證、兌換碼、已登入時點了連結（這裡打 `/api/service-relation/link`）。
 * 選「换」打 `/api/service-relation/switch`，送回提示原樣的來源，伺服器重算再寫；選「不换」關掉，本次登入內不再問同一個來源。
 * 服務關係開關關著時伺服器不會回提示、`/link` 是 404，這個元件什麼都不畫。
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { authFetch } from '../utils/api';
import { peekVisitLink } from '../utils/attribution';
import {
  clearServiceSwitch,
  declineServiceSwitch,
  offerServiceSwitch,
  pendingServiceSwitch,
  shouldCheckVisitLink,
  subscribeServiceSwitch,
} from '../serviceRelations/promptStore';
import { SERVICE_SWITCH_COPY, switchResultMessage } from '../serviceRelations/parentCopy';

export default function ServiceSwitchPrompt({ loggedIn }: { loggedIn: boolean }) {
  const prompt = useSyncExternalStore(subscribeServiceSwitch, pendingServiceSwitch, () => null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 已登入的家長這次是點連結進來的：問伺服器一次（還沒有服務關係就直接掛上，有了而不同就回提示）。
  useEffect(() => {
    if (!loggedIn || !shouldCheckVisitLink()) return;
    authFetch('/api/service-relation/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(peekVisitLink()),
    })
      .then(resp => (resp.ok ? resp.json() : null))
      .then(body => body?.serviceSwitch && offerServiceSwitch(body.serviceSwitch))
      .catch(() => {
        // 問不到：這次就不問，不影響其他畫面。
      });
  }, [loggedIn]);

  if (!loggedIn || (!prompt && !message)) return null;

  const confirm = async () => {
    if (!prompt) return;
    setBusy(true);
    try {
      const resp = await authFetch('/api/service-relation/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: prompt.source }),
      });
      const body = resp.ok ? await resp.json().catch(() => null) : null;
      // 伺服器重算後說不用換（`changed: false`：已經是同一位、或來源已經不算數）就不能說「已经换成」。
      setMessage(switchResultMessage(resp.ok, body?.changed === true, prompt.toName));
    } catch {
      setMessage(SERVICE_SWITCH_COPY.failed);
    }
    clearServiceSwitch();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="service-switch-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="service-switch-title" className="text-base font-bold text-brand-forest">
          {SERVICE_SWITCH_COPY.title}
        </h2>
        {message ? (
          <>
            <p className="mt-3 text-sm text-brand-charcoal" role="status">{message}</p>
            <button type="button" onClick={() => setMessage(null)} className="mt-5 w-full rounded-full bg-brand-forest py-3 text-sm font-bold text-white">
              好的
            </button>
          </>
        ) : (
          prompt && (
            <>
              <p className="mt-3 text-sm text-brand-charcoal">{SERVICE_SWITCH_COPY.question(prompt.currentName, prompt.toName)}</p>
              <p className="mt-1 text-xs text-brand-charcoal/80">{SERVICE_SWITCH_COPY.hint}</p>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" disabled={busy} onClick={confirm} className="w-full rounded-full bg-brand-forest py-3 text-sm font-bold text-white disabled:opacity-50">
                  {SERVICE_SWITCH_COPY.switchTo(prompt.toName)}
                </button>
                <button type="button" disabled={busy} onClick={declineServiceSwitch} className="w-full rounded-full border border-brand-stone py-3 text-sm font-bold text-brand-charcoal disabled:opacity-50">
                  {SERVICE_SWITCH_COPY.keep}
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

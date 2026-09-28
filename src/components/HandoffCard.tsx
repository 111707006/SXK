import { useEffect, useState } from 'react';
import { ChevronRight, Layers, Loader2 } from 'lucide-react';
import { authFetch } from '../utils/api';
import { HANDOFF_CARD } from '../handoff/handoffCopy';

/**
 * 專案 B 報告頁的「到 A 做深度評估」卡（ADR-0009、docs/specs/b-to-a-handoff.md §5）。
 * 放在 A 的 T2 入口同一個位置（報告本體的 T2 插槽），只掛在即時報告上。
 *
 * 畫不畫由伺服器決定：`GET /api/handoff/config` 回 `enabled` 才畫（交接關著、沒登入就整張不出現，
 * 不留一顆按不動的按鈕）。接收端的名字也從那裡來 —— B 的建置不寫品牌名（見 `handoffCopy.ts`）。
 *
 * 按下 → `POST /api/handoff/start {consent: true}` → 整頁換到回來的連結（碼在網址片段裡，2 分鐘）。
 */
export default function HandoffCard({ onShowPrivacy }: { onShowPrivacy: () => void }) {
  const [targetName, setTargetName] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 沒登入不問：發碼要登入，未登入的裝置模式看到這張卡也按不下去。
    if (!localStorage.getItem('senxinkang_token')) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/handoff/config');
        const data = await resp.json().catch(() => null);
        if (!cancelled && resp.ok && data?.enabled === true && typeof data.targetName === 'string' && data.targetName) {
          setTargetName(data.targetName);
        }
      } catch {
        // 問不到就當作沒開：少一張卡，不是一個錯誤。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!targetName) return null;

  const go = async () => {
    setGoing(true);
    setError('');
    try {
      const resp = await authFetch('/api/handoff/start', { method: 'POST', body: JSON.stringify({ consent: true }) });
      const data = await resp.json().catch(() => null);
      if (resp.ok && typeof data?.url === 'string') {
        // 留著「正在前往…」：頁面換走之前按鈕不再能按第二次（第二次會再發一個碼）。
        window.location.href = data.url;
        return;
      }
      // 401 已由 authFetch 處理（登出、回登入頁）；其餘照伺服器給的原因說。
      setError(typeof data?.error === 'string' && data.error ? data.error : HANDOFF_CARD.failed);
    } catch {
      setError(HANDOFF_CARD.failed);
    }
    setGoing(false);
  };

  return (
    <div id="handoff-card" className="bg-white rounded-2xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-5 shadow-sm text-left space-y-4">
      <div className="space-y-1.5">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-[10px] font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
          <Layers size={10} /> {HANDOFF_CARD.badge}
        </span>
        <h3 className="text-sm font-extrabold text-brand-forest">{HANDOFF_CARD.title(targetName)}</h3>
        <p className="text-[11px] text-brand-charcoal/70 leading-relaxed max-w-2xl">{HANDOFF_CARD.body(targetName)}</p>
      </div>

      <div className="space-y-2">
        <button
          id="handoff-start-btn"
          type="button"
          onClick={go}
          disabled={going}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
        >
          {going ? <Loader2 size={13} className="animate-spin" /> : null}
          {going ? HANDOFF_CARD.going : HANDOFF_CARD.button(targetName)}
          {!going && <ChevronRight size={13} />}
        </button>
        <p className="text-[10px] text-brand-charcoal/55 leading-relaxed">
          {HANDOFF_CARD.consent(targetName)}，
          <button type="button" onClick={onShowPrivacy} className="underline underline-offset-2 hover:text-brand-forest cursor-pointer">
            {HANDOFF_CARD.privacy}
          </button>
        </p>
        {error && (
          <p role="alert" className="text-[11px] font-bold text-amber-800">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

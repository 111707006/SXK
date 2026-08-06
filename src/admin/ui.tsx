/**
 * 管理中心共用的畫面零件與資料載入。
 *
 * 後台有六個分頁，每一個都是「載入 → 顯示 → 修改 → 重新載入」的同一個形狀。
 * 沒有這個檔案，那個形狀會被抄六份，而錯誤處理與載入狀態最容易在抄的過程中
 * 走樣 —— 其中一份忘了處理 401，使用者就會停在一個永遠轉不完的圈上。
 *
 * 這裡只有外觀與流程，**沒有任何授權判斷**。誰看得到什麼在 `adminView.ts`。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AdminApiError } from './adminApi';
import { describeApiError, type AdminErrorView } from './adminView';

/** 把任何一種失敗翻成畫面說得出口的話。 */
export function toErrorView(err: unknown): AdminErrorView {
  if (err instanceof AdminApiError) {
    return describeApiError({ code: err.code, status: err.status, message: err.message });
  }
  // fetch 本身 reject（斷線、DNS、被防火牆擋掉）時拿到的是 TypeError，
  // 訊息是英文的 "Failed to fetch" —— 直接顯示給維運人員看沒有意義。
  if (err instanceof TypeError) {
    return { message: '无法连线到伺服器，请检查网路后再试。', action: 'none' };
  }
  return { message: err instanceof Error ? err.message : '发生未知错误。', action: 'none' };
}

/**
 * 分頁的資料載入。
 *
 * `onError` 收到的是已經分流過的錯誤 —— 401 與 503 要由外層的殼處理（回登入、
 * 標成不可用），不是由分頁自己畫一個紅框然後讓人繼續按。
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
  onError: (view: AdminErrorView) => void
): { data: T | null; loading: boolean; failure: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // load 與 onError 每次 render 都是新的函式。放進 deps 會讓 effect 每次都重跑
  // （無限請求）；用 ref 讓 effect 只由呼叫端宣告的 deps 決定。
  const loadRef = useRef(load);
  const errorRef = useRef(onError);
  loadRef.current = load;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure(null);
    loadRef
      .current()
      .then(result => {
        // 使用者可能已經切到別的公司了。丟掉舊請求的結果，否則畫面會短暫
        // 顯示上一家公司的資料 —— 在這個系統裡那不是閃爍，是外洩。
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        const view = toErrorView(err);
        setLoading(false);
        setData(null);
        // `failure` **一律**設定，即使這個錯誤同時要往上送給殼處理。
        // 少了這一行，呼叫端只看得到 `data === null`，而 `null` 與「查到零筆」
        // 在畫面上長得一模一樣 —— 一次失敗的查詢會被畫成「這家公司沒有家長」。
        // 殼切換畫面是非同步的（select_company 要重新取身分），中間那段空窗
        // 正是這個謊會被看見的時候。
        setFailure(view.message);
        if (view.action !== 'none') errorRef.current(view);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { data, loading, failure, reload };
}

// ══════════════════════════════════════════════
// 外觀零件
// ══════════════════════════════════════════════

export function Spinner({ label = '载入中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-brand-charcoal/50">
      <Loader2 size={14} className="animate-spin" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="space-y-1.5">
        <p className="text-xs leading-relaxed text-amber-900">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-[11px] font-bold text-amber-700 underline">
            重试
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-xs font-bold text-brand-forest">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-brand-charcoal/50">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-brand-stone bg-white p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-brand-forest">{title}</h2>
          {description && (
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-brand-charcoal/50">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
};

export function Button({ variant = 'primary', busy, children, className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
  const skin =
    variant === 'primary'
      ? 'bg-brand-forest text-white'
      : variant === 'danger'
        ? 'border border-red-200 bg-red-50 text-red-700'
        : 'border border-brand-stone bg-white text-brand-charcoal';
  return (
    // `disabled` 寫在 {...rest} **之後**：反過來的話，呼叫端只要明確傳了
    // `disabled={false}`，展開就會把 busy 算出來的 true 蓋掉，送出中的按鈕
    // 又變回可以重複點 —— 在「开设后台帐号」上就是連開兩個帳號。
    <button className={`${base} ${skin} ${className}`} {...rest} disabled={busy || rest.disabled}>
      {busy && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-bold text-brand-charcoal/70">{label}</span>
      {children}
      {hint && <span className="block text-[10px] leading-relaxed text-brand-charcoal/45">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-xl border border-brand-stone bg-brand-cream/40 px-3 py-2 text-xs text-brand-charcoal outline-none transition focus:border-brand-moss';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className || ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} leading-relaxed ${props.className || ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className || ''}`} />;
}

/** 判定的顏色。文字本身由 `adminView.statusLabel` 提供，這裡只管顏色。 */
export function StatusBadge({ status, children }: { status: string; children: React.ReactNode }) {
  const skin =
    status === 'delay'
      ? 'bg-red-50 text-red-700 border-red-100'
      : status === 'borderline'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-brand-sage text-brand-forest border-brand-stone';
  return (
    <span className={`inline-block rounded-lg border px-2 py-0.5 text-[10px] font-bold ${skin}`}>{children}</span>
  );
}

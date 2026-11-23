/**
 * 成人 ADHD（`VITE_APP_MODE=adhd`）的受評者端外殼：登入（沿用 B 的 `AuthScreen`，`?c=` 照舊）、歷次結果、
 * 開始新的評估。作答與報告不在這裡 —— 是客戶的 HTML（`/assess/`，`src/adhd/bridge.js`）。
 * 設計：`docs/specs/adhd-product-design.md` 第 2.2 節。
 */
import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, FileText, LogOut, Plus } from 'lucide-react';
import AuthScreen from '../components/AuthScreen';
import { BrandMark } from '../components/BrandMark';
import { BeianFooter } from '../components/BeianFooter';
import { PRODUCT } from '../productConfig';
import { ASSESS_PATH } from './page';

/** 這幾個鍵 `bridge.js` 也用（`test/adhdShell.structure.test.ts` 比對兩邊一致）。 */
export const USER_TOKEN_KEY = 'senxinkang_token';
export const IDENTITY_KEY = 'senxinkang_user_email';
export const DRAFT_PREFIX = 'ADHD_SCREEN_LOCAL_V15:';
export const OWNER_KEY = 'sxk_adhd_owner';
export const CASE_KEY = 'sxk_adhd_case';

interface ListItem {
  id: number;
  subjectName: string;
  conclusionTitle: string;
  createdAt: string;
  updatedAt: string;
}

/** 登入後要回去的地方：只收 `/assess/` 底下（不做開放轉址）。 */
export function safeNext(search: string): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith(ASSESS_PATH) || next.includes('//') || next.includes('\\')) return null;
  return next;
}

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** 登出：通行證與這台裝置上的本機草稿一起清掉（合作單位的共用平板）。 */
function clearSession() {
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(DRAFT_PREFIX) || k === OWNER_KEY || k === CASE_KEY)) drop.push(k);
    }
    drop.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* 存取不了就算了，下一次 bridge 換人時也會清 */
  }
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function AdhdShell() {
  const [token, setToken] = useState<string | null>(() => read(USER_TOKEN_KEY));
  const [identity, setIdentity] = useState<string | null>(() => read(IDENTITY_KEY));
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = PRODUCT.brand.documentTitle;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setIdentity(null);
    setItems(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setError(null);
    fetch('/api/adhd/assessments', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) {
          if (alive) logout();
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const body = await r.json();
        if (alive) setItems(body.assessments ?? []);
      })
      .catch(() => alive && setError('读取失败，请稍后刷新再试。'));
    return () => {
      alive = false;
    };
  }, [token, logout]);

  if (!token) {
    return (
      <div className="min-h-screen bg-brand-cream/40 flex flex-col items-center justify-center gap-4 p-4">
        <AuthScreen
          dbConfigured={null}
          onAuthSuccess={(phone, newToken) => {
            if (!newToken) return;
            try {
              localStorage.setItem(USER_TOKEN_KEY, newToken);
              localStorage.setItem(IDENTITY_KEY, phone);
            } catch {
              /* 沒有本機儲存：這一頁照樣能看，作答頁會再要求登入 */
            }
            const next = safeNext(window.location.search);
            if (next) {
              window.location.assign(next);
              return;
            }
            setToken(newToken);
            setIdentity(phone);
          }}
        />
        <BeianFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream/40 text-brand-charcoal">
      <header className="bg-white border-b border-brand-stone/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-forest text-white flex items-center justify-center font-extrabold overflow-hidden">
            <BrandMark />
          </div>
          <h1 className="text-base font-black text-brand-forest flex-1">{PRODUCT.brand.headerTitle}</h1>
          {identity && <span className="text-xs text-brand-charcoal/70 hidden sm:inline">{identity}</span>}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-forest hover:underline cursor-pointer"
          >
            <LogOut size={13} />
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <section className="bg-white rounded-3xl border border-brand-stone/60 p-5 space-y-3">
          <h2 className="text-sm font-black text-brand-forest">开始评估</h2>
          <p className="text-xs leading-relaxed text-brand-charcoal/80">
            依序填写基本信息与四页量表，完成后查看筛查结果。结果会保存在您的账户里，之后可以在这里再次查看。
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${ASSESS_PATH}?new=1`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-brand-forest text-white text-xs font-extrabold hover:bg-brand-forest-dark"
            >
              <Plus size={14} />
              开始新的评估
            </a>
            <a
              href={ASSESS_PATH}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-brand-forest/30 text-brand-forest text-xs font-extrabold hover:bg-brand-sage/20"
            >
              <ClipboardList size={14} />
              继续上次的填写
            </a>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-brand-stone/60 p-5 space-y-3">
          <h2 className="text-sm font-black text-brand-forest">我的结果</h2>
          {error && <p className="text-xs text-rose-700">{error}</p>}
          {items === null && !error && <p className="text-xs text-brand-charcoal/60">读取中…</p>}
          {items?.length === 0 && <p className="text-xs text-brand-charcoal/60">还没有完成的评估。</p>}
          {items && items.length > 0 && (
            <ul className="divide-y divide-brand-stone/40">
              {items.map(it => (
                <li key={it.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-brand-charcoal truncate">{it.conclusionTitle}</p>
                    <p className="text-xs text-brand-charcoal/60">
                      {it.subjectName} · {when(it.updatedAt || it.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`${ASSESS_PATH}?view=${it.id}`}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-forest hover:underline"
                  >
                    <FileText size={13} />
                    查看
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-8 text-center text-[11px] text-brand-charcoal/50">
        {PRODUCT.brand.copyright}
        <BeianFooter />
      </footer>
    </div>
  );
}

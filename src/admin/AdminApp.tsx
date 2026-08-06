/**
 * 管理中心的殼 —— 登入、公司切換、分頁切換。
 *
 * 這個檔案刻意只做三件事：拿身分、依身分決定顯示什麼、把錯誤分流。
 * **「誰看得到什麼」的判斷一律來自 `adminView.ts`**，不寫在下面的 JSX 條件裡：
 * 專案沒有 jsdom，寫在這裡的判斷沒有任何一條測試驗得到，而它們錯掉的樣子
 * 恰好都很正常（一個空列表、一個多出來的選單項目）。
 *
 * 與家長端共用同一份部署與資料庫，但工作階段完全分開（不同的 localStorage 鍵、
 * 後端不同的簽章）—— 後台成員在同一台電腦上通常也是家長。
 */
import { useCallback, useEffect, useState } from 'react';
import { Building2, ChevronDown, Loader2, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  adminApi,
  getAdminToken,
  setAdminToken,
  type AdminCompany,
  type AdminIdentityView,
} from './adminApi';
import {
  parseSwitcherValue,
  resolveScreen,
  scopeKey,
  selectionLabel,
  switcherOptions,
  visibleTabs,
  type AdminErrorView,
  type AdminTabId,
} from './adminView';
import { Button, ErrorNote, Field, Spinner, TextInput, toErrorView } from './ui';
import ParentsPanel from './panels/ParentsPanel';
import SpecialistsPanel from './panels/SpecialistsPanel';
import CompanySettingsPanel from './panels/CompanySettingsPanel';
import CompaniesPanel from './panels/CompaniesPanel';
import AdminUsersPanel from './panels/AdminUsersPanel';
import SummaryPanel from './panels/SummaryPanel';

export default function AdminApp() {
  const [identity, setIdentity] = useState<AdminIdentityView | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTabId>('parents');
  const [switching, setSwitching] = useState(false);

  const boot = useCallback(async () => {
    if (!getAdminToken()) {
      setIdentity(null);
      setBooting(false);
      return;
    }
    try {
      const result = await adminApi.me();
      setIdentity(result.identity);
      setCompanies(result.companies);
      setUnavailable(false);
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'unavailable') setUnavailable(true);
      else {
        // 開機時的任何其他失敗都當作「這顆 token 用不了」。留著它只會讓
        // 每一支後續請求都用同一個壞掉的身分再失敗一次。
        setAdminToken(null);
        setIdentity(null);
        if (view.action === 'relogin') setNotice(view.message);
      }
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    document.title = '管理中心';
    void boot();
  }, [boot]);

  /** 分頁把處理不了的錯誤丟上來 —— 401 與 503 不該由分頁自己畫一個紅框。 */
  const handleError = useCallback(
    (view: AdminErrorView) => {
      setNotice(view.message);
      if (view.action === 'unavailable') setUnavailable(true);
      if (view.action === 'relogin') {
        setAdminToken(null);
        setIdentity(null);
      }
      // 畫面以為選好了、後端說沒有 —— 以後端為準，重新取一次身分。
      if (view.action === 'select_company') void boot();
    },
    [boot]
  );

  async function switchScope(value: string) {
    const selection = parseSwitcherValue(value);
    if (!selection) return;
    setSwitching(true);
    setNotice(null);
    try {
      // token 由 adminApi 自己輪替 —— 這裡拿到的 identity 與新 token 是同一個視野。
      const result = await adminApi.selectCompany(selection);
      setIdentity(result.identity);
    } catch (err) {
      handleError(toErrorView(err));
    } finally {
      setSwitching(false);
    }
  }

  function retryBoot() {
    setBooting(true);
    // 先清掉才看得到重試的結果 —— boot() 只在成功時清它，失敗會再設回來。
    setUnavailable(false);
    setNotice(null);
    void boot();
  }

  function signOut() {
    setAdminToken(null);
    setIdentity(null);
    setCompanies([]);
    setNotice(null);
    setTab('parents');
  }

  if (booting) {
    return (
      <Shell>
        <Spinner label="正在确认登入状态…" />
      </Shell>
    );
  }

  const screen = resolveScreen({ identity, unavailable });

  if (screen.kind === 'unavailable') {
    return (
      <Shell>
        <div className="rounded-3xl border border-brand-stone bg-white p-8 text-center">
          <ShieldAlert size={28} className="mx-auto text-amber-500" />
          <p className="mt-3 text-xs font-bold text-brand-forest">管理中心当前不可用</p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-brand-charcoal/60">
            后台需要数据库与 SESSION_SECRET。这个部署缺少其中之一，因此没有任何后台资料可以读取。
            这不是登入问题，重新登入不会有帮助——请联系部署维运人员。
          </p>
          {/*
            必须有一条出路。资料库短暂断线是常见情况，而这个画面既不显示 header
            也没有登出，少了这颗按钮就只能靠使用者自己想到按 F5。
          */}
          <Button variant="ghost" className="mt-4" onClick={retryBoot}>
            <RefreshCw size={12} />
            重试
          </Button>
        </div>
      </Shell>
    );
  }

  if (screen.kind === 'login') {
    return (
      <Shell>
        <LoginForm
          notice={notice}
          onError={handleError}
          onSuccess={() => {
            setNotice(null);
            setBooting(true);
            void boot();
          }}
        />
      </Shell>
    );
  }

  // screen 是 needs_company 或 ready，兩者都已經有身分。
  const current = identity!;
  const tabs = visibleTabs(current);
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'parents';

  return (
    <Shell>
      <header className="mb-5 rounded-3xl border border-brand-stone bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Building2 size={16} className="text-brand-moss" />
            <div>
              <p className="text-sm font-bold text-brand-forest">管理中心</p>
              <p className="text-[11px] text-brand-charcoal/50">
                当前视野：{selectionLabel(current, companies)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {current.role === 'global_admin' && (
              <div className="relative">
                <select
                  value={scopeValue(current)}
                  onChange={e => void switchScope(e.target.value)}
                  disabled={switching}
                  className="appearance-none rounded-xl border border-brand-stone bg-brand-cream/40 py-2 pl-3 pr-8 text-xs font-medium text-brand-charcoal outline-none focus:border-brand-moss disabled:opacity-50"
                >
                  <option value="" disabled>
                    选择要查看的合作公司
                  </option>
                  {switcherOptions(companies).map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {switching ? (
                  <Loader2
                    size={12}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-brand-charcoal/40"
                  />
                ) : (
                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-charcoal/40"
                  />
                )}
              </div>
            )}
            <span className="hidden text-[11px] text-brand-charcoal/50 sm:inline">{current.email}</span>
            <Button variant="ghost" onClick={signOut}>
              <LogOut size={12} />
              登出
            </Button>
          </div>
        </div>

        {screen.kind === 'ready' && (
          <nav className="mt-4 flex flex-wrap gap-1.5 border-t border-brand-stone pt-3">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  t.id === activeTab
                    ? 'bg-brand-forest text-white'
                    : 'text-brand-charcoal/60 hover:bg-brand-sage'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {notice && (
        <div className="mb-4">
          <ErrorNote message={notice} />
        </div>
      )}

      {screen.kind === 'needs_company' ? (
        <div className="rounded-3xl border border-brand-stone bg-white p-8 text-center">
          <Building2 size={26} className="mx-auto text-brand-moss" />
          <p className="mt-3 text-xs font-bold text-brand-forest">请先选定要查看的合作公司</p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-brand-charcoal/60">
            全域管理员没有「同时看全部公司」这个状态。请从右上角选定一家合作公司，
            或选择「未归属的家长」——那些是没有从合作公司连结进站的家长。
            <br />
            每一次切换都会被记录下来。
          </p>
        </div>
      ) : (
        // key 讓分頁在切換視野時整個重掛。沿用舊 state 會把上一家公司的家長
        // 留在畫面上直到新請求回來，而那不是閃爍，是外洩。
        <div key={scopeKey(current)}>
          {activeTab === 'parents' && <ParentsPanel onError={handleError} />}
          {activeTab === 'specialists' && <SpecialistsPanel onError={handleError} />}
          {activeTab === 'company' && <CompanySettingsPanel onError={handleError} />}
          {activeTab === 'companies' && <CompaniesPanel onError={handleError} onChanged={boot} />}
          {activeTab === 'adminUsers' && <AdminUsersPanel onError={handleError} companies={companies} />}
          {activeTab === 'summary' && <SummaryPanel onError={handleError} />}
        </div>
      )}
    </Shell>
  );
}

/** 下拉目前該選到哪一項。未選定時是空字串，讓那個 disabled 的提示項顯示出來。 */
function scopeValue(identity: AdminIdentityView): string {
  if (identity.role !== 'global_admin' || identity.selection === null) return '';
  return identity.selection.kind === 'unassigned'
    ? 'unassigned'
    : `company:${identity.selection.companyId}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-cream px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

function LoginForm({
  notice,
  onError,
  onSuccess,
}: {
  notice: string | null;
  onError: (view: AdminErrorView) => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      // token 由 adminApi 存下來，這裡不碰 localStorage。
      await adminApi.login(email.trim(), password);
      onSuccess();
    } catch (err) {
      const view = toErrorView(err);
      // 密碼錯誤（後端不帶 code 的 401）留在表單旁邊。但資料庫沒設定的 503
      // 要往上送 —— 那不是打錯密碼，再試一百次也一樣，畫面必須說出這件事。
      if (view.action === 'none') setFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <div className="rounded-3xl border border-brand-stone bg-white p-6">
        <h1 className="text-sm font-bold text-brand-forest">管理中心</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-brand-charcoal/50">
          这是给合作公司与系统管理员使用的后台，与家长端是两个各自独立的登入。
        </p>

        {notice && (
          <div className="mt-4">
            <ErrorNote message={notice} />
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="信箱">
            <TextInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="密码">
            <TextInput
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {failure && <ErrorNote message={failure} />}

          <Button type="submit" busy={busy} className="w-full">
            登入
          </Button>
        </form>

        <p className="mt-4 text-[10px] leading-relaxed text-brand-charcoal/40">
          后台没有预设帐号，也没有自助注册。需要开通请联系系统管理员。
        </p>
      </div>
    </div>
  );
}

/**
 * 合作公司清單與建立（issue #4）—— 只有全域管理員看得到。
 *
 * 專案 A 開了合作公司時（`units`，#117，ADR-0020）叫「合作单位」：分機構與個人治療師、可以照類型篩選；
 * 建個人治療師單位時一併開好那個帳號（單位管理者兼推薦人）。B 照舊叫合作公司，一個字都不變。
 *
 * `mergedAccounts`（`VITE_ADMIN_UNITS_MERGED`，只在 `units` 時才可能是 true）：「后台帐号」分頁併進來 ——
 * 每一列可以展開看這個單位底下的帳號，最下面多「全域管理员」一塊（`UnitAccounts.tsx`）。關著時畫面一個字都不變。
 *
 * 進站識別碼（slug）是這裡最要緊的欄位：它就是家長連結上的 `?c=`，
 * 決定一位家長會歸屬到哪一家公司。它在資料庫上是 UNIQUE，重複會被 409 擋下 ——
 * 兩家公司共用一個識別碼等於把家長送給錯的公司，而那件事沒有補救的方法。
 */
import EntryLinkQr from '../EntryLinkQr';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2, Upload } from 'lucide-react';
import { GlobalAccountsSection, UnitAccountsBlock, useAccountGroups, useUnitAccounts } from './UnitAccounts';
import { AdminApiError, adminApi, type AdminCompany, type WecomQrList } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { UNIT_KIND_LABEL, UNIT_KINDS, type UnitKind } from '../units';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Panel,
  Select,
  Spinner,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

/** 單位清單還沒讀到時給分組用的空陣列（固定一個，`useMemo` 才不會每次重算）。 */
const EMPTY_UNITS: AdminCompany[] = [];

export default function CompaniesPanel({
  onError,
  onChanged,
  units = false,
  mergedAccounts = false,
  serviceRelations = false,
}: {
  /** 服務關係開關（展開機構「新增推荐人」的說明文字用）。 */
  serviceRelations?: boolean;
  onError: (view: AdminErrorView) => void;
  /** 新建一家公司後要讓上層的切換選單也看得到它。 */
  onChanged: () => void;
  /** 專案 A 的合作單位（#117）：改名、類型、篩選、個人治療師帳號。 */
  units?: boolean;
  /** 「后台帐号」併進來（`VITE_ADMIN_UNITS_MERGED`）。只有 `units` 也是 true 才算數。 */
  mergedAccounts?: boolean;
}) {
  const load = useCallback(() => adminApi.companies(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  const merged = units && mergedAccounts;
  const accounts = useUnitAccounts(merged, onError);
  const groups = useAccountGroups(accounts.data, data?.companies ?? EMPTY_UNITS);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const toggleExpanded = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  /** 新增或停用帳號之後：單位與帳號兩份都重讀。 */
  const reloadAll = () => {
    reload();
    accounts.reload();
  };

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  // 合作單位（#117）：類型不給預設——新建時一定要選；個人治療師多帳號的三格。
  const [kind, setKind] = useState<UnitKind | ''>('');
  const [account, setAccount] = useState({ email: '', password: '', phone: '' });
  const [kindFilter, setKindFilter] = useState<UnitKind | ''>('');
  const [busy, setBusy] = useState(false);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);

  const allCompanies = data?.companies ?? [];
  const companies = units && kindFilter ? allCompanies.filter(c => (c.kind ?? 'institution') === kindFilter) : allCompanies;
  const noun = units ? '单位' : '公司';
  const origin = window.location.origin;

  // 企業微信客服二維碼（使用者 2026-11-10；B 2026-11-19 起也有）：伺服器沒有這幾支（404）→ 整塊不畫。
  const [qrs, setQrs] = useState<WecomQrList | null>(null);
  const [qrFailure, setQrFailure] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    adminApi.wecomQrs().then(
      list => alive && setQrs(list),
      err => {
        if (!alive || (err instanceof AdminApiError && err.status === 404)) return;
        setQrFailure(toErrorView(err).message);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  async function create() {
    setBusy(true);
    setSaveFailure(null);
    try {
      if (units && !kind) {
        setSaveFailure('请选择单位类型（机构或个人治疗师）。');
        return;
      }
      await adminApi.createCompany(
        name.trim(),
        slug.trim().toLowerCase(),
        !units || !kind
          ? undefined
          : kind === 'therapist'
            ? { kind, email: account.email.trim(), password: account.password, phone: account.phone.trim() }
            : { kind }
      );
      setName('');
      setSlug('');
      setKind('');
      setAccount({ email: '', password: '', phone: '' });
      setCreating(false);
      reload();
      // 個人治療師單位一併開了帳號：合併畫面要看得到他。
      if (merged) accounts.reload();
      onChanged();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Panel
      title={units ? '合作单位' : '合作公司'}
      description={
        units
          ? merged
            ? '每一个单位有一个进站识别码。机构底下可以有好几位推荐人；个人治疗师单位只有他自己一位，他的帐号同时是单位管理者与推荐人。' +
              '点单位名称展开，看这个单位底下能登入的后台帐号；机构可以在那里新增推荐人与管理者。推荐人的兑换码与优惠券在「兑换码与优惠券」产生。'
            : '每一个单位有一个进站识别码。机构底下可以有好几位推荐人（在「兑换码与优惠券」开）；个人治疗师单位只有他自己一位，他的帐号同时是单位管理者与推荐人。'
          : '每一家公司有一个进站识别码。家长必须从带着这个识别码的连结注册，才会归属到该公司。'
      }
      action={
        !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={12} />
            新增{noun}
          </Button>
        )
      }
    >
      {creating && (
        <div className="mb-5 max-w-xl space-y-3 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
          {units && (
            <Field label="单位类型">
              <Select value={kind} onChange={e => setKind(e.target.value as UnitKind | '')}>
                <option value="">请选择</option>
                {UNIT_KINDS.map(k => (
                  <option key={k} value={k}>
                    {UNIT_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={units && kind === 'therapist' ? '治疗师名称' : `${noun}名称`}>
            <TextInput value={name} maxLength={units && kind === 'therapist' ? 50 : 128} onChange={e => setName(e.target.value)} />
          </Field>
          <Field
            label="进站识别码"
            hint="只能用小写英数与连字号，长度 2–64。建立后不要更改——已经发出去的连结都指着它。"
          >
            <TextInput
              value={slug}
              maxLength={64}
              onChange={e => setSlug(e.target.value)}
              placeholder="kangxing"
              className="font-mono"
            />
          </Field>

          {units && kind === 'therapist' && (
            <>
              <Field label="手机号">
                <TextInput value={account.phone} inputMode="numeric" maxLength={11} onChange={e => setAccount({ ...account, phone: e.target.value })} />
              </Field>
              <Field label="登入信箱" hint="这个帐号同时是单位管理者与推荐人：看得到本单位全部家长，也有自己的兑换码与代填。">
                <TextInput value={account.email} type="email" autoComplete="off" onChange={e => setAccount({ ...account, email: e.target.value })} />
              </Field>
              <Field label="初始密码" hint="至少 8 个字元，交给治疗师后请他自己保管。">
                <TextInput
                  value={account.password}
                  type="password"
                  autoComplete="new-password"
                  onChange={e => setAccount({ ...account, password: e.target.value })}
                />
              </Field>
            </>
          )}

          {saveFailure && <ErrorNote message={saveFailure} />}

          <div className="flex gap-2">
            <Button onClick={() => void create()} busy={busy}>
              <Save size={12} />
              建立
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setSaveFailure(null);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {qrs && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
          <WecomQrCell
            keyId="default"
            url={qrs.default}
            fallback="/kefu-qr.jpg"
            onChanged={setQrs}
            onFailure={setQrFailure}
          />
          <div className="min-w-[200px] flex-1 space-y-1 text-xs leading-relaxed text-brand-charcoal/70">
            <p className="text-sm font-bold text-brand-forest">客服二维码（预设）</p>
            <p>家长按「1 对 1 专家咨询」看到的企业微信二维码。没归属公司的家长、以及没设自己二维码的公司，都用这一张。</p>
            <p>只收 jpg／png，2 MB 以内。还没上传时用系统内建的那一张。</p>
          </div>
        </div>
      )}
      {qrFailure && <ErrorNote message={qrFailure} />}

      {units && allCompanies.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-brand-charcoal/70">
          <span>类型</span>
          <Select value={kindFilter} onChange={e => setKindFilter(e.target.value as UnitKind | '')} aria-label="照类型筛选">
            <option value="">全部</option>
            {UNIT_KINDS.map(k => (
              <option key={k} value={k}>
                {UNIT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : allCompanies.length === 0 ? (
        <EmptyState
          title={units ? '还没有合作单位' : '还没有合作公司'}
          hint="建立第一家之后，就可以开设它的后台帐号并把进站连结交给对方。"
        />
      ) : companies.length === 0 ? (
        <EmptyState title="这个类型还没有单位" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                <th className="py-2 pr-3 font-bold">{units ? '单位' : '公司'}</th>
                {units && <th className="py-2 pr-3 font-bold">类型</th>}
                <th className="py-2 pr-3 font-bold">识别码</th>
                <th className="py-2 pr-3 font-bold">进站连结</th>
                <th className="py-2 pr-3 font-bold">通知位置</th>
                {qrs && <th className="py-2 font-bold">客服二维码</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <Fragment key={c.id}>
                <tr className="border-b border-brand-stone/60 last:border-0">
                  <td className="py-2.5 pr-3 font-bold text-brand-forest">
                    {merged ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left font-bold text-brand-forest hover:underline"
                        aria-expanded={expanded.has(c.id)}
                        onClick={() => toggleExpanded(c.id)}
                      >
                        {expanded.has(c.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {c.name}
                        {groups && (
                          <span className="ml-1 font-normal text-brand-charcoal/45">{groups.byUnit[c.id]?.length ?? 0} 个帐号</span>
                        )}
                      </button>
                    ) : (
                      c.name
                    )}
                  </td>
                  {units && <td className="py-2.5 pr-3 text-brand-charcoal/70">{UNIT_KIND_LABEL[c.kind ?? 'institution']}</td>}
                  <td className="py-2.5 pr-3 font-mono text-brand-charcoal/70">{c.slug}</td>
                  <td className="py-2.5 pr-3">
                    {/* 11/03 第 2 頁：連結旁加二維碼，可下載 PNG */}
                    <EntryLinkQr url={`${origin}/?c=${c.slug}`} code={c.slug} />
                  </td>
                  <td className="py-2.5 pr-3">
                    {c.wecomWebhookUrl ? (
                      <span className="text-brand-moss">已设定</span>
                    ) : (
                      <span className="text-brand-charcoal/40">未设定（退回全域）</span>
                    )}
                  </td>
                  {qrs && (
                    <td className="py-2.5">
                      <WecomQrCell
                        keyId={c.id}
                        url={qrs.companies[c.id] ?? null}
                        fallbackLabel="用预设"
                        onChanged={setQrs}
                        onFailure={setQrFailure}
                      />
                    </td>
                  )}
                </tr>
                {merged && expanded.has(c.id) && (
                  <tr className="border-b border-brand-stone/60 last:border-0">
                    <td colSpan={qrs ? 6 : 5} className="pb-3">
                      <UnitAccountsBlock
                        unit={c}
                        serviceRelations={serviceRelations}
                        accounts={groups?.byUnit[c.id] ?? []}
                        referrers={accounts.data?.referrers ?? []}
                        loading={accounts.loading}
                        failure={accounts.failure}
                        onRetry={accounts.reload}
                        onError={onError}
                        onChanged={reloadAll}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
    {merged && (
      <div className="mt-5">
        <GlobalAccountsSection
          groups={groups}
          loading={accounts.loading}
          failure={accounts.failure}
          onRetry={accounts.reload}
          onError={onError}
          onChanged={reloadAll}
        />
      </div>
    )}
    </>
  );
}

/** 一張客服二維碼：縮圖、上傳（換掉）、移除。`keyId` 是 `'default'` 或公司 id。 */
function WecomQrCell({
  keyId,
  url,
  fallback,
  fallbackLabel,
  onChanged,
  onFailure,
}: {
  keyId: 'default' | number;
  url: string | null;
  /** 沒上傳時畫的圖（預設那張畫內建的）。 */
  fallback?: string;
  /** 沒上傳、也沒有 fallback 圖時寫的字。 */
  fallbackLabel?: string;
  onChanged: (list: WecomQrList) => void;
  onFailure: (message: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const shown = url ?? fallback ?? null;

  async function run(job: () => Promise<WecomQrList>) {
    setBusy(true);
    onFailure(null);
    try {
      onChanged(await job());
    } catch (err) {
      onFailure(toErrorView(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {shown ? (
        <img
          src={shown}
          alt="客服二维码"
          className={`h-16 w-16 shrink-0 rounded-lg border border-brand-stone/60 bg-white object-contain p-0.5 ${url ? '' : 'opacity-50'}`}
        />
      ) : (
        <span className="text-brand-charcoal/40">{fallbackLabel}</span>
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void run(() => adminApi.uploadWecomQr(keyId, file));
          }}
        />
        <Button variant="ghost" busy={busy} onClick={() => input.current?.click()}>
          <Upload size={12} />
          {url ? '更换' : '上传'}
        </Button>
        {url && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(keyId === 'default' ? '移除后改用系统内建的二维码，确定吗？' : '移除后这家公司的家长改看预设二维码，确定吗？')) {
                void run(() => adminApi.removeWecomQr(keyId));
              }
            }}
          >
            <Trash2 size={12} />
            移除
          </Button>
        )}
      </div>
    </div>
  );
}

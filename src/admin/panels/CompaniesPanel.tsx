/**
 * 合作公司清單與建立（issue #4）—— 只有全域管理員看得到。
 *
 * 進站識別碼（slug）是這裡最要緊的欄位：它就是家長連結上的 `?c=`，
 * 決定一位家長會歸屬到哪一家公司。它在資料庫上是 UNIQUE，重複會被 409 擋下 ——
 * 兩家公司共用一個識別碼等於把家長送給錯的公司，而那件事沒有補救的方法。
 */
import EntryLinkQr from '../EntryLinkQr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Save, Trash2, Upload } from 'lucide-react';
import { AdminApiError, adminApi, type WecomQrList } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Panel,
  Spinner,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

export default function CompaniesPanel({
  onError,
  onChanged,
}: {
  onError: (view: AdminErrorView) => void;
  /** 新建一家公司後要讓上層的切換選單也看得到它。 */
  onChanged: () => void;
}) {
  const load = useCallback(() => adminApi.companies(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);

  const companies = data?.companies ?? [];
  const origin = window.location.origin;

  // 企業微信客服二維碼（使用者 2026-11-10）：B 沒有這幾支（404）→ 整塊不畫。
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
      await adminApi.createCompany(name.trim(), slug.trim().toLowerCase());
      setName('');
      setSlug('');
      setCreating(false);
      reload();
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
    <Panel
      title="合作公司"
      description="每一家公司有一个进站识别码。家长必须从带着这个识别码的连结注册，才会归属到该公司。"
      action={
        !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={12} />
            新增公司
          </Button>
        )
      }
    >
      {creating && (
        <div className="mb-5 max-w-xl space-y-3 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
          <Field label="公司名称">
            <TextInput value={name} maxLength={128} onChange={e => setName(e.target.value)} />
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

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : companies.length === 0 ? (
        <EmptyState title="还没有合作公司" hint="建立第一家之后，就可以开设它的后台帐号并把进站连结交给对方。" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                <th className="py-2 pr-3 font-bold">公司</th>
                <th className="py-2 pr-3 font-bold">识别码</th>
                <th className="py-2 pr-3 font-bold">进站连结</th>
                <th className="py-2 pr-3 font-bold">通知位置</th>
                {qrs && <th className="py-2 font-bold">客服二维码</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-brand-stone/60 last:border-0">
                  <td className="py-2.5 pr-3 font-bold text-brand-forest">{c.name}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
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

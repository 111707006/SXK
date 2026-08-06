/**
 * 合作公司清單與建立（issue #4）—— 只有全域管理員看得到。
 *
 * 進站識別碼（slug）是這裡最要緊的欄位：它就是家長連結上的 `?c=`，
 * 決定一位家長會歸屬到哪一家公司。它在資料庫上是 UNIQUE，重複會被 409 擋下 ——
 * 兩家公司共用一個識別碼等於把家長送給錯的公司，而那件事沒有補救的方法。
 */
import { useCallback, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { adminApi } from '../adminApi';
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

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : companies.length === 0 ? (
        <EmptyState title="还没有合作公司" hint="建立第一家之后，就可以开设它的后台帐号并把进站连结交给对方。" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                <th className="py-2 pr-3 font-bold">公司</th>
                <th className="py-2 pr-3 font-bold">识别码</th>
                <th className="py-2 pr-3 font-bold">进站连结</th>
                <th className="py-2 font-bold">通知位置</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-brand-stone/60 last:border-0">
                  <td className="py-2.5 pr-3 font-bold text-brand-forest">{c.name}</td>
                  <td className="py-2.5 pr-3 font-mono text-brand-charcoal/70">{c.slug}</td>
                  <td className="py-2.5 pr-3">
                    <code className="break-all text-[10px] text-brand-charcoal/55">{`${origin}/?c=${c.slug}`}</code>
                  </td>
                  <td className="py-2.5">
                    {c.wecomWebhookUrl ? (
                      <span className="text-brand-moss">已设定</span>
                    ) : (
                      <span className="text-brand-charcoal/40">未设定（退回全域）</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

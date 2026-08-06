/**
 * 專家名單維護（issue #10）。
 *
 * 這一頁決定了家長端報告頁上「可以預約誰」。畫面上的承諾必須是這家公司履行
 * 得了的，因此停用是一個明確的動作 —— 不是把人刪掉（刪掉會讓既有預約失去
 * 對應的名字），而是讓他不再出現在家長端。
 */
import { useCallback, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { adminApi, type AdminSpecialist } from '../adminApi';
import { formatSlots, parseSlots, type AdminErrorView } from '../adminView';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Panel,
  Spinner,
  TextArea,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

interface Draft {
  name: string;
  title: string;
  specialty: string;
  experience: string;
  avatarUrl: string;
  slotsText: string;
  active: boolean;
}

const EMPTY: Draft = {
  name: '',
  title: '',
  specialty: '',
  experience: '',
  avatarUrl: '',
  slotsText: '',
  active: true,
};

function toDraft(s: AdminSpecialist): Draft {
  return {
    name: s.name,
    title: s.title ?? '',
    specialty: s.specialty ?? '',
    experience: s.experience ?? '',
    avatarUrl: s.avatarUrl ?? '',
    slotsText: formatSlots(s.slots),
    active: s.active,
  };
}

function toInput(draft: Draft) {
  const trimmed = (v: string) => (v.trim() ? v.trim() : null);
  return {
    name: draft.name.trim(),
    title: trimmed(draft.title),
    specialty: trimmed(draft.specialty),
    experience: trimmed(draft.experience),
    avatarUrl: trimmed(draft.avatarUrl),
    slots: parseSlots(draft.slotsText),
    active: draft.active,
  };
}

export default function SpecialistsPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.specialists(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const specialists = data?.specialists ?? [];

  async function save() {
    if (!editing) return;
    const input = toInput(editing.draft);
    if (!input.name) {
      setSaveFailure('请填写专家姓名。');
      return;
    }
    setBusy(true);
    setSaveFailure(null);
    try {
      if (editing.id === null) await adminApi.createSpecialist(input);
      else await adminApi.updateSpecialist(editing.id, input);
      setEditing(null);
      reload();
    } catch (err) {
      const view = toErrorView(err);
      // 「未歸屬」的視野下新增專家會被後端擋掉（400）。那不是壞掉，
      // 是這個視野本來就沒有一家公司可以隸屬 —— 讓訊息留在表單旁邊。
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="专家名单"
      description="这份名单决定家长在报告页上能预约到谁。离职或暂停接案请用「停用」，不要删除——既有预约还指着这个名字。"
      action={
        !editing && (
          <Button onClick={() => setEditing({ id: null, draft: EMPTY })}>
            <Plus size={12} />
            新增专家
          </Button>
        )
      }
    >
      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-brand-forest">
              {editing.id === null ? '新增专家' : '编辑专家'}
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setSaveFailure(null);
              }}
              aria-label="取消"
              className="rounded-lg p-1 text-brand-charcoal/50 transition hover:bg-white"
            >
              <X size={13} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="姓名（必填）">
              <TextInput
                value={editing.draft.name}
                maxLength={64}
                onChange={e => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })}
              />
            </Field>
            <Field label="职称">
              <TextInput
                value={editing.draft.title}
                maxLength={128}
                onChange={e => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })}
              />
            </Field>
            <Field label="专长">
              <TextArea
                rows={3}
                value={editing.draft.specialty}
                onChange={e =>
                  setEditing({ ...editing, draft: { ...editing.draft, specialty: e.target.value } })
                }
              />
            </Field>
            <Field label="资历">
              <TextArea
                rows={3}
                value={editing.draft.experience}
                onChange={e =>
                  setEditing({ ...editing, draft: { ...editing.draft, experience: e.target.value } })
                }
              />
            </Field>
            <Field label="头像网址">
              <TextInput
                value={editing.draft.avatarUrl}
                maxLength={512}
                onChange={e =>
                  setEditing({ ...editing, draft: { ...editing.draft, avatarUrl: e.target.value } })
                }
              />
            </Field>
            <Field label="可预约时段" hint="一行一个，例如「周三 上午」。最多 20 个，超过的部分不会被存下来。">
              <TextArea
                rows={3}
                value={editing.draft.slotsText}
                onChange={e =>
                  setEditing({ ...editing, draft: { ...editing.draft, slotsText: e.target.value } })
                }
              />
            </Field>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-brand-charcoal/70">
            <input
              type="checkbox"
              checked={editing.draft.active}
              onChange={e => setEditing({ ...editing, draft: { ...editing.draft, active: e.target.checked } })}
              className="accent-brand-forest"
            />
            启用（关闭后家长端不再看得到这位专家）
          </label>

          {saveFailure && (
            <div className="mt-3">
              <ErrorNote message={saveFailure} />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={() => void save()} busy={busy}>
              <Save size={12} />
              保存
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
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
      ) : specialists.length === 0 ? (
        <EmptyState
          title="还没有专家"
          hint="名单是空的时候，家长端的报告页不会显示预约区块，而是说明这家机构的专家名单尚未开放——不会留一个按不动的按钮在那里。"
        />
      ) : (
        <ul className="space-y-2">
          {specialists.map(s => (
            <li
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-brand-stone px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-brand-forest">
                  {s.name}
                  {s.title && <span className="ml-1.5 font-medium text-brand-charcoal/50">{s.title}</span>}
                  {!s.active && (
                    <span className="ml-2 rounded-lg border border-brand-stone bg-brand-sage px-1.5 py-0.5 text-[10px] text-brand-charcoal/60">
                      已停用
                    </span>
                  )}
                </p>
                {s.specialty && (
                  <p className="mt-1 text-[11px] leading-relaxed text-brand-charcoal/60">{s.specialty}</p>
                )}
                <p className="mt-1 text-[10px] text-brand-charcoal/45">
                  可预约时段：{s.slots.length ? s.slots.join('、') : '未设定'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveFailure(null);
                  setEditing({ id: s.id, draft: toDraft(s) });
                }}
              >
                编辑
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * 後台帳號的共用畫面：帳號列表、開帳號的表單（信箱＋初始密碼，其餘欄位由呼叫端塞進來）、停用／啟用。
 *
 * 「后台帐号」分頁（`AdminUsersPanel.tsx`）與「合作单位」分頁合併後的帳號區（`UnitAccounts.tsx`）
 * 都用這一份，免得兩邊各寫一份停用按鈕，改了一邊忘了另一邊。
 */
import { useState, type ReactNode } from 'react';
import { Save } from 'lucide-react';
import { adminApi, type AdminUser } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { Button, ErrorNote, Field, TextInput, toErrorView } from '../ui';

/** 角色怎麼寫。`units`：專案 A 的合作單位（#117），「公司成员」改叫「单位管理者」。 */
export function adminRoleLabel(role: AdminUser['role'], units: boolean): string {
  if (role === 'global_admin') return '全域管理员';
  if (role === 'referrer') return '推荐人';
  return units ? '单位管理者' : '公司成员';
}

/**
 * 停用／重新啟用。
 *
 * `togglingId` 不只是為了轉圈 —— 沒有它，慢速連線上使用者按了沒有任何回饋，
 * 會再按一次，於是兩個請求各自 reload()，後回來的那個覆蓋先回來的，畫面顯示
 * 的可能是中間某個狀態。變更權限的按鈕不該有這種模糊地帶。
 */
export function useAdminUserToggle({
  onError,
  onDone,
}: {
  onError: (view: AdminErrorView) => void;
  /** 成功之後要重讀哪些列表。 */
  onDone: () => void;
}) {
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function toggle(id: number, active: boolean) {
    if (togglingId !== null) return;
    setTogglingId(id);
    setFailure(null);
    try {
      await adminApi.setAdminUserActive(id, active);
      onDone();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setFailure(view.message);
      else onError(view);
    } finally {
      setTogglingId(null);
    }
  }

  return { togglingId, failure, setFailure, toggle };
}

/** 帳號列表：信箱、角色、（選填）所屬單位、狀態、停用／啟用。 */
export function AdminUserTable({
  users,
  roleLabel,
  unitColumn,
  togglingId,
  onToggle,
  minWidthClass = 'min-w-[560px]',
}: {
  users: AdminUser[];
  roleLabel: (user: AdminUser) => string;
  /** 要不要畫「所属单位／所属公司」那一欄。單位展開區裡不畫（就是這一個單位）。 */
  unitColumn?: { title: string; name: (user: AdminUser) => string };
  togglingId: number | null;
  onToggle: (id: number, active: boolean) => void;
  minWidthClass?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidthClass} text-left text-xs`}>
        <thead>
          <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
            <th className="py-2 pr-3 font-bold">信箱</th>
            <th className="py-2 pr-3 font-bold">角色</th>
            {unitColumn && <th className="py-2 pr-3 font-bold">{unitColumn.title}</th>}
            <th className="py-2 pr-3 font-bold">状态</th>
            <th className="py-2 font-bold" />
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-brand-stone/60 last:border-0">
              <td className="py-2.5 pr-3 text-brand-forest">{u.email}</td>
              <td className="py-2.5 pr-3 text-brand-charcoal/70">{roleLabel(u)}</td>
              {unitColumn && <td className="py-2.5 pr-3 text-brand-charcoal/70">{unitColumn.name(u)}</td>}
              <td className="py-2.5 pr-3">
                {u.active ? (
                  <span className="font-bold text-brand-moss">启用中</span>
                ) : (
                  <span className="text-brand-charcoal/40">已停用</span>
                )}
              </td>
              <td className="py-2.5 text-right">
                <Button
                  variant={u.active ? 'danger' : 'ghost'}
                  busy={togglingId === u.id}
                  disabled={togglingId !== null}
                  onClick={() => onToggle(u.id, !u.active)}
                >
                  {u.active ? '停用' : '重新启用'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 開帳號的表單：信箱、初始密碼，加上呼叫端的欄位（`children`，例如角色與所屬單位）。
 *
 * `onSubmit` 回一句字＝擋下來（呼叫端自己的檢查，例如沒選單位），照樣畫在表單裡；丟錯＝伺服器擋下來，
 * 照 `toErrorView` 分流（要登出、要換視野的交給上層）。成功後由呼叫端把表單收起來。
 */
export function AdminUserForm({
  onSubmit,
  onCancel,
  onError,
  children,
  submitLabel = '开设',
}: {
  onSubmit: (input: { email: string; password: string }) => Promise<string | void>;
  onCancel: () => void;
  onError: (view: AdminErrorView) => void;
  children?: ReactNode;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const blocked = await onSubmit({ email: email.trim(), password });
      if (blocked) setFailure(blocked);
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 max-w-xl space-y-3 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
      <Field label="信箱">
        <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="初始密码" hint="至少 8 个字元。请用另一个管道交给对方，并请对方尽快自行更换。">
        <TextInput
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      {children}

      {failure && <ErrorNote message={failure} />}

      <div className="flex gap-2">
        <Button onClick={() => void submit()} busy={busy}>
          <Save size={12} />
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

/** 「不能停用自己」的那一行說明（伺服器也擋）。 */
export function SelfDeactivateNote() {
  return (
    <p className="mt-3 text-[10px] text-brand-charcoal/40">
      不能停用自己的帐号——那会把自己锁在门外，而且没有第二个人能救。
    </p>
  );
}

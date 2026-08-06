/**
 * 後台帳號（issue #4）—— 只有全域管理員看得到。
 *
 * 合作公司**無法自行增刪帳號**，由森心康代為處理。理由是責任歸屬：一家公司
 * 能自己開帳號，就等於能把看得到孩子資料的權限給任何人，而那件事沒有痕跡。
 *
 * 停用要立刻生效 —— 後端每一次請求都回查資料庫的啟用狀態，不等 token 過期。
 * 「對方有人離職」是這個功能存在的理由。
 */
import { useCallback, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { adminApi, type AdminCompany } from '../adminApi';
import type { AdminErrorView } from '../adminView';
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

type Role = 'global_admin' | 'company_member';

export default function AdminUsersPanel({
  onError,
  companies,
}: {
  onError: (view: AdminErrorView) => void;
  companies: AdminCompany[];
}) {
  const load = useCallback(() => adminApi.adminUsers(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('company_member');
  const [companyId, setCompanyId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);

  const users = data?.adminUsers ?? [];
  const companyName = (id: number | null) =>
    id === null ? '—' : (companies.find(c => c.id === id)?.name ?? `公司 #${id}`);

  async function create() {
    // 沒選公司時 companyId 是空字串，而 `Number('')` 是 0 —— 送出去後端會回
    // 「找不到该合作公司」，於是管理員跑去懷疑公司清單，而真正的問題是他沒選。
    // 在這裡說清楚。
    if (role === 'company_member' && !companyId) {
      setSaveFailure('请选择这个帐号所属的合作公司。');
      return;
    }
    setBusy(true);
    setSaveFailure(null);
    try {
      await adminApi.createAdminUser({
        email: email.trim(),
        password,
        role,
        companyId: role === 'company_member' ? Number(companyId) : null,
      });
      setEmail('');
      setPassword('');
      setCompanyId('');
      setCreating(false);
      reload();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 停用／重新啟用。
   *
   * `togglingId` 不只是為了轉圈 —— 沒有它，慢速連線上使用者按了沒有任何回饋，
   * 會再按一次，於是兩個請求各自 reload()，後回來的那個覆蓋先回來的，畫面顯示
   * 的可能是中間某個狀態。變更權限的按鈕不該有這種模糊地帶。
   */
  async function toggleActive(id: number, active: boolean) {
    if (togglingId !== null) return;
    setTogglingId(id);
    setSaveFailure(null);
    try {
      await adminApi.setAdminUserActive(id, active);
      reload();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Panel
      title="后台帐号"
      description="合作公司无法自行开设帐号。停用会立刻生效，对方下一个动作就会被挡下，不用等登入过期。"
      action={
        !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={12} />
            开设帐号
          </Button>
        )
      }
    >
      {creating && (
        <div className="mb-5 max-w-xl space-y-3 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
          <Field label="信箱">
            <TextInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="初始密码" hint="至少 8 个字元。请用另一个管道交给对方，并请对方尽快自行更换。">
            <TextInput
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="角色">
            <Select
              value={role}
              onChange={e => {
                setRole(e.target.value as Role);
                setCompanyId('');
              }}
            >
              <option value="company_member">合作公司成员（只看得到自己公司）</option>
              <option value="global_admin">全域管理员（可切换公司，看得到汇总）</option>
            </Select>
          </Field>
          {role === 'company_member' && (
            <Field label="所属合作公司">
              <Select value={companyId} onChange={e => setCompanyId(e.target.value)}>
                <option value="">请选择</option>
                {companies.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {saveFailure && <ErrorNote message={saveFailure} />}

          <div className="flex gap-2">
            <Button onClick={() => void create()} busy={busy}>
              <Save size={12} />
              开设
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
      ) : users.length === 0 ? (
        <EmptyState title="还没有后台帐号" />
      ) : (
        <>
          {saveFailure && !creating && (
            <div className="mb-3">
              <ErrorNote message={saveFailure} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                  <th className="py-2 pr-3 font-bold">信箱</th>
                  <th className="py-2 pr-3 font-bold">角色</th>
                  <th className="py-2 pr-3 font-bold">所属公司</th>
                  <th className="py-2 pr-3 font-bold">状态</th>
                  <th className="py-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-brand-stone/60 last:border-0">
                    <td className="py-2.5 pr-3 text-brand-forest">{u.email}</td>
                    <td className="py-2.5 pr-3 text-brand-charcoal/70">
                      {u.role === 'global_admin' ? '全域管理员' : '公司成员'}
                    </td>
                    <td className="py-2.5 pr-3 text-brand-charcoal/70">{companyName(u.companyId)}</td>
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
                        onClick={() => void toggleActive(u.id, !u.active)}
                      >
                        {u.active ? '停用' : '重新启用'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-brand-charcoal/40">
            不能停用自己的帐号——那会把自己锁在门外，而且没有第二个人能救。
          </p>
        </>
      )}
    </Panel>
  );
}

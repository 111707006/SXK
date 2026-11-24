/**
 * 後台帳號（issue #4）—— 只有全域管理員看得到。
 *
 * 合作公司**無法自行增刪帳號**，由森心康代為處理。理由是責任歸屬：一家公司
 * 能自己開帳號，就等於能把看得到孩子資料的權限給任何人，而那件事沒有痕跡。
 *
 * 停用要立刻生效 —— 後端每一次請求都回查資料庫的啟用狀態，不等 token 過期。
 * 「對方有人離職」是這個功能存在的理由。
 *
 * 列表、表單、停用按鈕在 `AdminUserBlocks.tsx`（與合併後的「合作单位」分頁共用）。
 */
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { adminApi, type AdminCompany } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { Button, EmptyState, ErrorNote, Field, Panel, Select, Spinner, useAsyncData } from '../ui';
import { AdminUserForm, AdminUserTable, SelfDeactivateNote, adminRoleLabel, useAdminUserToggle } from './AdminUserBlocks';

type Role = 'global_admin' | 'company_member';

export default function AdminUsersPanel({
  onError,
  companies,
  units = false,
}: {
  onError: (view: AdminErrorView) => void;
  companies: AdminCompany[];
  /** 專案 A 的合作單位（#117／#125，ADR-0020）：「公司成员」改叫「单位管理者」。B 照舊。 */
  units?: boolean;
}) {
  const load = useCallback(() => adminApi.adminUsers(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState<Role>('company_member');
  const [companyId, setCompanyId] = useState<string>('');
  const toggler = useAdminUserToggle({ onError, onDone: reload });

  const users = data?.adminUsers ?? [];
  const companyName = (id: number | null) =>
    id === null ? '—' : (companies.find(c => c.id === id)?.name ?? `${units ? '单位' : '公司'} #${id}`);

  async function create({ email, password }: { email: string; password: string }) {
    // 沒選公司時 companyId 是空字串，而 `Number('')` 是 0 —— 送出去後端會回
    // 「找不到该合作公司」，於是管理員跑去懷疑公司清單，而真正的問題是他沒選。
    // 在這裡說清楚。
    if (role === 'company_member' && !companyId) {
      return units ? '请选择这个帐号所属的合作单位。' : '请选择这个帐号所属的合作公司。';
    }
    toggler.setFailure(null);
    await adminApi.createAdminUser({
      email,
      password,
      role,
      companyId: role === 'company_member' ? Number(companyId) : null,
    });
    setCompanyId('');
    setCreating(false);
    reload();
  }

  return (
    <Panel
      title="后台帐号"
      description={`合作${units ? '单位' : '公司'}无法自行开设帐号。停用会立刻生效，对方下一个动作就会被挡下，不用等登入过期。`}
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
        <AdminUserForm onSubmit={create} onCancel={() => setCreating(false)} onError={onError}>
          <Field label="角色">
            <Select
              value={role}
              onChange={e => {
                setRole(e.target.value as Role);
                setCompanyId('');
              }}
            >
              <option value="company_member">{units ? '单位管理者（只看得到自己单位）' : '合作公司成员（只看得到自己公司）'}</option>
              <option value="global_admin">{units ? '全域管理员（可切换单位，看得到汇总）' : '全域管理员（可切换公司，看得到汇总）'}</option>
            </Select>
          </Field>
          {role === 'company_member' && (
            <Field label={units ? '所属合作单位' : '所属合作公司'}>
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
        </AdminUserForm>
      )}

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : users.length === 0 ? (
        <EmptyState title="还没有后台帐号" />
      ) : (
        <>
          {toggler.failure && !creating && (
            <div className="mb-3">
              <ErrorNote message={toggler.failure} />
            </div>
          )}
          <AdminUserTable
            users={users}
            roleLabel={u => adminRoleLabel(u.role, units)}
            unitColumn={{ title: units ? '所属单位' : '所属公司', name: u => companyName(u.companyId) }}
            togglingId={toggler.togglingId}
            onToggle={(id, active) => void toggler.toggle(id, active)}
            onDeleted={units ? reload : undefined}
          />
          <SelfDeactivateNote />
        </>
      )}
    </Panel>
  );
}

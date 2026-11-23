/**
 * 合併後的「合作单位」分頁裡的後台帳號（`VITE_ADMIN_UNITS_MERGED`，只在專案 A 開了合作單位時）：
 * 每個單位展開後列出能登入的人、機構可以加單位管理者；最下面是全域管理員與沒掛單位的帳號。
 *
 * 只用現有的端點：`GET/POST /admin-users`、`POST /admin-users/:id/active`，另讀 `GET /referrers`
 * 找推薦人掛在哪個單位（推薦人的 `admin_users.company_id` 是 null）。分組在 `../unitAccounts.ts`。
 * 列表、表單、停用按鈕與「后台帐号」分頁共用 `AdminUserBlocks.tsx`。
 */
import { useCallback, useMemo, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { CreateReferrerForm } from './ReferrersPanel';
import { AdminApiError, adminApi, type AdminCompany, type AdminUser } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { groupAdminUsers, unitAccountRoleLabel, type AccountGroups, type ReferrerLink } from '../unitAccounts';
import { Button, ErrorNote, Panel, Spinner, useAsyncData } from '../ui';
import { AdminUserForm, AdminUserTable, SelfDeactivateNote, adminRoleLabel, useAdminUserToggle } from './AdminUserBlocks';

export interface UnitAccountsData {
  users: AdminUser[];
  referrers: ReferrerLink[];
}

/** 讀帳號與推薦人兩份。`enabled` 關著不打網路（開關關著的畫面一個請求都不多）。 */
export function useUnitAccounts(enabled: boolean, onError: (view: AdminErrorView) => void) {
  const load = useCallback(async (): Promise<UnitAccountsData | null> => {
    if (!enabled) return null;
    const [users, referrers] = await Promise.all([
      adminApi.adminUsers(),
      // 推薦人那一支不在（404）就當沒有推薦人：他們照樣列在「未挂单位的帐号」，停用照樣能按。
      adminApi.referrers().catch(err => {
        if (err instanceof AdminApiError && err.status === 404) return { referrers: [] };
        throw err;
      }),
    ]);
    return {
      users: users.adminUsers,
      referrers: referrers.referrers.map(r => ({ adminUserId: r.adminUserId, companyId: r.companyId })),
    };
  }, [enabled]);
  return useAsyncData(load, [enabled], onError);
}

export function useAccountGroups(data: UnitAccountsData | null, units: readonly AdminCompany[]): AccountGroups | null {
  return useMemo(
    () => (data ? groupAdminUsers(data.users, data.referrers, units.map(u => u.id)) : null),
    [data, units],
  );
}

/** 一個單位展開後的那一塊。 */
export function UnitAccountsBlock({
  unit,
  accounts,
  referrers,
  loading,
  failure,
  onRetry,
  onError,
  onChanged,
  serviceRelations = false,
}: {
  unit: AdminCompany;
  /** 服務關係開關（說明文字用）。 */
  serviceRelations?: boolean;
  accounts: AdminUser[];
  referrers: ReferrerLink[];
  loading: boolean;
  failure: string | null;
  onRetry: () => void;
  onError: (view: AdminErrorView) => void;
  /** 新增或停用成功：重讀單位與帳號兩份。 */
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  // 開推薦人（使用者 2026-11-23：從「兑换码与优惠券」搬來）：只有機構；個人治療師單位恰好一位推薦人，建單位時就建好了。
  const [creatingReferrer, setCreatingReferrer] = useState(false);
  const toggler = useAdminUserToggle({ onError, onDone: onChanged });
  // 個人治療師單位只有他自己一位（#117），不出「新增管理者」。
  const canAdd = (unit.kind ?? 'institution') === 'institution';

  async function create({ email, password }: { email: string; password: string }) {
    toggler.setFailure(null);
    await adminApi.createAdminUser({ email, password, role: 'company_member', companyId: unit.id });
    setCreating(false);
    onChanged();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-brand-forest">这个单位的后台帐号</p>
        {canAdd && !creating && !creatingReferrer && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCreatingReferrer(true)}>
              <UserPlus size={12} />
              新增推荐人
            </Button>
            <Button variant="ghost" onClick={() => setCreating(true)}>
              <Plus size={12} />
              新增管理者
            </Button>
          </div>
        )}
      </div>
      {creating && <AdminUserForm onSubmit={create} onCancel={() => setCreating(false)} onError={onError} />}
      {creatingReferrer && (
        <CreateReferrerForm
          companies={[unit]}
          units
          serviceRelations={serviceRelations}
          fixedUnit={unit}
          onCancel={() => setCreatingReferrer(false)}
          onCreated={() => {
            setCreatingReferrer(false);
            onChanged();
          }}
        />
      )}

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={onRetry} />
      ) : accounts.length === 0 ? (
        <p className="text-xs text-brand-charcoal/50">这个单位还没有后台帐号</p>
      ) : (
        <>
          {toggler.failure && <ErrorNote message={toggler.failure} />}
          <AdminUserTable
            users={accounts}
            roleLabel={u => unitAccountRoleLabel(u, referrers)}
            togglingId={toggler.togglingId}
            onToggle={(id, active) => void toggler.toggle(id, active)}
            minWidthClass="min-w-[440px]"
          />
        </>
      )}
    </div>
  );
}

/** 分頁最下面那一塊：全域管理員（可新增、停用／啟用），以及沒掛單位的帳號（只列、停用／啟用）。 */
export function GlobalAccountsSection({
  groups,
  loading,
  failure,
  onRetry,
  onError,
  onChanged,
}: {
  groups: AccountGroups | null;
  loading: boolean;
  failure: string | null;
  onRetry: () => void;
  onError: (view: AdminErrorView) => void;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const toggler = useAdminUserToggle({ onError, onDone: onChanged });

  async function create({ email, password }: { email: string; password: string }) {
    toggler.setFailure(null);
    await adminApi.createAdminUser({ email, password, role: 'global_admin', companyId: null });
    setCreating(false);
    onChanged();
  }

  const table = (users: AdminUser[]) => (
    <AdminUserTable
      users={users}
      roleLabel={u => adminRoleLabel(u.role, true)}
      togglingId={toggler.togglingId}
      onToggle={(id, active) => void toggler.toggle(id, active)}
      minWidthClass="min-w-[440px]"
    />
  );

  return (
    <Panel
      title="全域管理员"
      description="可以切换单位、看得到汇总。合作单位无法自行开设帐号。停用会立刻生效，对方下一个动作就会被挡下，不用等登入过期。"
      action={
        !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={12} />
            新增全域管理员
          </Button>
        )
      }
    >
      {creating && <AdminUserForm onSubmit={create} onCancel={() => setCreating(false)} onError={onError} />}

      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={onRetry} />
      ) : groups ? (
        <>
          {toggler.failure && !creating && (
            <div className="mb-3">
              <ErrorNote message={toggler.failure} />
            </div>
          )}
          {groups.globalAdmins.length === 0 ? (
            <p className="text-xs text-brand-charcoal/50">还没有全域管理员帐号</p>
          ) : (
            table(groups.globalAdmins)
          )}
          <SelfDeactivateNote />

          <div className="mt-6 space-y-2">
            <p className="text-xs font-bold text-brand-forest">未挂单位的帐号</p>
            <p className="text-[10px] text-brand-charcoal/50">不属于任何单位、也不是全域管理员的帐号（例如还没挂单位的推荐人）。这里只能停用或启用。</p>
            {groups.unattached.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50">没有未挂单位的帐号</p>
            ) : (
              table(groups.unattached)
            )}
          </div>
        </>
      ) : null}
    </Panel>
  );
}

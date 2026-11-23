/**
 * 合併後的「合作单位」分頁（`VITE_ADMIN_UNITS_MERGED`，只在專案 A 開了合作單位時）：後台帳號怎麼分到各單位底下。
 * 純函式，不碰 React —— 分錯的樣子很安靜（某個單位展開是空的），所以要測得到。
 *
 * 帳號的單位不全記在同一個地方：
 * - 單位管理者（`company_member`，含個人治療師那一位）：`admin_users.company_id`。
 * - 推薦人（`referrer`）：`admin_users.company_id` 一律是 null，單位記在 `referrers.company_id`（`GET /referrers` 才看得到）。
 */
import type { AdminUser } from './adminApi';

/** `GET /referrers` 裡這裡用得到的兩欄。 */
export interface ReferrerLink {
  adminUserId: number;
  companyId: number | null;
}

export interface AccountGroups {
  /** 單位 id → 掛在那個單位底下的帳號（照伺服器回的順序）。沒有帳號的單位不在裡面。 */
  byUnit: Record<number, AdminUser[]>;
  globalAdmins: AdminUser[];
  /** 不屬於任何（認得的）單位、也不是全域管理員：例如沒掛單位的推薦人。 */
  unattached: AdminUser[];
}

/** 這個帳號掛在哪個單位；`null`＝沒有（或是全域管理員）。`unitIds` 之外的單位當作沒有。 */
export function accountUnitId(user: AdminUser, referrers: readonly ReferrerLink[], unitIds: ReadonlySet<number>): number | null {
  if (user.role === 'global_admin') return null;
  const id = user.role === 'referrer' ? (referrers.find(r => r.adminUserId === user.id)?.companyId ?? null) : user.companyId;
  return id !== null && unitIds.has(id) ? id : null;
}

export function groupAdminUsers(
  users: readonly AdminUser[],
  referrers: readonly ReferrerLink[],
  unitIds: Iterable<number>,
): AccountGroups {
  const known = new Set(unitIds);
  const groups: AccountGroups = { byUnit: {}, globalAdmins: [], unattached: [] };
  for (const user of users) {
    if (user.role === 'global_admin') {
      groups.globalAdmins.push(user);
      continue;
    }
    const unit = accountUnitId(user, referrers, known);
    if (unit === null) groups.unattached.push(user);
    else (groups.byUnit[unit] ??= []).push(user);
  }
  return groups;
}

/**
 * 單位展開區裡的角色寫法。個人治療師那一位是單位管理者、同時也是推薦人（#117），兩個都寫出來。
 */
export function unitAccountRoleLabel(user: AdminUser, referrers: readonly ReferrerLink[]): string {
  if (user.role === 'global_admin') return '全域管理员';
  if (user.role === 'referrer') return '推荐人';
  return referrers.some(r => r.adminUserId === user.id) ? '单位管理者（兼推荐人）' : '单位管理者';
}

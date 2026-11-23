/**
 * 合作單位停用與刪除、後台帳號與推薦人刪除（使用者 2026-11-23；ADR-0020 第 10 點）：擋下的原因與畫面上的字。
 * 純資料與純函式，前端（確認框）與伺服器（409 的訊息）共用；只在專案 A 開了合作單位時用得到。
 *
 * 規則（使用者決定「家長轉回森心康直属再刪」「帳號完全刪除」）：
 * - 只刪已停用的單位；有訂單記到這個單位或它的推薦人（`payments.split_snapshot`）就不刪。
 * - 刪的時候：服務關係全部拿掉（回直屬，每位一筆改派紀錄）、篩查渠道改成直屬、未用的碼作廢、
 *   單位管理者與旗下推薦人連帳號刪掉。已用的碼與已發的使用權保留（家長的權益不拿走）。
 */

export type DeleteBlockerCode =
  | 'active'
  | 'orders'
  | 'exports'
  | 'phone_conflict'
  | 'self'
  | 'global_admin'
  | 'referrer_account'
  | 'therapist_unit'
  | 'served_parents'
  | 'codes';

export interface DeleteBlocker {
  code: DeleteBlockerCode;
  count: number;
  message: string;
}

/** `GET /api/admin/companies/:id/delete-preview` 與 409 的本體。 */
export interface UnitDeletePreview {
  company: { id: number; name: string; kind: 'institution' | 'therapist'; active: boolean };
  /** 現在由這個單位服務、會回到森心康直属的家長。 */
  servedParents: number;
  /** 篩查渠道是這個單位、會改成直屬的家長。 */
  screeningParents: number;
  /** 這個單位與旗下推薦人還沒用的碼：作廢。 */
  unusedCodes: number;
  /** 已經用掉的碼：保留（對帳顯示「已删除」）。 */
  usedCodes: number;
  /** 會刪掉的後台帳號（單位管理者＋推薦人的帳號）。 */
  accounts: number;
  referrers: number;
  /** 空的才刪得了。 */
  blockers: DeleteBlocker[];
}

export const BLOCKER_TEXT: Record<DeleteBlockerCode, (n: number) => string> = {
  active: () => '还在启用中：先停用，才能删除。',
  orders: n => `有 ${n} 笔订单记到这个单位或它的推荐人（清分对帐要用），不能删除，只能停用。`,
  exports: n => `要删的后台帐号有 ${n} 笔导出纪录（稽核要留），不能删除，只能停用。`,
  phone_conflict: n => `有 ${n} 位家长在森心康直属也有同一支手机号的帐号（重复帐号还没合并），转回直属会撞在一起，请先处理。`,
  self: () => '不能删除自己的帐号。',
  global_admin: () => '全域管理员的帐号不能删除。',
  referrer_account: () => '这是推荐人的帐号，请到推荐人列表删除推荐人（连帐号一起删）。',
  therapist_unit: () => '这是个人治疗师单位的帐号（推荐人就是单位本身），请在合作单位分页停用后删除整个单位。',
  served_parents: n => `还有 ${n} 位家长绑定或由这位推荐人服务，请先改派。`,
  codes: n => `已经产生过 ${n} 组兑换码（含已用的，对帐要用），不能删除，只能停用。`,
};

export function blocker(code: DeleteBlockerCode, count = 1): DeleteBlocker {
  return { code, count, message: BLOCKER_TEXT[code](count) };
}

/** 有數字才算擋下（`active` 與身分類的傳 1）。 */
export function blockersOf(entries: Array<[DeleteBlockerCode, number]>): DeleteBlocker[] {
  return entries.filter(([, n]) => n > 0).map(([code, n]) => blocker(code, n));
}

/** 確認框的幾句話：會發生什麼。 */
export function unitDeleteSummary(p: UnitDeletePreview): string[] {
  return [
    `${p.servedParents} 位现在由这个单位服务的家长转回森心康直属（每位留一笔改派纪录）。`,
    `${p.screeningParents} 位筛查渠道是这个单位的家长，筛查渠道改成直属。`,
    `${p.unusedCodes} 组还没用的兑换码作废；${p.usedCodes} 组已用的保留，家长的使用权不受影响。`,
    `删除 ${p.accounts} 个后台帐号（单位管理者与 ${p.referrers} 位推荐人）。`,
    '删除后不能复原。',
  ];
}

/**
 * 後台改派畫面的字與選項（#119，ADR-0020）。純函式，前端用；只給後台（不進家長端）。
 */
import type { ChangeActor, ChangeReason, ServiceRelation } from './rules';

/** `GET /api/admin/service-targets`：改派時能選的（啟用中的）單位與推薦人。 */
export interface ServiceTargets {
  units: Array<{ id: number; name: string; kind: string }>;
  referrers: Array<{ id: number; name: string; companyId: number }>;
}

/** 列表每一列帶的服務關係（`null`＝森心康直屬）。 */
export type ServiceView = {
  companyId: number;
  companyName: string | null;
  referrerId: number | null;
  referrerName: string | null;
} | null;

/** `GET /api/admin/parents/:id/service-changes` 的一列。 */
export interface ServiceChange {
  id: number;
  fromCompanyId: number | null;
  fromReferrerId: number | null;
  toCompanyId: number | null;
  toReferrerId: number | null;
  actor: ChangeActor;
  reason: ChangeReason;
  adminUserId: number | null;
  createdAt: string | null;
  /** 伺服器帶的名字；沒有（舊伺服器）就從 `targets` 找，再找不到寫編號。 */
  fromCompanyName?: string | null;
  fromReferrerName?: string | null;
  toCompanyName?: string | null;
  toReferrerName?: string | null;
}

export const DIRECT_LABEL = '森心康直属';

/** 「甲机构 · 张」「甲机构 · 还没标注」「森心康直属」；名字讀不到寫編號。 */
export function relationLabel(service: ServiceView): string {
  if (service === null) return DIRECT_LABEL;
  const unit = service.companyName ?? `单位 #${service.companyId}`;
  if (service.referrerId === null) return `${unit} · 还没标注`;
  return `${unit} · ${service.referrerName ?? `推荐人 #${service.referrerId}`}`;
}

/** 這個單位可以選的推薦人。 */
export function referrerOptions(targets: ServiceTargets, companyId: number | null): ServiceTargets['referrers'] {
  return companyId === null ? [] : targets.referrers.filter(r => r.companyId === companyId);
}

/** 畫面上兩個下拉選單 → 送給伺服器的 `to`。單位是 null＝森心康直屬；推薦人不在這個單位就清掉。 */
export function targetFromChoice(targets: ServiceTargets, companyId: number | null, referrerId: number | null): ServiceRelation | null {
  if (companyId === null) return null;
  const ok = referrerId !== null && referrerOptions(targets, companyId).some(r => r.id === referrerId);
  return { companyId, referrerId: ok ? referrerId : null };
}

const WHO: Record<ChangeActor, Partial<Record<ChangeReason, string>> & { default: string }> = {
  // 後台＋兌換碼只有代填（`proxyFillServed`）會寫：第一次掛上服務關係，不是改派。
  admin: { code: '后台代填', default: '后台改派' },
  parent: { link: '家长自己（连结）', code: '家长自己（兑换码）', default: '家长自己' },
  system: { migration: '系统（资料转换）', default: '系统' },
};

function labelOf(
  targets: ServiceTargets,
  companyId: number | null,
  referrerId: number | null,
  names: { company?: string | null; referrer?: string | null } = {}
): string {
  if (companyId === null) return DIRECT_LABEL;
  // 伺服器帶了名字這一欄卻是 null：那一列已經刪掉了（LEFT JOIN 對不到；使用者 2026-11-23 可以刪單位與推薦人）。
  if (names.company === null) return `已删除的单位 #${companyId}`;
  if (referrerId !== null && names.referrer === null) {
    return `${names.company ?? targets.units.find(u => u.id === companyId)?.name ?? `单位 #${companyId}`} · 已删除的推荐人 #${referrerId}`;
  }
  return relationLabel({
    companyId,
    companyName: names.company ?? targets.units.find(u => u.id === companyId)?.name ?? null,
    referrerId,
    referrerName: referrerId === null ? null : names.referrer ?? targets.referrers.find(r => r.id === referrerId)?.name ?? null,
  });
}

/** 一列改派紀錄 → 從誰、到誰、誰改的。 */
export function changeLine(targets: ServiceTargets, change: ServiceChange): { from: string; to: string; who: string } {
  const who = WHO[change.actor] ?? { default: '—' };
  return {
    from: labelOf(targets, change.fromCompanyId, change.fromReferrerId, { company: change.fromCompanyName, referrer: change.fromReferrerName }),
    to: labelOf(targets, change.toCompanyId, change.toReferrerId, { company: change.toCompanyName, referrer: change.toReferrerName }),
    who: who[change.reason] ?? who.default,
  };
}

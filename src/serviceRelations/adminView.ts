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
  admin: { default: '后台改派' },
  parent: { link: '家长自己（连结）', code: '家长自己（兑换码）', default: '家长自己' },
  system: { migration: '系统（资料转换）', default: '系统' },
};

function labelOf(targets: ServiceTargets, companyId: number | null, referrerId: number | null): string {
  if (companyId === null) return DIRECT_LABEL;
  return relationLabel({
    companyId,
    companyName: targets.units.find(u => u.id === companyId)?.name ?? null,
    referrerId,
    referrerName: referrerId === null ? null : targets.referrers.find(r => r.id === referrerId)?.name ?? null,
  });
}

/** 一列改派紀錄 → 從誰、到誰、誰改的。 */
export function changeLine(targets: ServiceTargets, change: ServiceChange): { from: string; to: string; who: string } {
  const who = WHO[change.actor] ?? { default: '—' };
  return {
    from: labelOf(targets, change.fromCompanyId, change.fromReferrerId),
    to: labelOf(targets, change.toCompanyId, change.toReferrerId),
    who: who[change.reason] ?? who.default,
  };
}

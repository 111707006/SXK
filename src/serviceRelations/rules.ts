/**
 * 服務關係規則（#118，ADR-0020 第 3、6 點；規格 #114「服務關係規則」）。**只在專案 A**。
 *
 * 服務關係＝家長**現在**由哪個合作單位、哪位推薦人服務（`service_relations`，一位家長最多一列；
 * 沒有列＝森心康直屬）。這一檔是純函式，不碰資料庫：
 *
 * - `resolveLinkSource`：連結上的單位代號（`?c=`）與推薦人代號（`&t=`）查到的東西 → 這次的來源。
 * - `decideAttach`：現在的服務關係 × 這次的來源 → 直接掛上／問家長／不動。
 * - `relationAfterConsent`：家長在提示裡選「換」之後，伺服器重算一次（不信前端），回要寫的那一列。
 * - `canReassign`：後台改派的權限（全域管理員／單位管理者／推薦人）。
 *
 * 不確定的時候一律「不動」「不准」。
 */

/** 一位家長的服務關係。`referrerId` 是 null＝單位裡還沒標注推薦人。 */
export interface ServiceRelation {
  companyId: number;
  referrerId: number | null;
}

/**
 * 這次的來源。兌換碼的單位是那位推薦人所屬的單位（ADR-0020 第 7 點：碼同時算推薦人與所屬單位）；
 * 推薦人還沒有單位（遷移前的舊資料）時，呼叫端不要組出這個來源，傳 null。
 */
export type RelationSource =
  | { kind: 'company_link'; companyId: number }
  | { kind: 'referrer_link'; companyId: number; referrerId: number }
  | { kind: 'code'; companyId: number; referrerId: number };

export type AttachDecision =
  /** 還沒有服務關係：直接掛上。 */
  | { kind: 'attach'; to: ServiceRelation }
  /** 已經有了、來源指向不同的單位或推薦人：先問家長。 */
  | { kind: 'ask'; current: ServiceRelation; to: ServiceRelation }
  /** 來源與現在相同、或來源無效。 */
  | { kind: 'keep' };

/** 改派紀錄的「誰改的」：後台帳號、家長自己、系統（遷移）。順序就是 `service_relation_changes.actor` 的 ENUM。 */
export const CHANGE_ACTORS = ['admin', 'parent', 'system'] as const;
export type ChangeActor = (typeof CHANGE_ACTORS)[number];

/** 改派紀錄的原因：連結、兌換碼、後台改派、遷移。順序就是 `service_relation_changes.reason` 的 ENUM。 */
export const CHANGE_REASONS = ['link', 'code', 'admin', 'migration'] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

/** 連結上的單位代號查到的單位；查不到傳 null。 */
export interface LinkCompany {
  id: number;
  active: boolean;
}

/** 連結上的推薦人代號查到的推薦人；查不到傳 null。`companyId` 是 null＝還沒隸屬單位（遷移前的舊資料）。 */
export interface LinkReferrer {
  id: number;
  companyId: number | null;
  active: boolean;
}

/**
 * 連結 → 來源。單位查不到或停用：沒有來源。推薦人不屬於該單位、沒有單位、或停用：當作只帶單位（#114「連結」）。
 */
export function resolveLinkSource(company: LinkCompany | null, referrer: LinkReferrer | null): RelationSource | null {
  if (company === null || !company.active) return null;
  if (referrer !== null && referrer.active && referrer.companyId === company.id) {
    return { kind: 'referrer_link', companyId: company.id, referrerId: referrer.id };
  }
  return { kind: 'company_link', companyId: company.id };
}

function targetOf(source: RelationSource): ServiceRelation {
  return { companyId: source.companyId, referrerId: source.kind === 'company_link' ? null : source.referrerId };
}

/**
 * 現在的服務關係 × 這次的來源。
 *
 * - 沒有服務關係：直接掛上。
 * - 只帶單位連結、而現在就在同一個單位（不管有沒有標注推薦人）：不問。
 * - 推薦人連結或兌換碼：同單位同推薦人不動；其他（含同單位還沒標注）都問家長。
 */
export function decideAttach(current: ServiceRelation | null, source: RelationSource | null): AttachDecision {
  if (source === null) return { kind: 'keep' };
  const to = targetOf(source);
  if (current === null) return { kind: 'attach', to };
  if (current.companyId === to.companyId && (source.kind === 'company_link' || current.referrerId === to.referrerId)) {
    return { kind: 'keep' };
  }
  return { kind: 'ask', current: { ...current }, to };
}

/**
 * 家長在提示裡選「換」：伺服器用**現在**的服務關係重算一次。要掛上或要問，就寫來源指向的那一列；
 * 不動（來源無效、或期間已經是同一個）就回 null、什麼都不寫。
 */
export function relationAfterConsent(current: ServiceRelation | null, source: RelationSource | null): ServiceRelation | null {
  const decision = decideAttach(current, source);
  return decision.kind === 'keep' ? null : decision.to;
}

/** 改派的人。單位管理者的 `companyId` 取自工作階段。 */
export type ReassignActor =
  | { role: 'global_admin' }
  | { role: 'unit_manager'; companyId: number }
  | { role: 'referrer'; referrerId: number; companyId: number | null };

/**
 * 後台改派權限（ADR-0020 第 6 點）：`to` 是 null＝拿掉服務關係（回森心康直屬）。
 *
 * - 全域管理員：什麼都能改。
 * - 單位管理者：改之前、改之後都要在自己單位（不能從直屬認領、不能改到別的單位、不能拿掉）。
 * - 推薦人：一律不可以（不能手動認領）。
 *
 * ⚠️ 這裡不看 `to.referrerId` 是否真的隸屬 `to.companyId`——那要查資料，呼叫端先驗。
 */
export function canReassign(actor: ReassignActor, from: ServiceRelation | null, to: ServiceRelation | null): boolean {
  switch (actor.role) {
    case 'global_admin':
      return true;
    case 'unit_manager':
      return from !== null && to !== null && from.companyId === actor.companyId && to.companyId === actor.companyId;
    default:
      return false;
  }
}

/**
 * 代填的人（#124）：推薦人（含個人治療師帳號）或單位管理者。`companyId` 取自工作階段與資料庫。
 */
export type ProxyParty =
  | { kind: 'referrer'; referrerId: number; companyId: number }
  | { kind: 'unit'; companyId: number };

/**
 * 代填能不能碰這位家長（服務關係開關開著時）：
 * - 沒有服務關係：只有篩查渠道（帳號歸屬，`screeningCompanyId`）就是本單位的可以（`unbound`，代填時掛上）；
 *   直屬或從別單位進來的不行——不能靠打一支手機號就看到孩子資料、把家長認領走，要全域管理員先指派（review）
 * - 推薦人：只有標注給自己的（`mine`）；同單位別人的、還沒標注的、別單位的都不行——推薦人不能手動認領
 * - 單位管理者：本單位的都可以（`mine`）；別單位的不行（跨單位的家長不能代填）
 */
export function proxyAccess(
  party: ProxyParty,
  current: ServiceRelation | null,
  screeningCompanyId: number | null
): 'mine' | 'unbound' | 'other' {
  if (current === null) return screeningCompanyId === party.companyId ? 'unbound' : 'other';
  if (current.companyId !== party.companyId) return 'other';
  if (party.kind === 'unit') return 'mine';
  return current.referrerId === party.referrerId ? 'mine' : 'other';
}

/** 代填一位還沒有服務關係的家長之後掛到哪裡。 */
export function proxyTarget(party: ProxyParty): ServiceRelation {
  return { companyId: party.companyId, referrerId: party.kind === 'referrer' ? party.referrerId : null };
}

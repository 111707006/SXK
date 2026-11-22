/**
 * 合作單位（#117，ADR-0020，只在專案 A）：單位的兩種類型、推薦人代號、推薦人的個人連結。
 * 前端（後台畫面）與伺服器共用。
 *
 * - **機構**：底下可以有好幾位推薦人，每位推薦人各有一個代號，個人連結是 `?c=<單位>&t=<推薦人>`。
 * - **個人治療師**：恰好一位推薦人，他同時是單位管理者；他的連結就是單位連結 `?c=<單位>`。
 */
import { SLUG_PATTERN } from '../utils/companySlug';
import { isProjectA, type AdminCenterShape } from './companyScope';

/**
 * 有沒有合作單位這回事：A 開了合作公司（`A_COMPANIES`）。B 的合作公司照舊叫公司、沒有類型；A 沒開時沒有單位可選，
 * 推薦人照舊不必隸屬。後台路由與畫面都問這一句。
 */
export function unitsEnabled(shape: AdminCenterShape): boolean {
  return isProjectA(shape) && shape.multiCompany;
}

export type UnitKind = 'institution' | 'therapist';

export const UNIT_KINDS: readonly UnitKind[] = ['institution', 'therapist'];

export const UNIT_KIND_LABEL: Record<UnitKind, string> = { institution: '机构', therapist: '个人治疗师' };

export function isUnitKind(value: unknown): value is UnitKind {
  return value === 'institution' || value === 'therapist';
}

/** 推薦人代號：格式同進站代號（小寫英數與連字號，2–64），在同一個單位裡唯一（資料庫的 UNIQUE 擋）。 */
export function isValidReferrerCode(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

/**
 * 推薦人的個人連結。個人治療師單位就是單位連結；機構底下的推薦人要有代號才有連結（舊的、沒代號的回 `null`）。
 * 單位不知道（沒隸屬，等遷移票處理）也回 `null`。
 */
export function referrerEntryUrl(
  origin: string,
  referrer: { companySlug: string | null; companyKind: UnitKind | null; code: string | null }
): string | null {
  if (!referrer.companySlug) return null;
  const unit = `${origin}/?c=${encodeURIComponent(referrer.companySlug)}`;
  if (referrer.companyKind === 'therapist') return unit;
  return referrer.code ? `${unit}&t=${encodeURIComponent(referrer.code)}` : null;
}

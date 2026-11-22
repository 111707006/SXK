/**
 * 換人提示（#120，ADR-0020 第 6 點）的來源與提示資料。前端與伺服器共用。
 *
 * 提示裡不帶任何編號：家長選「換」時把 `source` 原樣送回 `POST /api/service-relation/switch`，伺服器照來源
 * **重查**一次單位與推薦人、用同一份規則（`relationAfterConsent`）重算，不採信前端說要換成誰。
 * - link：單位代號＋推薦人代號（等於家長自己再點一次那條連結，沒有比點連結多的權限）
 * - code：兌換碼的編號；伺服器只認**這位家長自己用掉的**那一組
 */
import { SLUG_PATTERN } from '../utils/companySlug';

export type SwitchSource =
  | { kind: 'link'; companySlug: string; referrerCode: string | null }
  | { kind: 'code'; codeId: number };

/** 提示資料：現在誰服務、要換成誰（推薦人的名字，沒有推薦人寫單位名）、來源。 */
export interface ServiceSwitchPrompt {
  currentName: string;
  toName: string;
  source: SwitchSource;
}

const slugOf = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return SLUG_PATTERN.test(s) ? s : null;
};

/** 一條連結（`{companySlug, referrerCode?}`）；單位代號不對回 null，推薦人代號不對就當作沒帶。 */
export function readLinkSource(raw: unknown): Extract<SwitchSource, { kind: 'link' }> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { companySlug?: unknown; referrerCode?: unknown };
  const companySlug = slugOf(r.companySlug);
  if (companySlug === null) return null;
  return { kind: 'link', companySlug, referrerCode: slugOf(r.referrerCode) };
}

/** `POST /api/service-relation/switch` 的 `source`；形狀不對回 null（400）。 */
export function readSwitchSource(raw: unknown): SwitchSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { kind?: unknown; codeId?: unknown; companySlug?: unknown; referrerCode?: unknown };
  if (r.kind === 'code') return Number.isInteger(r.codeId) && (r.codeId as number) > 0 ? { kind: 'code', codeId: r.codeId as number } : null;
  if (r.kind !== 'link') return null;
  // 推薦人代號帶了卻不對：整個來源不認（不同於連結進站的「當作只帶單位」——這是提示原樣送回來的，不該被改過）。
  if (r.referrerCode != null && slugOf(r.referrerCode) === null) return null;
  return readLinkSource(r);
}

/** 提示上的名字：有推薦人寫推薦人，沒有寫單位；都讀不到寫「另一位老师」。 */
export function displayNameOf(names: { companyName: string | null; referrerName: string | null }): string {
  return names.referrerName ?? names.companyName ?? '另一位老师';
}

/** 「本次登入內不再追問同一來源」用的鍵。 */
export function switchSourceKey(source: SwitchSource): string {
  return source.kind === 'code' ? `code:${source.codeId}` : `link:${source.companySlug}:${source.referrerCode ?? ''}`;
}

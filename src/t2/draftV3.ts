/**
 * 完整版作答的草稿（T2 v3）：答到一半關掉頁面、手機斷線、被電話打斷，回來打開同一份問卷時接著答。
 *
 * 只存在這支手機的瀏覽器裡（`localStorage`），每份問卷一筆，交卷成功就清掉；7 天沒動的草稿不用（題目可能已經換了月齡段）。
 * 讀寫一律包 try/catch：無痕視窗、儲存被關掉、塞滿時就當沒有草稿，作答照常 —— 草稿只是方便，不是作答的必要條件。
 * 草稿裡只有答案，沒有孩子的名字或家長的資料；同一支手機換帳號登入時，用 `owner`（登入的使用者 id）分開。
 */

import type { Rater } from './types';
import type { V3Answers } from './answeringV3';

export interface DraftV3 {
  rater: Rater | null;
  grade?: number;
  answers: V3Answers;
  savedAt: number;
}

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PREFIX = 'sxk.t2v3.draft';

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storageOf(storage?: DraftStorage): DraftStorage | null {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 登入的帳號標籤（手機號）→ 草稿鍵裡的 `owner`：只放雜湊，不把手機號再寫一次。 */
export function ownerOf(identity: string): string {
  let h = 5381;
  for (let i = 0; i < identity.length; i++) h = ((h << 5) + h + identity.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function draftKey(owner: string, toolCode: string): string {
  return `${PREFIX}:${owner}:${toolCode}`;
}

/** 讀草稿；沒有、壞掉、過期、讀不到都回 null（過期或壞掉的順手清掉）。 */
export function loadDraft(owner: string, toolCode: string, now: number = Date.now(), storage?: DraftStorage): DraftV3 | null {
  const s = storageOf(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(draftKey(owner, toolCode));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DraftV3>;
    const fresh = typeof d.savedAt === 'number' && now - d.savedAt <= DRAFT_MAX_AGE_MS && now >= d.savedAt;
    const shaped = typeof d.answers === 'object' && d.answers !== null && !Array.isArray(d.answers);
    if (!fresh || !shaped) {
      s.removeItem(draftKey(owner, toolCode));
      return null;
    }
    return { rater: (d.rater ?? null) as Rater | null, ...(typeof d.grade === 'number' ? { grade: d.grade } : {}), answers: d.answers as V3Answers, savedAt: d.savedAt! };
  } catch {
    return null;
  }
}

/** 存草稿；什麼都還沒答（沒選填表人、沒有答案）就不存，並清掉舊的。 */
export function saveDraft(owner: string, toolCode: string, draft: Omit<DraftV3, 'savedAt'>, now: number = Date.now(), storage?: DraftStorage): void {
  const s = storageOf(storage);
  if (!s) return;
  try {
    if (draft.rater === null && Object.keys(draft.answers).length === 0) {
      s.removeItem(draftKey(owner, toolCode));
      return;
    }
    s.setItem(draftKey(owner, toolCode), JSON.stringify({ ...draft, savedAt: now }));
  } catch {
    // 塞滿或被關掉：不存，作答照常
  }
}

export function clearDraft(owner: string, toolCode: string, storage?: DraftStorage): void {
  const s = storageOf(storage);
  if (!s) return;
  try {
    s.removeItem(draftKey(owner, toolCode));
  } catch {
    // 同上
  }
}

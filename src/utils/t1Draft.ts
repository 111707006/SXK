/**
 * T1 作答到一半的草稿（2026-11-10 實際走一遍清單第 1 條）。
 *
 * 以前 36 題的作答只放在 `T1Screening` 的 state 裡：重新整理、在微信裡切出去被回收，
 * 回來就從第 1 題重來。現在每答一題就寫進 localStorage，回來時接著做
 * （`LedoT1Questions` 本來就從第一題還沒答的開始）。
 *
 * 只是家長自己手機上的方便：讀不到、寫不進去（隱私模式、空間滿）就當沒有草稿，照舊從頭做。
 * 交卷、登出都會清掉；換了孩子（姓名或生日不同）或超過 {@link DRAFT_MAX_AGE_DAYS} 天的草稿不用。
 */
import type { Child } from '../types';
import type { SupplementAnswers } from './t1Supplement';

export const T1_DRAFT_KEY = 'senxinkang_t1_draft';
export const DRAFT_MAX_AGE_DAYS = 14;

export interface T1Draft {
  childKey: string;
  answers: Record<string, number>;
  /** 九個方面答完、停在「补充资料」那一步時才有。 */
  supplement?: SupplementAnswers;
  atSupplement?: boolean;
  savedAt: string;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 草稿是哪一個孩子的：姓名＋生日（沒有生日的舊檔案用月齡）。 */
export function childDraftKey(child: Pick<Child, 'name' | 'birthDate' | 'ageMonth'>): string {
  return `${child.name}|${child.birthDate ?? `m${child.ageMonth}`}`;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * 讀草稿：要是同一個孩子、沒過期，而且只留這一次題目裡有的題號、值是 0／1／2 的作答。
 * 一題都對不上就當沒有。
 */
export function loadT1Draft(
  child: Pick<Child, 'name' | 'birthDate' | 'ageMonth'>,
  questionIds: readonly string[],
  now: Date = new Date(),
  storage: Storage | null = defaultStorage(),
): T1Draft | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(T1_DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Partial<T1Draft>;
  if (d.childKey !== childDraftKey(child)) return null;
  const savedAt = typeof d.savedAt === 'string' ? Date.parse(d.savedAt) : NaN;
  if (!Number.isFinite(savedAt) || now.getTime() - savedAt > DRAFT_MAX_AGE_DAYS * 86_400_000) return null;
  const ids = new Set(questionIds);
  const answers: Record<string, number> = {};
  for (const [id, v] of Object.entries(d.answers ?? {})) {
    if (ids.has(id) && (v === 0 || v === 1 || v === 2)) answers[id] = v;
  }
  if (Object.keys(answers).length === 0) return null;
  const allAnswered = questionIds.every(id => answers[id] !== undefined);
  return {
    childKey: d.childKey,
    answers,
    savedAt: d.savedAt as string,
    ...(d.supplement && typeof d.supplement === 'object' ? { supplement: d.supplement } : {}),
    // 題目沒答完就不可能停在补充资料
    ...(d.atSupplement === true && allAnswered ? { atSupplement: true } : {}),
  };
}

export function saveT1Draft(draft: Omit<T1Draft, 'savedAt'>, now: Date = new Date(), storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(T1_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: now.toISOString() }));
  } catch {
    /* 寫不進去就算了：只是少了接著做的方便 */
  }
}

export function clearT1Draft(storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(T1_DRAFT_KEY);
  } catch {
    /* 同上 */
  }
}

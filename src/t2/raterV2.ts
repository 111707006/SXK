/**
 * T2 填表人 v2（客戶 10/17 第 5 項，#70，規格 `docs/specs/client-changes-2026-10-17.md` §6）。開關 `T2_RATER_V2`。
 *
 * - 畫面上拿掉「老师」；`RATERS` 照舊留著 `teacher` —— 開關打開以前交的卷要讀得出、報告照樣畫。
 * - 交卷（9/08 題庫與完整版兩條路）新送的 `teacher` 拒收。
 * - 「其他」可帶一句選填說明 `raterNote`：去頭尾空白、最多 10 字（照字算，不照 UTF-16 單位）、空的就是沒有。
 *   不是「其他」卻帶說明 → 拒收（畫面不會這樣送，送了就是狀態壞了，不悄悄丟掉）。
 *
 * 前端與伺服器共用；推薦引擎的 `'T'`（量表允許的填寫人）是另一套，不在這裡。
 */

import { RATERS, type Rater } from './types';

export const RATER_NOTE_MAX = 10;

/** 開關開著時交卷收的填表人：`RATERS` 去掉老师。 */
export const RATERS_V2: ReadonlyArray<Rater> = RATERS.filter(r => r !== 'teacher');

export type RaterCheck =
  | { ok: true; rater: Rater; raterNote?: string }
  | { ok: false; code: 'RATER_INVALID' | 'RATER_NOTE_INVALID'; error: string };

/** 讀交卷 body 的 `rater` 與 `raterNote`（開關開著時）。 */
export function readRaterV2(rater: unknown, raterNote: unknown): RaterCheck {
  if (typeof rater !== 'string' || !(RATERS_V2 as ReadonlyArray<string>).includes(rater)) {
    return { ok: false, code: 'RATER_INVALID', error: '请选择填表人身份。' };
  }
  if (raterNote === undefined || raterNote === null) return { ok: true, rater: rater as Rater };
  if (typeof raterNote !== 'string') return { ok: false, code: 'RATER_NOTE_INVALID', error: '填表人的说明格式不正确。' };
  const note = raterNote.trim();
  if (note === '') return { ok: true, rater: rater as Rater };
  if (rater !== 'other') return { ok: false, code: 'RATER_NOTE_INVALID', error: '只有选「其他」才需要写是谁。' };
  if ([...note].length > RATER_NOTE_MAX) {
    return { ok: false, code: 'RATER_NOTE_INVALID', error: `「其他」最多写 ${RATER_NOTE_MAX} 个字。` };
  }
  return { ok: true, rater: 'other', raterNote: note };
}

const RATER_LABELS: Readonly<Record<Rater, string>> = {
  father: '父亲',
  mother: '母亲',
  caregiver: '主要照顾者',
  teacher: '老师',
  other: '其他',
};

/** 填表人在畫面上的字。順序照 `RATERS`；`v2` 開著不出「老师」。 */
export function raterOptions(v2: boolean): ReadonlyArray<{ value: Rater; label: string }> {
  return (v2 ? RATERS_V2 : RATERS).map(value => ({ value, label: RATER_LABELS[value] }));
}

/** 報告作答回顧那一行：「其他（阿姨）」；舊的 `teacher` 照原樣是「老师」；讀不懂的值不出字。 */
export function raterLabel(rater: unknown, raterNote?: unknown): string | null {
  if (typeof rater !== 'string' || !Object.prototype.hasOwnProperty.call(RATER_LABELS, rater)) return null;
  const label = RATER_LABELS[rater as Rater];
  return rater === 'other' && typeof raterNote === 'string' && raterNote !== '' ? `${label}（${raterNote}）` : label;
}

/**
 * 交卷 body 裡填表人那一段。開關關著只送 `rater`（與以前一字不差）；開著時選「其他」又寫了字才帶 `raterNote`。
 * 伺服器照樣會再去一次空白、再數一次字（`readRaterV2`）。
 */
export function raterPayload(v2: boolean, rater: Rater | null, note: string): { rater: Rater | null; raterNote?: string } {
  const trimmed = note.trim();
  return v2 && rater === 'other' && trimmed !== '' ? { rater, raterNote: trimmed } : { rater };
}

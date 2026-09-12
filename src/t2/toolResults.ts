/**
 * 交卷與已完成清單的純函式（票 #57，規格 v2 §9.2）。
 *
 * 【這一層做什麼】
 * 三件事，全部不碰資料庫、不碰 Express：
 * 1. `readToolSubmission`：把 `POST /api/t2/tool-results` 的 body 讀成 `ScoreInput`。每個欄位都驗、
 *    **不猜** —— `toolId` 不認得、`rater` 不是五種之一、月齡不是整數，一律回拒絕。安靜地當成
 *    `other`／0 個月存進去，是一筆對不上任何人的紀錄。
 * 2. `refusalToHttp`：計分層的五種拒算（`ScoreRefusal`）翻成 400 的回應。缺答那一種**訊息裡要有
 *    缺題數**（票的驗收），家長端要能說「還有 N 題」。
 * 3. `toolBands`：一支 `ToolResult` 對它餵的每個維度的 band（跑規則表）。這是加測提示要的資料 ——
 *    「星號做完且判留意或關注才顯示」（#58），前端不該自己跑規則表。
 *
 * 【這一層不做什麼】
 * 不算分（`scoring/`）、不判 band 的規則（`rules/`）、不挑最新且完整的一筆（`findings.ts` 的
 * `latestCompleteResults`）。伺服器的處理函式把這三個純函式串起來，自己只管讀寫。
 */

import { TOOLKIT } from './toolkit';
import type { ToolId } from './toolkit';
import type { AnswerValue, ScoreInput, ScoreRefusal } from './scoring';
import { ruleFor } from './rules';
import { TOOL_SPECS } from './toolSpecs';
import { RATERS } from './types';
import type { Band, DimensionCode, Rater, ToolResult } from './types';

/** 400 的回應本體：`error` 給人看、`code` 給程式看，其餘欄位依拒絕的種類附上。 */
export interface SubmissionRejection {
  error: string;
  code:
    | 'BODY_INVALID'
    | 'TOOL_UNKNOWN'
    | 'AGE_INVALID'
    | 'RATER_INVALID'
    | 'PRE_INVALID'
    | 'ANSWERS_INVALID'
    | 'ANSWERS_UNEXPECTED'
    | 'AGE_OUT_OF_WINDOW'
    | 'INCOMPLETE';
  toolId?: ToolId;
  windowMonths?: { lo: number; hi: number };
  /** 缺答的題 key，照出題順序（`INCOMPLETE`）。 */
  missing?: string[];
  /** 這次沒出、卻送來了的題 key（`ANSWERS_UNEXPECTED`）。 */
  unexpected?: string[];
  /** 值不在值域內的題（`ANSWERS_INVALID`，來自計分層）。 */
  invalid?: Array<{ key: string; value: AnswerValue }>;
}

export type SubmissionParse =
  | { ok: true; value: ScoreInput }
  | { ok: false; status: 400; body: SubmissionRejection };

function reject(code: SubmissionRejection['code'], error: string, extra: Partial<SubmissionRejection> = {}): SubmissionParse {
  return { ok: false, status: 400, body: { error, code, ...extra } };
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isToolId(x: unknown): x is ToolId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(TOOLKIT, x);
}

function isRater(x: unknown): x is Rater {
  return typeof x === 'string' && (RATERS as ReadonlyArray<string>).includes(x);
}

/** 前置題的一個答案：單選是字串、複選是字串陣列、是非題是布林（`PreQuestionSpec.kind`）。 */
function isPreValue(x: unknown): x is string | string[] | boolean {
  if (typeof x === 'string' || typeof x === 'boolean') return true;
  return Array.isArray(x) && x.every(v => typeof v === 'string');
}

/**
 * 讀交卷的 body。順序是 body → toolId → 月齡 → rater → pre → answers，第一個不對的就回，
 * 不累積 —— 前端一次只會做錯一件事，而錯的通常是第一件。
 *
 * 月齡只驗「非負整數」，窗口交給計分層（它知道每支工具的窗口，這裡不抄第二份）。
 * `answers` 的值域也交給計分層（題庫自己的選項）；這裡只擋型別 —— 布林、物件、null 進了計分層會
 * 被當成「不在值域」，錯誤訊息會指到一題，但那一題其實是整個 body 的形狀壞了。
 */
export function readToolSubmission(body: unknown): SubmissionParse {
  if (!isPlainObject(body)) return reject('BODY_INVALID', '交卷的内容格式不正确。');

  const { toolId, assessedAgeMonth, rater, pre, answers } = body;
  if (!isToolId(toolId)) return reject('TOOL_UNKNOWN', '没有这一份问卷。');
  if (typeof assessedAgeMonth !== 'number' || !Number.isInteger(assessedAgeMonth) || assessedAgeMonth < 0) {
    return reject('AGE_INVALID', '作答的月龄不正确。', { toolId });
  }
  if (!isRater(rater)) return reject('RATER_INVALID', '请选择填表人身份。', { toolId });

  const preOut: ScoreInput['pre'] = {};
  if (pre !== undefined && pre !== null) {
    if (!isPlainObject(pre)) return reject('PRE_INVALID', '前置问题的答案格式不正确。', { toolId });
    for (const [key, value] of Object.entries(pre)) {
      if (!isPreValue(value)) return reject('PRE_INVALID', '前置问题的答案格式不正确。', { toolId });
      preOut[key] = Array.isArray(value) ? [...value] : value;
    }
  }

  if (!isPlainObject(answers)) return reject('ANSWERS_INVALID', '题目的答案格式不正确。', { toolId });
  const answersOut: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return reject('ANSWERS_INVALID', '题目的答案格式不正确。', { toolId, invalid: [{ key, value: value as AnswerValue }] });
    }
    answersOut[key] = value;
  }

  return { ok: true, value: { toolId, assessedAgeMonth, rater, pre: preOut, answers: answersOut } };
}

/**
 * 計分層的拒算 → 400。五種都是「這份交卷本身有問題」，沒有一種是伺服器的錯，所以全部 400。
 *
 * `no_items_at_age` 對家長來說與窗口外是同一件事（這個月齡這份問卷沒有題可答），共用一個 code；
 * 兩者的差別（登錄表的窗口與題庫實際出得了題的範圍不一致）是題庫的事，記在勘誤 D1。
 */
export function refusalToHttp(refusal: ScoreRefusal): { status: 400; body: SubmissionRejection } {
  switch (refusal.reason) {
    case 'age_out_of_window':
    case 'no_items_at_age':
      return {
        status: 400,
        body: {
          error: `这份问卷适用 ${refusal.windowMonths.lo}–${refusal.windowMonths.hi} 个月，孩子现在 ${refusal.assessedAgeMonth} 个月，不在范围内。`,
          code: 'AGE_OUT_OF_WINDOW',
          toolId: refusal.toolId,
          windowMonths: refusal.windowMonths,
        },
      };
    case 'incomplete': {
      const left = refusal.askedCount - refusal.answeredCount;
      return {
        status: 400,
        body: {
          error: `还有 ${left} 题没有作答，全部答完才能交卷。`,
          code: 'INCOMPLETE',
          toolId: refusal.toolId,
          missing: refusal.missing,
        },
      };
    }
    case 'unexpected_answer':
      return {
        status: 400,
        body: {
          error: '答案里有这次没有出的题目，请重新打开问卷再作答。',
          code: 'ANSWERS_UNEXPECTED',
          toolId: refusal.toolId,
          unexpected: refusal.unexpected,
        },
      };
    case 'invalid_answer':
      return {
        status: 400,
        body: {
          error: '有题目的答案不在可选范围内。',
          code: 'ANSWERS_INVALID',
          toolId: refusal.toolId,
          invalid: refusal.invalid,
        },
      };
  }
}

/**
 * 一支工具對它餵的每個維度的 band（附錄 F 的 `feeds` × 規則表的 `bandFor`）。
 *
 * 只回餵的維度；不出 band 的工具（chexi、氣質）餵的那一格是 `null`，**不是缺鍵** ——
 * 「做了、沒有判定」與「不餵這個維度」對加測提示是兩件事：前者這支不能當星號用，後者根本不相干。
 * 標籤落在哪個維度不看這裡（`ToolFeed` 的警語），這裡只管 band。
 */
export function toolBands(r: ToolResult): Partial<Record<DimensionCode, Band | null>> {
  const rule = ruleFor(r.toolId);
  const out: Partial<Record<DimensionCode, Band | null>> = {};
  for (const feed of TOOL_SPECS[r.toolId].feeds) out[feed.dimension] = rule.bandFor(r, feed.dimension);
  return out;
}

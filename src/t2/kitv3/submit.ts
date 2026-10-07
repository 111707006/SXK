/**
 * 完整版題庫的交卷（T2 v3 題庫規格 §4.1、§8 R3g）：讀 body、驗、算分，產出要存的那一筆 `ToolResultV3`。純函式。
 *
 * 與 9/08 那一套（`src/t2/toolResults.ts`＋`scoring/`）同一個哲學：**分數是伺服器算的**，窗口外、缺答、多題、
 * 值域外一律拒算、不落表 —— 半套結果不存在。回應的 `code` 沿用同一組字（前端兩版共用一套錯誤處理），
 * 多一個 `GRADE_INVALID`（學障兩支的年級）。
 *
 * 【與舊版不同的地方】
 * - 工具用客規代碼（`SXK-GM`、`M-CHAT-R/F`……），窗口照客規附錄 A（`RECOMMEND_CONFIG.tools`），頁面只警告的我們照樣擋（§2.2）。
 * - 答案可以是 `null`（「不确定」「未观察到」「不适用」）—— 只有那一段的選項組真的有 `null` 那一項才收。
 * - 「無法觀察」整段略過（ATT）：`<段>.na` ＝ 1，那一段的題就不能再送。
 * - 沒有前置題；作答的情境（年級、有沒有上學、性別）一起存在結果裡，報告照存的讀。
 */

import { RECOMMEND_CONFIG } from '../recommend/config';
import { RATERS } from '../types';
import type { Rater } from '../types';
import { KITV3_BANKS, isKitV3Tool } from './index';
import { askedItems, formFor, scoreKitV3, sectionIsNa, type KitV3Score, type LdScoring, type ScoreContext } from './score';
import { TOOLKIT_VERSION_V3, type KitV3Bank, type ToolkitVersionV3 } from './types';

export interface V3Submission {
  toolId: string;
  assessedAgeMonth: number;
  rater: Rater;
  answers: Record<string, number | null>;
  /** 學障兩支：家長改過的年級（跳級、晚讀）；沒送由月齡推。 */
  grade?: number;
}

/** 伺服器從孩子檔案帶進來的作答情境（家長不在交卷時送）。 */
export interface V3ChildContext {
  inSchool?: boolean;
  sex?: 'male' | 'female';
}

/** 存進 `t2_tool_results.result` 的那一筆。 */
export interface ToolResultV3 {
  toolkitVersion: ToolkitVersionV3;
  toolId: string;
  assessedAgeMonth: number;
  rater: Rater;
  /** 計分用的情境（月齡、年級、上學、性別）。 */
  context: ScoreContext;
  answers: Record<string, number | null>;
  score: KitV3Score;
  computedAt: string;
}

export interface V3Rejection {
  error: string;
  code:
    | 'BODY_INVALID'
    | 'TOOL_UNKNOWN'
    | 'AGE_INVALID'
    | 'RATER_INVALID'
    | 'GRADE_INVALID'
    | 'ANSWERS_INVALID'
    | 'ANSWERS_UNEXPECTED'
    | 'AGE_OUT_OF_WINDOW'
    | 'INCOMPLETE';
  toolId?: string;
  windowMonths?: { lo: number; hi: number };
  missing?: string[];
  unexpected?: string[];
  invalid?: Array<{ key: string; value: unknown }>;
}

type Refused = { ok: false; status: 400; body: V3Rejection };
const refuse = (code: V3Rejection['code'], error: string, extra: Partial<V3Rejection> = {}): Refused => ({
  ok: false,
  status: 400,
  body: { error, code, ...extra },
});

const isPlainObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** 讀 body（`toolkitVersion` 由路由先看過）。順序同舊版：第一個不對的就回。 */
export function readV3Submission(body: unknown): { ok: true; value: V3Submission } | Refused {
  if (!isPlainObject(body)) return refuse('BODY_INVALID', '交卷的内容格式不正确。');
  const { toolId, assessedAgeMonth, rater, answers, grade } = body;
  if (!isKitV3Tool(toolId)) return refuse('TOOL_UNKNOWN', '没有这一份问卷。');
  if (typeof assessedAgeMonth !== 'number' || !Number.isInteger(assessedAgeMonth) || assessedAgeMonth < 0) {
    return refuse('AGE_INVALID', '作答的月龄不正确。', { toolId });
  }
  if (typeof rater !== 'string' || !(RATERS as ReadonlyArray<string>).includes(rater)) return refuse('RATER_INVALID', '请选择填表人身份。', { toolId });
  if (grade !== undefined && grade !== null && (typeof grade !== 'number' || !Number.isInteger(grade))) {
    return refuse('GRADE_INVALID', '年级不正确。', { toolId });
  }
  if (!isPlainObject(answers)) return refuse('ANSWERS_INVALID', '题目的答案格式不正确。', { toolId });
  const out: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      return refuse('ANSWERS_INVALID', '题目的答案格式不正确。', { toolId, invalid: [{ key, value }] });
    }
    out[key] = value;
  }
  return {
    ok: true,
    value: { toolId, assessedAgeMonth, rater: rater as Rater, answers: out, ...(typeof grade === 'number' ? { grade } : {}) },
  };
}

/** 年級只有學障兩支收，而且要在那一支的範圍裡。 */
function checkGrade(bank: KitV3Bank, grade: number | undefined): string | null {
  if (grade === undefined) return null;
  if (bank.family !== 'ld') return '这份问卷不需要年级。';
  const [lo, hi] = (bank.scoring as LdScoring).gradeRange;
  return grade < lo || grade > hi ? `年级要在 ${lo}–${hi} 之间。` : null;
}

/** 驗完、算分。`now` 給測試固定時間。 */
export function scoreToolV3(input: V3Submission, child: V3ChildContext, now: Date = new Date()): { ok: true; result: ToolResultV3 } | Refused {
  const bank = KITV3_BANKS[input.toolId];
  const spec = RECOMMEND_CONFIG.tools[input.toolId];
  const age = input.assessedAgeMonth;
  const windowMonths = { lo: spec.minM, hi: spec.maxM };
  const outOfWindow = () =>
    refuse('AGE_OUT_OF_WINDOW', `这份问卷适用 ${spec.minM}–${spec.maxM} 个月，孩子现在 ${age} 个月，不在范围内。`, { toolId: input.toolId, windowMonths });
  if (age < spec.minM || age > spec.maxM) return outOfWindow();
  let form;
  try {
    form = formFor(bank, age);
  } catch {
    return outOfWindow();
  }

  const gradeError = checkGrade(bank, input.grade);
  if (gradeError) return refuse('GRADE_INVALID', gradeError, { toolId: input.toolId });

  const context: ScoreContext = {
    ageM: age,
    ...(input.grade !== undefined ? { grade: input.grade } : {}),
    ...(child.inSchool !== undefined ? { inSchool: child.inSchool } : {}),
    ...(child.sex ? { sex: child.sex } : {}),
  };

  // 這次出的題、每一題的選項組；能整段略過的段多收一個 `<段>.na`
  const asked = askedItems(bank, context);
  const optionsOf = new Map(asked.map(a => [a.item.key, form.sections.find(s => s.key === a.section)!.options]));
  const sectionOf = new Map(asked.map(a => [a.item.key, a.section]));
  const naKeys = new Set(form.sections.filter(s => s.naLabel !== undefined).map(s => `${s.key}.na`));
  const naSections = new Set(form.sections.filter(s => sectionIsNa(s, input.answers)).map(s => s.key));

  const unexpected = Object.keys(input.answers).filter(k => {
    if (naKeys.has(k)) return false;
    const sec = sectionOf.get(k);
    return sec === undefined || naSections.has(sec);
  });
  if (unexpected.length) {
    return refuse('ANSWERS_UNEXPECTED', '答案里有这次没有出的题目，请重新打开问卷再作答。', { toolId: input.toolId, unexpected });
  }
  const invalid = Object.entries(input.answers).filter(([k, v]) => {
    if (naKeys.has(k)) return v !== 0 && v !== 1;
    return !bank.options[optionsOf.get(k)!].some(o => o.value === v);
  });
  if (invalid.length) {
    return refuse('ANSWERS_INVALID', '有题目的答案不在可选范围内。', { toolId: input.toolId, invalid: invalid.map(([key, value]) => ({ key, value })) });
  }

  const score = scoreKitV3(bank, input.answers, context);
  if (score.missing.length) {
    return refuse('INCOMPLETE', `还有 ${score.missing.length} 题没有作答，全部答完才能交卷。`, { toolId: input.toolId, missing: score.missing });
  }
  return {
    ok: true,
    result: {
      toolkitVersion: TOOLKIT_VERSION_V3,
      toolId: input.toolId,
      assessedAgeMonth: age,
      rater: input.rater,
      context,
      answers: { ...input.answers },
      score,
      computedAt: now.toISOString(),
    },
  };
}

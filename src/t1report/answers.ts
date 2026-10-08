/**
 * T1 報告的「真實資料」層：一份報告的逐題作答、作答分布、歷次報告的關注分（`T1_REPORT_REAL`，2026-10-08）。
 *
 * 【為什麼有這一層】
 * 舊報告上的四個儀表、「居同龄前 X%」、三條寫死的預測曲線都不是這個孩子的資料（儀表是模型照
 * 45–98 填的、百分位沒有常模、曲線每個孩子一樣）。新版報告上的每一個數字都從這裡算 ——
 * 這裡只讀家長真的答過的東西：九個維度的成績、R1b 起存下的逐題作答（`DimensionScore.items`）、
 * 這位家長自己的歷次報告快照。**讀不到就回 null，不補數字。**
 *
 * 【逐題作答怎麼對到題目】
 * `items[i]` 是那一維第 i 題的作答（2 可以做到／1 有时·部分／0 还不能），題目順序是
 * `t1Data.ts` 那個年齡段裡該維度的題目順序（`T1Screening.tsx` 存的時候就是這樣排的）。
 * 年齡段照**測評月齡**（`assessedAgeMonth`）找，不是今天的月齡 —— 跨段之後題目就對不上了。
 * 舊成績（R1b 之前）沒有 `items`，也可能沒有 `assessedAgeMonth`：那一維的逐題就是 null。
 *
 * 前端（報告畫面）與伺服器（提示、模板）共用這一檔，所以輸入一律當 `unknown` 收 ——
 * 值的來源是 JSON（localStorage、資料庫、請求 body），型別宣告擋不住裡面的東西。
 */

import { getT1AgeBand } from '../t1Data';
import type { AssessmentStatus } from '../types';

export type T1Answer = 0 | 1 | 2;

export interface T1ItemAnswer {
  questionId: string;
  /** 題目原文（`t1Data.ts`），一字不改。 */
  text: string;
  answer: T1Answer;
}

export interface T1DimensionAnswers {
  dimensionId: string;
  dimensionName: string;
  status: AssessmentStatus;
  score: number;
  maxScore: number;
  /** 這一維的逐題作答；舊成績或對不上題目時是 null。 */
  items: T1ItemAnswer[] | null;
}

export interface T1AnswerCounts {
  can: number;
  partly: number;
  notYet: number;
  total: number;
}

export interface T1Answers {
  /** 讀題目用的月齡（測評月齡，沒有就是呼叫端給的退路）；兩個都沒有是 null。 */
  ageMonth: number | null;
  /** 那個年齡段的名稱（「A 段 1-2 岁 (幼儿早期)」）；月齡不明時是 null。 */
  bandName: string | null;
  /** 只有 T1 的成績，依該年齡段題目裡維度出現的順序；年齡段沒有的維度排在最後。 */
  dimensions: T1DimensionAnswers[];
  /** 三種作答各幾題。**每一維都有逐題作答**才算，否則 null（少一維的「X / 36」是錯的數字）。 */
  counts: T1AnswerCounts | null;
}

/** 三種作答給家長看的說法，照題目選項原文（`t1Data.ts` 的 `stdOptions`）。 */
export const ANSWER_LABEL: Record<T1Answer, string> = {
  2: '可以做到',
  1: '有时・部分',
  0: '还不能',
};

const STATUSES: ReadonlyArray<AssessmentStatus> = ['normal', 'borderline', 'delay'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 把任一層級的得分換算到共用的 0–8「關注分」刻度（CONTEXT.md「關注分」）。
 * 2026-10-08 從 `ReportBody.tsx` 搬來，算式不變：歷次對照圖與九宮格要用同一把尺。
 */
export function toConcernScore(score: number, maxScore: number): number {
  const max = maxScore > 0 ? maxScore : 8;
  return Math.round(8 * (1 - score / max));
}

/** 一份報告裡 T1 的成績，形狀不對的丟掉（`tierId` 沒寫的舊成績當 T1）。 */
function t1ScoresOf(scores: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(scores)) return [];
  return scores.filter(
    (s): s is Record<string, unknown> =>
      isRecord(s) && typeof s.dimensionId === 'string' && s.dimensionId !== '' &&
      finite(s.score) && finite(s.maxScore) && (s.tierId === undefined || s.tierId === 'T1'),
  );
}

/**
 * 一份報告的逐題作答。
 *
 * @param scores 那一份報告的成績（`DimensionScore[]`，當 unknown 收）。
 * @param fallbackAgeMonth 成績上沒有測評月齡時的退路 —— **只能是那一份報告當時的孩子月齡**，
 *   不可以是今天的（`DimensionScore.assessedAgeMonth` 的說明）。
 */
export function t1AnswersOf(scores: unknown, fallbackAgeMonth?: number | null): T1Answers {
  const t1 = t1ScoresOf(scores);
  const assessed = t1.map(s => s.assessedAgeMonth).find(finite);
  const ageMonth = finite(assessed) ? assessed : finite(fallbackAgeMonth) ? fallbackAgeMonth : null;
  const band = ageMonth === null ? null : getT1AgeBand(ageMonth);

  const order: string[] = [];
  if (band) for (const q of band.questions) if (!order.includes(q.dimensionId)) order.push(q.dimensionId);
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);

  const seen = new Set<string>();
  const dimensions: T1DimensionAnswers[] = [];
  for (const s of t1) {
    const dimensionId = s.dimensionId as string;
    if (seen.has(dimensionId)) continue;
    seen.add(dimensionId);
    const questions = band ? band.questions.filter(q => q.dimensionId === dimensionId) : [];
    const raw = s.items;
    let items: T1ItemAnswer[] | null = null;
    if (
      questions.length > 0 && Array.isArray(raw) && raw.length === questions.length &&
      raw.every(v => v === 0 || v === 1 || v === 2)
    ) {
      items = questions.map((q, i) => ({ questionId: q.id, text: q.text, answer: raw[i] as T1Answer }));
    }
    dimensions.push({
      dimensionId,
      dimensionName: typeof s.dimensionName === 'string' && s.dimensionName ? s.dimensionName : dimensionId,
      status: STATUSES.includes(s.status as AssessmentStatus) ? (s.status as AssessmentStatus) : 'normal',
      score: s.score as number,
      maxScore: s.maxScore as number,
      items,
    });
  }
  dimensions.sort((a, b) => rank(a.dimensionId) - rank(b.dimensionId));

  let counts: T1AnswerCounts | null = null;
  if (dimensions.length > 0 && dimensions.every(d => d.items !== null)) {
    const all = dimensions.flatMap(d => d.items!);
    counts = {
      can: all.filter(i => i.answer === 2).length,
      partly: all.filter(i => i.answer === 1).length,
      notYet: all.filter(i => i.answer === 0).length,
      total: all.length,
    };
  }

  return { ageMonth, bandName: band ? band.name : null, dimensions, counts };
}

/** 被標記（黃燈或紅燈）的維度，紅燈在前、同級照題目順序。 */
export function flaggedDimensions(answers: Pick<T1Answers, 'dimensions'>): T1DimensionAnswers[] {
  const red = answers.dimensions.filter(d => d.status === 'delay');
  const yellow = answers.dimensions.filter(d => d.status === 'borderline');
  return [...red, ...yellow];
}

/** 一維裡某一種作答的題目。 */
export function itemsAnswered(d: T1DimensionAnswers, answer: T1Answer): T1ItemAnswer[] {
  return (d.items ?? []).filter(i => i.answer === answer);
}

// ---------------------------------------------------------------------------
// 歷次報告的關注分（取代寫死的三條預測曲線）
// ---------------------------------------------------------------------------

export interface ScreeningPoint {
  id: string;
  createdAt: string;
  /** 維度 → 那一份報告的關注分與判定。 */
  dimensions: Record<string, { concern: number; status: AssessmentStatus }>;
  /** 那一份報告用的年齡段（跨段之後題目不同，畫面要說出來）。 */
  bandName: string | null;
}

/** 對照圖最多畫幾份（最近的幾份）。手機寬度放不下更多。 */
export const SCREENING_SERIES_MAX = 6;

function pointOf(id: string, createdAt: string, scores: unknown, ageMonth: unknown): ScreeningPoint {
  const answers = t1AnswersOf(scores, finite(ageMonth) ? ageMonth : null);
  const dimensions: ScreeningPoint['dimensions'] = {};
  for (const d of answers.dimensions) {
    dimensions[d.dimensionId] = { concern: toConcernScore(d.score, d.maxScore), status: d.status };
  }
  return { id, createdAt, dimensions, bandName: answers.bandName };
}

/**
 * 這位家長**到這一份為止**的歷次篩查報告，由舊到新。
 *
 * 只收報告快照（有 `aiReport`、不是深度評估）—— 沒生成報告的篩查結果會被覆蓋，不是一個時間點。
 * 這一份（`current`）一定在最後：從歷史開舊報告時，比它新的不算（那份報告當時還沒有後來的事）；
 * 剛生成、還沒進歷史的那一份補在最後。
 */
export function screeningSeries(
  history: unknown,
  current: { id?: string | null; createdAt?: string | null; scores: unknown; ageMonth?: number | null },
): ScreeningPoint[] {
  const points: ScreeningPoint[] = [];
  const cutoff = typeof current.createdAt === 'string' && current.createdAt ? current.createdAt : null;
  if (Array.isArray(history)) {
    for (const raw of history) {
      if (!isRecord(raw) || raw.type === 'T2_T3_SPECIALIZED' || !isRecord(raw.aiReport)) continue;
      if (typeof raw.id !== 'string' || typeof raw.createdAt !== 'string') continue;
      if (current.id && raw.id === current.id) continue;
      if (cutoff && raw.createdAt > cutoff) continue;
      const child = isRecord(raw.child) ? raw.child : null;
      const p = pointOf(raw.id, raw.createdAt, raw.scores, child?.ageMonth);
      if (Object.keys(p.dimensions).length > 0) points.push(p);
    }
  }
  points.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const now = pointOf(current.id ?? 'current', cutoff ?? '', current.scores, current.ageMonth);
  return [...points.slice(-(SCREENING_SERIES_MAX - 1)), now];
}

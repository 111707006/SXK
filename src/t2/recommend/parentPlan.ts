/**
 * 推薦結果 → 家長端的 T2 入口（T2 v3 推薦規格 §4、§5；客規 §13.2）。純函式。
 *
 * 【為什麼另寫一層字】
 * 引擎吐的 `reason`、`alerts`、`gaps` 是客規的原句（「红旗」「中度落后」「改为治疗师当面评估」「转介」），寫給治療師看的；
 * 照《家长报告用语对照表》一句都不能直接給家長（規格 §5、memory `parent-wording-apply-all-tiers`）。這裡只讀引擎的**結構**
 *（類別、維度、填寫人、分鐘、第幾次）自己組句，這一檔在用字掃描裡（`test/parentWording.structure.test.ts`）。
 * P0 安全／醫療那兩句的確切字句要客戶給（待問 R-3），之前用中性的說法。
 *
 * 【沒有治療師】T3 預告不回、不出（使用者 2026-10-07）；`overrides` 不做（規格 §4）。
 * 量表名稱是客戶給的專有名詞，照用（規格 §5）。
 */

import { SITE_DIMENSION_NAME } from '../dimensionMap';
import type { DimensionCode } from '../types';
import { recommend } from './engine';
import { buildRecommendInput, type ChildRecommendFields, type T1ScoreInput } from './input';
import type { Alert, Recommendation, RecommendedTool } from './types';

export interface ParentPlanTool {
  code: string;
  name: string;
  dimension: DimensionCode | null;
  /** 為什麼推這一份（家長端的字）。 */
  reason: string;
  /** 誰填（家長端的字）。 */
  rater: string;
  minutes: number;
  /** 第一次／第二次填寫。 */
  session: 1 | 2;
}

export interface ParentPlanV3 {
  version: 'v3';
  status: 'RECOMMEND' | 'NO_T2';
  tools: ParentPlanTool[];
  totalMinutes: number;
  /** 兩次以上才提「建议分 2 次填写」。 */
  sessions: 1 | 2;
  /** 最上方的提示（安全、醫療、聽力、診斷年齡、T1 逐題資料缺）。 */
  notices: Array<{ kind: Alert['type'] | 'ITEMS_MISSING'; text: string }>;
  /** 這個年齡沒有適合在家填寫的問卷的維度。 */
  gaps: Array<{ dimension: DimensionCode; text: string }>;
  /** `NO_T2` 時的那一句。 */
  noT2Text?: string;
}

const dimName = (d: DimensionCode) => SITE_DIMENSION_NAME[d];

/** 規則必選的幾支各有自己的理由；其餘照類別。 */
const RULE_REASON: Readonly<Record<string, string>> = {
  'M-CHAT-R/F': '筛查里和别人互动、沟通的几题，想再多了解一些',
  'SXK-EMO': '筛查里有关情绪的一题，想多了解一些；建议在专业人员陪同下填写',
  'SXK-TIC': '您提到孩子有反复眨眼、清喉咙等情况，想多了解一些',
};
const RULE_DEFAULT = '好几个方面都想多了解一些，先用一份综合问卷';

export function reasonOf(t: Pick<RecommendedTool, 'code' | 'cls' | 'dim'>): string {
  const d = t.dim;
  switch (t.cls) {
    case 'rule':
      return RULE_REASON[t.code] ?? RULE_DEFAULT;
    case 'dx':
      return '和您填写的孩子情况有关';
    case 'P1':
      return d ? `「${dimName(d)}」想优先多了解一些` : '帮助更完整地了解孩子';
    case 'P2':
    case 'P5':
      return d ? `「${dimName(d)}」和您填写的孩子情况有关，想多了解一些` : '和您填写的孩子情况有关';
    case 'P3':
    case 'P4':
      return d ? `筛查里「${dimName(d)}」这一项，想再多了解一些` : '帮助更完整地了解孩子';
    case 'depth':
      return d ? `「${dimName(d)}」再多一份问卷，看得更完整` : '帮助更完整地了解孩子';
    case 'base':
      return '了解孩子日常生活的整体情况，之后可以前后对照';
    case 'fill':
      return '帮助更完整地了解孩子';
  }
}

/** 誰填：家長能填就是家長；只有本人版的讓孩子在家長的手機上填；只有教師版的請老師填（規格 §4）。 */
export function raterOf(raters: ReadonlyArray<string>): string {
  if (raters.includes('P')) return '家长填写';
  if (raters.includes('S')) return '孩子自己填写（可以用您的手机）';
  if (raters.includes('T')) return '请老师填写';
  return '家长填写';
}

const NOTICE_TEXT: Readonly<Record<Alert['type'], string>> = {
  SAFETY: '筛查里有关情绪的一题，建议先和专业人员聊一聊；下面的情绪问卷，建议在专业人员陪同下填写。',
  MEDICAL: '筛查里有关走路的题目，建议同时请儿童神经科或康复医学科的医生看一看。',
  PREREQ: '语言这一项，建议先确认孩子做过的听力检查结果。',
  DX_AGE: '您填写的孩子情况，在这个年龄先按筛查结果安排问卷。',
};
const ITEMS_MISSING_TEXT = '这次的筛查没有记下每一题的作答，重新做一次筛查，安排会更贴近孩子。';
export const NO_T2_TEXT = '目前不需要第二层检查，建议 3–6 个月后再做一次筛查。';

function gapText(d: DimensionCode, kind: 'none' | 'secondary'): string {
  return kind === 'none'
    ? `「${dimName(d)}」这个年龄没有适合在家填写的问卷，可以预约专家当面多了解。`
    : `「${dimName(d)}」这个年龄没有专门的问卷，先用一份相关的问卷看看，也可以预约专家当面多了解。`;
}

export function parentPlanV3(rec: Recommendation, itemsMissing: boolean): ParentPlanV3 {
  // 同一種提示只出一次（引擎可能有兩條 DX_AGE）
  const kinds = [...new Set(rec.alerts.map(a => a.type))];
  const notices: ParentPlanV3['notices'] = kinds.map(kind => ({ kind, text: NOTICE_TEXT[kind] }));
  if (itemsMissing) notices.push({ kind: 'ITEMS_MISSING', text: ITEMS_MISSING_TEXT });
  if (rec.status === 'NO_T2') {
    return { version: 'v3', status: 'NO_T2', tools: [], totalMinutes: 0, sessions: 1, notices, gaps: [], noT2Text: NO_T2_TEXT };
  }
  const tools = rec.tools.map(t => ({
    code: t.code,
    name: t.name,
    dimension: t.dim,
    reason: reasonOf(t),
    rater: raterOf(t.rater),
    minutes: t.minutes,
    session: t.session,
  }));
  return {
    version: 'v3',
    status: 'RECOMMEND',
    tools,
    totalMinutes: rec.parentMinutes,
    sessions: tools.some(t => t.session === 2) ? 2 : 1,
    notices,
    gaps: rec.gapDims.map(g => ({ dimension: g.dim, text: gapText(g.dim, g.kind) })),
  };
}

export interface RunRecommendationArgs {
  child: ChildRecommendFields;
  t1Scores: ReadonlyArray<T1ScoreInput & { assessedAgeMonth?: number }>;
  /** 今天的實足月齡（T1 沒記測評月齡時的退路）。 */
  liveAgeMonth: number;
  /** 近 90 天做完的量表（客規代碼）。 */
  doneCodes: ReadonlyArray<string>;
}

/**
 * 跑一次推薦：月齡用做 T1 那時候的測評月齡（最新一筆 T1 的 `assessedAgeMonth`，沒有才用今天的）。
 * 回 `rec`（照客規、含已做過的排除）與 `full`（不排除做過的 —— 報告快照的「推了哪些」用它，規格 §5.1、R-30）。
 */
export function runRecommendation(args: RunRecommendationArgs): { rec: Recommendation; full: Recommendation; itemsMissing: boolean; ageM: number } {
  const t1 = args.t1Scores.filter(s => s.tierId === 'T1');
  const stamped = [...t1].reverse().find(s => typeof s.assessedAgeMonth === 'number');
  const ageM = stamped?.assessedAgeMonth ?? args.liveAgeMonth;
  const built = buildRecommendInput({ ageM, child: args.child, t1Scores: t1, doneCodes: args.doneCodes });
  return {
    rec: recommend(built.input),
    full: recommend({ ...built.input, done: [] }),
    itemsMissing: built.itemsMissing,
    ageM: built.input.ageM,
  };
}

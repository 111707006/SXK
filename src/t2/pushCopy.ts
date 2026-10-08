/**
 * 線上干預 v3 畫面的字（T2 v3 規格 P12、P14、P17、§5.3、§5.4）。只在每週活動帶著 v3 的 `push`／`plan` 時用；
 * 舊週次照舊走 `trainingCopy.ts`／`weeklyCopy.ts`。
 *
 * 【不自己造狀態詞】
 * 顏色（紅／橙／綠）在家長端一律說成 `statusWording.ts` 那三句（需要较多支持／需要少量支持／发展稳定），
 * 與報告、九宮格同一個出口；不寫「红色」「重度」。轉介的那一句也不用《用语对照表》的禁字（建议评估、转介……）。
 */

import { STATUS_WORDING } from '../utils/statusWording';
import { SITE_DIMENSION_NAME } from './dimensionMap';
import { MODULE_TITLES_SC } from './trainingCopy';
import type { AssessmentStatus } from '../types';
import type { DimensionCode, ModuleNo } from './types';

export type PushColor = 'red' | 'orange' | 'green';
export type PushVariant = 'easy' | 'standard' | 'hard';
export type PushSource = 't2' | 't1';

/** 顏色 → 家長端的狀態（同報告）。 */
export const STATUS_OF_COLOR: Readonly<Record<PushColor, AssessmentStatus>> = { red: 'delay', orange: 'borderline', green: 'normal' };

/** 本月做法（客戶第七節「简单／标准／难一点」，手冊每張卡本來就寫好的三種）。 */
export const VARIANT_LABEL: Readonly<Record<PushVariant, string>> = { easy: '简单版', standard: '标准做法', hard: '难一点' };

/** 顏色從哪裡來（客戶第一關：卡片上「T1 推定」與「T2 分级」分開標）。 */
export const SOURCE_LABEL: Readonly<Record<PushSource, string>> = { t2: '按深度评估', t1: '按筛查推估' };

/** 月齡區間「24–28 个月」；三等分的小數取整（下取整、上進位，不縮小區間）。 */
export function monthRangeLabel([lo, hi]: readonly [number, number]): string {
  return `${Math.floor(lo)}–${Math.ceil(hi)} 个月`;
}

export function statusLabelOf(color: PushColor): string {
  return STATUS_WORDING[STATUS_OF_COLOR[color]].label;
}

export const PUSH_PAGE = {
  abilityTitle: '这一期练哪几块',
  abilitySub: '颜色深的先安排；每块从孩子做得到的月龄开始，一个月往上走一段',
  guidanceTitle: '怎么带最有效',
  periodSuffix: (periodNo: number) => (periodNo > 1 ? ` · 第 ${periodNo} 期` : ''),
  /** 三個月的階梯（取代「先熟悉／加一点／换玩法」）：做法照月份走。 */
  staircase: [
    { t1: '简单版', t2: '先做得到、养成习惯' },
    { t1: '标准做法', t2: '照手册的玩法练' },
    { t1: '难一点', t2: '往上推一点点' },
  ],
  /** 客戶第九節「期末检核区：三档进步状况的判断标准和对应做法，都印在页面上」。我們沒有治療師回診，照打卡完成率自動判（推送規格 §5.2）。 */
  periodEndTitle: '12 周练完之后怎么调整',
  periodEndRows: [
    { when: '打卡完成 80% 以上', then: '下一期内容往上走一段，每个活动都用「难一点」的做法，每周仍是 3 个。' },
    { when: '完成 50% 到 79%', then: '下一期换一批新活动，难度照月份慢慢往上。' },
    { when: '完成不到 50%', then: '下一期内容往回放一段，每周少一个、都用「简单版」，先把习惯找回来。' },
  ],
  periodEndNote: '这个调整只影响家庭活动，不会改动评估结果；三个月后建议重新做一次筛查和深度评估，用新的结果来安排。',
  /** 客戶第十節「几个要讲清楚的边界」。 */
  boundary: '这些是在家陪孩子练的活动建议，只是日常的配合，也不代表医生的判断；不能取代专业人员的训练与指导。',
  t1Evidence: '标着「按筛查推估」的几块，还没做深度评估问卷，依据比较少；如果分到的活动比较多，建议补做那一块的问卷。',
  adjusted: {
    good: '上一期练得很好，这一期每个活动都用「难一点」的做法。',
    stable: '上一期按部就班，这一期换一批新活动。',
    hard: '上一期不太容易坚持，这一期每周少一个、都用「简单版」——先把习惯找回来。',
  },
} as const;

/** 能力表的一列：「语言沟通 · 需要较多支持（按深度评估）」＋「每月 4 个 · 这个月练 24–28 个月的内容」。 */
export function abilityRow(d: { dimension: DimensionCode; color: PushColor; source: PushSource; quota: number; window: readonly [number, number] }) {
  return {
    title: `${SITE_DIMENSION_NAME[d.dimension]} · ${statusLabelOf(d.color)}`,
    source: SOURCE_LABEL[d.source],
    detail: `每月 ${d.quota} 个 · 这个月练 ${monthRangeLabel(d.window)}的内容`,
  };
}

/** 客戶第九節「交给家长的时候」那幾句（第四句「下次回诊带来」我們沒有回診，不放）。 */
export function guidanceLines(perWeek: number): string[] {
  return [
    `这个月一共 ${perWeek * 4} 个活动，一周做 ${perWeek} 个，每个活动一周做 4 次左右，一次 10 到 15 分钟。`,
    '做了就打个卡。做不到也没关系，打卡时记一下孩子的状态。',
    '孩子做不到就用「简单」的做法，轻松完成就试「难一点」。让他成功，比让他挑战重要。',
  ];
}

/** 有「需要较多支持」的能力時，能力表下方那一句（客戶「家庭活动只是配合」）。 */
export function referralLine(dimensions: ReadonlyArray<DimensionCode>): string {
  const names = dimensions.map(d => SITE_DIMENSION_NAME[d]).join('、');
  return `${names}目前${STATUS_WORDING.delay.label}，家庭活动是配合，建议同时约专家当面聊一聊，了解得更清楚。`;
}

/**
 * 詳情頁「为什么这周排这一个」（客戶第五節「为什么给」栏：哪个能力、判什么、取自哪个模组、月龄窗、编号）。
 * 放寬來的另加一句；補位的不另說（家長不需要知道原本那一支被停用）。
 */
export function pushReason(
  dimension: DimensionCode,
  push: { color: PushColor; source: PushSource; module: number | null; window: readonly [number, number]; relaxed: boolean },
  activityId: string,
): string {
  const no = Number(activityId.slice(1));
  const from = push.module ? `从「${MODULE_TITLES_SC[push.module as ModuleNo]}」里` : '';
  const head = `${SITE_DIMENSION_NAME[dimension]}${statusLabelOf(push.color)}（${SOURCE_LABEL[push.source]}），${from}按编号排到第 ${no} 号，练 ${monthRangeLabel(push.window)}的内容。`;
  return push.relaxed ? `${head}这个月龄段的活动排完了，挑了最接近的一支。` : head;
}

/** 本月做法那一句：「这个月用「简单版」」。 */
export function variantLine(variant: PushVariant): string {
  return `这个月用「${VARIANT_LABEL[variant]}」`;
}

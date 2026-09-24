/**
 * 家庭訓練新畫面自己的字（Keep 規格 §3.1、§3.2、§7、K16）。純資料與純函式，沒有 React。
 *
 * 【為什麼集中在這裡】
 * 與 `weeklyCopy.ts`／`reportCopy.ts` 同一個安排：畫面元件（`src/components/training/`）只排版，
 * 句子在這裡。家長用字的護欄（`test/parentWording.structure.test.ts`）掃的是原始碼，句子散在 JSX
 * 裡就只能靠讀。票 7、8 的新字也加在這一檔。
 *
 * 【哪些字不在這裡】
 * - 判定與狀態的說法：只走 `src/utils/statusWording.ts`（經 `reportCopy.ts` 的 `dimensionStatus`）。
 * - 「因為……所以練……」、準備中、兩個月齡的說明：`weeklyCopy.ts` 既有的句子（`reasonSentence`、
 *   `PREPARING_SENTENCE`、`AGE_SPLIT_NOTE`），不另寫一份。「为什么练这一块」是 `DIMENSION_WHY`。
 * - 客戶的內容（手冊的「练什么」「需要什么」「小提醒」、腳本）：活動庫的欄位，照原文顯示，不改字、
 *   不進這一檔（§7；§9 第 3 題由客戶決定要不要改）。
 *
 * 【12 週】
 * 樣品寫「4 周」「第 4 周最后一天」「这四周的重点」的地方全部改成 12 週（§3.2 最後一句）。
 * 週數從 `PLAN_TOTAL_WEEKS` 取（暫採，§9 第 2 題），使用者改了這裡跟著變。
 */

import { AGE_SPLIT_NOTE } from './weeklyCopy';
import { PLAN_TOTAL_WEEKS, type PlanPosition } from './trainingPlan';
import type { CheckinMood } from './practice';

/** 孩子的稱呼：家長填了名字用名字，沒有就是「孩子」（與 SMART 目標同一個退路）。 */
export function childLabel(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : '孩子';
}

// ── 通用 ────────────────────────────────────────────────────────────────

export const COMMON = {
  back: '返回',
  close: '关闭',
  comingSoon: '即将开放',
} as const;

/** 活動有沒有示範片（§3.1 第 4、5 項）。 */
export const CLIP_STATE = {
  has: '有示范片',
  none: '示范片制作中 · 先看图文',
  /** 小卡左下角的角標。 */
  badgeClip: '示范片',
  badgePictures: '图文',
} as const;

/** 「本周已练 N 次」。只在讀得到打卡時出現——讀不到時不寫 0 次。 */
export function practicedTimes(n: number): string {
  return `本周已练 ${n} 次`;
}

/** 星期幾，0＝星期一（與 `weeks.ts`、`practice.ts` 的編號一致）。打卡格的表頭。 */
export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 「孩子今天玩得怎样？」三選一（§3.6，票 7 用；計劃頁 STEP 3 先列出來）。與 `CHECKIN_MOODS` 同序。 */
export const MOOD_LABEL: Readonly<Record<CheckinMood, string>> = {
  engaged: '很投入',
  ok: '还可以',
  reluctant: '不太想玩',
};

// ── 報告入口（§3.1） ───────────────────────────────────────────────────

export const ENTRY = {
  title: '线上干预',
  tabs: { library: '示范片库', calendar: '打卡', expert: '问专家' },
  subtitle: '按这份报告安排，在家就能做',
  chipAll: '全部',
  planTags: ['定制', '本周', '按 T2 结果'],
  planLead: `${PLAN_TOTAL_WEEKS} 周计划 + 每周更新`,
  weekTag: '本周',
  libraryTitle: '示范片库',
  librarySub: '示范片做好后都放在这里，年龄没到的也能先看',
  bannerText: '不确定怎么带？约专家带着做一次',
  bannerAction: '去预约',
  loading: '正在准备这一周的活动…',
  error: '这一周的活动暂时读不出来，请稍后再打开这一页。',
  noActivities: '这一周还没有排得上的活动。下面可以先约专家聊聊这一周在家可以做什么。',
} as const;

/** 「{孩子名}的家庭活动计划」。 */
export function planTitle(childName: string | undefined): string {
  return `${childLabel(childName)}的家庭活动计划`;
}

/** 計劃大卡的小字：`共 12 周 · 本周 4 个活动 · 已练 N 次`。打卡讀不出來（`null`）時不寫「已练」。 */
export function planCardMeta(activityCount: number, sessions: number | null): string {
  const base = `共 ${PLAN_TOTAL_WEEKS} 周 · 本周 ${activityCount} 个活动`;
  return sessions === null ? base : `${base} · 已练 ${sessions} 次`;
}

/** 配對用的月齡與年齡段（票 #60 那一行）；兩個月齡不同時接 `AGE_SPLIT_NOTE`。 */
export function weekAgeLine(ageMonth: number, ageBand: string, reportAgeMonth: number): string {
  const line = `按孩子现在 ${ageMonth} 个月${ageBand ? `、${ageBand}这一段` : ''}安排。`;
  return ageMonth === reportAgeMonth ? line : `${line}${AGE_SPLIT_NOTE}（答题时 ${reportAgeMonth} 个月）。`;
}

export function swapHeading(dimensionName: string): string {
  return `换着玩 · ${dimensionName}`;
}

export function swapCount(n: number): string {
  return `${n} 个`;
}

export function swapSub(childName: string | undefined): string {
  return `练同一块、也适合${childLabel(childName)}现在的月龄；玩腻了就换一个`;
}

/** 換著玩的活動在詳情頁說的那一句（它沒有配對的理由，不套「因為……所以練……」）。 */
export function swapReason(dimensionName: string, childName: string | undefined): string {
  return `这一个不在这周的计划里：和本周的活动练同一块（${dimensionName}），也适合${childLabel(childName)}现在的月龄，玩腻了可以换它。`;
}

// ── 計劃頁（§3.2） ─────────────────────────────────────────────────────

/**
 * 「Hi，{稱呼} 已为{孩子名}生成」。**稱呼暫採「{孩子名}家长」**：系統只存孩子的名字，沒有家長的
 * 稱呼（樣品的「小宝妈妈」是編的）。沒有名字就是「家长」。
 */
export function planGreeting(childName: string | undefined): string {
  const name = childName?.trim();
  return `Hi，${name ? `${name}家长` : '家长'} 已为${childLabel(childName)}生成`;
}

/** `第 N 周 / 共 12 周`；過了 12 週是「已满 12 周，建议再评估一次」（§4.5）。 */
export function planWeekLabel(position: PlanPosition): string {
  if (position.weekIndex > position.totalWeeks) return `已满 ${position.totalWeeks} 周，建议再评估一次`;
  return `第 ${position.weekIndex} 周 / 共 ${position.totalWeeks} 周`;
}

export const PLAN_PAGE = {
  heading: '家庭活动计划',
  checks: ['按 T2 结果', '每周更新', '在家就能做'],
  reassess: '重新评估',

  arrangeTitle: '我的计划安排',
  /** 三張卡（§3.2）。第二張取代樣品的「难度 入门」：活動庫沒有難度欄位（目標月齡承擔難度）。 */
  arrange: [
    { label: '每天陪伴', big: '10–15', unit: '分钟', note: '分成两三小段做\n重点是天天做' },
    { label: '从哪开始', big: '做得到', unit: '', note: '从做得到的开始\n太难就退回简单版' },
    { label: '计划', big: String(PLAN_TOTAL_WEEKS), unit: '周', note: `第 ${PLAN_TOTAL_WEEKS} 周末\n再评估一次看变化` },
  ],

  sharesTitle: '这周练哪几块',

  resultsTitle: '我的评估结果',
  fullReport: '看完整报告',
  preparingNote: '活动准备中，可以先约专家',

  weekTitle: '本周活动',
  go: '去练',

  faqKicker: '常见问题',
  faqTitle: '家长最常问的四件事',
  /** 四個問題當目錄；`step` 是答案在哪一個 STEP（0 起）。 */
  faq: [
    { sub: '每天', main: '要练多久？', step: 1 },
    { sub: '这么多活动', main: '先练哪一个？', step: 0 },
    { sub: '孩子不配合', main: '怎么办？', step: 2 },
    { sub: '练了几周', main: '看得出变化吗？', step: 3 },
  ],

  steps: ['按评估结果 排好每一周', '每天十来分钟 跟着示范做', '孩子不配合 就先停', '打卡看得见 三个月后再评估'],

  /** STEP 1 按月的階梯（§3.2）：圓圈裡是 `n`＋`unit`。 */
  staircase: [
    { n: '1', unit: '个月', t1: '先熟悉', t2: '跟着示范做' },
    { n: '2', unit: '个月', t1: '加一点', t2: '每次多一轮' },
    { n: '3', unit: '个月', t1: '换玩法', t2: '换个地方玩' },
    { n: String(PLAN_TOTAL_WEEKS), unit: '周末', t1: '再评估', t2: '看哪里变了' },
  ],
  youAreHere: '你在这里',

  /** STEP 2 的示意小手機。 */
  phoneActions: '动作列表',
  phoneCalendar: '打卡日历',
  phoneTrainsPrefix: '这个活动练什么：',

  /**
   * STEP 3。樣品第三條是「做完记一下孩子的状态，下周安排会参考」——**配對現在不看心情與進步**
   * （§3.6、§9 第 6 題），改成記在打卡日曆裡；等 S27 真的用上再改回來。
   */
  step3: ['喊痛、明显累了或不愿意，就先停下来', '做不到就退回简单版——先让他成功', '做完记一下孩子的状态，会记在打卡日历里'],

  step4Caption: `实心的是练过的日子；最后一格是第 ${PLAN_TOTAL_WEEKS} 周末，提醒你再评估一次`,

  expertTitle: '有疑问 随时约专家',
  expertSub: '线上、线下都有，时间由客服和你确认',

  barLabel: '本周练过的活动',
  start: '开始今天的活动',
} as const;

/** 半圓儀表上一段寫幾項。 */
export function itemCount(n: number): string {
  return `${n} 项`;
}

/** 有標記的維度那張卡：「本周练：{活動名}」。 */
export function thisWeekPractice(titles: ReadonlyArray<string>): string {
  return `本周练：${titles.join('、')}`;
}

export function othersLabel(n: number): string {
  return `其他 ${n} 项`;
}

/** 「其他」那張卡的數字：`3 项发展稳定`（`label` 是 statusWording 的三級短標籤）。 */
export function othersValue(n: number, label: string): string {
  return `${n} 项${label}`;
}

/** 本週活動那一列：`已练 N 次`。 */
export function practicedBadge(n: number): string {
  return `已练 ${n} 次`;
}

// ── 活動詳情的簡單版（票 7 換成完整的） ────────────────────────────────

export const DETAIL = {
  trainsTitle: '这个活动练什么',
  whyTitle: '为什么这周排这一个',
  needTitle: '要准备',
  stepsTitle: '怎么玩',
  tipTitle: '小提醒',
  deeperPrefix: '想深入练：',
  watchClip: '看示范',
  notFound: '这个活动暂时找不到了，回到计划看看这周的其他活动。',
} as const;

/** 「约 N 分钟」（活動庫有填時長才出現）。 */
export function aboutMinutes(n: number): string {
  return `约 ${n} 分钟`;
}

// ── 還沒做的頁（示範片庫、打卡日曆，票 8） ─────────────────────────────

export const COMING_SOON = {
  title: '即将开放',
  body: '这一页还在准备中，先回到计划看看这周的活动。',
  back: '回到上一页',
} as const;

// ── 抽屜 ────────────────────────────────────────────────────────────────

export const EXPERT_SHEET = {
  title: '约专家',
  sub: '线上、线下都有；线下的地点和时间由客服打电话和你确认。',
} as const;

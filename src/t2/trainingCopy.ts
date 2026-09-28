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
import type { ModuleNo } from './types';
import { hasReminder, type PracticePrefs } from './practice';

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

// ── 獨立頁（2026-09-28 使用者：線上干預不放在報告裡，從導覽列另外開）───────────
// 內容與 Keep 規格 §3.1 的入口相同（`ENTRY`），只是換了位置：導覽列「线上干预」→ `TrainingPage`。
// 報告第六段只留一行連結過來（`REPORT_TRAINING_LINK`）。

export const TRAINING_PAGE = {
  navLabel: '线上干预',
  loading: '正在读取深度评估报告…',
  noReport: '完成深度评估、生成报告之后，这里会按结果安排每周的家庭活动，附示范片与打卡。',
  noReportAction: '去做深度评估',
  locked: '线上干预跟着深度评估一起开放。解锁深度评估、生成报告之后，这里会按结果安排每周的家庭活动。',
  lockedAction: '去解锁深度评估',
  error: '报告暂时读不出来，请稍后再打开这一页。',
  retry: '再试一次',
} as const;

export const REPORT_TRAINING_LINK = {
  text: '按这份报告安排的每周家庭活动、示范片与打卡，都在「线上干预」。',
  action: '打开线上干预',
} as const;

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

// ── 認不得的頁的退路（`ComingSoonScreen`；片庫、日曆票 8 已換成真的頁） ─

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

// ══ 活動詳情、播放器、打卡成功、抽屜（Keep 票 7） ═══════════════════════════
//
// 票 7 的字集中在這一段（§3.3–§3.6、§3.8）；打卡日曆、示範片庫（票 8）的字接在這一段之後。

// ── 活動詳情（§3.3，票 7） ──────────────────────────────────────────────

/**
 * 15 個模組的簡體名（詳情標題的「{模組名}」）。`activitySeed.ts` 的 `MODULE_TITLES` 是繁體（後台與
 * 規格用），家長端要簡體；客戶手冊抽出來的內容（`activityContent.ts`）沒有模組名，所以在這裡另放一份，
 * `test/trainingDetailCopy.test.ts` 逐字對 `MODULE_TITLES` 釘住兩份一一對應。
 */
export const MODULE_TITLES_SC: Readonly<Record<ModuleNo, string>> = {
  1: '身体动一动',
  2: '平衡与协调',
  3: '力气与耐力',
  4: '小手动起来',
  5: '画画写写前',
  6: '自己来',
  7: '听懂与回应',
  8: '词汇与说话',
  9: '聊天与说故事',
  10: '认识情绪',
  11: '情绪来了怎么办',
  12: '和人一起玩',
  13: '专心与记忆',
  14: '看与想',
  15: '动脑与解决问题',
};

/** 詳情標題：「我们来爬行 · 身体动一动 · 亲子」。手冊沒填的那一段不出。 */
export function detailHeadline(activity: { title: string; moduleNo: ModuleNo; people: string }): string {
  return [activity.title, MODULE_TITLES_SC[activity.moduleNo], activity.people].filter(Boolean).join(' · ');
}

/**
 * 詳情頁自己的字。客戶的內容（練什麼、原理、步驟、孩子卡住了怎麼辦……）是活動庫的欄位，照原文顯示，
 * 不在這裡；「为什么这周排这一个」的理由句走 `weeklyCopy.ts`，「为什么练{維度}」走 `DIMENSION_WHY`。
 */
export const DETAIL = {
  loading: '正在读取这个活动…',
  error: '这个活动暂时读不出来，请稍后再打开这一页。',
  notFound: '这个活动暂时找不到了，回到计划看看这周的其他活动。',

  /** 大圖（§3.3 第一列）。 */
  clipMaking: '示范片制作中',
  goWithClip: '跟着示范做',
  goPictures: '看图文步骤',
  actions: '动作列表',

  /** 系列列：本週計劃／換著玩／示範片庫各自是一個系列。 */
  series: { plan: '计划', swap: '换着玩', library: '示范片库' },
  seriesPlanSub: '本周',
  clipBadge: '示范片',
  picturesBadge: '图文',

  /** 數字列。 */
  minutes: '分钟',
  clipSeconds: '示范片',
  doneThenCheckin: '做完就打卡',

  /** 出處（樣品寫的「星晨儿童康复中心」是客戶 ASQ3 檔案上的院所名，不用）。 */
  source: '森心康',
  sourceMark: '森',

  /** 標籤列的第一個：從哪裡點進來。 */
  sourceTag: { plan: '按评估安排', swap: '换着玩', library: '示范片库' },
  atHome: '在家就能做',

  /** 四個圖示。 */
  addCalendar: '加日历',
  calendarAdded: '已加日历',
  cast: '投屏',
  expert: '问专家',

  trainsTitle: '这个活动练什么',
  whyPlan: '为什么这周排这一个：',
  whyOther: '什么时候选它：',
  collapse: '收起',
  stepsTitle: '怎么玩',
  stepsMoreWithSay: '看动作列表（含边做边说）',
  stepsMore: '看动作列表',
  reactionsTitle: '孩子卡住了怎么办',
  mistakesTitle: '大人最常做错的三件事',
  levelTitle: '太难或太简单',
  easier: '做不到 · 降一阶',
  harder: '太简单 · 升一阶',
  tipTitle: '小提醒',
  deeperPrefix: '想深入练：',

  /** 底部三顆。 */
  mode: '跟练方式',
  go: 'GO',
  equip: '要准备',
} as const;

/** 「约 N 分钟」（活動庫有填時長、又沒有腳本的片長時才出現）。 */
export function aboutMinutes(n: number): string {
  return `约 ${n} 分钟`;
}

/**
 * 數字列的片長：腳本的「2–3 分钟」拆成大字「2–3」與單位「分钟」（照樣品的排法）。不是這種寫法就
 * 整段原文照放（客戶的原文，不硬拆）。
 */
export function splitMinutes(length: string): { big: string; unit: string } {
  const m = /^(.+?)\s*分钟$/.exec(length.trim());
  return m && /^[\d–\-~～.]+$/.test(m[1]) ? { big: m[1], unit: '分钟' } : { big: length.trim(), unit: '' };
}

/** 「展开全部 8 条」（腳本的原理先列三條）。 */
export function expandAll(n: number): string {
  return `展开全部 ${n} 条`;
}

/** 「为什么练大运动：」 */
export function whyDimension(dimensionName: string): string {
  return `为什么练${dimensionName}：`;
}

/** 腳本的「孩子的反應」抽出來時拿掉了「如果」兩個字（`ActivityGuide` 的註解），畫面上加回來。 */
export function reactionIf(text: string): string {
  return `如果${text}`;
}

/** 「练过 N」圖示（→ 打卡日曆）。打卡讀不出來時不寫數字。 */
export function practicedIcon(n: number | null): string {
  return n === null ? '练过' : `练过 ${n}`;
}

/** 孩子現在幾個月：「8 个月」「3 岁」「1 岁 6 个月」。 */
export function ageText(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} 个月`;
  return m === 0 ? `${y} 岁` : `${y} 岁 ${m} 个月`;
}

/**
 * 年齡提醒（§3.3）：孩子還不到這一支的適齡。**只在比下限小時出**（`ageFit` 的 `tooYoung`）：配對會
 * 往前取適齡較小的活動（「从做得到的开始」），那種不能說成「先看看就好」。沒有示範片時不叫家長去看
 * 一支不存在的片。
 */
export function ageReminder(ageLabel: string, childName: string | undefined, childAgeMonth: number, clip: boolean): string {
  return `适合 ${ageLabel}；${childLabel(childName)}现在 ${ageText(childAgeMonth)}，${clip ? '先看看示范片就好' : '先看看怎么玩就好'}。`;
}

/** 片庫裡的一支（不在這週的計劃、也不是換著玩）在「什么时候选它」說的話。 */
export function libraryReason(
  fit: 'fits' | 'tooYoung' | 'tooOld' | 'unknown',
  ageLabel: string,
  childName: string | undefined,
  childAgeMonth: number | null,
): string {
  if (fit === 'fits') return `这一个不在这周的计划里，也适合${childLabel(childName)}现在的月龄，想换着玩可以选它。`;
  if (fit === 'tooYoung' && childAgeMonth !== null) {
    return `这一个适合 ${ageLabel}，${childLabel(childName)}现在 ${ageText(childAgeMonth)}，还不到这个年龄——先看看示范片，到了再练。`;
  }
  return '这一个不在这周的计划里，想换着玩可以选它。';
}

// ── 按 GO 之後（§3.4、§3.5，票 7） ──────────────────────────────────────

export const PLAYER = {
  prev: '上一步',
  next: '下一步',
  done: '做完了，打卡',
  posting: '正在打卡…',
  failed: '没打上卡，请再按一次。',
  soundOn: '打开声音',
  soundOff: '静音',
  tapToPlay: '点一下播放',
  sayTitle: '边做边说（影片脚本的旁白）',
  /** 圖文模式、又沒有示範片時多說的一句（§3.5）。 */
  noClipNote: '这一个还没有示范片；示范片做好后，按 GO 会改成看片跟着做。',
  /** 活動庫裡這一支還沒有步驟（後台可以清成零步）：照樣做得完、打得了卡。 */
  noSteps: '这一个的步骤还在整理中，陪孩子玩过了一样可以打卡。',
} as const;

/** 「第 1 步 · 共 4 步」。 */
export function stepOf(i: number, n: number): string {
  return `第 ${i} 步 · 共 ${n} 步`;
}

/** 圖文模式的「第 1 步」。 */
export function stepNo(i: number): string {
  return `第 ${i} 步`;
}

/** 播放器左上角：「示范片 0:10 · 循环播放」；不知道長度（`clock` 是空字串）就不寫長度。 */
export function clipLoopLabel(clock: string): string {
  return clock ? `示范片 ${clock} · 循环播放` : '示范片 · 循环播放';
}

// ── 打卡成功（§3.6，票 7） ─────────────────────────────────────────────

/**
 * 樣品的說明句是「都是选填。下周安排活动时会参考」——**配對現在不看心情與進步**（§9 第 6 題），
 * 改成「都是选填，会记在打卡日历里」；等 S27 真的用上再改回來。
 */
export const CHECKIN = {
  title: '打卡成功',
  weekSessions: '本周打卡次数',
  planPracticed: '本周练过的活动',
  moodQuestion: '孩子今天玩得怎样？',
  progressTitle: '这次看看有没有进步',
  progressSub: '影片脚本里的「怎么看出有进步」，看到了就勾起来',
  optional: '都是选填，会记在打卡日历里',
  saveFailed: '没存上，请再点一次。',
  toCalendar: '看打卡日历',
  toPlan: '回到计划',
} as const;

/** 「我们来爬行 · 第 3 次」（N 是 POST 回來的 `timesForActivity`：這一支一共第幾次，不分週）。 */
export function checkinSub(title: string, times: number): string {
  return `${title} · 第 ${times} 次`;
}

// ── 抽屜（§3.8，票 7） ─────────────────────────────────────────────────

/** 動作列表（§3.8 第一列）。英文小標照樣品（Keep 的「怎么玩–Play」那種寫法）。 */
export const ACTIONS_SHEET = {
  title: '动作列表',
  steps: '个步骤',
  minutes: '分钟',
  clip: '示范片',
  noteClip: '按 GO 之后示范片循环播放，步骤一步一步往下看；做完就打卡。',
  noteNoClip: '这一个还没有示范片，先照图文一步一步做。',
  playTitle: '怎么玩–Play',
  sayTitle: '边做边说–Say',
  saySub: '影片脚本里的旁白，照着对孩子说就好。',
  easier: '简单–Easier',
  harder: '难一点–Harder',
  go: 'GO · 开始跟着做',
} as const;

/** 要準備（§3.8）：手冊的「需要什么」；有腳本時加场地／器材／安全检查／大人位置（標題是腳本的原文鍵）。 */
export const EQUIP_SHEET = {
  title: '要准备',
  need: '需要什么',
} as const;

/** 跟練方式（§3.8）。存在這支手機上，不上伺服器（`followMode.ts`）。 */
export const MODE_SHEET = {
  title: '跟练方式',
  video: '看示范片跟着做',
  videoNote: '示范片边看边做，适合第一次做',
  videoNoClip: '这一个还没有示范片',
  pictures: '只看图文步骤',
  picturesNote: '一步一张卡，网络不好、想自己掌握节奏时用',
  savedHere: '只记在这支手机上',
} as const;

/** 投屏（§3.8）：瀏覽器叫不出投屏時的說明。 */
export const CAST_SHEET = {
  title: '投屏到电视',
  leadClip: '这个浏览器叫不出投屏，可以改用手机自己的投屏：',
  leadNoClip: '这一个还没有示范片，先照图文步骤做。有示范片的活动可以这样投：',
  ways: [
    { who: 'iPhone：', how: '按 GO 播放后，点画面上的投屏图示（AirPlay），或从控制中心选「屏幕镜像」。' },
    { who: '安卓：', how: '用浏览器菜单里的「投屏」，或手机下拉选单里的「无线投屏」。' },
    { who: '在微信里：', how: '先点右上角「…」→「在浏览器打开」，再照上面做。' },
  ],
} as const;

/**
 * 加到日曆（§3.8）。**提醒是手機日曆發的，不是我們發的**：樣品的「到时间提醒你」改成
 * 「加到手机日历，到时间手机会提醒你」。
 */
export const REMINDER_SHEET = {
  title: '加到日历',
  sub: '每周哪几天陪孩子练？加到手机日历，到时间手机会提醒你。',
  days: '哪几天',
  time: '几点',
  save: '加到打卡日历',
  saving: '正在保存…',
  saveFailed: '没存上，请稍后再试。',
  ics: '也加到手机日历（.ics）',
  icsOpening: '正在打开日历档…',
  icsFailed: '日历档暂时打不开，请稍后再试。',
  icsNote: 'iPhone 会直接打开「日历」；安卓看浏览器。',
  /** 已設的提醒還在讀：先不讓按（免得把預設的一、三、五存成家長的提醒）。 */
  loadingStored: '正在读取已经设好的提醒…',
  /** 讀不到已設的提醒：家長自己選過再加。 */
  storedUnknown: '暂时读不到已经设好的提醒；选好哪几天、几点再加。',
  wechat: '微信里下载不了日历档：先点右上角「…」→「在浏览器打开」，再回到这里加到手机日历。',
} as const;

/** 「已加到打卡日历：每周一、三、五 19:30」。 */
export function reminderSaved(label: string): string {
  return `已加到打卡日历：${label}`;
}

/** 「每周一、三、五 19:30」（星期 0＝一…6＝日，與 `practice.ts` 同一套編號）。 */
export function reminderLabel(days: ReadonlyArray<number>, time: string): string {
  return `每周${days.map(d => WEEKDAYS[d]).join('、')} ${time}`;
}

// ── 打卡日曆、示範片庫（Keep 票 8） ────────────────────────────────────
//
// §3.7、§3.9。句子的來源：樣品的 `CalendarScreen`／`LibraryScreen` 原句，規格點名的兩句照規格
// （提醒列、片庫底下那一句）。數字與日期由畫面算好傳進來，這裡只拼字。

/** 打卡日曆（§3.7）。 */
export const CALENDAR = {
  title: '打卡日历',
  /** 三個數字的標題。第三個與計劃頁底部的 x/4 同一句（`PLAN_PAGE.barLabel`）。 */
  stats: ['本月练了几天', '连续天数', PLAN_PAGE.barLabel],
  prevMonth: '上个月',
  nextMonth: '下个月',
  legend: {
    done: '练过',
    reminder: '提醒的日子',
    today: '今天',
    /** 第 12 週末（§8、v2.1 S14），與計劃頁 STEP 4 最後一格同一天。 */
    reassess: `第 ${PLAN_TOTAL_WEEKS} 周末再评估`,
  },
  recentTitle: '最近的打卡',
  /**
   * 最近的打卡是空的。日曆一進來只查這個月與上個月（`initialMonths`），更早的打卡不在手上——
   * 所以只說這兩個月，不說「还没有打卡」（很久以前練過的家長看到會是一句錯話）。
   */
  recentEmpty: '这两个月还没有打卡。做完一个活动按「打卡」，就会记在这里。',
  /** 這個月的打卡讀不出來：日曆照畫，練過的日子不標，數字不出（不寫 0）。 */
  checkinsError: '打卡记录暂时读不出来，请稍后再打开这一页。',
  /** 提醒讀不出來：不說「还没设」（那是一句不知道真假的話）。 */
  reminderError: '提醒暂时读不出来，点这里重新设定',
} as const;

/**
 * 提醒列（§3.7）：「提醒：每周一、三、五 19:30」或「还没设提醒，设定每周哪几天练」。
 * 「每周……」與加到日曆抽屜存好時說的是同一句（`reminderLabel`，票 7）。
 */
export function reminderLine(prefs: PracticePrefs | null): string {
  if (!hasReminder(prefs)) return '还没设提醒，设定每周哪几天练';
  return `提醒：${reminderLabel(prefs.reminderDays, prefs.reminderTime)}`;
}

/** 月曆的標題：「2026 年 9 月」。 */
export function calendarMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

/**
 * 最近的打卡那一列找不到活動（停用了、讀不到）：「活动 007」。只寫編號，不編一個名字。
 */
export function unknownActivityTitle(id: string): string {
  return `活动 ${activityNo(id)}`;
}

/** 最近的打卡那一列：「看到 N 项进步」（勾了才出）。 */
export function progressSeen(n: number): string {
  return `看到 ${n} 项进步`;
}

/** 示範片庫（§3.9）。 */
export const LIBRARY = {
  title: '示范片库',
  markPlan: '本周',
  markSwap: '换着玩',
  /** 適齡含孩子現在的月齡時，接在適齡原文後面。 */
  fitsNow: ' · 适合现在',
  loading: '正在读取示范片…',
  error: '示范片暂时读不出来，请稍后再打开这一页。',
  /** 片庫是空的（示範片還在上架）。 */
  empty: '示范片还在制作中，做好后都会放在这里。这一周的活动先照图文一步一步做，一样能打卡。',
  /** 篩選之後一支都沒有。 */
  filterEmpty: '这一类暂时还没有示范片。',
} as const;

/** 片庫最上面那一行：「17 支示范片 · 点开看怎么做」。 */
export function librarySummary(n: number): string {
  return `${n} 支示范片 · 点开看怎么做`;
}

/** 三個篩選，帶數量。 */
export function libraryChips(
  childName: string | undefined,
  counts: { all: number; fit: number; later: number },
): Array<{ key: 'all' | 'fit' | 'later'; label: string }> {
  return [
    { key: 'all', label: `全部 ${counts.all}` },
    { key: 'fit', label: `适合${childLabel(childName)}现在 ${counts.fit}` },
    { key: 'later', label: `再大一点 ${counts.later}` },
  ];
}

/** 片庫底下那一句（§3.9 原句）。 */
export function libraryFootnote(childName: string | undefined): string {
  const child = childLabel(childName);
  return `年龄还没到的也可以先看片。每周排进计划的，只会是适合${child}现在月龄的活动。`;
}

/** 手冊的編號：`A001` → `001`（樣品卡片上標題前那個灰字）。認不得的照原樣。 */
export function activityNo(id: string): string {
  const m = /^A(\d{3})$/.exec(id);
  return m ? m[1] : id;
}

const MODULE_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

/** 片庫的組標題：「模组一 · 身体动一动」（模組名是票 7 的 `MODULE_TITLES_SC`）。 */
export function moduleHeading(no: ModuleNo): string {
  return `模组${MODULE_NUMERALS[no]} · ${MODULE_TITLES_SC[no]}`;
}

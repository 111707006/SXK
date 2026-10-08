/**
 * 「九大能力关联图」的資料與句子（使用者 2026-10-08；新版 T1 報告取代腦區拓撲圖，只在專案 A）。
 *
 * 舊的拓撲圖畫的是腦區名稱與「协同率 X%」，那些不是從作答算得出來的。這張圖只講**能力之間怎麼互相帶動**：
 * 九個能力是點，顏色照這個孩子的判定（綠／黃／紅，同九宮格），十二條線是使用者給定的關聯與白話說明。
 * 沒有腦區、沒有百分比、沒有題目原文。
 *
 * - 線的兩端**都**被標記（需要少量／較多支持）→ 畫粗、上色，點了多一句「這兩項常常一起進步」（`pairSupportSentence`）。
 * - 其他線淡灰。
 *
 * 名字一律走網站的維度名稱（`DIMENSIONS_DATA`），句子在這一檔（進 `test/parentWording.structure.test.ts` 的掃描）。
 */

import { DIMENSIONS_DATA } from '../data';
import type { AssessmentStatus } from '../types';

export interface AbilityLink {
  a: string;
  b: string;
  /** 給家長的一句：這兩項為什麼連在一起。 */
  why: string;
}

/** 十二條關聯（使用者 2026-10-08 定，句子原文照抄）。順序就是畫面上列出來的順序。 */
export const ABILITY_LINKS: ReadonlyArray<AbilityLink> = [
  { a: 'language', b: 'social_emotional', why: '说得出、听得懂，是和人来回互动的主要工具' },
  { a: 'language', b: 'cognitive', why: '理解和表达，要靠概念、记忆这些动脑的基本功' },
  { a: 'language', b: 'learning_ability', why: '读写是建立在口语上的' },
  { a: 'cognitive', b: 'learning_ability', why: '推理和记忆是学东西的底子' },
  { a: 'cognitive', b: 'self_care', why: '记得住步骤、懂规则，才做得来日常的事' },
  { a: 'social_emotional', b: 'emotion_behavior', why: '情绪稳下来，才比较能和别人好好相处' },
  { a: 'emotion_behavior', b: 'attention', why: '管住冲动和管住情绪，用的是同一种「刹车」能力' },
  { a: 'attention', b: 'learning_ability', why: '专注和做事有条理，决定学习的效率' },
  { a: 'sensory_processing', b: 'attention', why: '对声音、触碰太敏感或太迟钝，都会让孩子坐不住、分心' },
  { a: 'sensory_processing', b: 'emotion_behavior', why: '感觉不舒服时，常常用发脾气、躲开来表达' },
  { a: 'sensory_processing', b: 'gross_motor', why: '平衡和身体位置的感觉，撑着走跑跳和动作协调' },
  { a: 'gross_motor', b: 'self_care', why: '穿衣、吃饭、如厕都要用到大小动作' },
];

/**
 * 圓周上的順序：十二條線裡有九條剛好是相鄰兩點（繞一圈），剩下三條（语言—认知、注意力—学习、感觉—情绪）
 * 只跨一格，所以畫在圓上幾乎不交叉。
 */
export const ABILITY_RING: ReadonlyArray<string> = [
  'language', 'social_emotional', 'emotion_behavior', 'attention', 'sensory_processing',
  'gross_motor', 'self_care', 'cognitive', 'learning_ability',
];

/** 網站的維度名稱（同九宮格）。 */
export function abilityName(id: string): string {
  return DIMENSIONS_DATA.find(d => d.id === id)?.name ?? id;
}

export const linkKey = (l: Pick<AbilityLink, 'a' | 'b'>) => `${l.a}--${l.b}`;

const isFlagged = (s: AssessmentStatus | undefined) => s === 'borderline' || s === 'delay';

export interface AbilityLinkView extends AbilityLink {
  key: string;
  /** 兩端都被標記：畫粗、上色、多一句。 */
  bold: boolean;
  /** 兩端有一個是「需要较多支持」：粗線用紅，否則用黃。只在 `bold` 時有意義。 */
  tone: 'delay' | 'borderline';
}

/** 這個孩子的十二條線（判定從成績來，讀不到的維度當作沒被標記）。 */
export function abilityLinksFor(statusOf: (id: string) => AssessmentStatus | undefined): AbilityLinkView[] {
  return ABILITY_LINKS.map(l => {
    const sa = statusOf(l.a);
    const sb = statusOf(l.b);
    return {
      ...l,
      key: linkKey(l),
      bold: isFlagged(sa) && isFlagged(sb),
      tone: sa === 'delay' || sb === 'delay' ? 'delay' : 'borderline',
    };
  });
}

/** 兩端都被標記時多的那一句。 */
export function pairSupportSentence(a: string, b: string): string {
  return `${abilityName(a)}和${abilityName(b)}都需要支持，这两项常常一起进步，练其中一项也会带动另一项。`;
}

/** 一條線點開時的說明（兩端都被標記就多一句）。 */
export function linkSentences(link: AbilityLinkView): string[] {
  const head = `${abilityName(link.a)} ↔ ${abilityName(link.b)}：${link.why}。`;
  return link.bold ? [head, pairSupportSentence(link.a, link.b)] : [head];
}

/** 圖的標題與小字（畫面上的固定句也放這裡，一起進掃描）。 */
export const ABILITY_MAP_COPY = {
  title: '九大能力关联图',
  subtitle: '能力之间会互相带动。颜色是这次的结果；两头都需要支持的线画得比较粗。点一个能力或一条线看说明。',
  hint: '点上面的能力或连线，看看它们怎么互相影响。',
  linksOf: (name: string) => `和「${name}」相连的能力：`,
} as const;

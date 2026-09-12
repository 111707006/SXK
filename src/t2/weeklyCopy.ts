/**
 * 每週活動畫面上的句子（票 #60，規格 v2 §7.3 的 `reason`）。純函式，沒有 I/O、沒有 React。
 *
 * 【為什麼抽出來】
 * 與 `entrance.ts`／`answering.ts` 同一個安排：畫面元件只排版，句子在這裡。兩個理由 ——
 * 句子要有測試（「因為……所以練……」是規格點名要顯示的東西），而家長用字的護欄
 * （`test/parentWording.structure.test.ts`）掃的是原始碼，句子散在 JSX 裡就只能靠讀。
 *
 * 【band 怎麼講】
 * 一律走 `src/utils/statusWording.ts` —— 全站唯一的一份。這裡不自己寫「需要多練習」這種話：
 * 那就是那一檔檔頭記著的「同一顆紅燈五個名字」的下一次。
 *
 * 【為什麼只講第一個對上的標籤】
 * `matchedTags` 可能有三四個。全部列出來，那一句會變成一段，而它在畫面上是配在活動標題底下的
 * 一行小字。第一個是 `targets` 的順序（內容團隊排的），不是隨機的。
 *
 * 【年齡段】
 * 配對用的是**實足月齡**，報告用的是**測評月齡**（孩子跨段之後兩者會分岔）。畫面上要標出
 * 這一週的活動是照哪一個配的 —— 兩個數字不同時，家長看到「報告說 47 個月、活動說 48 個月」
 * 而沒有任何解釋的話，會以為其中一個是錯的。
 */

import { STATUS_WORDING } from '../utils/statusWording';
import type { AssessmentStatus } from '../types';
import { SITE_DIMENSION_NAME } from './dimensionMap';
import { TAG_SENTENCES } from './report/sentences';
import type { ActivityTag } from './findingTags';
import type { AgeKey, PickReason } from './activityMatch';
import type { Band, DimensionCode } from './types';

/** §9 的對照：band → 正式站的三級（家長端的說法從那裡查）。 */
export const STATUS_OF_BAND: Readonly<Record<Band, AssessmentStatus>> = {
  clear: 'normal',
  watch: 'borderline',
  refer: 'delay',
};

/** 配對的四個年齡段（§7.2）→ 家長讀的說法。 */
export const AGE_BAND_LABEL: Readonly<Record<AgeKey, string>> = {
  '<12': '1 岁前',
  '12-36': '1–3 岁',
  '36-72': '3–6 岁',
  '72+': '6 岁以上',
};

/** 某個維度這一週配不到活動時說的話（§7.4）。 */
export const PREPARING_SENTENCE = '这方面的活动还在准备中，可以先和专家聊聊这一周可以做什么';

/** 兩個月齡不同時的說明（檔頭「年齡段」）。 */
export const AGE_SPLIT_NOTE = '这一周的活动按孩子现在的月龄安排；报告里的描述按答题那时候的月龄写';

/** 這一支是往前取的（`belowWindow`）時多說的一句。 */
export const BELOW_WINDOW_NOTE = '这一支比同龄的一般安排再往前一点，从孩子已经做得到的地方开始';

/**
 * 「因為……所以練……」（規格 §7.3 的 `reason` 展開）。
 *
 * `因为语言沟通目前与同龄常见的发展节奏有差距（这次看到：主动说出来的话比同龄孩子少一些…），
 *  所以这周安排这一支来练。`
 *
 * 沒有對上任何 ★ 標籤時省掉中間那一段 —— 那時這一支是「這個維度的模組群裡挑出來的」，
 * 硬安一個標籤上去就是在說一件規則引擎沒說的事。
 */
export function reasonSentence(dimension: DimensionCode, reason: PickReason): string {
  const name = SITE_DIMENSION_NAME[dimension];
  const describe = STATUS_WORDING[STATUS_OF_BAND[reason.band]].describe;
  const tag = reason.matchedTags[0] as ActivityTag | undefined;
  // `TAG_SENTENCES` 是完整的句子（自己帶句號）。嵌進括號裡時把句號去掉，
  // 否則畫面上會出現「……句子也短一些。），所以」這種兩個標點疊在一起的讀法。
  const seen = tag ? `（这次看到：${TAG_SENTENCES[tag].replace(/。$/, '')}）` : '';
  return `因为${name}目前${describe}${seen}，所以这周安排这一支来练。`;
}

/** 「9 月 7 日 – 9 月 13 日」。吃兩個 `YYYY-MM-DD`；認不得就回空字串（畫面上少一行，不是壞掉）。 */
export function weekRangeLabel(weekStart: string, weekEnd: string): string {
  const a = monthDayLabel(weekStart);
  const b = monthDayLabel(weekEnd);
  return a && b ? `${a} – ${b}` : '';
}

function monthDayLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[2])} 月 ${Number(m[3])} 日` : '';
}

/** 「3–6 岁」。認不得的年齡段回空字串。 */
export function ageBandLabel(ageKey: string): string {
  return AGE_BAND_LABEL[ageKey as AgeKey] ?? '';
}

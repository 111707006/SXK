/**
 * 完整版報告（T2 v3，`T2FindingsV3`）家長看得到的句子與整理（T2 v3 題庫規格 §5.3）。純函式，這一檔在用字掃描裡。
 *
 * 九宮格的狀態句不在這裡：照舊走 `reportCopy.ts` 的 `dimensionStatus`（`statusWording` 那一把尺），v3 與舊快照同一套說法。
 * 這裡只放 v3 多出來的四樣：
 * - 最上方的提示句（`notices`：轉介、倒退、情緒影響大、能作答的題不夠）。確切字句要客戶給（待問 R-3），之前用中性的說法；
 * - 生活品質（QOL）一段：只講困擾多寡與哪幾面比較明顯，分段名稱（「明显」「中度」）只進後台；
 * - 氣質一段：九個向度各講「偏向哪一端」，不講好壞（§5.3）；哪一端是什麼照那一表的 `poles`（BSQ 方向與 ITQ／TTS 相反，照表走就對）；
 * - 作答回顧：選了最差那一檔或倒數第二檔的題（§5.3）。
 *
 * 量表名稱是客戶給的專有名詞，照用（推薦規格 §5），名字取推薦設定，報告頁不必為了名字先下載題庫。
 */

import { formV3 } from './answeringV3';
import type { T2FindingsV3 } from './findingsV3';
import type { KitV3Bank, KitV3Option } from './kitv3/types';
import type { TemperamentScoring } from './kitv3/score';
import type { ToolResultV3 } from './kitv3/submit';
import { RECOMMEND_CONFIG } from './recommend/config';

/** 量表給家長看的名字（推薦設定裡的客規名稱）；設定裡沒有就退回代碼。 */
export function toolNameV3(toolId: string): string {
  return RECOMMEND_CONFIG.tools[toolId]?.name ?? toolId;
}

// ---------------------------------------------------------------------------
// 最上方的提示
// ---------------------------------------------------------------------------

/** 各旗標的句子（`{name}` 換成量表名稱）。字句待客戶（R-3），之前用中性的說法。 */
export const NOTICE_SENTENCE_V3: Readonly<Record<string, string>> = {
  refer: '「{name}」里有几项，建议近期请专业人员当面看一看。',
  priority: '「{name}」里您勾选了需要留意的情况，建议预约专家进一步了解。',
  regression: '您提到孩子有些以前会的，现在不会了，建议近期请专业人员当面看一看。',
  impact_high: '情绪方面对孩子日常生活的影响比较大，建议先和专业人员聊一聊。',
  insufficient: '「{name}」能作答的题目不够，这一份这次先不下判断。',
  too_many_na: '「{name}」能作答的题目不够，这一份这次先不下判断。',
};

/**
 * 報告最上方的幾句，依快照的順序、同一句只出一次。同一支同時有 `refer` 與 `priority`（TIC 勾了要緊的那幾項）只講 `refer`。
 */
export function noticeLinesV3(findings: Pick<T2FindingsV3, 'notices'>): string[] {
  const referred = new Set(findings.notices.filter(n => n.flag === 'refer').map(n => n.toolId));
  const lines: string[] = [];
  for (const n of findings.notices) {
    if (n.flag === 'priority' && referred.has(n.toolId)) continue;
    const template = NOTICE_SENTENCE_V3[n.flag];
    if (!template) continue;
    const line = template.replace('{name}', toolNameV3(n.toolId));
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// 生活品質（QOL）
// ---------------------------------------------------------------------------

/** 整體困擾的四段（好 → 壞），對到 QOL 的 `levels`。 */
export const QOL_SENTENCE: ReadonlyArray<string> = [
  '日常生活里，目前没有看到明显让孩子困扰的地方。',
  '日常生活里，有少数地方让孩子有些困扰。',
  '日常生活里，有几个地方让孩子比较困扰。',
  '日常生活里，有不少地方让孩子困扰，可以和专家聊一聊怎么帮孩子减轻。',
];

export interface QolSummary {
  sentence: string;
  /** 困擾比較明顯的面向（分段在後兩段的），依題庫順序。 */
  heavier: string[];
}

/** QOL 那一筆 → 一句總結＋比較明顯的面向；沒有整體分段（不該發生）時 `null`。 */
export function qolSummaryV3(result: ToolResultV3): QolSummary | null {
  const band = result.score.total.band;
  if (band === null || band < 0 || band >= QOL_SENTENCE.length) return null;
  return {
    sentence: QOL_SENTENCE[band],
    heavier: result.score.facets.filter(f => f.band !== null && f.band >= 2).map(f => f.name),
  };
}

// ---------------------------------------------------------------------------
// 氣質
// ---------------------------------------------------------------------------

export const TEMPERAMENT_LEAD = '每个孩子天生的风格不同，没有好坏之分；了解孩子偏向哪一边，比较容易找到适合他的相处方式。';
export const TEMPERAMENT_NO_NORM = '孩子资料里没有填写性别，这一段先按问卷本身的中间值粗略比较。';
const TEMPERAMENT_MIDDLE = '居中';

export interface TemperamentLine {
  dimension: string;
  /** 「偏向大」「偏向有规律」或「居中」。 */
  text: string;
  /** 0＝偏向低分那一端、1＝居中、2＝偏向高分那一端（畫面用來排版，不出字）。 */
  band: 0 | 1 | 2;
}

/**
 * 氣質那一筆 → 九個向度各一行。`bank` 是氣質那一支的題庫（`poles` 在它的計分設定裡，每一表各自的方向）。
 * 沒答到的向度（`band` 是 null）不出。
 */
export function temperamentLinesV3(result: ToolResultV3, bank: KitV3Bank): TemperamentLine[] {
  const scoring = bank.scoring as TemperamentScoring;
  const poles = scoring.forms[result.score.form]?.poles;
  if (!poles) return [];
  const lines: TemperamentLine[] = [];
  for (const f of result.score.facets) {
    if (f.band !== 0 && f.band !== 1 && f.band !== 2) continue;
    const pair = poles[f.key];
    if (!pair) continue;
    lines.push({ dimension: f.key, band: f.band, text: f.band === 1 ? TEMPERAMENT_MIDDLE : `偏向${pair[f.band === 0 ? 0 : 1]}` });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// 作答回顧
// ---------------------------------------------------------------------------

export interface ReviewItemV3 {
  key: string;
  sectionName: string;
  text: string;
  answer: string;
}

export interface ReviewGroupV3 {
  toolId: string;
  heading: string;
  computedAt: string;
  items: ReviewItemV3[];
}

/** 回顧不列的族：氣質沒有好壞（§5.3），QOL 另有自己一段。 */
const REVIEW_SKIP_FAMILIES: ReadonlySet<string> = new Set(['temperament', 'qol']);

/**
 * 選了最差那一檔或倒數第二檔的題（§5.3）。題庫裡每一組選項都由好排到壞（能力題「已经会 → 还不会」、
 * 困擾題「很少 → 总是」），「不确定」那類 `value: null` 不算一檔。
 * 只有兩檔的（是／否、有／没有）不列：哪一邊算差每一題不同（M-CHAT 有反向題），整組都會被當成「倒數兩檔」。
 */
function isUnstable(options: ReadonlyArray<KitV3Option>, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const graded = options.filter(o => o.value !== null);
  if (graded.length < 3) return false;
  const i = graded.findIndex(o => o.value === value);
  return i >= graded.length - 2;
}

/** 每一支一組，依交卷順序；沒有要列的題就不出那一組。`banks` 是已經載好的題庫（沒載到的那一支先不列）。 */
export function reviewGroupsV3(
  findings: Pick<T2FindingsV3, 'toolResults'>,
  banks: Readonly<Record<string, KitV3Bank>>,
): ReviewGroupV3[] {
  const groups: ReviewGroupV3[] = [];
  for (const r of findings.toolResults) {
    const bank = banks[r.toolId];
    if (!bank || REVIEW_SKIP_FAMILIES.has(bank.family)) continue;
    const form = formV3(bank, r.context);
    const items: ReviewItemV3[] = [];
    for (const section of form.sections) {
      for (const item of section.items) {
        const value = r.answers[item.key];
        if (!isUnstable(section.options, value)) continue;
        const oi = section.options.findIndex(o => o.value === value);
        items.push({
          key: item.key,
          sectionName: section.name,
          text: item.text,
          answer: item.anchors?.[oi] ?? section.options[oi].label,
        });
      }
    }
    if (items.length > 0) groups.push({ toolId: r.toolId, heading: toolNameV3(r.toolId), computedAt: r.computedAt, items });
  }
  return groups;
}

/**
 * 報告頁的句子與作答回顧（票 #61，規格 v2 §6.3、§6.4）。純函式，沒有 I/O、沒有 React。
 *
 * 【為什麼抽出來】
 * 與 `weeklyCopy.ts`／`answering.ts` 同一個安排：畫面元件只排版，句子在這裡。家長用字的護欄
 * （`test/parentWording.structure.test.ts`）掃的是原始碼，句子散在 JSX 裡就只能靠讀。
 *
 * 【band 怎麼講】
 * 三級 band 一律走 `src/utils/statusWording.ts`（全站唯一的一份）。四種「沒有判定」的值
 * （`partial`／`not_assessed`／`no_tool`）**各有自己的句子**，而且沒有一句長得像 clear ——
 * §5.7：「塌成同一個值就是『沒做完』被讀成『沒事』」。這裡是那條規則在畫面上的最後一道。
 *
 * 【作答回顧列什麼】
 * §6.4：「逐支工具列出答成『偶爾會／還不會』『經常／總是』『≤4』的題目原文 —— 這是工具包報告的
 * 『尚未穩定的項目（可直接作為訓練目標）』」。三條各對一個計分族（達成率、關切率、獨立率）；其餘族
 * 比照工具包各自那一段（dev 的「未通過」、snap 的「蛮多的以上」、chexi 的「正确以上」、mchat 答成風險
 * 方向、warn 陽性）。氣質量表沒有「尚未穩定」這回事，不列。
 *
 * 題目原文**只在這裡**進畫面（可摺疊的回顧），敘述段落不引用（§6.4）。原文從題庫 import，不手抄；
 * 題目含《對照表》禁字是客戶原文、在問一件事，豁免理由見 `test/parentWording.structure.test.ts`。
 * M-CHAT 經 `displayItemText` 轉簡體，與作答畫面同一條規則。
 *
 * 【工具怎麼稱呼】
 * 維度名加代號（「语言沟通 · SXK-LANG」），與作答清單同一種寫法。不用工具包的量表名：
 * 18 支自建工具的名字對家長沒有意義，而且其中幾支的名字本身就是禁字（「自闭行为量表」）。
 */

import { STATUS_WORDING } from '../utils/statusWording';
import type { AssessmentStatus } from '../types';
import { SITE_DIMENSION_NAME } from './dimensionMap';
import { STATUS_OF_BAND } from './weeklyCopy';
import { displayItemText, displayPrompt } from './answering';
import { askedItems } from './scoring';
import { TOOLKIT } from './toolkit';
import type { ToolId, ToolkitItem } from './toolkit';
import { TOOL_SPECS } from './toolSpecs';
import { SAFETY_SENTENCE } from './report/sentences';
import { DIMENSION_CODES } from './types';
import type { DimensionBand, ScoringFamily, T2Findings, ToolResult } from './types';

// ---------------------------------------------------------------------------
// 維度的狀態
// ---------------------------------------------------------------------------

/**
 * 四種「沒有判定」在畫面上的一整句（§5.7）。`clear` 不在這裡 —— 它是三級之一，走 statusWording。
 * 每一句都要讀得出「這一項**沒有**這次的結果」，而不是「這一項沒事」。
 */
export const DIMENSION_STATE_SENTENCE: Readonly<Record<'partial' | 'not_assessed' | 'no_tool', string>> = {
  partial: '这一项的问卷还没做完，这次没有它的结果',
  not_assessed: '这一项这次没有做问卷，先照第一层的结果看',
  no_tool: '这个月龄暂时没有适合这一项的问卷',
};

/** 四種「沒有判定」的短標籤（卡片角落的膠囊，6 字以內，與 `StatusWording.label` 同一個位置）。 */
export const DIMENSION_STATE_LABEL: Readonly<Record<'partial' | 'not_assessed' | 'no_tool', string>> = {
  partial: '还没做完',
  not_assessed: '这次没做',
  no_tool: '暂无问卷',
};

export type DimensionStatus =
  | { kind: 'band'; status: AssessmentStatus; label: string; tag: string }
  | { kind: 'state'; label: string; tag: string };

/** 一個維度在總覽上怎麼標：三級 band 走 statusWording，其餘三種各自明寫。 */
export function dimensionStatus(band: DimensionBand): DimensionStatus {
  if (band === 'clear' || band === 'watch' || band === 'refer') {
    const status = STATUS_OF_BAND[band];
    return { kind: 'band', status, label: STATUS_WORDING[status].label, tag: STATUS_WORDING[status].tag };
  }
  return { kind: 'state', label: DIMENSION_STATE_LABEL[band], tag: DIMENSION_STATE_SENTENCE[band] };
}

// ---------------------------------------------------------------------------
// 其餘句子
// ---------------------------------------------------------------------------

/**
 * `overview` 以 `SAFETY_SENTENCE` 原樣開頭時（§5.6 置頂，驗證器釘住），把它拿掉。
 * 畫面把那一句放在最頂端的橫幅裡，再留在 overview 裡就是同一句連著出現兩次。
 */
export function stripSafetyPrefix(overview: string): string {
  return overview.startsWith(SAFETY_SENTENCE) ? overview.slice(SAFETY_SENTENCE.length) : overview;
}

/**
 * 「距上次 N 天」（§10.2 第 2 項）。同一天重做的（N＝0）不寫「0 天」——那不是家長會說的話。
 * 畫面上這一句**不帶工具代號**（報告層不寫工具名，代號也是工具名）。
 */
export function redoSentence(daysSinceLast: number): string {
  return daysSinceLast === 0 ? '今天已经填过一次' : `距上次填写 ${daysSinceLast} 天`;
}

/** 回顧裡一題都沒有時說的話。 */
export const REVIEW_EMPTY_SENTENCE = '这次勾选的项目都已经稳定，没有需要特别列出来的';

// ---------------------------------------------------------------------------
// 作答回顧
// ---------------------------------------------------------------------------

/** 回顧裡的一題：原文、所在面向、家長答的那個選項。 */
export interface ReviewItem {
  key: string;
  sectionName: string;
  no: number;
  text: string;
  /** 所答選項的標籤原文（ASR 是那條錨點全文，與作答畫面上按的是同一句）。 */
  answer: string;
}

export interface ReviewGroup {
  toolId: ToolId;
  heading: string;
  /** 這一筆是什麼時候算的（`ToolResult.computedAt`）。 */
  computedAt: string;
  items: ReviewItem[];
}

/**
 * 哪些答案算「尚未穩定」，逐族一條（檔頭「作答回顧列什麼」）。`profile`（氣質）沒有。
 * `risk`（mchat）看的是題目自己的 `riskAnswer`，所以判斷式吃得到題目。
 */
const UNSTABLE_BY_FAMILY: Readonly<Record<ScoringFamily, ((value: number | string, item: ToolkitItem) => boolean) | null>> = {
  achievement: v => typeof v === 'number' && v <= 1,
  pass: v => v === 'fail',
  independence: v => typeof v === 'number' && v <= 4,
  concern: v => typeof v === 'number' && v >= 2,
  total: v => typeof v === 'number' && v >= 2,
  'mean-snap': v => typeof v === 'number' && v >= 2,
  'mean-chexi': v => typeof v === 'number' && v >= 4,
  risk: (v, item) => item.riskAnswer !== undefined && v === item.riskAnswer,
  positive: v => v === 1,
  profile: null,
};

/** 家長按的那個選項在畫面上的字。ASR 顯示錨點全文（作答畫面上選項本體就是它）。 */
function answerLabel(toolId: ToolId, item: ToolkitItem, value: number | string): string {
  if (item.anchors && typeof value === 'number' && item.anchors[value] !== undefined) return item.anchors[value];
  const option = TOOLKIT[toolId].options.find(o => o.value === value);
  return option ? displayPrompt(toolId, option.label) : String(value);
}

/**
 * 一支工具這一筆作答裡「尚未穩定」的題目。題目照 `askedItems`（與出題、驗卷同一份）在
 * `assessedAgeMonth` 下重取，所以列出來的是**當時真的問過的**那些；沒答的題（`incomplete`）不列。
 */
export function unstableItems(result: ToolResult): ReviewItem[] {
  const test = UNSTABLE_BY_FAMILY[TOOL_SPECS[result.toolId].family];
  if (!test) return [];
  const bank = TOOLKIT[result.toolId];
  const out: ReviewItem[] = [];
  for (const asked of askedItems(result.toolId, result.assessedAgeMonth)) {
    const value = result.answers[asked.key];
    if (value === undefined || !test(value, asked.item)) continue;
    const section = bank.sections.find(s => s.key === asked.sectionKey);
    out.push({
      key: asked.key,
      sectionName: displayPrompt(result.toolId, section?.name ?? ''),
      no: asked.item.no,
      text: displayItemText(result.toolId, asked.item),
      answer: answerLabel(result.toolId, asked.item, value),
    });
  }
  return out;
}

/** 「语言沟通 · SXK-LANG」—— 與作答清單同一種稱呼；餵多個維度時維度名並列（順序照 `DIMENSION_CODES`）。 */
export function toolHeading(toolId: ToolId): string {
  const spec = TOOL_SPECS[toolId];
  const fed = new Set(spec.feeds.map(f => f.dimension));
  const names = DIMENSION_CODES.filter(d => fed.has(d)).map(d => SITE_DIMENSION_NAME[d]);
  return `${names.join('、')} · ${spec.code}`;
}

/** 快照裡每支工具的回顧，依完成順序；一題都沒有的那一支不出現。 */
export function reviewGroups(findings: T2Findings): ReviewGroup[] {
  const groups: ReviewGroup[] = [];
  for (const result of findings.toolResults) {
    const items = unstableItems(result);
    if (items.length === 0) continue;
    groups.push({ toolId: result.toolId, heading: toolHeading(result.toolId), computedAt: result.computedAt, items });
  }
  return groups;
}

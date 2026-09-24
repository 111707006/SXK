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
 * `not_screened`（v2.1 S08，不篩）沒有句子：那一格整個不出（`gridDimensions`）。
 *
 * v2.1 改了兩件事（§4.2、§4.6）：沒做的（`partial`／`not_assessed`）短標籤都是「此次没做」、顏色帶 T1 的
 * 紅／黃（`tone`，看 `t1Flag`），`no_tool` 維持灰；6 歲以上的認知、語言、動作沒有星號時，`no_tool` 那一句
 * 換成客戶的固定句（`SCHOOL_AGE_NO_TOOL_SENTENCE`）。
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
import { TOOL_SPECS, feedAt } from './toolSpecs';
import { SAFETY_SENTENCE, SCHOOL_AGE_NO_TOOL_SENTENCE } from './report/sentences';
import { schoolAgeNoStar } from './routing';
import type { AdviceRank } from './advice';
import { DIMENSION_CODES } from './types';
import type { DimensionBand, DimensionFinding, ScoringFamily, T2Findings, ToolResult } from './types';

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

/**
 * 四種「沒有判定」的短標籤（卡片角落的膠囊，6 字以內，與 `StatusWording.label` 同一個位置）。
 *
 * `partial` 與 `not_assessed` 同一個字（v2.1 §4.2、S02，客戶 9/21 工作單 #2）：兩者對家長都是「這次沒做」，
 * 分別改由顏色（T1 的紅／黃）與整句（`DIMENSION_STATE_SENTENCE`）講。`no_tool` 不是「沒做」是「沒得做」，另一個字。
 */
export const DIMENSION_STATE_LABEL: Readonly<Record<'partial' | 'not_assessed' | 'no_tool', string>> = {
  partial: '此次没做',
  not_assessed: '此次没做',
  no_tool: '暂无问卷',
};

/**
 * 「沒有判定」的那一格用哪一組顏色（v2.1 S02）：`delay`／`borderline` 是 T1 的紅／黃（與三級 band 同一組色），
 * `state` 是不在那把尺上的灰。
 */
export type StateTone = 'delay' | 'borderline' | 'state';

export type DimensionStatus =
  | { kind: 'band'; status: AssessmentStatus; label: string; tag: string }
  | { kind: 'state'; tone: StateTone; label: string; tag: string };

/**
 * 沒做的維度帶 T1 的顏色（v2.1 §4.2、S02）：看快照上的 `t1Flag`（紅 2、黃 1），**不從 band 名稱推** ——
 * `partial` 在規則上一定是紅、`not_assessed` 一定是黃，但顏色要講的是「第一層怎麼標」，那一格就是 `t1Flag`。
 * 讀不到（舊資料缺這一格）或對不上（0）時不猜一個顏色，退回灰（v2.1 §10：舊快照照存的樣子讀，不炸）。
 * `no_tool` 恆灰：它不是「沒做」，是這個月齡沒得做。
 */
function stateTone(finding: DimensionFinding): StateTone {
  if (finding.band !== 'partial' && finding.band !== 'not_assessed') return 'state';
  if (finding.t1Flag === 2) return 'delay';
  if (finding.t1Flag === 1) return 'borderline';
  return 'state';
}

/**
 * 一個維度在總覽上怎麼標：三級 band 走 statusWording，其餘三種各自明寫。`ageMonth` 是這份報告的測評月齡
 * （`findings.child.assessedAgeMonth`），6 歲以上的 `no_tool` 那一句要看它。
 *
 * `not_screened`（v2.1 S08）沒有句子：不篩的維度畫面上**不出這一格**，呼叫端要先過 `gridDimensions`。
 * 走到這裡就丟錯，不挑一種「沒有判定」的句子頂上 —— 那會把「不評這一項」印成「沒做」或「沒有問卷」。
 */
export function dimensionStatus(finding: DimensionFinding, ageMonth: number): DimensionStatus {
  const band = finding.band;
  if (band === 'clear' || band === 'watch' || band === 'refer') {
    const status = STATUS_OF_BAND[band];
    return { kind: 'band', status, label: STATUS_WORDING[status].label, tag: STATUS_WORDING[status].tag };
  }
  if (band === 'not_screened') {
    throw new Error('reportCopy：not_screened 的維度不出這一格，先過 gridDimensions 再取狀態句');
  }
  return { kind: 'state', tone: stateTone(finding), label: DIMENSION_STATE_LABEL[band], tag: stateSentence(finding, ageMonth) };
}

/**
 * 「沒有判定」的整句。6 歲以上的認知、語言、動作沒有星號時（v2.1 §4.6、S05，`schoolAgeNoStar`），`no_tool` 換成
 * 客戶的固定句 —— 「这个月龄暂时没有」對它們不成立，長大了也不會有家長自填的工具。其他 no_tool（感覺 0–23、
 * 學習 37–71、情緒 0–11）長大後確實有工具，照舊。九宮格那一格與 no_tool 段的標題都從這裡取，同一句。
 */
function stateSentence(finding: DimensionFinding, ageMonth: number): string {
  const band = finding.band as 'partial' | 'not_assessed' | 'no_tool';
  if (band === 'no_tool' && schoolAgeNoStar(finding.dimensionId, ageMonth)) return SCHOOL_AGE_NO_TOOL_SENTENCE;
  return DIMENSION_STATE_SENTENCE[band];
}

/**
 * 總覽九宮格要出的維度，順序照快照（＝`DIMENSION_CODES`）。不篩的那幾格（v2.1 §4.7、S08：學習 0–36、
 * 注意力 0–11）整格不出 —— 它們不是「沒事」、也不是「這個月齡沒有問卷」，是 T2 這個月齡段不評這一項。
 * 10 個月的個案因此只有七格。舊快照（v2.1 §10）沒有 `not_screened`，照存的九格出。
 */
export function gridDimensions(findings: T2Findings): DimensionFinding[] {
  return findings.dimensions.filter(d => d.band !== 'not_screened');
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

/**
 * 報告「本週活動」段之後的那一句（規格 v2.1 §4.10、S14，客戶 9/21 工作單 #18「沒打卡」那一半；句子是暫採）。
 * 規則輸出、畫面直接顯示，不經 AI（§3.6）—— 模板與 AI 兩條路的報告頁都有。
 *
 * ⚠️ 現在沒有打卡紀錄可判斷，**一律出現**。打卡上線後（S27，等客戶定義「完成率上下調」）改成只在
 * **沒有**打卡紀錄時出現；有打卡的那一支改走完成率調整，不再是這一句。
 */
export const RETEST_SENTENCE = '三个月后重评一次，看看这段时间练下来的变化。';

// ---------------------------------------------------------------------------
// CONSEQ／PLAN 兩段（規格 v2.1 §6.3，S09）
// ---------------------------------------------------------------------------

/**
 * 逐維度卡片裡那兩段的段名（暫採，規格 v2.1 §9 第 5 題）。句子本身是題庫原文、由 `advice.ts` 取，
 * 現在題庫是空的，兩段不出現。
 *
 * 後者**不用**工具包的「建议治疗项目」：「治疗」是《用语对照表》的禁字。「建议后续项目」是客戶在
 * LDP／LDS 自己用的段名。
 */
export const ADVICE_HEADING = {
  consequences: '若持续不处理，一般会怎样',
  plans: '建议后续项目',
} as const;

/** 「若持续不处理」的段首固定句（工作單 #10：措辭保留「一般走向，不是对这个孩子的预测」）。 */
export const ADVICE_LEAD_SENTENCE = '以下是这一类情况的一般走向，不是对这个孩子的预测。';

/** 「建议后续项目」每一項前面的標示（工具包原文）。 */
export const ADVICE_RANK_LABEL: Readonly<Record<AdviceRank, string>> = {
  primary: '主要方向',
  secondary: '次要方向',
};

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

/**
 * 「语言沟通 · SXK-LANG」—— 與作答清單同一種稱呼；餵多個維度時維度名並列（順序照 `DIMENSION_CODES`）。
 *
 * 給了測評月齡就只列那個月齡生效的 feed（v2.1 §4.3 的有條件貢獻）：48 個月做的 adl 是「日常生活」，
 * 不因為 73 個月起才算的移动与转位而多掛「动作」。一條都不生效（72 個月的 tempb，只出標籤）就照全部列。
 */
export function toolHeading(toolId: ToolId, ageMonth?: number): string {
  const spec = TOOL_SPECS[toolId];
  const active = ageMonth === undefined ? spec.feeds : spec.feeds.filter(f => feedAt(toolId, f.dimension, ageMonth) !== null);
  const fed = new Set((active.length > 0 ? active : spec.feeds).map(f => f.dimension));
  const names = DIMENSION_CODES.filter(d => fed.has(d)).map(d => SITE_DIMENSION_NAME[d]);
  return `${names.join('、')} · ${spec.code}`;
}

/** 快照裡每支工具的回顧，依完成順序；一題都沒有的那一支不出現。 */
export function reviewGroups(findings: T2Findings): ReviewGroup[] {
  const groups: ReviewGroup[] = [];
  for (const result of findings.toolResults) {
    const items = unstableItems(result);
    if (items.length === 0) continue;
    groups.push({
      toolId: result.toolId, heading: toolHeading(result.toolId, result.assessedAgeMonth), computedAt: result.computedAt, items,
    });
  }
  return groups;
}

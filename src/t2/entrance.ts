/**
 * 家長端 T2 入口的純函式層（票 #56，規格 v2 §4.4、§4.5、§9.2）。
 *
 * 【三件事】
 * 1. `t1FlagsFromScores`：正式站的篩查結果（`DimensionScore[]`）→ `planT2` 吃的九碼標記。
 * 2. `entranceState`：入口要不要出現。§4.5「所有被標記的維度都是 `no_tool` 時不顯示 T2 入口」
 *    —— 家長付費前就要知道這個年齡沒有東西可做。
 * 3. `describePlan`／`describePlanItem`：題量怎麼講。畫面上「需要完成 N 份、約 M 題」，
 *    必做、選做、加測分開算（§4.4 最後一段）。
 * 4. `noToolNotes`／`expertOnlyCopy`：沒有工具的維度怎麼講（§4.5）；6 歲以上的認知、語言、動作
 *    換成客戶的固定句（v2.1 §4.6、S05）。
 *
 * 【沒有 I/O】
 * 伺服器與畫面都呼叫這裡；伺服器算完把 `entrance` 一併回給前端，前端不重算。
 * 這裡沒有 fetch、沒有日期、沒有隨機 —— 那些都在 `server.ts` 與 `T2Entrance.tsx`。
 *
 * 【清單上不寫工具名】
 * 工具包的標題（「森心康自闭行为量表」「森心康学习障碍量表」）本身含《對照表》禁字，
 * 而報告層（#55）從不寫工具名。入口的清單因此只講「這一份是為哪個維度、幾題」——
 * 家長要知道的是「要為語言溝通答 49 題」，不是量表叫什麼。作答頁（#58）打開一支工具時
 * 標題怎麼顯示，是那張票的決定。
 */

import { SITE_DIMENSION_ID, SITE_DIMENSION_NAME } from './dimensionMap';
import { notScreened, schoolAgeNoStar } from './routing';
import { SCHOOL_AGE_NO_TOOL_SENTENCE } from './report/sentences';
import { DIMENSION_CODES } from './types';
import type { DimensionCode, PlanItem, T1Flag, T2Plan } from './types';

/** 正式站 `DimensionScore` 裡這裡會讀的三個欄位。 */
export interface T1ScoreLike {
  dimensionId: string;
  tierId: 'T1' | 'T2' | 'T3';
  status: 'normal' | 'borderline' | 'delay';
}

const FLAG_OF: Record<T1ScoreLike['status'], T1Flag> = { normal: 0, borderline: 1, delay: 2 };

/**
 * 篩查結果 → 九碼標記（§4.1：紅 2、黃 1、綠 0）。
 *
 * 九個 key 都會在：沒篩到的維度是 0（沒有東西可做，與綠一樣），不是缺 key —— `planT2`
 * 少一個 key 會丟錯。只看 `tierId === 'T1'`，T2／T3 的成績不是 T1 標記；認不得的
 * `dimensionId` 略過。同一個維度有多筆時取最後一筆（App 存檔時同維度同層只留一筆，
 * 這裡只是不讓舊資料炸掉）。
 */
export function t1FlagsFromScores(scores: ReadonlyArray<T1ScoreLike>): Record<DimensionCode, T1Flag> {
  const flags = {} as Record<DimensionCode, T1Flag>;
  for (const d of DIMENSION_CODES) flags[d] = 0;
  for (const s of scores) {
    if (s.tierId !== 'T1') continue;
    const code = DIMENSION_CODES.find(d => SITE_DIMENSION_ID[d] === s.dimensionId);
    if (!code) continue;
    const flag = FLAG_OF[s.status];
    if (flag !== undefined) flags[code] = flag;
  }
  return flags;
}

/**
 * 被 T1 標記（紅或黃）、而且這個月齡 T2 會評的維度，順序照 `DIMENSION_CODES`。
 * 不篩的段（v2.1 S08：學習 0–36、注意力 0–11）T1 標了也不算 —— 所以要吃月齡。
 */
export function flaggedDimensions(t1Flags: Readonly<Record<DimensionCode, T1Flag>>, ageMonth: number): DimensionCode[] {
  return DIMENSION_CODES.filter(d => t1Flags[d] !== 0 && !notScreened(d, ageMonth));
}

/**
 * 入口的三種狀態：
 * - `show`：有東西可答，顯示入口（題量、診斷方向、清單）。
 * - `expert_only`：被標記的維度**全部**在這個月齡沒有工具（§4.5）—— 不顯示入口，
 *   直接說「這個年齡目前沒有適用的深度評估工具，建議直接預約專家」並導向四種服務。
 * - `none`：全綠。沒有東西要做，也沒有專家好導，什麼都不顯示。只有**不篩**的維度被標記（10 個月的
 *   學習、注意力，v2.1 S08）也是這一種（暫採，v2.1 §9 第 3 題）：那不是「沒有工具、建議找專家」，
 *   是這個月齡段 T2 不看這一項。
 *
 * 判斷看的是 plan 裡**有沒有必做或選做**，不是逐一比對 `noTool`：沒有診斷方向時兩者等價
 * （每個被標記的維度不是出一支星號，就是進 `noTool`）；有診斷方向時，被標記的維度全是
 * `no_tool` 但 `DIS` 表提了必做（80 個月 LANG 紅、選自閉症 → asb／asr／spb……）——
 * 那是醫師給的方向，有東西可答就顯示，`noTool` 的維度在入口裡照樣寫專家導向。
 */
export type EntranceState = 'show' | 'expert_only' | 'none';

export function entranceState(plan: T2Plan, t1Flags: Readonly<Record<DimensionCode, T1Flag>>): EntranceState {
  if (plan.required.length + plan.optional.length > 0) return 'show';
  return flaggedDimensions(t1Flags, plan.ageMonth).length > 0 ? 'expert_only' : 'none';
}

export interface PlanDescription {
  /**
   * 「需要完成 2 份约 90 题，另有 1 份选做约 75 题」。只有選做時沒有前半句；
   * 什麼都沒有時 `null`。
   */
  headline: string | null;
  /** 「答完之后，可能再加测 1 份约 30 题」；沒有加測時 `null`。 */
  followup: string | null;
  /** 只出標籤、不出判定的補充問卷（chexi、氣質）；沒有時 `null`。 */
  extras: string | null;
}

const sum = (items: ReadonlyArray<PlanItem>) => items.reduce((n, i) => n + i.askedCount, 0);

/**
 * 題量三句話（§4.4「必做、選做、加測分開算」）。
 *
 * 加測與補充各自一句、不併進 headline：加測要星號做完且判留意或關注才會真的問（§4.2），
 * 補充問卷不出判定（§4.2 extras「永遠是選做」、`estimatedItems` 也沒有它那一格）——
 * 把它們加進「需要完成」會把 90 題講成 216 題，家長付費前看到的數字就是錯的。
 */
export function describePlan(plan: T2Plan): PlanDescription {
  const parts: string[] = [];
  if (plan.required.length > 0) parts.push(`需要完成 ${plan.required.length} 份约 ${plan.estimatedItems.required} 题`);
  if (plan.optional.length > 0) {
    parts.push(`${parts.length > 0 ? '另有 ' : ''}${plan.optional.length} 份选做约 ${plan.estimatedItems.optional} 题`);
  }
  return {
    headline: parts.length > 0 ? parts.join('，') : null,
    followup: plan.followup.length > 0
      ? `答完之后，可能再加测 ${plan.followup.length} 份约 ${plan.estimatedItems.followup} 题`
      : null,
    extras: plan.extras.length > 0
      ? `另可选填 ${plan.extras.length} 份补充问卷约 ${sum(plan.extras)} 题`
      : null,
  };
}

/** 清單上的一列：「语言沟通 · 49 题」；餵多個維度時維度名並列（順序照 `DIMENSION_CODES`）。 */
export function describePlanItem(item: PlanItem): string {
  const names = DIMENSION_CODES.filter(d => item.forDimensions.includes(d)).map(d => SITE_DIMENSION_NAME[d]);
  return `${names.join('、')} · ${item.askedCount} 题`;
}

// ---------------------------------------------------------------------------
// 沒有工具的維度（§4.5；v2.1 §4.6、S05）
// ---------------------------------------------------------------------------

/** 規格 v2 §4.5 的原話（簡體）：`no_tool` 的維度與「全部沒工具」都用它。 */
export const NO_TOOL_SENTENCE = '这个年龄目前没有适用的深度评估工具，建议直接预约专家';

/** 入口上講「沒有工具」的一段：哪幾個維度、講哪一句、整段怎麼寫。 */
export interface NoToolNote {
  dimensions: DimensionCode[];
  sentence: string;
  text: string;
}

/**
 * `plan.noTool` 的維度依「該講哪一句」分段，段的先後照各段第一個維度（`noTool` 已是 `DIMENSION_CODES` 順序）。
 *
 * 6 歲以上的認知、語言、動作沒有星號（`schoolAgeNoStar`）→ 客戶 9/21 工作單 #6 的固定句（v2.1 §4.6、S05）：
 * 「这个年龄目前没有」對它們會讀成「長大就有」，而它們長大了也不會有家長自填的工具。其餘的 no_tool（感覺 0–23、
 * 學習 37–71、情緒 0–11，以及新包之前的感覺、日常生活 181 起）照舊是 `NO_TOOL_SENTENCE`。
 *
 * 固定句自帶主詞（「6 岁以上的认知、语言、动作」），所以維度名後面加冒號；一般那句沿用原本的「「X」这个年龄……」。
 */
export function noToolNotes(plan: Pick<T2Plan, 'noTool' | 'ageMonth'>): NoToolNote[] {
  const notes: NoToolNote[] = [];
  for (const d of plan.noTool) {
    const sentence = schoolAgeNoStar(d, plan.ageMonth) ? SCHOOL_AGE_NO_TOOL_SENTENCE : NO_TOOL_SENTENCE;
    const note = notes.find(n => n.sentence === sentence);
    if (note) note.dimensions.push(d);
    else notes.push({ dimensions: [d], sentence, text: '' });
  }
  for (const note of notes) {
    const names = note.dimensions.map(d => SITE_DIMENSION_NAME[d]).join('、');
    note.text = note.sentence === SCHOOL_AGE_NO_TOOL_SENTENCE ? `「${names}」：${note.sentence}。` : `「${names}」${note.sentence}。`;
  }
  return notes;
}

/**
 * 入口只剩專家導向（`expert_only`）時的標題與另列的段落：所有被標記的維度講同一句 → 那一句就是標題；
 * 講不同句（190 個月語言與感覺都紅）→ 標題用一般那句，固定句的那幾個維度另列一段 —— 每一句只出現一次。
 */
export function expertOnlyCopy(plan: Pick<T2Plan, 'noTool' | 'ageMonth'>): { headline: string; notes: string[] } {
  const notes = noToolNotes(plan);
  const headline = notes.length === 1 ? notes[0].sentence : NO_TOOL_SENTENCE;
  return { headline, notes: notes.filter(n => n.sentence !== headline).map(n => n.text) };
}

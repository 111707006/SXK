/**
 * 家長端逐支作答的純函式層（票 #58，規格 v2 §3.1、§4.6、§5.1、§11 階段 5）。
 *
 * 【這一層做什麼】
 * 畫面（`T2Assessment.tsx`）要的每一個「算出來的東西」都在這裡，沒有 fetch、沒有日期、沒有 React：
 * 1. `formFor`：這支工具在這個月齡的表單 —— 前置題、依面向分組的題目、每題的 key。
 *    題目與 key 一律走計分層的 `askedItems()`，**不自己依 `startMonth` 再篩一次**：家長端多出或少出
 *    一題，交卷就永遠回 `incomplete`（`scoring/index.ts` 的警語）。
 * 2. `missingCount`／`canSubmit`：缺答不能交卷，按鈕要說「還有 N 題」。
 * 3. `togglePreMulti`：前置題複選的互斥（spa／spb 的「無」與其餘互斥）。
 * 4. `displayItemText`：M-CHAT 題目**以簡體顯示**。題庫原文是繁體（香港版授權文本），其他 21 支都是
 *    簡體 —— 轉換只在顯示層，題庫常數一個字都不動（`test/toolkit.structure.test.ts` 會重跑腳本比對）。
 * 5. `ASR_ITEM_NOTES`：SXK-ASR 第 4 項「仿说」「功能性语言」的白話註解、第 15 項「可以拿幼儿园同学
 *    或亲戚的孩子当比较」（§4.6 給家長填的配套）。
 * 6. `followupHints`：加測提示 —— 星號做完、該維度 band 是 watch 或 refer 時，該維度的加測工具顯示
 *    「再花约 N 题可以更精确」；clear 不推。band 由伺服器算好附在 `GET /api/t2/tool-results` 上，
 *    這裡不跑規則表。
 *
 * 【題目原文含《對照表》禁字】
 * 題目（「体育课上不明显笨拙、落后」那一類）是客戶的原文，是在問一件事，不是系統在說孩子——
 * 與 T1 題庫（`src/t1Data.ts`）同一個道理，題庫檔 `src/t2/toolkit/` 不進家長用字掃描
 * （`test/parentWording.structure.test.ts` 檔頭列了理由）。這一檔與畫面元件**進掃描**：這裡寫的
 * 每一個字都是系統自己的話。畫面元件只 import 題目、不手抄任何一題，`test/t2AssessmentCopy.structure.test.ts`
 * 釘住。
 */

import { TOOLKIT } from './toolkit';
import type { ToolId, ToolkitItem, ToolkitOption, ToolkitPreQuestion } from './toolkit';
import { askedItems } from './scoring';
import type { AnswerValue } from './scoring';
import { RATERS } from './types';
import type { Band, DimensionCode, PlanItem, Rater, T2Plan } from './types';

/** 表單上的一題：key 給交卷用、`item` 是題庫原物件（共用，不要改它的欄位）。 */
export interface FormItem {
  key: string;
  item: ToolkitItem;
}

export interface FormSection {
  key: string;
  /** 面向名稱原文；M-CHAT 只有一個沒名字的面向（`''`），畫面上不顯示標題。 */
  name: string;
  items: FormItem[];
}

export interface ToolForm {
  toolId: ToolId;
  ageMonth: number;
  options: ToolkitOption[];
  preQuestions: ToolkitPreQuestion[];
  /** 只含這個月齡有題的面向；沒題的面向整個不出現（畫面上一個空標題沒有意義）。 */
  sections: FormSection[];
  /** 本次要答的題數（＝伺服器驗收卷用的 `askedCount`）。 */
  askedCount: number;
}

/**
 * 這支工具在這個月齡的表單。題目與 key 全部來自 `askedItems()`，這裡只做分組。
 * 面向順序照題庫；dev 的六個領域在同一個年齡段裡各是一個面向。
 */
export function formFor(toolId: ToolId, ageMonth: number): ToolForm {
  const bank = TOOLKIT[toolId];
  const bySection = new Map<string, FormSection>();
  for (const asked of askedItems(toolId, ageMonth)) {
    let section = bySection.get(asked.sectionKey);
    if (!section) {
      const src = bank.sections.find(s => s.key === asked.sectionKey);
      section = { key: asked.sectionKey, name: src?.name ?? '', items: [] };
      bySection.set(asked.sectionKey, section);
    }
    section.items.push({ key: asked.key, item: asked.item });
  }
  const sections = [...bySection.values()];
  return {
    toolId,
    ageMonth,
    options: bank.options,
    preQuestions: bank.preQuestions,
    sections,
    askedCount: sections.reduce((n, s) => n + s.items.length, 0),
  };
}

export type { AnswerValue, Rater };
export { RATERS };

/** 前置題的答案：單選是字串、複選是字串陣列、是非題是布林（`readToolSubmission` 認的三種形狀）。 */
export type PreValue = string | string[] | boolean;

/** 畫面上正在填的一份。`rater` 沒選是 `null`；`pre` 沒答的 key 不在裡面。 */
export interface Draft {
  rater: Rater | null;
  pre: Record<string, PreValue>;
  answers: Record<string, AnswerValue>;
}

/** 這次出的題裡還沒答的題數。答了這次沒出的題不算數 —— 伺服器會把那種答案整份退回。 */
export function missingCount(form: ToolForm, answers: Readonly<Record<string, AnswerValue>>): number {
  let n = 0;
  for (const s of form.sections) for (const it of s.items) if (answers[it.key] === undefined) n++;
  return n;
}

/** 一題前置題答了沒有：單選要有值、複選至少一項、是非題要是布林。 */
export function preAnswered(q: ToolkitPreQuestion, value: PreValue | undefined): boolean {
  if (value === undefined) return false;
  if (q.kind === 'multi') return Array.isArray(value) && value.length > 0;
  if (q.kind === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && value !== '';
}

/**
 * 能不能交卷：填表人選了、每一題前置題答了、這次出的題全答了。三者缺一按鈕就停用。
 * 順序刻意照畫面：先問是誰在填，再問前置題，最後才是題目 —— 缺哪一段畫面各自提示。
 */
export function canSubmit(form: ToolForm, draft: Draft): boolean {
  if (draft.rater === null) return false;
  for (const q of form.preQuestions) if (!preAnswered(q, draft.pre[q.key])) return false;
  return missingCount(form, draft.answers) === 0;
}

/**
 * 複選前置題勾／取消一項之後的值。`exclusive` 的選項（spa／spb 的「無」）與其餘互斥：
 * 勾它時其餘全清、勾其餘時它被清掉（§5.1）。順序照選項表，不照勾選的先後。
 */
export function togglePreMulti(q: ToolkitPreQuestion, current: ReadonlyArray<string>, value: string): string[] {
  const option = q.options.find(o => o.value === value);
  if (!option) return [...current];
  if (current.includes(value)) return current.filter(v => v !== value);
  const kept = option.exclusive
    ? []
    : current.filter(v => !q.options.find(o => o.value === v)?.exclusive);
  const next = new Set([...kept, value]);
  return q.options.map(o => o.value).filter(v => next.has(v));
}

/** 現在勾著的是不是互斥那一項 —— 是的話其餘選項在畫面上停用。 */
export function exclusiveChecked(q: ToolkitPreQuestion, current: ReadonlyArray<string>): boolean {
  return current.some(v => q.options.find(o => o.value === v)?.exclusive === true);
}

/**
 * M-CHAT 顯示層的繁→簡對照。
 *
 * 【為什麼只有這一支要轉】
 * 題庫 22 支裡 21 支是簡體，只有 M-CHAT-R/F 是繁體（工具包收錄的是香港中文大學授權的中文版原文）。
 * 家長端全站簡體，一支問卷突然切成繁體是畫面上最突兀的事。**題庫常數不動**：`src/t2/toolkit/` 由腳本
 * 從 zip 重現、結構測試逐位元比對，動了就等於改題目；授權文本也不該被改寫。所以只在顯示層換字。
 *
 * 【為什麼是手寫的表，不是引一個套件】
 * 這裡要轉的只有 20 題加一句前置題，總共一百來個繁體字，全部列在下面；專案沒有 OpenCC 這類依賴，
 * 為一百個字加一個套件不值得。代價是表要跟題目走：題庫換版時 `test/t2Answering.test.ts` 的
 * 「轉完沒有任何一個表上的繁體字殘留」會抓出漏字。**詞先於字**：「傢俱」→「家具」，逐字轉會變成
 * 「家俱」（俱樂部的俱），所以先過詞表再過字表。
 */
export const TRAD_TO_SIMP: Readonly<Record<string, string>> = {
  嬰: '婴', 兒: '儿', 閉: '闭', 篩: '筛', 後: '后', 續: '续', 問: '问', 題: '题', 訂: '订', 間: '间',
  內: '内', 樣: '样', 會: '会', 視: '视', 著: '着', 嗎: '吗', 個: '个', 動: '动', 時: '时', 這: '这',
  沒: '没', 過: '过', 聾: '聋', 遊: '游', 戲: '戏', 裝: '装', 從: '从', 電: '电', 話: '话', 餵: '喂',
  歡: '欢', 樂: '乐', 場: '场', 設: '设', 樓: '楼', 異: '异', 擺: '摆', 隻: '只', 達: '达', 尋: '寻',
  協: '协', 觸: '触', 東: '东', 飛: '飞', 機: '机', 馬: '马', 貨: '货', 車: '车', 對: '对', 興: '兴',
  們: '们', 純: '纯', 與: '与', 幫: '帮', 別: '别', 處: '处', 來: '来', 給: '给', 舉: '举', 讓: '让',
  輛: '辆', 當: '当', 應: '应', 頭: '头', 說: '说', 學: '学', 語: '语', 為: '为', 塵: '尘', 聲: '声',
  嘗: '尝', 試: '试', 揮: '挥', 見: '见', 發: '发', 轉: '转', 圍: '围', 麼: '么', 讚: '赞', 賞: '赏',
  訴: '诉', 書: '书', 臉: '脸', 覺: '觉', 聽: '听', 態: '态', 搖: '摇', 蓋: '盖', 風: '风', 險: '险',
  醫: '医', 護: '护', 員: '员', 長: '长', 譜: '谱', 礙: '碍', 擔: '担',
};

/** 逐字轉會轉錯的詞，先換掉。 */
const TRAD_TO_SIMP_PHRASES: ReadonlyArray<[string, string]> = [
  ['傢俱', '家具'],
];

/** 繁體 → 簡體，只認上表；表外的字原樣通過。 */
export function toSimplified(text: string): string {
  let out = text;
  for (const [trad, simp] of TRAD_TO_SIMP_PHRASES) out = out.split(trad).join(simp);
  let result = '';
  for (const ch of out) result += TRAD_TO_SIMP[ch] ?? ch;
  return result;
}

/** 只有 M-CHAT 走轉換；其餘 21 支原文本來就是簡體，一字不動。 */
const DISPLAY_SIMPLIFIED: ReadonlySet<ToolId> = new Set<ToolId>(['mchat-rf']);

/** 一題在畫面上的文字。 */
export function displayItemText(toolId: ToolId, item: ToolkitItem): string {
  return DISPLAY_SIMPLIFIED.has(toolId) ? toSimplified(item.text) : item.text;
}

/** 前置題問法、選項標籤在畫面上的文字（同一條規則）。 */
export function displayPrompt(toolId: ToolId, text: string): string {
  return DISPLAY_SIMPLIFIED.has(toolId) ? toSimplified(text) : text;
}

/**
 * SXK-ASR 給家長填的配套（§4.6）：第 4 項的兩個術語加白話、第 15 項給一把尺。
 * 鍵是 `面向.題號`，與題庫的 `sections[].key` 與 `items[].no` 對應（SC.4 语言沟通、GN.3 整体印象）。
 * 這些字是系統自己的話，進家長用字掃描。
 */
const ASR_ITEM_NOTES: Readonly<Record<string, ReadonlyArray<string>>> = {
  'SC.4': [
    '「仿说」：孩子把听到的话原样重复一遍，例如你问「要不要喝水」，孩子回「要不要喝水」。',
    '「功能性语言」：用来表达需求、回答问题、跟人来回对话的话，不包括自己对自己说的话或背诵。',
  ],
  'GN.3': ['可以拿幼儿园同学或亲戚家年龄相近的孩子当比较。'],
};

export function asrItemNotes(sectionKey: string, no: number): string[] {
  return [...(ASR_ITEM_NOTES[`${sectionKey}.${no}`] ?? [])];
}

/** 填表人五種（工具包的「填表人身份」去掉治療師，§5.1）。順序照 `RATERS`。 */
export const RATER_OPTIONS: ReadonlyArray<{ value: Rater; label: string }> = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'caregiver', label: '主要照顾者' },
  { value: 'teacher', label: '老师' },
  { value: 'other', label: '其他' },
];

/**
 * `GET /api/t2/tool-results` 一筆裡這一層會讀的欄位：哪一支、什麼時候、對各維度的 band。
 * band 是伺服器跑規則表算好的（`toolBands`），家長端不重算。
 */
export interface CompletedEntry {
  id: number;
  createdAt: string;
  toolId: ToolId;
  bands: Partial<Record<DimensionCode, Band | null>>;
}

/** 每支做過的工具 → 最新一筆的日期。清單上「已完成 · 9 月 12 日」用它。 */
export function completedAt(entries: ReadonlyArray<CompletedEntry>): Partial<Record<ToolId, string>> {
  const out: Partial<Record<ToolId, string>> = {};
  for (const e of entries) {
    const cur = out[e.toolId];
    if (!cur || e.createdAt > cur) out[e.toolId] = e.createdAt;
  }
  return out;
}

/** 這個維度的星號（必做或選做那一支，§4.2）；沒有就 `null`（no_tool 的維度）。 */
function starFor(plan: T2Plan, dimension: DimensionCode): PlanItem | null {
  return [...plan.required, ...plan.optional].find(i => i.forDimensions.includes(dimension)) ?? null;
}

/**
 * 加測提示（§4.2、票 #58）：一支加測工具，只要它服務的任一個維度的星號**做完了**、而且星號對那個
 * 維度判 `watch` 或 `refer`，就顯示「再花约 N 题可以更精确」（N 是這支加測的題數）。`clear` 不推 ——
 * 星號說沒事，不該再推家長多答 30 題。星號沒做、或做了但對那個維度沒有 band（`null`），都不推。
 *
 * 回的是 `toolId → 那一句`；沒有提示的工具沒有鍵。加測工具本身照常列在清單上、隨時可答，
 * 提示只是多一句話。
 */
export function followupHints(plan: T2Plan, entries: ReadonlyArray<CompletedEntry>): Partial<Record<ToolId, string>> {
  const out: Partial<Record<ToolId, string>> = {};
  for (const item of plan.followup) {
    const recommended = item.forDimensions.some(d => {
      const star = starFor(plan, d);
      if (!star) return false;
      const done = entries.filter(e => e.toolId === star.toolId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      const band = done?.bands[d];
      return band === 'watch' || band === 'refer';
    });
    if (recommended) out[item.toolId] = `再花约 ${item.askedCount} 题可以更精确`;
  }
  return out;
}

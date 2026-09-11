/**
 * 路由：T1 之後推薦哪些工具（規格 v2 §4、附錄 B）。
 *
 * 【這是什麼】
 * 一個純函式 `planT2(t1Flags, ageMonth, diagnosis)`：T1 紅的維度該做哪一支（星號、必做）、
 * 黃的哪一支（選做）、之後還能加測哪兩支、只出標籤的工具另列 extras、哪些維度在這個
 * 月齡根本沒有工具（`noTool`）、三組各要答幾題。沒有 I/O、沒有日期、沒有隨機。
 *
 * 【底稿與修正】
 * 底稿是客戶中控台的 `DIM`（維度 × 年齡段 → 工具，客戶的優先順序）與 `DIS`（疾病 × 年齡段），
 * 兩張表**原樣抄**在下面（含 B.1 用〔〕標成不採的那些）—— 拿掉哪些是規則的事，不是
 * 抄表的人的事，這樣 `toolSpecs.ts` 的窗口或 feeds 改了，路由自己跟著變。套的修正：
 *
 * 1. 過工具窗口：月齡不在 `[lo, hi]` 的拿掉。
 * 2. 過維度對應：對該維度沒有面向可算的（附錄 F）拿掉 —— 客戶把感覺量表排進動作、
 *    認知、注意力……那些格，照做會讓一份感覺量表把認知推紅。
 * 3. 補後備：附錄 F 餵該維度、在窗口內、`DIM` 沒列的，依附錄 F 的順序接在末尾。
 * 4. **`sxk-dev` 恆排末尾**（本票加的，B.1 沒有這一條）。客戶把分齡發展量表排在語言 3–6、
 *    認知 3–6 的第一支；但它每個領域只有 5 題、永遠帶 `few_items`，是 T2 裡的「廣篩」。
 *    同一份規格的 §4.4 例子、§11 階段 3 的固定輸入、票 #43 的驗收都寫「48 個月 LANG 紅 →
 *    必做 sxk-lang 49 題」—— 只有把 dev 排到專用工具後面才對得上。代價是 COG 18–72 的
 *    星號從 dev 變成 adp（B.1 寫 dev），MOT 的加測順序 dev 退到最後。待使用者覆核。
 *
 * 第 2 條拿掉的不只 B.1 用〔〕標的那些：B.1 有三格列了附錄 F 說不餵該維度的工具（LANG 0–36 的
 * mchat-rf 只餵 SOC、MOT 的 sxk-adl 只餵 ADL、ADL 37–72 的 sxk-asq 沒有生活自理領域），一律以
 * 附錄 F 為準 —— 附錄 C 明寫 ADL 頂 PedsQL 的「動作 85–216」那格不採。後果是 **MOT 85–216 是
 * no_tool**（§4.5 的表寫「只剩 sxk-adl 的移動與轉位 4 項」，與附錄 C／F 矛盾），待使用者覆核。
 *
 * 「候選最多三支」（星號＋兩支加測）在過濾之後截。只出標籤的三支（chexi、tempa、tempb）
 * 不進候選、不佔名額、恆為 extra：客戶表在該段列了就列，附錄 F 餵該維度且在窗口內也列。
 *
 * 【段界那一個月】
 * 客戶的段是 0–36／37–72（`months/12 <= 3` 取第一個命中的段），工具窗口卻從 36／72 起。
 * 所以 36 個月的 ATT 已經有 sxk-ab、72 個月的 LEARN 有 sxk-ldp、EMO 有 snap-iv —— 第 3 條
 * 補進來的。§4.5 寫的「ATT 12–36 no_tool」是段的標籤；逐月看，那一個月不是 no_tool。
 *
 * 【診斷方向】
 * 選了就把 `DIS[疾病][段]` 的工具過窗口後全部提為必做，`forDimensions` 依附錄 F；不出 band 的
 * （dd／id 0–36 的 tempa、ld 系列的 chexi）落到 extras —— §4.2 說 extras「永遠是選做」，
 * 而 `estimatedItems` 也沒有 extra 那一格，讓一支不出判定的工具去擋報告說不過去。
 * 三格是空的（ld／adhd／tic 的 0–36）：選了等於沒選，`functionOrder` 也是 `null`。
 */

import { askedCount } from './toolkit';
import { TOOL_SPECS, TOOL_FEEDS, inWindow, feedsDimension } from './toolSpecs';
import { DIMENSION_CODES } from './types';
import type { DiagnosisDirection, DimensionCode, PlanItem, T1Flag, T2Plan, ToolId } from './types';

/** 客戶表的一列：某維度在某月齡段（閉區間）的有序工具。 */
export interface DimRoute {
  dimension: DimensionCode;
  lo: number;
  hi: number;
  tools: ReadonlyArray<ToolId>;
}

/**
 * 中控台 `DIM`，29 列，**原樣**（含 B.1 用〔〕標成不採的）。工具名由中控台代號換成 §3 的 id
 * （`SXK-SPa` → `sxk-spa`、`M-CHAT-R/F` → `mchat-rf`）。客戶寫「歲」，換成月齡閉區間的對照
 * 在 §4.2：0–3 → 0–36、3–6 → 37–72、6–12 → 73–144、12–18 → 145–216；動作 0–7／7–18 →
 * 0–84／85–216；注意力 1–3 → 12–36（12 以下無路由）；感覺處理 3–5／5–18 → 37–60／61–216。
 * 同一維度的段不重疊、沒列到的月齡（ATT 0–11、LEARN 0–36、LANG 145＋）沒有底稿，只有後備。
 */
export const DIM_ROUTES: ReadonlyArray<DimRoute> = [
  { dimension: 'MOT', lo: 0, hi: 84, tools: ['sxk-gm', 'sxk-dev', 'sxk-asq', 'sxk-spa', 'sxk-adl'] },
  { dimension: 'MOT', lo: 85, hi: 216, tools: ['sxk-spb', 'sxk-adl'] },

  { dimension: 'COG', lo: 0, hi: 36, tools: ['sxk-asq', 'sxk-voc'] },
  { dimension: 'COG', lo: 37, hi: 72, tools: ['sxk-dev', 'sxk-adp'] },
  { dimension: 'COG', lo: 73, hi: 216, tools: ['sxk-spb'] },

  { dimension: 'ATT', lo: 12, hi: 36, tools: ['sxk-tempa', 'sxk-spa'] },
  { dimension: 'ATT', lo: 37, hi: 72, tools: ['sxk-ab', 'sxk-tempb', 'sxk-att', 'sxk-spa'] },
  { dimension: 'ATT', lo: 73, hi: 144, tools: ['chexi', 'snap-iv', 'sxk-ab', 'sxk-ldp', 'sxk-spa'] },
  { dimension: 'ATT', lo: 145, hi: 216, tools: ['sxk-att', 'sxk-lds', 'snap-iv', 'chexi', 'sxk-spb'] },

  { dimension: 'LEARN', lo: 37, hi: 72, tools: ['sxk-adp', 'sxk-spa', 'sxk-att'] },
  { dimension: 'LEARN', lo: 73, hi: 144, tools: ['sxk-ldp', 'chexi', 'sxk-spb', 'sxk-ab', 'snap-iv'] },
  { dimension: 'LEARN', lo: 145, hi: 216, tools: ['sxk-lds', 'chexi', 'sxk-att', 'sxk-ab', 'snap-iv', 'sxk-spb'] },

  { dimension: 'LANG', lo: 0, hi: 36, tools: ['sxk-voc', 'mchat-rf', 'sxk-adl'] },
  { dimension: 'LANG', lo: 37, hi: 72, tools: ['sxk-dev', 'sxk-asb', 'sxk-asr'] },
  { dimension: 'LANG', lo: 73, hi: 144, tools: ['sxk-dev'] },

  { dimension: 'ADL', lo: 0, hi: 36, tools: ['sxk-adl'] },
  { dimension: 'ADL', lo: 37, hi: 72, tools: ['sxk-adl', 'sxk-soc'] },
  { dimension: 'ADL', lo: 73, hi: 216, tools: ['sxk-dev'] },

  { dimension: 'EMO', lo: 0, hi: 36, tools: ['sxk-tempa', 'sxk-adp', 'sxk-asq', 'mchat-rf'] },
  { dimension: 'EMO', lo: 37, hi: 72, tools: ['sxk-adp', 'sxk-tempb', 'sxk-soc', 'sxk-asr', 'sxk-asb', 'sxk-adl'] },
  { dimension: 'EMO', lo: 73, hi: 144, tools: ['sxk-spb', 'sxk-ab', 'snap-iv', 'sxk-adl'] },
  { dimension: 'EMO', lo: 145, hi: 216, tools: ['sxk-spb'] },

  { dimension: 'SOC', lo: 0, hi: 36, tools: ['mchat-rf', 'sxk-asq'] },
  { dimension: 'SOC', lo: 37, hi: 72, tools: ['sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-spa', 'sxk-dev'] },
  { dimension: 'SOC', lo: 73, hi: 144, tools: ['sxk-spb', 'sxk-adl'] },
  { dimension: 'SOC', lo: 145, hi: 216, tools: ['sxk-spb', 'sxk-adl'] },

  { dimension: 'SEN', lo: 0, hi: 36, tools: ['sxk-adp', 'sxk-spa'] },
  { dimension: 'SEN', lo: 37, hi: 60, tools: ['sxk-spa'] },
  { dimension: 'SEN', lo: 61, hi: 216, tools: ['sxk-spb'] },
];

/** 客戶表的一種疾病：功能處理順序＋四個年齡段的工具（最多 6 支）。 */
export interface DisRoute {
  /** 客戶的「功能處理順序」，報告拿它排維度。不是九個都在（沒有一列有 ADL）。 */
  functionOrder: ReadonlyArray<DimensionCode>;
  /** 固定四段：0–36、37–72、73–144、145–216。空陣列＝客戶表那一格是空的。 */
  cells: ReadonlyArray<{ lo: number; hi: number; tools: ReadonlyArray<ToolId> }>;
}

const DIS_SEGMENTS: ReadonlyArray<[number, number]> = [[0, 36], [37, 72], [73, 144], [145, 216]];

/** 四段的工具欄，順序固定 0–36、37–72、73–144、145–216。 */
type DisCells = [ToolId[], ToolId[], ToolId[], ToolId[]];

function dis(functionOrder: DimensionCode[], ...cells: DisCells): DisRoute {
  return { functionOrder, cells: DIS_SEGMENTS.map(([lo, hi], i) => ({ lo, hi, tools: cells[i] })) };
}

/** 學習障礙、多動症、抽動症三種的工具欄相同（客戶表如此），只有功能處理順序不同。 */
const LD_CELLS: DisCells = [
  [],
  ['sxk-dev', 'chexi', 'sxk-ab', 'snap-iv', 'sxk-spa', 'sxk-soc'],
  ['sxk-ldp', 'chexi', 'sxk-ab', 'snap-iv', 'sxk-att', 'sxk-spb'],
  ['sxk-lds', 'chexi', 'sxk-att', 'sxk-spb', 'sxk-ab', 'snap-iv'],
];

/** 情緒障礙與心理疾病整列相同。 */
const EMO_ROUTE = dis(
  ['EMO', 'ATT', 'LANG', 'COG', 'SEN', 'SOC', 'LEARN'],
  ['sxk-tempa', 'mchat-rf', 'sxk-lang', 'sxk-adp', 'sxk-soc', 'sxk-asq'],
  ['sxk-dev', 'chexi', 'sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-lang'],
  ['chexi', 'sxk-asb', 'sxk-asr', 'sxk-att', 'sxk-ab', 'snap-iv'],
  ['chexi', 'sxk-asr', 'sxk-ab', 'sxk-att', 'snap-iv', 'sxk-spb'],
);

/**
 * 中控台 `DIS`，十種 × 四段，**原樣**（附錄 B.2）。客戶把 PedsQL 的格子填成 SXK-ADL，照抄。
 * 過窗口是 `diagnosisToolsFor` 的事，這裡不過。
 */
export const DIS_ROUTES: Readonly<Record<DiagnosisDirection, DisRoute>> = {
  cp: dis(
    ['MOT', 'COG', 'LANG', 'SEN', 'ATT', 'EMO', 'SOC', 'LEARN'],
    ['sxk-gm', 'sxk-dev', 'sxk-asq', 'sxk-voc', 'sxk-lang', 'sxk-adl'],
    ['sxk-gm', 'sxk-dev', 'sxk-lang', 'sxk-spa', 'sxk-adl'],
    ['sxk-adl', 'sxk-spb', 'sxk-ldp'],
    ['sxk-adl', 'sxk-spb', 'sxk-lds', 'chexi'],
  ),
  dd: dis(
    ['COG', 'LANG', 'SEN', 'ATT', 'LEARN', 'SOC', 'EMO', 'MOT'],
    ['sxk-dev', 'sxk-asq', 'sxk-adp', 'sxk-gm', 'sxk-voc', 'sxk-tempa'],
    ['sxk-dev', 'sxk-lang', 'sxk-gm', 'chexi', 'sxk-spa', 'sxk-adl'],
    ['sxk-adl', 'sxk-spb', 'sxk-ldp', 'chexi'],
    ['sxk-adl', 'sxk-spb', 'sxk-lds', 'chexi'],
  ),
  id: dis(
    ['COG', 'LANG', 'SEN', 'ATT', 'LEARN', 'SOC', 'EMO', 'MOT'],
    ['sxk-dev', 'sxk-asq', 'sxk-voc', 'sxk-tempa', 'sxk-adl', 'sxk-adp'],
    ['sxk-dev', 'sxk-lang', 'sxk-gm', 'sxk-soc', 'sxk-adp', 'chexi'],
    ['sxk-ldp', 'chexi', 'sxk-spb', 'sxk-adl'],
    ['sxk-lds', 'chexi', 'sxk-spb', 'sxk-adl'],
  ),
  ld: dis(['LEARN', 'ATT', 'SEN', 'COG', 'LANG', 'SOC', 'EMO', 'MOT'], ...LD_CELLS),
  adhd: dis(['ATT', 'LEARN', 'SEN', 'COG', 'LANG', 'SOC', 'EMO', 'MOT'], ...LD_CELLS),
  lang: dis(
    ['LANG', 'COG', 'LEARN', 'SOC', 'SEN', 'ATT', 'EMO', 'MOT'],
    ['sxk-voc', 'sxk-lang', 'mchat-rf', 'sxk-soc', 'sxk-dev', 'sxk-adp'],
    ['sxk-lang', 'sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-adp', 'sxk-dev'],
    ['chexi', 'sxk-ldp', 'sxk-asb', 'sxk-asr', 'sxk-spb', 'sxk-adl'],
    ['sxk-lds', 'chexi', 'sxk-asr', 'sxk-ab', 'snap-iv', 'sxk-spb'],
  ),
  emo: EMO_ROUTE,
  psych: EMO_ROUTE,
  tic: dis(['EMO', 'SEN', 'ATT', 'LEARN', 'COG', 'LANG', 'SOC'], ...LD_CELLS),
  asd: dis(
    ['SOC', 'EMO', 'LANG', 'COG', 'LEARN', 'SEN', 'ATT', 'MOT'],
    ['mchat-rf', 'sxk-voc', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-gm'],
    ['sxk-asb', 'sxk-asr', 'sxk-lang', 'sxk-dev', 'sxk-soc', 'sxk-adp'],
    ['sxk-asb', 'sxk-asr', 'chexi', 'sxk-spb', 'sxk-ldp', 'sxk-adl'],
    ['sxk-asr', 'sxk-lds', 'chexi', 'sxk-ab', 'snap-iv', 'sxk-spb'],
  ),
};

/** 星號＋兩支加測（§4.2、§10.2 第 4 題）。 */
const MAX_PER_DIMENSION = 3;

/** 附錄 F 的順序（＝§3 登錄表的順序），第 3 條補後備時用。 */
const FEEDS_ORDER = Object.keys(TOOL_FEEDS) as ToolId[];

/** 在窗口內、且進路由（sxk-warn 不進，§4.6）。第 1 條。 */
function routable(id: ToolId, ageMonth: number): boolean {
  return TOOL_SPECS[id].routed && inWindow(id, ageMonth);
}

/** 客戶表在這個月齡、這個維度列的工具（原樣）；沒有那一段就是空的。 */
function dimListed(dimension: DimensionCode, ageMonth: number): ReadonlyArray<ToolId> {
  return DIM_ROUTES.find(r => r.dimension === dimension && ageMonth >= r.lo && ageMonth <= r.hi)?.tools ?? [];
}

/** 去重、保序地收工具。 */
function pushUnique(out: ToolId[], ids: Iterable<ToolId>, keep: (id: ToolId) => boolean): void {
  for (const id of ids) if (!out.includes(id) && keep(id)) out.push(id);
}

/**
 * 這個維度在這個月齡的有序候選：客戶表列的過第 1、2 條，再依附錄 F 的順序補後備（第 3 條），
 * 最後 sxk-dev 退到末尾（第 4 條）。全部會出 band、在窗口內、餵該維度。**不截**三支 ——
 * 截是 `planT2` 的事，這裡回全部，讓「第四支是誰」看得到。回傳的是新陣列。
 *
 * 客戶表列了、但附錄 F 說不餵該維度的，第 2 條會拿掉 —— 不只 B.1 用〔〕標出來的那些：
 * B.1 自己也有三格與附錄 F 對不上（LANG 0–36 的 mchat-rf、MOT 的 sxk-adl、ADL 37–72 的 sxk-asq），
 * 這裡一律以附錄 F 為準，見 `test/t2Routing.test.ts` 檔頭。
 */
export function candidatesFor(dimension: DimensionCode, ageMonth: number): ToolId[] {
  const out: ToolId[] = [];
  pushUnique(out, [...dimListed(dimension, ageMonth), ...FEEDS_ORDER],
    id => routable(id, ageMonth) && feedsDimension(id, dimension) && TOOL_SPECS[id].producesBand);
  return [...out.filter(id => id !== 'sxk-dev'), ...out.filter(id => id === 'sxk-dev')];
}

/**
 * 只出標籤的工具（chexi、tempa、tempb）：客戶表在該段列了就列（**不過**第 2 條 —— 它們不出 band，
 * 附錄 F 的 feeds 對它們不決定任何事，客戶把氣質排進注意力、把 chexi 排進學習就是相關性的訊號），
 * 再補附錄 F 餵該維度的；都要在窗口內。
 */
export function extrasFor(dimension: DimensionCode, ageMonth: number): ToolId[] {
  const out: ToolId[] = [];
  const tagOnly = (id: ToolId) => routable(id, ageMonth) && !TOOL_SPECS[id].producesBand;
  pushUnique(out, dimListed(dimension, ageMonth), tagOnly);
  pushUnique(out, FEEDS_ORDER, id => tagOnly(id) && feedsDimension(id, dimension));
  return out;
}

/**
 * 查疾病那一列；不認得的值丟清楚的錯。API 進來的可能是中文標籤或打錯的字，
 * 讓它 `TypeError: reading 'cells'` 沒有人看得出是哪一層錯。
 */
function disRouteOf(diagnosis: DiagnosisDirection): DisRoute {
  const route = Object.prototype.hasOwnProperty.call(DIS_ROUTES, diagnosis) ? DIS_ROUTES[diagnosis] : undefined;
  if (!route) throw new Error(`routing：不認得的診斷方向 ${JSON.stringify(diagnosis)}（§4.3 十選一的代號）`);
  return route;
}

/** `DIS[疾病][段]` 過窗口後的工具，依客戶的順序；那一格是空的、或月齡沒有段，回空。 */
export function diagnosisToolsFor(diagnosis: DiagnosisDirection, ageMonth: number): ToolId[] {
  const cell = disRouteOf(diagnosis).cells.find(c => ageMonth >= c.lo && ageMonth <= c.hi);
  return (cell?.tools ?? []).filter(id => routable(id, ageMonth));
}

/** 客戶的「功能處理順序」（附錄 B.2）。不看月齡 —— 但 `planT2` 只在那一格非空時才帶出去。 */
export function functionOrderOf(diagnosis: DiagnosisDirection): DimensionCode[] {
  return [...disRouteOf(diagnosis).functionOrder];
}

/** required > optional > followup（§4.2 第 5 條）。extra 自成一組，不跟前三者比。 */
const ROLE_STRENGTH: Record<PlanItem['role'], number> = { required: 3, optional: 2, followup: 1, extra: 0 };

/**
 * 同一支工具落在多個維度時合併成一筆：role 取最強、forDimensions 取聯集（保先到先得的順序）。
 * 一個收會出 band 的，另一個收 extras；兩邊不會有交集（producesBand 是二分的），
 * 所以 extra 永遠不會跟 required 撞在同一筆裡。
 */
class ItemBag {
  private readonly items = new Map<ToolId, { role: PlanItem['role']; forDimensions: DimensionCode[] }>();

  add(toolId: ToolId, role: PlanItem['role'], dimensions: ReadonlyArray<DimensionCode>): void {
    const cur = this.items.get(toolId);
    if (!cur) {
      this.items.set(toolId, { role, forDimensions: [...dimensions] });
      return;
    }
    if (ROLE_STRENGTH[role] > ROLE_STRENGTH[cur.role]) cur.role = role;
    for (const d of dimensions) if (!cur.forDimensions.includes(d)) cur.forDimensions.push(d);
  }

  toItems(ageMonth: number): PlanItem[] {
    return [...this.items].map(([toolId, { role, forDimensions }]) => ({
      toolId, forDimensions, role, askedCount: askedCount(toolId, ageMonth),
    }));
  }
}

function sumAsked(items: ReadonlyArray<PlanItem>): number {
  return items.reduce((n, i) => n + i.askedCount, 0);
}

/**
 * T1 之後要做哪些工具（§4.2 的演算法）。
 *
 * - `t1Flags`：九個維度的 T1 標記（0 綠、1 黃、2 紅）。九個都要給 —— 少一個 key 在型別層就會喊，
 *   不讓「忘了對一個維度」變成「那個維度是綠的」。值不是 0／1／2 也丟錯（JSON 進來的 `'2'` 字串
 *   或 3，若只當「不是 1 也不是 2」就是安靜地把紅當綠）。
 * - `ageMonth`：實足月齡（**整數**月，不進位）。不是非負整數就丟錯：NaN 會讓每個維度都安靜地變成
 *   no_tool；36.5 會掉進客戶表 0–36 與 37–72 兩段之間的縫，客戶的順序整個不見卻不報錯。
 *   216 以上不丟錯，只是全部 no_tool。
 * - `diagnosis`：§4.3 的診斷方向，選填。沒選、`null`、或選的那一格是空的，三者輸出完全一樣；
 *   不認得的代號丟錯。
 *
 * 回傳的每個陣列與 `PlanItem` 都是新的，可以放心改。
 */
export function planT2(
  t1Flags: Readonly<Record<DimensionCode, T1Flag>>,
  ageMonth: number,
  diagnosis?: DiagnosisDirection | null,
): T2Plan {
  if (!Number.isInteger(ageMonth) || ageMonth < 0) {
    throw new Error(`planT2：月齡要是非負整數（實足月齡，不進位），拿到 ${ageMonth}`);
  }
  for (const d of DIMENSION_CODES) {
    const flag: unknown = t1Flags[d];
    if (flag !== 0 && flag !== 1 && flag !== 2) {
      throw new Error(`planT2：${d} 的 T1 標記要是 0／1／2，拿到 ${JSON.stringify(flag)}`);
    }
  }

  const band = new ItemBag();
  const extras = new ItemBag();
  const noTool: DimensionCode[] = [];

  // 1–3：逐維度，紅黃才做
  for (const d of DIMENSION_CODES) {
    const flag = t1Flags[d];
    if (flag === 0) continue;

    for (const id of extrasFor(d, ageMonth)) extras.add(id, 'extra', [d]);

    const candidates = candidatesFor(d, ageMonth);
    if (candidates.length === 0) {
      noTool.push(d);
      continue;
    }
    const [star, ...rest] = candidates.slice(0, MAX_PER_DIMENSION);
    band.add(star, flag === 2 ? 'required' : 'optional', [d]);
    for (const id of rest) band.add(id, 'followup', [d]);
  }

  // 4：診斷方向 —— 那一格過窗口後有東西才算「選了」
  let functionOrder: DimensionCode[] | null = null;
  if (diagnosis) {
    const tools = diagnosisToolsFor(diagnosis, ageMonth);
    if (tools.length > 0) {
      functionOrder = functionOrderOf(diagnosis);
      for (const id of tools) {
        const dims = TOOL_FEEDS[id].map(f => f.dimension);
        if (TOOL_SPECS[id].producesBand) band.add(id, 'required', dims);
        else extras.add(id, 'extra', dims);
      }
    }
  }

  // 5–6：去重已在 ItemBag 裡做完；分組、算題數
  const items = band.toItems(ageMonth);
  const required = items.filter(i => i.role === 'required');
  const optional = items.filter(i => i.role === 'optional');
  const followup = items.filter(i => i.role === 'followup');

  return {
    ageMonth,
    required,
    optional,
    followup,
    extras: extras.toItems(ageMonth),
    noTool,
    estimatedItems: { required: sumAsked(required), optional: sumAsked(optional), followup: sumAsked(followup) },
    functionOrder,
  };
}

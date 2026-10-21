/**
 * 後台家長彙總（#69，規格 docs/specs/client-changes-2026-10-17.md §3.1）：一個孩子一行。
 *
 * 資料層（`adminStore.listSummarySources`）只負責帶著公司條件把原始資料撈出來；
 * 這裡把它整理成表上的一行。畫面與導出的 xlsx 讀的是同一份 `SummaryTable`，
 * 所以螢幕上與檔案裡不會是兩種說法。
 *
 * ⚠️ 只給伺服器載。篩查渠道的字裡有品牌名（A 才用得到），後台的畫面只吃伺服器回的字。
 */
import type { AssessmentRecord, AssessmentStatus, DimensionScore } from '../types';
import type { AdminCenterShape } from './companyScope';
import { DIMENSIONS_DATA } from '../data';
import { latestAssessedAgeMonth } from '../utils/ageBandDrift';

/** 資料層交出來的一位家長。JSON 欄位已解析，其餘不加工。 */
export interface SummarySource {
  userId: number;
  phone: string | null;
  companyId: number | null;
  /** 歸屬那家合作公司的名字（B）；未歸屬是 null。 */
  companyName: string | null;
  child: any;
  scores: DimensionScore[];
  reportHistory: AssessmentRecord[];
  bookingCount: number;
  /**
   * 這位家長每一次從 B 轉入（`handoff_imports`，只有 A 有）：時間與那時在 B 的合作公司名（B 未歸屬是 null）。
   * 篩查渠道看最早那一次（CONTEXT.md：轉入過不只一次取最早）。
   */
  handoffImports: Array<{ id: number; at: string; companyName: string | null }>;
}

export interface SummaryCell {
  score: number;
  maxScore: number;
  status: AssessmentStatus;
}

export interface SummaryRow {
  userId: number;
  childName: string | null;
  phone: string | null;
  /** 篩查當時的測評月齡；舊資料找不到是 null。 */
  assessedAgeMonth: number | null;
  /** 「X岁Y个月」；找不到是 null。 */
  ageLabel: string | null;
  channel: string;
  /** 最近一次 T1 的時間（ISO）。 */
  screenedAt: string;
  /** 照 `dimensions` 的順序；那個維度沒有 T1 成績是 null。 */
  cells: Array<SummaryCell | null>;
  /** 紅＋黃的維度數。 */
  flaggedCount: number;
  /** CONTEXT.md「發育指數」（100／90／80／75／70）；讀不到逐題作答是 null。 */
  developmentIndex: number | null;
}

/**
 * 算發育指數的那一支（`src/developmentIndex/`），由路由注入。這裡不直接 import：
 * 後台畫面以型別 import 本檔，通過率表不能沿著它被走進前端（`test/developmentIndex.structure.test.ts`）。
 */
export type DevelopmentIndexOf = (scores: DimensionScore[], ageMonth: number | null) => number | null;

export interface SummaryTable {
  dimensions: Array<{ id: string; name: string }>;
  rows: SummaryRow[];
}

export interface SummaryOptions {
  sort: 'newest' | 'oldest' | 'score_low';
  booked: 'all' | 'booked' | 'not_booked';
}

export const SUMMARY_DIMENSIONS: SummaryTable['dimensions'] = DIMENSIONS_DATA.map(d => ({ id: d.id, name: d.name }));

/** CONTEXT.md「篩查渠道」的三種固定說法（A）與 B 的未歸屬。 */
export const CHANNEL_DIRECT = '森心康直属';
export const CHANNEL_SCREENING_SYSTEM = '筛查系统（森心康）';
export const CHANNEL_UNASSIGNED = '未归属';

export function channelOf(source: SummarySource, shape: AdminCenterShape): string {
  if (shape.multiCompany) return source.companyName ?? CHANNEL_UNASSIGNED;
  const first = (source.handoffImports ?? []).reduce<SummarySource['handoffImports'][number] | null>(
    (best, h) => (!best || h.at < best.at || (h.at === best.at && h.id < best.id) ? h : best),
    null
  );
  if (first === null) return CHANNEL_DIRECT;
  return first.companyName ?? CHANNEL_SCREENING_SYSTEM;
}

export function ageLabelOf(ageMonth: number | null): string | null {
  if (ageMonth === null) return null;
  return `${Math.floor(ageMonth / 12)}岁${ageMonth % 12}个月`;
}

const STATUSES: ReadonlyArray<string> = ['normal', 'borderline', 'delay'];

/** 每個維度最新的那一格 T1（同一個維度存了兩格時取 `completedAt` 晚的）。 */
function latestT1ByDimension(scores: DimensionScore[]): Map<string, DimensionScore> {
  const out = new Map<string, DimensionScore>();
  for (const s of scores) {
    if (s?.tierId !== 'T1' || !STATUSES.includes(s.status)) continue;
    if (!Number.isFinite(Number(s.score)) || !Number.isFinite(Number(s.maxScore))) continue;
    const prev = out.get(s.dimensionId);
    if (!prev || String(s.completedAt ?? '') >= String(prev.completedAt ?? '')) out.set(s.dimensionId, s);
  }
  return out;
}

export function summaryRowOf(
  source: SummarySource,
  shape: AdminCenterShape,
  indexOf: DevelopmentIndexOf = () => null
): SummaryRow | null {
  const t1 = latestT1ByDimension(Array.isArray(source.scores) ? source.scores : []);
  if (t1.size === 0) return null;

  const cells = SUMMARY_DIMENSIONS.map(d => {
    const s = t1.get(d.id);
    return s ? { score: Number(s.score), maxScore: Number(s.maxScore), status: s.status } : null;
  });
  const screenedAt = [...t1.values()].map(s => String(s.completedAt ?? '')).reduce((a, b) => (b > a ? b : a), '');
  const assessedAgeMonth = latestAssessedAgeMonth(source.scores, source.reportHistory);

  return {
    userId: source.userId,
    childName: typeof source.child?.name === 'string' ? source.child.name : null,
    phone: source.phone,
    assessedAgeMonth,
    ageLabel: ageLabelOf(assessedAgeMonth),
    channel: channelOf(source, shape),
    screenedAt,
    cells,
    flaggedCount: cells.filter(c => c !== null && c.status !== 'normal').length,
    // 用與九維格同一組最新的 T1；跨了兩次篩查的話題目對不上，算出來就是 null。
    developmentIndex: indexOf([...t1.values()], assessedAgeMonth),
  };
}

function scoreRatio(row: SummaryRow): number {
  const max = row.cells.reduce((sum, c) => sum + (c?.maxScore ?? 0), 0);
  const score = row.cells.reduce((sum, c) => sum + (c?.score ?? 0), 0);
  return max > 0 ? score / max : Infinity;
}

/** 與家長列表同一組篩選：最近／最早篩查在前、总分低的在前；全部／已預約／尚未預約。 */
export function buildSummaryTable(
  sources: SummarySource[],
  shape: AdminCenterShape,
  options: SummaryOptions,
  indexOf?: DevelopmentIndexOf
): SummaryTable {
  const booked = sources.filter(s =>
    options.booked === 'booked' ? s.bookingCount > 0 : options.booked === 'not_booked' ? s.bookingCount === 0 : true
  );
  const rows = booked.map(s => summaryRowOf(s, shape, indexOf)).filter((r): r is SummaryRow => r !== null);
  const byTime = (a: SummaryRow, b: SummaryRow) => (a.screenedAt < b.screenedAt ? -1 : a.screenedAt > b.screenedAt ? 1 : 0);
  if (options.sort === 'oldest') rows.sort(byTime);
  else rows.sort((a, b) => byTime(b, a));
  if (options.sort === 'score_low') {
    rows.sort((a, b) => {
      const ra = scoreRatio(a);
      const rb = scoreRatio(b);
      return ra === rb ? 0 : ra < rb ? -1 : 1;
    });
  }
  return { dimensions: SUMMARY_DIMENSIONS, rows };
}

/**
 * 畫面上一頁幾行。家長多了以後整張表一次送到瀏覽器、一次畫出來會卡；排序（尤其「总分低的在前」）
 * 要看全部的人才排得出來，所以伺服器照樣整批整理、排好，只切一頁回去。導出不分頁 —— 那是拿去分析的整批。
 */
export const SUMMARY_PAGE_SIZE = 100;

export interface SummaryPage extends SummaryTable {
  /** 篩選後的總行數（不是這一頁的）。 */
  total: number;
  /** 從 1 起；超過最後一頁時夾回最後一頁。 */
  page: number;
  pageSize: number;
}

export function readSummaryPage(input: any): number {
  const n = Number(input?.page);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function summaryPageOf(table: SummaryTable, page: number, pageSize = SUMMARY_PAGE_SIZE): SummaryPage {
  const total = table.rows.length;
  const last = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), last);
  const start = (current - 1) * pageSize;
  return { dimensions: table.dimensions, rows: table.rows.slice(start, start + pageSize), total, page: current, pageSize };
}

export function readSummaryOptions(input: any): SummaryOptions {
  const sort = input?.sort === 'oldest' || input?.sort === 'score_low' ? input.sort : 'newest';
  const booked = input?.booked === 'booked' || input?.booked === 'not_booked' ? input.booked : 'all';
  return { sort, booked };
}

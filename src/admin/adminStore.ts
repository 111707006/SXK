/**
 * 後台的**唯一**資料入口。
 *
 * 規則只有一條，但不可妥協：**這個檔案裡每一句碰到家長資料的 SQL，都必須把
 * `companyWhereSql()` 產生的片段內插進 WHERE 子句。** `test/adminScope.structure.test.ts`
 * 會逐句檢查，沒帶條件的查詢過不了 CI。
 *
 * 為什麼是「一個檔案」而不是「一條慣例」：純函式測試可以把
 * `resolveCompanyCondition` 釘得完美，而某支路由自己下一句 `SELECT * FROM users`
 * 照樣把別家公司的孩子送出去。條件正確與條件有被用到是兩件事，後者只能靠
 * 「所有查詢都在這裡」來檢查。
 *
 * 路由層（`src/admin/routes.ts`）**不得**匯入 `src/db/mysql` —— 同一支結構測試
 * 會擋住。它只能透過本模組取資料。
 */
import type { CouponDiscount } from '../t2/coupon';
import { SPLIT_ORDERS_MAX, SPLIT_TOO_MANY } from '../revenueSplit/ledger';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { getPool, isConfigured } from '../db/mysql';
import { companyWhereSql, type CompanyCondition } from './companyScope';
import type { AssessmentRecord, DimensionScore } from '../types';
import { calculateAgeMonth } from '../utils/dateUtils';
import { screeningTotal, type ScreeningTotal } from './adminView';
import { ageBandOf, latestAssessedAgeMonth } from '../utils/ageBandDrift';
import { activityFromRow } from '../db/activities';
import { findingsFromRow, type FindingsRecord } from '../db/t2Findings';
import type { ActivityPatch } from '../utils/activityAdmin';
import type { Activity } from '../t2/types';
import { nextPassRange } from '../t2/trainingPass';
import { homeMediaFromRow, type HomeMediaItem, type HomeMediaKind, type HomeMediaSlot } from '../homeMedia/shape';
import type { SummarySource } from './parentSummary';
import { proxyAccess, proxyTarget, type ChangeActor, type ChangeReason, type ProxyParty, type ServiceRelation } from '../serviceRelations/rules';
import { isUnitKind, type UnitKind } from './units';

// ── 對外型別 ──

export interface ParentListItem {
  /** 家長的帳號 id。後台的一切以它為索引。 */
  id: number;
  email: string | null;
  phone: string | null;
  companyId: number | null;
  childName: string | null;
  childAgeMonth: number | null;
  childGender: string | null;
  /** 被標記（黃燈或紅燈）的維度，讓公司知道該先聯絡誰。分數跟著燈號一起列（2026-09-27）。 */
  flaggedDimensions: Array<{
    dimensionId: string;
    dimensionName: string;
    status: string;
    score: number;
    maxScore: number;
  }>;
  /** T1 九個維度的總分；還沒做篩查是 null（`screeningTotal`，`adminView.ts`）。 */
  screeningTotal: ScreeningTotal | null;
  /** 最近一次篩查資料的更新時間；沒做過篩查則為 null。 */
  screenedAt: string | null;
  registeredAt: string | null;
  hasBooking: boolean;
  /**
   * B→A 交接的邀請（ADR-0009）：最近一次送出成功的邀請簡訊、他的交接碼最近一次被用（＝到過 A）。
   * 專案 A 兩個都是 null（A 不發邀請）。能不能再邀請照 `src/handoff/invite.ts` 的 `inviteStatus` 判。
   */
  lastInvitedAt: string | null;
  handoffUsedAt: string | null;
  /**
   * 從專案 B 轉進來的（ADR-0009 的「來源欄」，只有專案 A 會有）：第一次轉入的時間與那時 B 那邊的合作公司
   * （`handoff_imports` 當下的快照；B 的家長未歸屬就是 null）。自己進站的家長整個是 null。
   * 取第一次：同一支手機在 B 的兩家合作公司是兩位家長，都轉過來會落在 A 的同一個帳號，最早的那一次才是他怎麼來的。
   */
  handoffSource: { at: string; companyName: string | null } | null;
  /**
   * 服務關係（#119，只有 `byService` 的條件才帶這兩欄；關著列表形狀一字不動）：現在服務他的單位與推薦人
   * （null＝森心康直屬；`referrerId` null＝還沒標注），與帳號歸屬那家的名字（篩查渠道的來源，改派不變）。
   */
  service?: { companyId: number; companyName: string | null; referrerId: number | null; referrerName: string | null } | null;
  screeningCompanyName?: string | null;
}

export interface ParentBooking {
  id: number;
  specialistId: string;
  specialistName: string | null;
  parentName: string;
  parentPhone: string;
  preferredSlot: string | null;
  reportSummary: string | null;
  /**
   * 四種服務中的哪一種（issue #21）。
   *
   * **型別是 `string` 而不是 `ServiceType`**：這個值來自資料庫，而遷移之前存下的
   * 舊列讀出來可能是任何東西。宣告成聯集型別只會讓「編譯器說它一定是四種之一」
   * 這件事在執行期不成立 —— 畫面該做的是把認不得的值顯示成「未记录服务类型」
   * （見 `serviceTypeLabel`），不是假設它不會發生。
   */
  serviceType: string;
  status: string;
  createdAt: string | null;
}

export interface ParentDetail extends ParentListItem {
  scores: DimensionScore[];
  reportHistory: AssessmentRecord[];
  bookings: ParentBooking[];
  /**
   * 最近一次篩查**當下**的測評月齡，以及它決定的年齡段。找不到時兩者都是 null。
   *
   * 專家沒有這兩個數字就讀不懂那份結果：`childAgeMonth` 是照**今天**算的，孩子
   * 跨段之後兩者會分岔，而分數是照當時那一段的題目與判準算出來的。少了它，一份
   * B 段的結果會被照著 C 段的常模去讀 —— 而畫面上看起來完全正常。
   */
  assessedAgeMonth: number | null;
  assessedBandName: string | null;
  /**
   * 這位家長最新的一份 T2 報告快照（#67），照存的樣子（舊版 `T2Findings` 或完整版 `T2FindingsV3`），
   * 不重算、不叫模型；沒有是 `null`。**只在專案 A**：B 沒有 T2，路由不問、回應裡沒有這一欄。
   */
  t2Report?: FindingsRecord | null;
}

export interface SpecialistRecord {
  id: number;
  companyId: number;
  name: string;
  title: string | null;
  specialty: string | null;
  experience: string | null;
  avatarUrl: string | null;
  slots: string[];
  active: boolean;
}

export interface SpecialistInput {
  name: string;
  title: string | null;
  specialty: string | null;
  experience: string | null;
  avatarUrl: string | null;
  slots: string[];
  active: boolean;
}

export interface CompanyRecord {
  id: number;
  name: string;
  slug: string;
  wecomWebhookUrl: string | null;
  /**
   * 家長端頁首與登入卡上的 LOGO 網址。`null` 代表用建置內建的字標
   * （`PRODUCT.brand.logoMark`）。
   *
   * ⚠️ **這是唯一會顯示在家長端的公司資料。** `name` 仍然只給後台看
   * —— 見 `deploy/schema.sql` 的欄位註解。
   */
  logoUrl: string | null;
  /** 合作單位的類型（#117，ADR-0020）：機構／個人治療師。舊列（與 B 的每一家）都是機構。 */
  kind: UnitKind;
  active: boolean;
  createdAt: string | null;
}

export interface AdminUserRecord {
  id: number;
  email: string;
  role: 'global_admin' | 'company_member' | 'referrer';
  companyId: number | null;
  active: boolean;
  createdAt: string | null;
  /** 推薦人帳號對到的 `referrers.id` 與那一列啟用沒（#93）；別的角色是 null／false。 */
  referrerId?: number | null;
  referrerActive?: boolean;
}

export interface CompanySummaryRow {
  /** `null` 代表「未歸屬」那一列。 */
  companyId: number | null;
  companyName: string;
  parentCount: number;
  screenedCount: number;
  bookingCount: number;
}

export interface ParentListOptions {
  sort: 'newest' | 'oldest';
  booked: 'all' | 'booked' | 'not_booked';
  /** 只列服務關係在單位裡、還沒標注推薦人的（#119）。只有 `byService` 的條件看它。 */
  unassignedOnly?: boolean;
}

// ── 共用工具 ──

/** 後台一律要求資料庫。記憶體模式沒有後台 —— 見 `routes.ts` 的 503。 */
export function isAvailable(): boolean {
  return isConfigured();
}

function requirePool(): Pool {
  const p = getPool();
  if (!p) throw new Error('后台需要数据库，当前为记忆体模式。');
  return p;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 被標記的維度：只看 **T1**（同 `screeningTotal`）。`completed_scores` 裡還躺著改版前的專項評估成績
 * （語言 40/120、動作 20/50），混進來會讓一個維度出現兩三次、滿分也對不上（2026-11-11 後台測試）。
 */
function flaggedFrom(scores: DimensionScore[]): ParentListItem['flaggedDimensions'] {
  return scores
    .filter(s => s.tierId === 'T1' && (s.status === 'delay' || s.status === 'borderline'))
    .map(s => ({
      dimensionId: s.dimensionId,
      dimensionName: s.dimensionName,
      status: s.status,
      score: s.score,
      maxScore: s.maxScore,
    }));
}

/**
 * 家長列表上的實足月齡。
 *
 * 不能直接讀存下來的 `ageMonth`：那是家長端**上一次寫入當下**算出來的值，
 * 而家長端現在是照今天推導的 —— 家長不必再存一次檔，兩邊就會愈差愈多，
 * 後台和專家於是照著一個過期的年齡在讀那份篩查結果。
 *
 * 只有沒存出生日期的舊檔案才退回存下來的月齡，那是我們僅有的資訊。
 */
function currentAgeMonth(child: any): number | null {
  if (typeof child?.birthDate === 'string') {
    const derived = calculateAgeMonth(child.birthDate);
    if (derived !== null) return derived;
  }
  return typeof child?.ageMonth === 'number' ? child.ageMonth : null;
}

/**
 * 「最近筛查」：T1 成績裡最晚的 `completedAt`（2026-11-17 code review 第 2 項）。以前直接讀 `user_data.updated_at`，
 * 家長只改孩子資料、下一張訂單、或手動改這張表，都會被當成剛篩查。舊成績沒有 `completedAt` 時回 null，
 * 呼叫端退回 `updated_at`。
 */
function lastScreenedAt(scores: DimensionScore[]): string | null {
  let latest = NaN;
  for (const s of scores) {
    if (s?.tierId !== 'T1') continue;
    const t = Date.parse(String(s.completedAt ?? ''));
    if (!Number.isNaN(t) && !(t <= latest)) latest = t;
  }
  return Number.isNaN(latest) ? null : new Date(latest).toISOString();
}

function rowToListItem(row: any): ParentListItem {
  const scores = parseJson<DimensionScore[]>(row.completed_scores, []);
  const child = parseJson<any>(row.child, null);
  return {
    id: Number(row.id),
    email: row.email ?? null,
    phone: row.phone ?? null,
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    childName: child?.name ?? null,
    childAgeMonth: currentAgeMonth(child),
    childGender: child?.gender ?? null,
    flaggedDimensions: flaggedFrom(scores),
    screeningTotal: screeningTotal(scores),
    screenedAt: lastScreenedAt(scores) ?? toIso(row.screened_at),
    registeredAt: toIso(row.created_at),
    hasBooking: Number(row.booking_count) > 0,
    lastInvitedAt: toIso(row.last_invited_at),
    handoffUsedAt: toIso(row.handoff_used_at),
    handoffSource: handoffSourceOf(row),
    ...(row.service_basis
      ? {
          service:
            row.cur_company_id === null || row.cur_company_id === undefined
              ? null
              : {
                  companyId: Number(row.cur_company_id),
                  companyName: row.service_company_name ?? null,
                  referrerId: row.cur_referrer_id === null ? null : Number(row.cur_referrer_id),
                  referrerName: row.service_referrer_name ?? null,
                },
          screeningCompanyName: row.screening_company_name ?? null,
        }
      : {}),
  };
}

function handoffSourceOf(row: any): ParentListItem['handoffSource'] {
  const at = toIso(row.handoff_first_at);
  return at === null ? null : { at, companyName: row.handoff_first_company ?? null };
}

function rowToSpecialist(row: any): SpecialistRecord {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    name: row.name,
    title: row.title ?? null,
    specialty: row.specialty ?? null,
    experience: row.experience ?? null,
    avatarUrl: row.avatar_url ?? null,
    slots: parseJson<string[]>(row.slots, []),
    active: Number(row.active) === 1,
  };
}

function rowToCompany(row: any): CompanyRecord {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    wecomWebhookUrl: row.wecom_webhook_url ?? null,
    logoUrl: row.logo_url ?? null,
    kind: isUnitKind(row.kind) ? row.kind : 'institution',
    active: Number(row.active) === 1,
    createdAt: toIso(row.created_at),
  };
}

/**
 * 撞到哪一個 UNIQUE（#117）：建個人治療師單位一次寫三張表，識別碼、信箱、推薦人代號撞到都是 `ER_DUP_ENTRY`，
 * 路由要講得出是哪一個。MySQL 的訊息是 `Duplicate entry '…' for key '<表>.<索引>'`（5.7 沒有表名）。
 */
function tagDuplicate(err: any): never {
  if (err?.code === 'ER_DUP_ENTRY') {
    const message = String(err.message ?? '');
    err.dupKey = message.includes('uk_referrers_company_code')
      ? 'code'
      : /slug'/.test(message)
        ? 'slug'
        : /email'/.test(message)
          ? 'email'
          : 'unknown';
  }
  throw err;
}

function rowToAdminUser(row: any): AdminUserRecord {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    active: Number(row.active) === 1,
    createdAt: toIso(row.created_at),
    referrerId: row.referrer_id === null || row.referrer_id === undefined ? null : Number(row.referrer_id),
    referrerActive: Number(row.referrer_active) === 1,
  };
}

// ══════════════════════════════════════════════════════════════
// 家長資料 —— 每一句都必須帶公司條件
// ══════════════════════════════════════════════════════════════

export async function listParents(
  condition: CompanyCondition,
  options: ParentListOptions
): Promise<ParentListItem[]> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  // 排序與篩選是列舉值對映到常數字串，不是把使用者輸入接進 SQL。
  const order = options.sort === 'oldest' ? 'ASC' : 'DESC';
  const bookedFilter =
    options.booked === 'booked'
      ? 'HAVING booking_count > 0'
      : options.booked === 'not_booked'
        ? 'HAVING booking_count = 0'
        : '';
  // 服務關係（#119）：byService 的條件才多帶這幾欄與「還沒標注」的篩選；關著查的東西不變。外層別名用 `cur`
  // （範圍片段自己用 `sr`）。都是常數字串，不接使用者輸入。
  const byService = condition.byService === true;
  const serviceColumns = byService
    ? `1 AS service_basis, cur.company_id AS cur_company_id, cur.referrer_id AS cur_referrer_id,
            sc.name AS service_company_name, sref.name AS service_referrer_name, chn.name AS screening_company_name,`
    : '';
  const serviceJoins = byService
    ? `LEFT JOIN service_relations cur ON cur.user_id = u.id
       LEFT JOIN companies sc ON sc.id = cur.company_id
       LEFT JOIN referrers sref ON sref.id = cur.referrer_id
       LEFT JOIN companies chn ON chn.id = u.company_id`
    : '';
  const unassignedFilter = byService && options.unassignedOnly ? 'AND cur.company_id IS NOT NULL AND cur.referrer_id IS NULL' : '';

  const [rows] = await p.execute(
    `SELECT ${serviceColumns} u.id, u.email, u.phone, u.company_id, u.created_at,
            ud.child, ud.completed_scores, ud.updated_at AS screened_at,
            (SELECT COUNT(*) FROM expert_bookings b WHERE b.user_id = u.id) AS booking_count,
            (SELECT MAX(i.sent_at) FROM handoff_invites i WHERE i.user_id = u.id AND i.status = 'sent') AS last_invited_at,
            (SELECT MAX(c.last_used_at) FROM handoff_codes c WHERE c.user_id = u.id) AS handoff_used_at,
            (SELECT MIN(h.created_at) FROM handoff_imports h WHERE h.user_id = u.id) AS handoff_first_at,
            (SELECT h.source_company_name FROM handoff_imports h WHERE h.user_id = u.id
              ORDER BY h.created_at, h.id LIMIT 1) AS handoff_first_company
       FROM users u
       LEFT JOIN user_data ud ON ud.user_id = u.id
       ${serviceJoins}
      WHERE ${scope.sql} ${unassignedFilter}
      ${bookedFilter}
      ORDER BY COALESCE(ud.updated_at, u.created_at) ${order}
      LIMIT 500`,
    scope.params
  );
  // SQL 照 `updated_at` 先排（取前 500 位）；畫面上的「最近筛查」是成績的時間，照它再排一次，兩邊才一致。
  const key = (x: ParentListItem) => x.screenedAt ?? x.registeredAt ?? '';
  const sign = options.sort === 'oldest' ? 1 : -1;
  return (rows as any[]).map(rowToListItem).sort((a, b) => (key(a) < key(b) ? -sign : key(a) > key(b) ? sign : 0));
}

/**
 * 單筆家長詳情。
 *
 * 找不到與「不屬於這個視野」回傳的是**同一個 null** —— 刻意不區分：
 * 若跨公司請求回 403 而不存在回 404，這支端點就成了一台「這個 id 存在嗎」的
 * 查詢機，別家公司的家長數量與 id 分布都會漏出去。
 */
export async function getParentDetail(
  condition: CompanyCondition,
  parentId: number
): Promise<ParentDetail | null> {
  const p = requirePool();
  const scope = companyWhereSql(condition);

  const [rows] = await p.execute(
    `SELECT u.id, u.email, u.phone, u.company_id, u.created_at,
            ud.child, ud.completed_scores, ud.report_history, ud.updated_at AS screened_at,
            (SELECT COUNT(*) FROM expert_bookings b WHERE b.user_id = u.id) AS booking_count,
            (SELECT MAX(i.sent_at) FROM handoff_invites i WHERE i.user_id = u.id AND i.status = 'sent') AS last_invited_at,
            (SELECT MAX(c.last_used_at) FROM handoff_codes c WHERE c.user_id = u.id) AS handoff_used_at,
            (SELECT MIN(h.created_at) FROM handoff_imports h WHERE h.user_id = u.id) AS handoff_first_at,
            (SELECT h.source_company_name FROM handoff_imports h WHERE h.user_id = u.id
              ORDER BY h.created_at, h.id LIMIT 1) AS handoff_first_company
       FROM users u
       LEFT JOIN user_data ud ON ud.user_id = u.id
      WHERE ${scope.sql} AND u.id = ?
      LIMIT 1`,
    [...scope.params, parentId]
  );
  const row = (rows as any[])[0];
  if (!row) return null;

  // 預約同樣走公司條件，不是「詳情查得到就把預約全撈出來」——
  // 那會讓一次判斷產生兩種範圍。
  const [bookingRows] = await p.execute(
    `SELECT b.id, b.specialist_id, b.parent_name, b.parent_phone, b.preferred_slot,
            b.report_summary, b.service_type, b.status, b.created_at,
            s.name AS specialist_name
       FROM expert_bookings b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN specialists s ON CAST(s.id AS CHAR) = b.specialist_id
      WHERE ${scope.sql} AND b.user_id = ?
      ORDER BY b.created_at DESC`,
    [...scope.params, parentId]
  );

  const scores = parseJson<DimensionScore[]>(row.completed_scores, []);
  const reportHistory = parseJson<AssessmentRecord[]>(row.report_history, []);
  // 家長端與這裡走**同一支**判斷（`ageBandDrift.ts`），因此兩邊說出來的年齡段
  // 名稱一定一致。各自查一次表就有兩種說法的空間，而專家與家長講的是同一份結果。
  const assessedAgeMonth = latestAssessedAgeMonth(scores, reportHistory);

  return {
    ...rowToListItem(row),
    scores,
    reportHistory,
    assessedAgeMonth,
    assessedBandName: assessedAgeMonth === null ? null : ageBandOf(assessedAgeMonth).name,
    bookings: (bookingRows as any[]).map(b => ({
      id: Number(b.id),
      specialistId: String(b.specialist_id),
      specialistName: b.specialist_name ?? null,
      parentName: b.parent_name,
      parentPhone: b.parent_phone,
      preferredSlot: b.preferred_slot ?? null,
      reportSummary: b.report_summary ?? null,
      // 空字串而不是 null：遷移之前的舊列讀出來沒有這一欄，而 `serviceTypeLabel`
      // 對認不得的值一律說「未记录服务类型」—— 那正是實情，不必再分兩種空。
      serviceType: typeof b.service_type === 'string' ? b.service_type : '',
      status: b.status,
      createdAt: toIso(b.created_at),
    })),
  };
}


/**
 * 這位家長最新的一份 T2 報告快照（#67）；沒有、或最新那一列讀不成快照時回 `null`。
 *
 * 與家長端的 `latestFindings`（`src/db/t2Findings.ts`）同一個「最新」（看 `id`）與同一支
 * `findingsFromRow`，所以後台看到的就是家長打開報告頁看到的那一份。公司條件掛在 JOIN 的
 * `users` 上 —— 詳情那一句已經帶過條件，這裡仍自己帶一次：一支函式只靠呼叫端先查過，
 * 換個呼叫端就是一條不帶條件的路。
 */
export async function latestT2Findings(
  condition: CompanyCondition,
  parentId: number
): Promise<FindingsRecord | null> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const [rows] = await p.execute(
    `SELECT f.id, f.findings, f.prose, f.is_ai_generated, f.ai_engine, f.created_at
       FROM t2_findings f
       JOIN users u ON u.id = f.user_id
      WHERE ${scope.sql} AND f.user_id = ?
      ORDER BY f.id DESC
      LIMIT 1`,
    [...scope.params, parentId]
  );
  const row = (rows as any[])[0];
  return row ? findingsFromRow(row) : null;
}

/**
 * 家長彙總（#69）的原始資料：視野裡**有 `user_data`** 的每一位家長，不設筆數上限（導出是拿去分析的整批，
 * 截在 500 會安靜地少人）。沒做過 T1 的由 `parentSummary.ts` 濾掉 —— 那要讀成績 JSON 才知道。
 *
 * 轉入紀錄另外一句、同樣帶公司條件（JOIN `users`），整批交出去，最早那一次在 `channelOf` 挑：
 * 篩查渠道「轉入兩次取最早」這條規則因此只有一處、測得到。
 *
 * `report_history` 是整份報告快照（AI 文字、圖表資料），一位家長幾十 KB；彙總只拿它補「篩查當時的月齡」，
 * 而成績本身帶 `assessedAgeMonth` 的家長根本用不到。所以第一句不讀它，只有成績裡找不到月齡的那幾位
 * （R1 之前的舊資料）再用第二句按 id 補讀。不用 `JSON_TABLE` 在 SQL 裡挑欄位：正式庫的版本沒驗過。
 */
const SUMMARY_HISTORY_BATCH = 500;

export async function listSummarySources(condition: CompanyCondition): Promise<SummarySource[]> {
  const p = requirePool();
  const scope = companyWhereSql(condition);

  const [rows] = await p.execute(
    `SELECT u.id, u.phone, u.company_id, c.name AS company_name,
            ud.child, ud.completed_scores,
            (SELECT COUNT(*) FROM expert_bookings b WHERE b.user_id = u.id) AS booking_count
       FROM users u
       JOIN user_data ud ON ud.user_id = u.id
       LEFT JOIN companies c ON c.id = u.company_id
      WHERE ${scope.sql}`,
    scope.params
  );
  const scoresOf = new Map<number, DimensionScore[]>();
  for (const row of rows as any[]) scoresOf.set(Number(row.id), parseJson<DimensionScore[]>(row.completed_scores, []));

  const needHistory = [...scoresOf].filter(([, scores]) => latestAssessedAgeMonth(scores, null) === null).map(([id]) => id);
  const histories = new Map<number, AssessmentRecord[]>();
  for (let i = 0; i < needHistory.length; i += SUMMARY_HISTORY_BATCH) {
    const ids = needHistory.slice(i, i + SUMMARY_HISTORY_BATCH);
    const [historyRows] = await p.execute(
      `SELECT ud.user_id, ud.report_history
         FROM user_data ud
         JOIN users u ON u.id = ud.user_id
        WHERE ${scope.sql} AND ud.user_id IN (${ids.map(() => '?').join(', ')})`,
      [...scope.params, ...ids]
    );
    for (const h of historyRows as any[]) {
      histories.set(Number(h.user_id), parseJson<AssessmentRecord[]>(h.report_history, []));
    }
  }
  const [importRows] = await p.execute(
    `SELECT h.id, h.user_id, h.created_at, h.source_company_name
       FROM handoff_imports h
       JOIN users u ON u.id = h.user_id
      WHERE ${scope.sql}`,
    scope.params
  );

  const imports = new Map<number, SummarySource['handoffImports']>();
  for (const h of importRows as any[]) {
    const at = toIso(h.created_at);
    if (at === null) continue;
    const list = imports.get(Number(h.user_id)) ?? [];
    list.push({ id: Number(h.id), at, companyName: h.source_company_name ?? null });
    imports.set(Number(h.user_id), list);
  }

  return (rows as any[]).map(row => ({
    userId: Number(row.id),
    phone: row.phone ?? null,
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    companyName: row.company_name ?? null,
    child: parseJson<any>(row.child, null),
    scores: scoresOf.get(Number(row.id)) ?? [],
    reportHistory: histories.get(Number(row.id)) ?? [],
    bookingCount: Number(row.booking_count) || 0,
    handoffImports: imports.get(Number(row.id)) ?? [],
  }));
}

/** 一次導出（#69）：誰、哪個視野、哪一種、幾筆、用了哪組篩選。 */
export interface AdminExportEntry {
  adminUserId: number;
  /** `all`：兌換碼對帳匯出（#113），跨所有推薦人、只有全域管理員。 */
  condition: CompanyCondition | { kind: 'all' };
  /** `parent_summary` 是導出 .xlsx；`parent_summary_view` 是看了畫面上的彙總（一樣是整批電話）；`redeem_codes` 是兌換碼對帳（#113）。 */
  kind: 'parent_summary' | 'parent_summary_view' | 'redeem_codes' | 'revenue_split';
  rowCount: number;
  filters: string;
  requestIp: string | null;
}

/**
 * 每一次導出都留下紀錄（`admin_exports`）。寫的是檢視者自己的行為，與 `recordCompanySwitch` 同一類；
 * 範圍取自條件本身，不取自請求。
 */
export async function recordExport(entry: AdminExportEntry): Promise<void> {
  const p = requirePool();
  await p.execute(
    `INSERT INTO admin_exports (admin_user_id, scope_kind, company_id, kind, row_count, filters, request_ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.adminUserId,
      entry.condition.kind,
      entry.condition.kind === 'company' ? entry.condition.companyId : null,
      entry.kind,
      entry.rowCount,
      entry.filters,
      entry.requestIp,
    ]
  );
}

/**
 * 刪除一位家長的結果。
 *
 * `not_found` 同時代表「這個 id 不存在」與「不在這個視野裡」—— 與詳情路由同一個
 * 理由：分開回應等於送出一台「這個 id 存在嗎」的查詢機。
 */
export type DeleteParentResult = 'deleted' | 'not_found' | 'has_payments';

/**
 * 硬刪一位家長（ADR-0006）。
 *
 * 【硬刪，不是軟刪】
 * `LegalTerms.tsx` 的「刪除權」承諾的是**刪除**，不是隱藏。軟刪還有兩個實際的麻煩：
 * 後台每一句查詢與家長登入都要多一個「排除已刪除」的條件；`uk_company_phone`
 * 唯一索引會讓被軟刪的手機號再也註冊不了，除非再加特例。
 *
 * 【為什麼要一個交易】
 * `expert_bookings.user_id` 的外鍵是 `ON DELETE SET NULL`（專案 B 的匿名預約需要
 * 它可以是 null），所以直接刪 `users` 會留下一筆後台永遠找不到、卻含著家長姓名
 * 與手機號的孤兒列。預約必須先刪，而「先刪預約」與「刪帳號」中間失敗的話，那位
 * 家長就失去了他的預約紀錄卻還在 —— 兩句話要嘛一起成立，要嘛都不成立。
 *
 * 【為什麼擋付款】
 * 付款紀錄是對帳憑證，退款與客訴都要它。`payments` 的外鍵是 `ON DELETE CASCADE`，
 * 刪掉家長就一起沒了。實際上只有專案 A 有付款、只有專案 B 有公司成員，這道擋門
 * 與公司成員永遠碰不到面 —— 程式碼兩道都做，不因為現實中碰不到就省掉。
 *
 * 其餘的表（`user_data`、`unlocks`、`report_links`）靠外鍵連帶刪除。
 * **掃碼帶走的報告連結因此 404** —— 那條連結原本永久有效、沒有撤回手段，
 * 刪除家長成了唯一的撤回方法。
 */
export async function deleteParent(
  condition: CompanyCondition,
  parentId: number
): Promise<DeleteParentResult> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const conn = await p.getConnection();

  try {
    await conn.beginTransaction();

    // 先確認他在這個視野裡，並把那一列鎖住 —— 中間有人送出預約或付款的話，
    // 下面兩句要看到的是同一個狀態。
    const [found] = await conn.execute(
      `SELECT u.id FROM users u
        WHERE ${scope.sql} AND u.id = ?
        FOR UPDATE`,
      [...scope.params, parentId]
    );
    if (!(found as any[])[0]) {
      await conn.rollback();
      return 'not_found';
    }

    // JOIN users 而不是只看 `payments.user_id`：公司條件必須跟著每一句走，
    // 而 `payments` 自己沒有 company_id。
    const [paid] = await conn.execute(
      `SELECT COUNT(*) AS n
         FROM payments pay
         JOIN users u ON u.id = pay.user_id
        WHERE ${scope.sql} AND pay.user_id = ?`,
      [...scope.params, parentId]
    );
    if (Number((paid as any[])[0]?.n ?? 0) > 0) {
      await conn.rollback();
      return 'has_payments';
    }

    await conn.execute(
      `DELETE b FROM expert_bookings b
         JOIN users u ON u.id = b.user_id
        WHERE ${scope.sql} AND b.user_id = ?`,
      [...scope.params, parentId]
    );

    const [result] = await conn.execute(
      `DELETE u FROM users u
        WHERE ${scope.sql} AND u.id = ?`,
      [...scope.params, parentId]
    );

    await conn.commit();
    return (result as ResultSetHeader).affectedRows > 0 ? 'deleted' : 'not_found';
  } catch (err) {
    // 回滾本身也可能失敗（連線斷了）。吞掉它，讓原本那個錯誤傳上去 ——
    // 那才是解釋得了發生什麼事的那一個。
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// ══════════════════════════════════════════════════════════════
// B→A 交接的邀請簡訊（ADR-0009）—— 同樣每一句都帶公司條件：寫入用
// `INSERT … SELECT … FROM users u WHERE u.id = ? AND 條件`，視野外的家長一列都寫不進去。
// ══════════════════════════════════════════════════════════════

export interface InviteTarget {
  id: number;
  phone: string | null;
  hasScreening: boolean;
  lastInvitedAt: string | null;
  handoffUsedAt: string | null;
}

/** 這一批 id 裡、在這個視野內的家長，附判斷能不能邀請要的事實。視野外的直接不在結果裡。 */
export async function listInviteTargets(condition: CompanyCondition, ids: number[]): Promise<InviteTarget[]> {
  if (ids.length === 0) return [];
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const [rows] = await p.execute(
    `SELECT u.id, u.phone, ud.completed_scores,
            (SELECT MAX(i.sent_at) FROM handoff_invites i WHERE i.user_id = u.id AND i.status = 'sent') AS last_invited_at,
            (SELECT MAX(c.last_used_at) FROM handoff_codes c WHERE c.user_id = u.id) AS handoff_used_at
       FROM users u
       LEFT JOIN user_data ud ON ud.user_id = u.id
      WHERE ${scope.sql} AND u.id IN (${ids.map(() => '?').join(', ')})`,
    [...scope.params, ...ids]
  );
  return (rows as any[]).map(row => ({
    id: Number(row.id),
    phone: row.phone ?? null,
    hasScreening: parseJson<DimensionScore[]>(row.completed_scores, []).some(s => s?.tierId === 'T1'),
    lastInvitedAt: toIso(row.last_invited_at),
    handoffUsedAt: toIso(row.handoff_used_at),
  }));
}

/** 為這位家長建一組邀請用的交接碼（只存雜湊）。視野外回 `null`。 */
export async function createInviteCode(
  condition: CompanyCondition,
  input: { userId: number; codeHash: string; consentVersion: string | null }
): Promise<number | null> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const [result] = await p.execute(
    `INSERT INTO handoff_codes (code_hash, user_id, kind, consent_version)
     SELECT ?, u.id, 'sms', ? FROM users u WHERE u.id = ? AND ${scope.sql}`,
    [input.codeHash, input.consentVersion, input.userId, ...scope.params]
  );
  const header = result as ResultSetHeader;
  return header.affectedRows === 1 ? header.insertId : null;
}

/** 記一則邀請（送出或失敗）。視野外寫不進去。 */
export async function recordInvite(
  condition: CompanyCondition,
  input: { userId: number; codeId: number | null; adminUserId: number; status: 'sent' | 'failed'; detail: string | null }
): Promise<void> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  await p.execute(
    `INSERT INTO handoff_invites (user_id, code_id, admin_user_id, status, detail)
     SELECT u.id, ?, ?, ?, ? FROM users u WHERE u.id = ? AND ${scope.sql}`,
    [input.codeId, input.adminUserId, input.status, input.detail?.slice(0, 255) ?? null, input.userId, ...scope.params]
  );
}

// ══════════════════════════════════════════════════════════════
// 專家名單（後台維護）—— 同樣帶公司條件
// ══════════════════════════════════════════════════════════════

export async function listSpecialists(
  condition: CompanyCondition,
  includeInactive: boolean
): Promise<SpecialistRecord[]> {
  const p = requirePool();
  const scope = companyWhereSql(condition, 's.company_id');
  const activeFilter = includeInactive ? '' : 'AND s.active = 1';
  const [rows] = await p.execute(
    `SELECT s.* FROM specialists s
      WHERE ${scope.sql} ${activeFilter}
      ORDER BY s.active DESC, s.id ASC`,
    scope.params
  );
  return (rows as any[]).map(rowToSpecialist);
}

export async function createSpecialist(
  condition: CompanyCondition,
  input: SpecialistInput
): Promise<SpecialistRecord | null> {
  // 未歸屬沒有公司，因此沒有專家可以隸屬。回 null 讓路由層答 400，
  // 而不是憑空挑一家公司塞進去。
  if (condition.kind !== 'company') return null;
  const p = requirePool();
  const [result] = await p.execute(
    `INSERT INTO specialists
       (company_id, name, title, specialty, experience, avatar_url, slots, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      condition.companyId,
      input.name,
      input.title,
      input.specialty,
      input.experience,
      input.avatarUrl,
      JSON.stringify(input.slots),
      input.active ? 1 : 0,
    ]
  );
  const id = (result as ResultSetHeader).insertId;
  const list = await listSpecialists(condition, true);
  return list.find(s => s.id === id) ?? null;
}

/** 回傳受影響的列數；0 代表「不在這個視野裡」，路由層一律當作找不到。 */
export async function updateSpecialist(
  condition: CompanyCondition,
  specialistId: number,
  input: SpecialistInput
): Promise<number> {
  const p = requirePool();
  const scope = companyWhereSql(condition, 's.company_id');
  const [result] = await p.execute(
    `UPDATE specialists s
        SET s.name = ?, s.title = ?, s.specialty = ?, s.experience = ?,
            s.avatar_url = ?, s.slots = ?, s.active = ?
      WHERE ${scope.sql} AND s.id = ?`,
    [
      input.name,
      input.title,
      input.specialty,
      input.experience,
      input.avatarUrl,
      JSON.stringify(input.slots),
      input.active ? 1 : 0,
      ...scope.params,
      specialistId,
    ]
  );
  return (result as ResultSetHeader).affectedRows;
}

// ══════════════════════════════════════════════════════════════
// 公司設定（企業微信通知位置）—— 由條件決定改的是哪一家
// ══════════════════════════════════════════════════════════════

export async function getScopedCompany(
  condition: CompanyCondition
): Promise<CompanyRecord | null> {
  if (condition.kind !== 'company') return null;
  const p = requirePool();
  const scope = companyWhereSql(condition, 'c.id');
  const [rows] = await p.execute(`SELECT c.* FROM companies c WHERE ${scope.sql} LIMIT 1`, scope.params);
  const row = (rows as any[])[0];
  return row ? rowToCompany(row) : null;
}

/** 「本機構設定」那一頁改得動的欄位。沒帶到的鍵不會被寫入。 */
export interface CompanySettingsPatch {
  wecomWebhookUrl?: string | null;
  logoUrl?: string | null;
}

/**
 * 更新本機構設定。
 *
 * **只寫進 `patch` 裡真的帶了的鍵** —— 兩個欄位在同一頁上，但不見得同時被改。
 * 若改成「兩欄一起寫」，一個只想換 LOGO 的請求會把 webhook 一併覆蓋成
 * 當時輸入框裡的值；輸入框若還沒載入完就是空字串，通知位置就這樣被清掉了，
 * 而畫面上沒有任何跡象 —— 下一次有家長送出預約時才會發現通知沒送到。
 */
export async function updateScopedCompanySettings(
  condition: CompanyCondition,
  patch: CompanySettingsPatch
): Promise<number> {
  if (condition.kind !== 'company') return 0;

  const sets: string[] = [];
  // 型別跟著 mysql2 的 execute 走 —— `unknown[]` 過不了它的多載。
  const values: (string | null)[] = [];
  if ('wecomWebhookUrl' in patch) {
    sets.push('c.wecom_webhook_url = ?');
    values.push(patch.wecomWebhookUrl ?? null);
  }
  if ('logoUrl' in patch) {
    sets.push('c.logo_url = ?');
    values.push(patch.logoUrl ?? null);
  }
  // 一個欄位都沒帶：不是錯誤，但也沒有 SQL 可以跑。回 0 會被呼叫端當成
  // 「未歸屬」而回一句不相干的錯誤訊息，所以這裡由路由層先擋掉。
  if (sets.length === 0) return 0;

  const p = requirePool();
  const scope = companyWhereSql(condition, 'c.id');
  const [result] = await p.execute(
    `UPDATE companies c SET ${sets.join(', ')} WHERE ${scope.sql}`,
    [...values, ...scope.params]
  );
  return (result as ResultSetHeader).affectedRows;
}

// ══════════════════════════════════════════════════════════════
// 全域管理員專用 —— 不涉及個別家長資料，因此不吃公司條件
// ══════════════════════════════════════════════════════════════

/**
 * 跨公司彙總。**只回統計數字，不回任何個別家長。**
 *
 * 這是唯一一個合法跨越公司邊界的查詢，因此它刻意不接受 `CompanyCondition`：
 * 讓它與「帶條件的家長查詢」在型別上就是兩種東西，不會有人以為忘了傳條件。
 * 路由層限定 `global_admin` 才呼叫得到。
 */
export async function summaryByCompany(): Promise<CompanySummaryRow[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT c.id AS company_id, c.name AS company_name,
            COUNT(u.id) AS parent_count,
            SUM(CASE WHEN ud.user_id IS NOT NULL THEN 1 ELSE 0 END) AS screened_count,
            COUNT(DISTINCT b.id) AS booking_count
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id
       LEFT JOIN user_data ud ON ud.user_id = u.id
       LEFT JOIN expert_bookings b ON b.user_id = u.id
      GROUP BY c.id, c.name
      ORDER BY c.id ASC`,
    []
  );

  // 未歸屬的家長單獨一列。省略他們會讓「各公司加總 ≠ 全部家長」，
  // 而對不起來的數字最後總是被當成資料遺失。
  const [unassigned] = await p.execute(
    `SELECT COUNT(u.id) AS parent_count,
            SUM(CASE WHEN ud.user_id IS NOT NULL THEN 1 ELSE 0 END) AS screened_count,
            COUNT(DISTINCT b.id) AS booking_count
       FROM users u
       LEFT JOIN user_data ud ON ud.user_id = u.id
       LEFT JOIN expert_bookings b ON b.user_id = u.id
      WHERE u.company_id IS NULL`,
    []
  );

  const u = (unassigned as any[])[0] || {};
  return [
    ...(rows as any[]).map(r => ({
      companyId: Number(r.company_id),
      companyName: r.company_name,
      parentCount: Number(r.parent_count) || 0,
      screenedCount: Number(r.screened_count) || 0,
      bookingCount: Number(r.booking_count) || 0,
    })),
    {
      companyId: null,
      companyName: '未归属',
      parentCount: Number(u.parent_count) || 0,
      screenedCount: Number(u.screened_count) || 0,
      bookingCount: Number(u.booking_count) || 0,
    },
  ];
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM companies ORDER BY id ASC', []);
  return (rows as any[]).map(rowToCompany);
}

/**
 * 建一家合作公司／合作單位。`kind` 只有 A 會傳（#117）；機構照舊只寫名稱與識別碼（類型用欄位預設），
 * 所以 B 的這句話一個字都沒變。
 */
export async function createCompany(name: string, slug: string, kind: UnitKind = 'institution'): Promise<CompanyRecord> {
  const p = requirePool();
  const [result] =
    kind === 'institution'
      ? await p.execute('INSERT INTO companies (name, slug) VALUES (?, ?)', [name, slug])
      : await p.execute('INSERT INTO companies (name, slug, kind) VALUES (?, ?, ?)', [name, slug, kind]);
  const id = (result as ResultSetHeader).insertId;
  const [rows] = await p.execute('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);
  return rowToCompany((rows as any[])[0]);
}

export async function findCompanyById(id: number): Promise<CompanyRecord | null> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);
  const row = (rows as any[])[0];
  return row ? rowToCompany(row) : null;
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    'SELECT id, email, role, company_id, active, created_at FROM admin_users ORDER BY id ASC',
    []
  );
  return (rows as any[]).map(rowToAdminUser);
}

/** 含密碼杂凑，只給登入流程用。 */
export async function findAdminUserByEmail(
  email: string
): Promise<(AdminUserRecord & { passwordHash: string }) | null> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT a.*, r.id AS referrer_id, r.active AS referrer_active
       FROM admin_users a LEFT JOIN referrers r ON r.admin_user_id = a.id
      WHERE a.email = ? LIMIT 1`,
    [email]
  );
  const row = (rows as any[])[0];
  return row ? { ...rowToAdminUser(row), passwordHash: row.password } : null;
}

export async function findAdminUserById(id: number): Promise<AdminUserRecord | null> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT a.id, a.email, a.role, a.company_id, a.active, a.created_at, r.id AS referrer_id, r.active AS referrer_active
       FROM admin_users a LEFT JOIN referrers r ON r.admin_user_id = a.id
      WHERE a.id = ? LIMIT 1`,
    [id]
  );
  const row = (rows as any[])[0];
  return row ? rowToAdminUser(row) : null;
}

export async function createAdminUser(
  email: string,
  passwordHash: string,
  role: 'global_admin' | 'company_member',
  companyId: number | null
): Promise<AdminUserRecord> {
  const p = requirePool();
  const [result] = await p.execute(
    'INSERT INTO admin_users (email, password, role, company_id) VALUES (?, ?, ?, ?)',
    [email, passwordHash, role, companyId]
  );
  const id = (result as ResultSetHeader).insertId;
  const created = await findAdminUserById(id);
  if (!created) throw new Error('建立后台帐号后读不回来');
  return created;
}

export async function setAdminUserActive(id: number, active: boolean): Promise<number> {
  const p = requirePool();
  const [result] = await p.execute('UPDATE admin_users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  return (result as ResultSetHeader).affectedRows;
}

// ══════════════════════════════════════════════════════════════
// 活動庫（#44，ADR-0005）—— 不是家長資料，因此不吃公司條件
// ══════════════════════════════════════════════════════════════
//
// 活動是森心康的內容，不屬於任何一家合作公司，也不含任何一位家長的資料，因此
// 這幾支查詢**刻意沒有** `${scope.sql}`。這個豁免不是靠紀律維持的：
// `test/adminScope.structure.test.ts` 有一份「這張表是全域的」的明列清單（`GLOBAL_TABLES`），
// 想讓一張新表不帶公司條件，必須先去改那個檔案 —— 那是一個看得見的動作。
//
// 它們仍然住在這裡而不是路由層：單一入口的規則對全域的表一樣適用，
// 否則「路由裡沒有 SQL」這條護欄就會有第一個例外，而例外會長出第二個。
//
// 列 → 活動的轉換在 `src/db/activities.ts`，家長端的每週配對（#53／#60）讀的是同一支。
// （退場的素材庫在這裡也有過一段，2026-09 隨 ADR-0005 拿掉；#63。）
//
// 讀兩支、寫一支。寫的那一支是標記頁（#62）：局部更新，帶了才改。

/**
 * 整份活動庫，含已停用的，依編號排序（A001 → A300）。
 *
 * 後台要的是 300 支的全貌 —— 「還沒填 targetMonth」與「已停用」在畫面上必須分得開，
 * 進度數字（已填 N 支）也是從這裡算的。家長端配對只認啟用中且 `targetMonth` 非 null 的，
 * 那是配對函式自己過濾，不在這裡先篩掉。
 */
export async function listActivities(): Promise<Activity[]> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM activities ORDER BY id ASC', []);
  return (rows as any[]).map(row => activityFromRow(row));
}

export async function findActivityById(id: string): Promise<Activity | null> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM activities WHERE id = ? LIMIT 1', [id]);
  const row = (rows as any[])[0];
  return row ? activityFromRow(row) : null;
}

/**
 * `ActivityPatch` 的每個欄位 → 資料表欄位與序列化方式。
 *
 * 寫成一張表而不是一串 if：新增一個可填的欄位時，這裡少一列會在型別檢查就被抓到
 * （`Record<keyof ActivityPatch, …>` 要求齊全），而不是某個欄位在畫面上存了、資料庫裡沒有。
 * 一個欄位可以寫好幾欄：`ageMonths`（由適齡原文解析的硬閘）是 `age_min_month` 與 `age_max_month`。
 *
 * 手冊的文字欄位照原樣寫字串，**清掉就是空字串，不寫 `NULL`**：`NULL` 是「遷移還沒填」，
 * 遷移重跑只填 `NULL`（`deploy/migrations/2026-09-23-activity-content.sql`），清掉的不會被填回來。
 *
 * 示範片與封面同一條規則：patch 裡的 `null` 是「清掉」（`readActivityPatch` 的 `readUrl`），存成空字串；
 * 示範片的遷移（`2026-09-24-activity-media.sql`）也只填 `NULL`，內容團隊下架的片不會在下一次部署自己回來。
 * 讀回來時空字串就是沒有（`activityFromRow`）。片長清掉照舊寫 `NULL`：那一欄的遷移另外要片子還是清單上
 * 那一支才補，片被清掉就不補。
 */
const plainColumn = (column: string) => [{ column, encode: (v: any) => v }];
const clearableUrlColumn = (column: string) => [{ column, encode: (v: string | null) => v ?? '' }];
const jsonColumn = (column: string) => [{ column, encode: (v: any) => JSON.stringify(v) }];
const ACTIVITY_COLUMNS: Readonly<Record<keyof ActivityPatch, ReadonlyArray<{ column: string; encode: (v: any) => unknown }>>> = {
  title: plainColumn('title'),
  targetMonth: plainColumn('target_month'),
  ageLabel: plainColumn('age_label'),
  ageMonths: [
    { column: 'age_min_month', encode: v => v.min },
    { column: 'age_max_month', encode: v => v.max },
  ],
  people: plainColumn('people'),
  dimensions: jsonColumn('dimensions'),
  targets: jsonColumn('targets'),
  avoidIf: jsonColumn('avoid_if'),
  durationMin: plainColumn('duration_min'),
  equipment: jsonColumn('equipment'),
  need: plainColumn('need'),
  trains: plainColumn('trains'),
  steps: jsonColumn('steps'),
  easier: plainColumn('easier'),
  harder: plainColumn('harder'),
  tip: plainColumn('tip'),
  deeper: plainColumn('deeper'),
  guide: jsonColumn('guide'),
  videoUrl: clearableUrlColumn('video_url'),
  posterUrl: clearableUrlColumn('poster_url'),
  videoSeconds: plainColumn('video_seconds'),
  active: [{ column: 'active', encode: v => (v ? 1 : 0) }],
};

/**
 * 局部更新一支活動，回傳更新後的整支；這個 id 不存在回 `null`。
 *
 * **帶了才改，沒帶不動**：內容團隊今天填 targetMonth、下週貼標籤，整筆覆寫會讓前端漏送
 * 一個欄位就悄悄清掉一個。SET 子句只列 `patch` 裡有的欄位，欄位名來自上面那張表，
 * **不是**請求裡的字 —— 值全部參數化。
 *
 * 更新後一律讀回：路由要把整支回給畫面（列表即時更新），而且這樣就不必依賴 `affectedRows`
 * 去判斷「找不到」—— 那個數字在「內容一模一樣」時也是 0（退場的素材庫曾在這裡踩過一次）。
 */
export async function updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null> {
  const p = requirePool();
  const keys = (Object.keys(patch) as Array<keyof ActivityPatch>).filter(k => patch[k] !== undefined);
  if (keys.length > 0) {
    const columns = keys.flatMap(k => ACTIVITY_COLUMNS[k].map(c => ({ column: c.column, value: c.encode(patch[k]) })));
    const sets = columns.map(c => `${c.column} = ?`).join(', ');
    const params: any[] = columns.map(c => c.value);
    await p.execute(`UPDATE activities SET ${sets} WHERE id = ?`, [...params, id]);
  }
  return findActivityById(id);
}

/** 每一次公司切換都留下紀錄 —— 越界行為要有痕跡。 */
export async function recordCompanySwitch(
  adminUserId: number,
  companyId: number | null,
  selection: 'company' | 'unassigned',
  requestIp: string | null
): Promise<void> {
  const p = requirePool();
  await p.execute(
    'INSERT INTO admin_company_switches (admin_user_id, company_id, selection, request_ip) VALUES (?, ?, ?, ?)',
    [adminUserId, companyId, selection, requestIp]
  );
}

// ── 首頁素材（客戶 10/22，#87）──
//
// `home_media` 是全站一套的開屏與輪播，不屬於任何一家合作公司，也不含任何一位家長的資料 —— 同活動庫，
// 刻意不帶 `${scope.sql}`，列在 `test/adminScope.structure.test.ts` 的 `GLOBAL_TABLES`；路由層限定全域管理員。

/** 全部素材（含停用的），依槽位、排序。 */
export async function listHomeMedia(): Promise<HomeMediaItem[]> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM home_media ORDER BY slot ASC, sort_order ASC, id ASC', []);
  return (rows as Record<string, unknown>[]).map(homeMediaFromRow).filter((i): i is HomeMediaItem => i !== null);
}

/** 新增一張素材，排在同槽位最後面。回整張。 */
export async function createHomeMedia(input: { slot: HomeMediaSlot; kind: HomeMediaKind; url: string; link: string | null }): Promise<HomeMediaItem | null> {
  const p = requirePool();
  const [maxRows] = await p.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM home_media WHERE slot = ?', [input.slot]);
  const next = Number((maxRows as any[])[0]?.m ?? 0) + 1;
  const [result] = await p.execute(
    'INSERT INTO home_media (slot, kind, url, link, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)',
    [input.slot, input.kind, input.url, input.link, next],
  );
  return findHomeMedia((result as ResultSetHeader).insertId);
}

export async function findHomeMedia(id: number): Promise<HomeMediaItem | null> {
  const p = requirePool();
  const [rows] = await p.execute('SELECT * FROM home_media WHERE id = ? LIMIT 1', [id]);
  const row = (rows as Record<string, unknown>[])[0];
  return row ? homeMediaFromRow(row) : null;
}

/** 局部更新：帶了才改（連結、排序、啟用、封面、檔案網址）。回整張；不存在回 null。 */
export async function updateHomeMedia(
  id: number,
  patch: { link?: string | null; sortOrder?: number; active?: boolean; posterUrl?: string; url?: string },
): Promise<HomeMediaItem | null> {
  const p = requirePool();
  const sets: string[] = [];
  const args: Array<string | number | null> = [];
  if (patch.link !== undefined) { sets.push('link = ?'); args.push(patch.link); }
  if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder); }
  if (patch.active !== undefined) { sets.push('active = ?'); args.push(patch.active ? 1 : 0); }
  if (patch.posterUrl !== undefined) { sets.push('poster_url = ?'); args.push(patch.posterUrl); }
  if (patch.url !== undefined) { sets.push('url = ?'); args.push(patch.url); }
  if (sets.length > 0) {
    await p.execute(`UPDATE home_media SET ${sets.join(', ')} WHERE id = ?`, [...args, id]);
  }
  return findHomeMedia(id);
}

// ── 推薦人（客戶 10/22，#93）──
//
// `referrers` 是推薦人本身的名冊（渠道商、治療師），不是家長資料：只有全域管理員建、看全部（路由層 requireGlobal），
// 列在 `test/adminScope.structure.test.ts` 的 `GLOBAL_TABLES`。推薦人看家長走的是公司條件那一套（`kind: 'referrer'`，
// `companyWhereSql` 產生 `referrer_bindings` 的 EXISTS），不在這裡另開一條路。

export type ReferrerKind = 'channel' | 'therapist';

export interface ReferrerRecord {
  id: number;
  adminUserId: number;
  email: string;
  name: string;
  phone: string;
  kind: ReferrerKind;
  companyId: number | null;
  companyName: string | null;
  /** 所屬單位的進站代號與類型（#117）：後台畫推薦人的個人連結用。沒隸屬是 null。 */
  companySlug: string | null;
  companyKind: UnitKind | null;
  /** 推薦人代號（#117）：個人連結 `?c=<單位>&t=<代號>`，在同一個單位裡唯一。舊的推薦人是 null。 */
  code: string | null;
  active: boolean;
  createdAt: string | null;
}

function rowToReferrer(row: any): ReferrerRecord {
  return {
    id: Number(row.id),
    adminUserId: Number(row.admin_user_id),
    email: row.email,
    name: row.name,
    phone: row.phone,
    kind: row.kind === 'therapist' ? 'therapist' : 'channel',
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    companyName: row.company_name ?? null,
    companySlug: row.company_slug ?? null,
    companyKind: isUnitKind(row.company_kind) ? row.company_kind : null,
    code: row.code ?? null,
    active: Number(row.active) === 1,
    createdAt: toIso(row.created_at),
  };
}

export async function listReferrers(): Promise<ReferrerRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT r.*, a.email, c.name AS company_name, c.slug AS company_slug, c.kind AS company_kind
       FROM referrers r
       JOIN admin_users a ON a.id = r.admin_user_id
       LEFT JOIN companies c ON c.id = r.company_id
      ORDER BY r.id ASC`,
    []
  );
  return (rows as any[]).map(rowToReferrer);
}

export async function findReferrer(id: number): Promise<ReferrerRecord | null> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT r.*, a.email, c.name AS company_name, c.slug AS company_slug, c.kind AS company_kind
       FROM referrers r
       JOIN admin_users a ON a.id = r.admin_user_id
       LEFT JOIN companies c ON c.id = r.company_id
      WHERE r.id = ? LIMIT 1`,
    [id]
  );
  const row = (rows as any[])[0];
  return row ? rowToReferrer(row) : null;
}

// ══════════════════════════════════════════════════════════════
// 服務關係與改派（#119，ADR-0020；服務關係開關開著才有路由呼叫）
// ══════════════════════════════════════════════════════════════

export interface ServiceRelationChangeRecord {
  id: number;
  fromCompanyId: number | null;
  fromReferrerId: number | null;
  toCompanyId: number | null;
  toReferrerId: number | null;
  actor: ChangeActor;
  reason: ChangeReason;
  adminUserId: number | null;
  createdAt: string | null;
  /** 兩端的名字（伺服器 JOIN 出來）：推薦人與單位管理者沒有全部單位的名單，畫面不能只靠 `/service-targets` 對名字。 */
  fromCompanyName: string | null;
  fromReferrerName: string | null;
  toCompanyName: string | null;
  toReferrerName: string | null;
}

const nullableId = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** 一列（`users u` LEFT JOIN `service_relations cur`）→ 服務關係；沒有那一列＝null（森心康直屬）。 */
function relationFromRow(row: any): ServiceRelation | null {
  return row.cur_company_id === null || row.cur_company_id === undefined
    ? null
    : { companyId: Number(row.cur_company_id), referrerId: nullableId(row.cur_referrer_id) };
}

/** 這位家長在視野裡的話，回他現在的服務關係（可能是 null）；不在視野裡回 null。 */
export async function getServiceRelation(
  condition: CompanyCondition,
  userId: number
): Promise<{ relation: ServiceRelation | null } | null> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  // 外層別名用 `cur`：範圍片段自己會用 `sr` 查 service_relations。
  const [rows] = await p.execute(
    `SELECT u.id, cur.company_id AS cur_company_id, cur.referrer_id AS cur_referrer_id
       FROM users u LEFT JOIN service_relations cur ON cur.user_id = u.id
      WHERE ${scope.sql} AND u.id = ? LIMIT 1`,
    [...scope.params, userId]
  );
  const row = (rows as any[])[0];
  return row ? { relation: relationFromRow(row) } : null;
}

export type ReassignResult =
  | { ok: true; changed: boolean; relation: ServiceRelation | null }
  /** not_found：不在視野裡；stale：服務關係在路由判權限之後被別人改了（呼叫端回 409，請重讀）。 */
  | { ok: false; reason: 'not_found' | 'stale' };

const sameRelation = (a: ServiceRelation | null, b: ServiceRelation | null) =>
  a === null || b === null ? a === b : a.companyId === b.companyId && a.referrerId === b.referrerId;

/**
 * 後台改派：一個交易裡先以範圍條件鎖住這位家長（`FOR UPDATE`），確認服務關係還是路由判權限時讀到的 `from`，
 * 再寫一列紀錄（actor＝admin、reason＝admin）與新的服務關係（`to` 是 null＝拿掉）。跟現在一樣就什麼都不寫。
 * 權限由路由層用 `canReassign` 判；`to` 的單位與推薦人由路由層先驗過。
 */
export async function reassignServiceRelation(
  condition: CompanyCondition,
  input: { userId: number; from: ServiceRelation | null; to: ServiceRelation | null; adminUserId: number }
): Promise<ReassignResult> {
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT u.id, cur.company_id AS cur_company_id, cur.referrer_id AS cur_referrer_id
         FROM users u LEFT JOIN service_relations cur ON cur.user_id = u.id
        WHERE ${scope.sql} AND u.id = ? LIMIT 1 FOR UPDATE`,
      [...scope.params, input.userId]
    );
    const row = (rows as any[])[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, reason: 'not_found' };
    }
    const current = relationFromRow(row);
    if (!sameRelation(current, input.from)) {
      await conn.rollback();
      return { ok: false, reason: 'stale' };
    }
    if (sameRelation(current, input.to)) {
      await conn.commit();
      return { ok: true, changed: false, relation: current };
    }
    await conn.execute(
      `INSERT INTO service_relation_changes
         (user_id, from_company_id, from_referrer_id, to_company_id, to_referrer_id, actor, reason, admin_user_id)
       VALUES (?, ?, ?, ?, ?, 'admin', 'admin', ?)`,
      [
        input.userId,
        current?.companyId ?? null,
        current?.referrerId ?? null,
        input.to?.companyId ?? null,
        input.to?.referrerId ?? null,
        input.adminUserId,
      ]
    );
    // 這位家長那一列已經鎖住（上面的 FOR UPDATE），現在有沒有服務關係也已知。
    if (input.to === null) {
      await conn.execute('DELETE FROM service_relations WHERE user_id = ?', [input.userId]);
    } else if (current === null) {
      await conn.execute('INSERT INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?)', [
        input.userId,
        input.to.companyId,
        input.to.referrerId,
      ]);
    } else {
      await conn.execute('UPDATE service_relations SET company_id = ?, referrer_id = ? WHERE user_id = ?', [
        input.to.companyId,
        input.to.referrerId,
        input.userId,
      ]);
    }
    await conn.commit();
    return { ok: true, changed: true, relation: input.to };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

/** 一位家長的改派紀錄，新的在前；不在視野裡回 null。 */
export async function listServiceRelationChanges(
  condition: CompanyCondition,
  userId: number
): Promise<ServiceRelationChangeRecord[] | null> {
  if ((await getServiceRelation(condition, userId)) === null) return null;
  const p = requirePool();
  const scope = companyWhereSql(condition);
  const [rows] = await p.execute(
    `SELECT ch.*, fc.name AS from_company_name, fr.name AS from_referrer_name,
            tc.name AS to_company_name, tr.name AS to_referrer_name
       FROM service_relation_changes ch JOIN users u ON u.id = ch.user_id
       LEFT JOIN companies fc ON fc.id = ch.from_company_id
       LEFT JOIN referrers fr ON fr.id = ch.from_referrer_id
       LEFT JOIN companies tc ON tc.id = ch.to_company_id
       LEFT JOIN referrers tr ON tr.id = ch.to_referrer_id
      WHERE ${scope.sql} AND u.id = ?
      ORDER BY ch.created_at DESC, ch.id DESC`,
    [...scope.params, userId]
  );
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    fromCompanyId: nullableId(r.from_company_id),
    fromReferrerId: nullableId(r.from_referrer_id),
    toCompanyId: nullableId(r.to_company_id),
    toReferrerId: nullableId(r.to_referrer_id),
    actor: r.actor,
    reason: r.reason,
    adminUserId: nullableId(r.admin_user_id),
    createdAt: toIso(r.created_at),
    fromCompanyName: r.from_company_name ?? null,
    fromReferrerName: r.from_referrer_name ?? null,
    toCompanyName: r.to_company_name ?? null,
    toReferrerName: r.to_referrer_name ?? null,
  }));
}

/** 開一位推薦人：後台帳號（角色 `referrer`）與 `referrers` 那一列在同一個交易裡。信箱撞到丟 `ER_DUP_ENTRY`。 */
export async function createReferrer(input: {
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  kind: ReferrerKind;
  companyId: number | null;
  /** 推薦人代號（#117）；沒有單位的舊流程是 null。 */
  code?: string | null;
}): Promise<ReferrerRecord> {
  const p = requirePool();
  const conn = await p.getConnection();
  let referrerId: number;
  try {
    await conn.beginTransaction();
    const [account] = await conn.execute(
      "INSERT INTO admin_users (email, password, role, company_id) VALUES (?, ?, 'referrer', NULL)",
      [input.email, input.passwordHash]
    );
    // 沒有代號就照舊那一句（不碰 `code` 欄）；有代號才寫。
    const [ref] = input.code
      ? await conn.execute(
          'INSERT INTO referrers (admin_user_id, name, phone, kind, company_id, code) VALUES (?, ?, ?, ?, ?, ?)',
          [(account as ResultSetHeader).insertId, input.name, input.phone, input.kind, input.companyId, input.code]
        )
      : await conn.execute(
          'INSERT INTO referrers (admin_user_id, name, phone, kind, company_id) VALUES (?, ?, ?, ?, ?)',
          [(account as ResultSetHeader).insertId, input.name, input.phone, input.kind, input.companyId]
        );
    referrerId = (ref as ResultSetHeader).insertId;
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    tagDuplicate(err);
  } finally {
    conn.release();
  }
  const created = await findReferrer(referrerId);
  if (!created) throw new Error('建立推荐人后读不回来');
  return created;
}

/**
 * 建一個個人治療師單位（#117，ADR-0020）：單位（類型 therapist）、一個後台帳號（角色 company_member，屬於這個單位）、
 * 一列推薦人（指著同一個帳號、屬於這個單位、沒有代號——他的連結就是單位連結），同一個交易。
 * 這個帳號因此同時是單位管理者與推薦人（`buildIdentity` 看 `referrers.admin_user_id`）。
 * 識別碼或信箱撞到丟 `ER_DUP_ENTRY`，`dupKey` 說是哪一個。
 */
export async function createTherapistUnit(input: {
  name: string;
  slug: string;
  email: string;
  passwordHash: string;
  phone: string;
}): Promise<{ company: CompanyRecord; referrer: ReferrerRecord }> {
  const p = requirePool();
  const conn = await p.getConnection();
  let companyId: number;
  let referrerId: number;
  try {
    await conn.beginTransaction();
    const [unit] = await conn.execute("INSERT INTO companies (name, slug, kind) VALUES (?, ?, 'therapist')", [input.name, input.slug]);
    companyId = (unit as ResultSetHeader).insertId;
    const [account] = await conn.execute(
      "INSERT INTO admin_users (email, password, role, company_id) VALUES (?, ?, 'company_member', ?)",
      [input.email, input.passwordHash, companyId]
    );
    const [ref] = await conn.execute(
      "INSERT INTO referrers (admin_user_id, name, phone, kind, company_id) VALUES (?, ?, ?, 'therapist', ?)",
      [(account as ResultSetHeader).insertId, input.name, input.phone, companyId]
    );
    referrerId = (ref as ResultSetHeader).insertId;
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    tagDuplicate(err);
  } finally {
    conn.release();
  }
  const [company, referrer] = await Promise.all([findCompanyById(companyId), findReferrer(referrerId)]);
  if (!company || !referrer) throw new Error('建立个人治疗师单位后读不回来');
  return { company, referrer };
}

/** 停用／重新啟用一位推薦人（他的後台帳號一起）。回影響的列數。 */
export async function setReferrerActive(id: number, active: boolean): Promise<number> {
  const p = requirePool();
  const [result] = await p.execute(
    'UPDATE referrers r JOIN admin_users a ON a.id = r.admin_user_id SET r.active = ?, a.active = ? WHERE r.id = ?',
    [active ? 1 : 0, active ? 1 : 0, id]
  );
  return (result as ResultSetHeader).affectedRows;
}

// ── 兌換碼（客戶 10/22，#110）──
//
// `redeem_batches`、`redeem_codes` 是森心康發給推薦人的碼，不是家長資料：全域管理員看全部（requireGlobal），
// 推薦人只看自己的（`referrerId` 取自工作階段，不收請求參數）。列在 `test/adminScope.structure.test.ts` 的 `GLOBAL_TABLES`。
// 這裡**不 JOIN users**（家長的手機號是家長資料）；用過的碼只帶家長編號與時間，對帳匯出（#113）另外一支。

export interface RedeemCodeRecord {
  id: number;
  batchId: number;
  /** 推薦人的碼有值；單位層的碼（#124）是 null。 */
  referrerId: number | null;
  /** 單位層的碼（#124）才有值。舊程式碼讀不到這一欄時是 null。 */
  companyId: number | null;
  code: string;
  months: number;
  status: 'unused' | 'used' | 'void';
  usedBy: number | null;
  usedAt: string | null;
  createdAt: string | null;
}

function rowToRedeemCode(row: any): RedeemCodeRecord {
  return {
    id: Number(row.id),
    batchId: Number(row.batch_id),
    referrerId: row.referrer_id === null || row.referrer_id === undefined ? null : Number(row.referrer_id),
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    code: row.code,
    months: Number(row.months),
    status: row.status === 'used' ? 'used' : row.status === 'void' ? 'void' : 'unused',
    usedBy: row.used_by === null || row.used_by === undefined ? null : Number(row.used_by),
    usedAt: toIso(row.used_at),
    createdAt: toIso(row.created_at),
  };
}

/** 一位推薦人的全部碼（新的在前）。 */
export async function listRedeemCodes(referrerId: number): Promise<RedeemCodeRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT c.id, c.batch_id, c.code, c.status, c.used_by, c.used_at, b.referrer_id, b.months, b.created_at
       FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id
      WHERE b.referrer_id = ?
      ORDER BY c.id DESC`,
    [referrerId]
  );
  return (rows as any[]).map(rowToRedeemCode);
}

/** 一個單位層的全部碼（#124，新的在前）。 */
export async function listUnitRedeemCodes(companyId: number): Promise<RedeemCodeRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT c.id, c.batch_id, c.code, c.status, c.used_by, c.used_at, b.referrer_id, b.company_id, b.months, b.created_at
       FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id
      WHERE b.company_id = ?
      ORDER BY c.id DESC`,
    [companyId]
  );
  return (rows as any[]).map(rowToRedeemCode);
}

/**
 * 替一位推薦人（`referrerId`）或一個單位（`companyId`，#124 單位層的碼）產一批碼，兩個恰好給一個。
 * 碼由 `generate` 給（伺服器用 crypto）；撞到既有的碼（UNIQUE）換一組再試，最多 5 次。
 * 一批在同一個交易裡：要嘛整批都在，要嘛一組都沒有。
 */
export async function createRedeemBatch(input: {
  referrerId?: number;
  companyId?: number;
  months: number;
  quantity: number;
  createdBy: number;
  generate: () => string;
}): Promise<RedeemCodeRecord[]> {
  if ((input.referrerId === undefined) === (input.companyId === undefined)) throw new Error('一批码要恰好发给一位推荐人或一个单位');
  const p = requirePool();
  const conn = await p.getConnection();
  let batchId: number;
  try {
    await conn.beginTransaction();
    // 推薦人的碼照舊那一句（關著時 SQL 不變）；單位層的碼才寫 company_id。
    const [batch] =
      input.companyId === undefined
        ? await conn.execute('INSERT INTO redeem_batches (referrer_id, months, quantity, created_by) VALUES (?, ?, ?, ?)', [
            input.referrerId ?? null,
            input.months,
            input.quantity,
            input.createdBy,
          ])
        : await conn.execute('INSERT INTO redeem_batches (company_id, months, quantity, created_by) VALUES (?, ?, ?, ?)', [
            input.companyId,
            input.months,
            input.quantity,
            input.createdBy,
          ]);
    batchId = (batch as ResultSetHeader).insertId;
    for (let i = 0; i < input.quantity; i++) {
      for (let attempt = 1; ; attempt++) {
        try {
          await conn.execute('INSERT INTO redeem_codes (batch_id, code) VALUES (?, ?)', [batchId, input.generate()]);
          break;
        } catch (err: any) {
          if (err?.code !== 'ER_DUP_ENTRY' || attempt >= 5) throw err;
        }
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const [rows] = await p.execute(
    `SELECT c.id, c.batch_id, c.code, c.status, c.used_by, c.used_at, b.referrer_id, b.months, b.created_at
       FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id
      WHERE c.batch_id = ? ORDER BY c.id ASC`,
    [batchId]
  );
  return (rows as any[]).map(rowToRedeemCode);
}

/** 作廢一組**還沒用**的碼。回影響的列數（用過的、已作廢的、不存在的都是 0）。 */
export async function voidRedeemCode(id: number): Promise<number> {
  const p = requirePool();
  const [result] = await p.execute(
    "UPDATE redeem_codes SET status = 'void', voided_at = NOW() WHERE id = ? AND status = 'unused'",
    [id]
  );
  return (result as ResultSetHeader).affectedRows;
}

// ── T2 優惠券（客戶 11/03，開關 `T2_COUPON`，`src/t2/coupon.ts`）──
// `coupon_batches`、`coupon_codes` 是森心康發的折扣碼，不是家長資料：只有全域管理員（requireGlobal）。
// 同兌換碼，**不 JOIN users**：用過的碼只帶家長編號與時間。列在 `test/adminScope.structure.test.ts` 的 `GLOBAL_TABLES`。

export interface CouponBatchRecord {
  id: number;
  note: string | null;
  discount: CouponDiscount;
  quantity: number;
  expiresOn: string | null;
  createdAt: string | null;
  unused: number;
  used: number;
  void: number;
}

export interface CouponCodeRecord {
  id: number;
  batchId: number;
  code: string;
  status: 'unused' | 'used' | 'void';
  usedBy: number | null;
  usedAt: string | null;
}

const couponStatusOf = (raw: unknown): CouponCodeRecord['status'] => (raw === 'used' ? 'used' : raw === 'void' ? 'void' : 'unused');

/** 全部批次（新的在前），附各狀態張數。 */
export async function listCouponBatches(): Promise<CouponBatchRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT b.id, b.note, b.discount_kind, b.discount_value, b.quantity,
            DATE_FORMAT(b.expires_on, '%Y-%m-%d') AS expires_on, b.created_at,
            SUM(c.status = 'unused') AS n_unused, SUM(c.status = 'used') AS n_used, SUM(c.status = 'void') AS n_void
       FROM coupon_batches b LEFT JOIN coupon_codes c ON c.batch_id = b.id
      GROUP BY b.id
      ORDER BY b.id DESC`
  );
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    note: r.note ?? null,
    discount: { kind: r.discount_kind === 'amount' ? 'amount' : 'percent', value: Number(r.discount_value) },
    quantity: Number(r.quantity),
    expiresOn: r.expires_on ?? null,
    createdAt: toIso(r.created_at),
    unused: Number(r.n_unused ?? 0),
    used: Number(r.n_used ?? 0),
    void: Number(r.n_void ?? 0),
  }));
}

/** 一批的每一張（依產生順序）。 */
export async function listCouponCodes(batchId: number): Promise<CouponCodeRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT c.id, c.batch_id, c.code, c.status, c.used_by, c.used_at
       FROM coupon_codes c
      WHERE c.batch_id = ?
      ORDER BY c.id ASC`,
    [batchId]
  );
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    batchId: Number(r.batch_id),
    code: r.code,
    status: couponStatusOf(r.status),
    usedBy: r.used_by === null || r.used_by === undefined ? null : Number(r.used_by),
    usedAt: toIso(r.used_at),
  }));
}

/** 產一批。同兌換碼：整批在同一個交易裡，撞到既有的碼換一組再試（最多 5 次）。回新批次的編號。 */
export async function createCouponBatch(input: {
  note: string | null;
  discount: CouponDiscount;
  quantity: number;
  expiresOn: string | null;
  createdBy: number;
  generate: () => string;
}): Promise<number> {
  const p = requirePool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [batch] = await conn.execute(
      'INSERT INTO coupon_batches (note, discount_kind, discount_value, quantity, expires_on, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [input.note, input.discount.kind, input.discount.value, input.quantity, input.expiresOn, input.createdBy]
    );
    const batchId = (batch as ResultSetHeader).insertId;
    for (let i = 0; i < input.quantity; i++) {
      for (let attempt = 1; ; attempt++) {
        try {
          await conn.execute('INSERT INTO coupon_codes (batch_id, code) VALUES (?, ?)', [batchId, input.generate()]);
          break;
        } catch (err: any) {
          if (err?.code !== 'ER_DUP_ENTRY' || attempt >= 5) throw err;
        }
      }
    }
    await conn.commit();
    return batchId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** 改一批的折法、到期日、備註（帶了才改）。之後開的訂單照新的收；已經開好的訂單金額不變。回影響的列數。 */
export async function updateCouponBatch(
  id: number,
  patch: { discount?: CouponDiscount; expiresOn?: string | null; note?: string | null }
): Promise<number> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.discount) {
    sets.push('discount_kind = ?', 'discount_value = ?');
    args.push(patch.discount.kind, patch.discount.value);
  }
  if (patch.expiresOn !== undefined) {
    sets.push('expires_on = ?');
    args.push(patch.expiresOn);
  }
  if (patch.note !== undefined) {
    sets.push('note = ?');
    args.push(patch.note);
  }
  if (sets.length === 0) return 0;
  const p = requirePool();
  const [result] = await p.execute(`UPDATE coupon_batches SET ${sets.join(', ')} WHERE id = ?`, [...args, id]);
  return (result as ResultSetHeader).affectedRows;
}

/** 作廢一張**還沒用**的。回影響的列數。 */
export async function voidCouponCode(id: number): Promise<number> {
  const p = requirePool();
  const [result] = await p.execute(
    "UPDATE coupon_codes SET status = 'void', voided_at = NOW() WHERE id = ? AND status = 'unused'",
    [id]
  );
  return (result as ResultSetHeader).affectedRows;
}

// ── 推薦人代填（客戶 10/22，#112）──
//
// 這兩支**刻意不帶** `${scope.sql}`，列在 `test/adminScope.structure.test.ts` 的 `CROSS_SCOPE_ALLOWLIST`：
// 代填的對象是「還不在推薦人名下」的家長（第一次代填才綁定），公司條件那一套表達不了。邊界改由這裡自己守：
//   - 以（推薦人的合作公司，手機號）找家長 —— 與家長端登入同一個鍵（ADR-0002），找不到就以同一個鍵建帳號
//   - 已綁在**別的**推薦人名下的家長一律擋下（`other`），一個字都不寫
//   - 只回孩子的姓名、生日、性別（填表要用），不回成績、報告、手機號以外的任何東西

export type ProxyLookup =
  | { status: 'new' }
  | { status: 'mine' | 'unbound'; child: { name: string; birthDate: string; gender: string } | null }
  | { status: 'other' };

/** 代填之前用手機號找家長（推薦人的合作公司、沒有就未歸屬）。 */
export async function proxyLookup(referrer: { id: number; companyId: number | null }, phone: string): Promise<ProxyLookup> {
  const p = requirePool();
  // 先找「已經綁在這位推薦人名下」的那一個帳號（不看公司）：家長可能是從某家合作公司的連結註冊、再用掉這位推薦人的兌換碼，
  // 帳號的公司與推薦人的不同；同一支手機號在別處另有一個帳號時，只照（推薦人的公司，手機號）找會找到另一位家長（2026-11-20 正式站）。
  // 找不到才照登入的鍵（推薦人的公司，手機號）。
  const [rows] = await p.execute(
    `SELECT u.id, rb.referrer_id, ud.child
       FROM users u
       LEFT JOIN referrer_bindings rb ON rb.user_id = u.id
       LEFT JOIN user_data ud ON ud.user_id = u.id
      WHERE u.phone = ? AND (rb.referrer_id <=> ? OR u.company_id <=> ?)
      ORDER BY (rb.referrer_id <=> ?) DESC, u.id ASC
      LIMIT 1`,
    [phone, referrer.id, referrer.companyId, referrer.id]
  );
  const row = (rows as any[])[0];
  if (!row) return { status: 'new' };
  if (row.referrer_id !== null && row.referrer_id !== undefined && Number(row.referrer_id) !== referrer.id) return { status: 'other' };
  const child = parseJson<any>(row.child, null);
  return {
    status: row.referrer_id === null || row.referrer_id === undefined ? 'unbound' : 'mine',
    child: child && typeof child.name === 'string'
      ? { name: child.name, birthDate: typeof child.birthDate === 'string' ? child.birthDate : '', gender: child.gender === 'girl' ? 'girl' : 'boy' }
      : null,
  };
}

export type ProxyFillResult =
  | { ok: true; userId: number; consumedCodeId: number | null; endsOn: string | null }
  | { ok: false; reason: 'other' };

/**
 * 代填，一個交易：找或建家長 → 擋別人名下的 → 寫孩子資料 → 寫一份「代填」快照 → 第一次代填才用掉該推薦人一組同月數的
 * 未用碼（沒有就先為他產一組再用掉，對帳表上一樣是一組）、發一段 `proxy` 使用權、綁定。再代填只覆蓋快照（舊的留著）、不再扣碼。
 * 任何一步失敗整個退回。
 */
export async function proxyFill(
  referrer: { id: number; companyId: number | null; adminUserId: number },
  input: {
    phone: string;
    child: { name: string; birthDate: string; gender: 'boy' | 'girl'; ageMonth: number };
    findings: { rulesVersion: string; toolkitVersion: string } & Record<string, unknown>;
    months: number;
    today: string;
    generateCode: () => string;
  }
): Promise<ProxyFillResult> {
  const p = requirePool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    // 1. 找或建家長：已經綁在這位推薦人名下的那一個帳號優先（同 `proxyLookup`），否則照登入的鍵（推薦人的公司，手機號），都沒有才建
    const [found] = await conn.execute(
      `SELECT u.id FROM users u LEFT JOIN referrer_bindings rb ON rb.user_id = u.id
        WHERE u.phone = ? AND (rb.referrer_id <=> ? OR u.company_id <=> ?)
        ORDER BY (rb.referrer_id <=> ?) DESC, u.id ASC LIMIT 1 FOR UPDATE`,
      [input.phone, referrer.id, referrer.companyId, referrer.id]
    );
    let userId: number;
    if ((found as any[])[0]) {
      userId = Number((found as any[])[0].id);
    } else {
      const [ins] = await conn.execute('INSERT INTO users (phone, company_id) VALUES (?, ?)', [input.phone, referrer.companyId]);
      userId = (ins as ResultSetHeader).insertId;
    }
    // 2. 別人名下的擋掉
    const [bindRows] = await conn.execute('SELECT referrer_id FROM referrer_bindings WHERE user_id = ? FOR UPDATE', [userId]);
    const boundTo = (bindRows as any[])[0]?.referrer_id;
    if (boundTo !== undefined && boundTo !== null && Number(boundTo) !== referrer.id) {
      await conn.rollback();
      return { ok: false, reason: 'other' };
    }
    // 3. 孩子資料、4. 代填快照
    await writeProxyChildAndSnapshot(conn, userId, input);
    // 5. 第一次代填：扣一組碼、發使用權、綁定
    const [proxyPass] = await conn.execute("SELECT 1 FROM training_passes WHERE user_id = ? AND source = 'proxy' LIMIT 1", [userId]);
    let consumedCodeId: number | null = null;
    if ((proxyPass as any[]).length === 0) {
      const [free] = await conn.execute(
        `SELECT c.id FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id
          WHERE b.referrer_id = ? AND b.months = ? AND c.status = 'unused'
          ORDER BY c.id ASC LIMIT 1 FOR UPDATE`,
        [referrer.id, input.months]
      );
      if ((free as any[])[0]) {
        consumedCodeId = Number((free as any[])[0].id);
      } else {
        const [batch] = await conn.execute(
          'INSERT INTO redeem_batches (referrer_id, months, quantity, created_by) VALUES (?, ?, 1, ?)',
          [referrer.id, input.months, referrer.adminUserId]
        );
        const [code] = await conn.execute('INSERT INTO redeem_codes (batch_id, code) VALUES (?, ?)', [(batch as ResultSetHeader).insertId, input.generateCode()]);
        consumedCodeId = (code as ResultSetHeader).insertId;
      }
      await useCodeAndIssueProxyPass(conn, userId, consumedCodeId, input);
      await conn.execute(
        "INSERT IGNORE INTO referrer_bindings (user_id, referrer_id, source, ref_id) VALUES (?, ?, 'proxy', ?)",
        [userId, referrer.id, consumedCodeId]
      );
    }
    await conn.commit();
    return { ok: true, userId, consumedCodeId, endsOn: null };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

type ProxyConn = Awaited<ReturnType<Pool['getConnection']>>;

/** 代填的孩子資料（只改姓名、生日、性別、月齡，其他欄位照留）與一份新的代填快照（舊的留著）。 */
async function writeProxyChildAndSnapshot(
  conn: ProxyConn,
  userId: number,
  input: { child: { name: string; birthDate: string; gender: 'boy' | 'girl'; ageMonth: number }; findings: { rulesVersion: string; toolkitVersion: string } & Record<string, unknown> }
): Promise<void> {
  const [dataRows] = await conn.execute('SELECT child FROM user_data WHERE user_id = ? FOR UPDATE', [userId]);
  const existing = (dataRows as any[])[0];
  const prevChild = existing ? parseJson<any>(existing.child, null) : null;
  const child = { ...(prevChild ?? {}), name: input.child.name, birthDate: input.child.birthDate, gender: input.child.gender, ageMonth: input.child.ageMonth };
  if (existing) {
    await conn.execute('UPDATE user_data SET child = ? WHERE user_id = ?', [JSON.stringify(child), userId]);
  } else {
    await conn.execute(
      "INSERT INTO user_data (user_id, child, completed_scores, orders, report_history) VALUES (?, ?, '[]', '[]', '[]')",
      [userId, JSON.stringify(child)]
    );
  }
  await conn.execute(
    `INSERT INTO t2_findings (user_id, rules_version, toolkit_version, findings, prose, is_ai_generated, ai_engine)
     VALUES (?, ?, ?, ?, NULL, 0, 'proxy')`,
    [userId, input.findings.rulesVersion, input.findings.toolkitVersion, JSON.stringify(input.findings)]
  );
}

/** 用掉那一組碼、發一段 `proxy` 使用權（接在既有的後面）。 */
async function useCodeAndIssueProxyPass(conn: ProxyConn, userId: number, codeId: number, input: { months: number; today: string }): Promise<void> {
  await conn.execute("UPDATE redeem_codes SET status = 'used', used_by = ?, used_at = NOW() WHERE id = ?", [userId, codeId]);
  const [passRows] = await conn.execute(
    `SELECT DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on
       FROM training_passes WHERE user_id = ? FOR UPDATE`,
    [userId]
  );
  const passes = (passRows as any[]).map(r => ({ startsOn: String(r.starts_on), endsOn: String(r.ends_on), months: 1 as const, source: 'proxy' as const }));
  const range = nextPassRange(passes, input.today, input.months as 1 | 3 | 6 | 12);
  await conn.execute(
    "INSERT INTO training_passes (user_id, starts_on, ends_on, months, source, ref_id, unique_key) VALUES (?, ?, ?, ?, 'proxy', ?, ?)",
    [userId, range.startsOn, range.endsOn, input.months, codeId, `proxy:${codeId}`]
  );
}

// ── 代填（服務關係開關開著，#124）──
//
// 與上面兩支同理列在 `CROSS_SCOPE_ALLOWLIST`（對象可能還沒有服務關係，範圍條件表達不了），邊界改由這裡守：
//   - 以手機號找啟用中的帳號（A 的身分只看手機號）；同一支有好幾個時，服務關係在本單位、標注給我的優先
//   - 能不能碰照 `proxyAccess`：別單位的、（推薦人）不是標注給自己的一律 `other`；沒有服務關係（直屬）的都可以，一個字都不寫
//   - 只回孩子的姓名、生日、性別

const SERVED_LOOKUP_SQL = `SELECT u.id, u.company_id AS screening_company_id, sr.company_id AS cur_company_id, sr.referrer_id AS cur_referrer_id, ud.child
       FROM users u
       LEFT JOIN service_relations sr ON sr.user_id = u.id
       LEFT JOIN user_data ud ON ud.user_id = u.id
      WHERE u.phone = ? AND u.disabled_at IS NULL
      ORDER BY (sr.company_id <=> ?) DESC, (sr.referrer_id <=> ?) DESC, u.id ASC
      LIMIT 1`;

const servedLookupParams = (party: ProxyParty, phone: string) => [phone, party.companyId, party.kind === 'referrer' ? party.referrerId : null];

function servedRelationOf(row: any): ServiceRelation | null {
  return row.cur_company_id === null || row.cur_company_id === undefined
    ? null
    : { companyId: Number(row.cur_company_id), referrerId: row.cur_referrer_id === null ? null : Number(row.cur_referrer_id) };
}

/** 代填之前用手機號找家長（服務關係開關開著）。 */
export async function proxyLookupServed(party: ProxyParty, phone: string): Promise<ProxyLookup> {
  const p = requirePool();
  const [rows] = await p.execute(SERVED_LOOKUP_SQL, servedLookupParams(party, phone));
  const row = (rows as any[])[0];
  if (!row) return { status: 'new' };
  const access = proxyAccess(party, servedRelationOf(row), nullableId(row.screening_company_id));
  if (access === 'other') return { status: 'other' };
  const child = parseJson<any>(row.child, null);
  return {
    status: access,
    child: child && typeof child.name === 'string'
      ? { name: child.name, birthDate: typeof child.birthDate === 'string' ? child.birthDate : '', gender: child.gender === 'girl' ? 'girl' : 'boy' }
      : null,
  };
}

/**
 * 代填（服務關係開關開著），一個交易：找或建家長（新帳號的篩查渠道＝代填的單位）→ 擋不能碰的 → 孩子資料與快照 →
 * 第一次代填扣一組碼（推薦人的、或單位層的；沒有就先產一組）、發使用權、推薦人代填照舊寫推薦綁定 →
 * 還沒有服務關係就掛上（推薦人＝他與他的單位；單位＝那個單位、推薦人空），寫一列紀錄（後台、原因＝兌換碼）。
 */
export async function proxyFillServed(
  party: ProxyParty,
  adminUserId: number,
  input: {
    phone: string;
    child: { name: string; birthDate: string; gender: 'boy' | 'girl'; ageMonth: number };
    findings: { rulesVersion: string; toolkitVersion: string } & Record<string, unknown>;
    months: number;
    today: string;
    generateCode: () => string;
  }
): Promise<ProxyFillResult> {
  const p = requirePool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [found] = await conn.execute(`${SERVED_LOOKUP_SQL} FOR UPDATE`, servedLookupParams(party, input.phone));
    const row = (found as any[])[0];
    let userId: number;
    let current: ServiceRelation | null = null;
    if (row) {
      userId = Number(row.id);
      current = servedRelationOf(row);
      if (proxyAccess(party, current, nullableId(row.screening_company_id)) === 'other') {
        await conn.rollback();
        return { ok: false, reason: 'other' };
      }
    } else {
      const [ins] = await conn.execute('INSERT INTO users (phone, company_id) VALUES (?, ?)', [input.phone, party.companyId]);
      userId = (ins as ResultSetHeader).insertId;
    }
    await writeProxyChildAndSnapshot(conn, userId, input);

    const [proxyPass] = await conn.execute("SELECT 1 FROM training_passes WHERE user_id = ? AND source = 'proxy' LIMIT 1", [userId]);
    let consumedCodeId: number | null = null;
    if ((proxyPass as any[]).length === 0) {
      const ownerColumn = party.kind === 'referrer' ? 'b.referrer_id' : 'b.company_id';
      const ownerId = party.kind === 'referrer' ? party.referrerId : party.companyId;
      const [free] = await conn.execute(
        `SELECT c.id FROM redeem_codes c JOIN redeem_batches b ON b.id = c.batch_id
          WHERE ${ownerColumn} = ? AND b.months = ? AND c.status = 'unused'
          ORDER BY c.id ASC LIMIT 1 FOR UPDATE`,
        [ownerId, input.months]
      );
      if ((free as any[])[0]) {
        consumedCodeId = Number((free as any[])[0].id);
      } else {
        const [batch] = await conn.execute(
          party.kind === 'referrer'
            ? 'INSERT INTO redeem_batches (referrer_id, months, quantity, created_by) VALUES (?, ?, 1, ?)'
            : 'INSERT INTO redeem_batches (company_id, months, quantity, created_by) VALUES (?, ?, 1, ?)',
          [ownerId, input.months, adminUserId]
        );
        const [code] = await conn.execute('INSERT INTO redeem_codes (batch_id, code) VALUES (?, ?)', [(batch as ResultSetHeader).insertId, input.generateCode()]);
        consumedCodeId = (code as ResultSetHeader).insertId;
      }
      await useCodeAndIssueProxyPass(conn, userId, consumedCodeId, input);
      if (party.kind === 'referrer') {
        await conn.execute(
          "INSERT IGNORE INTO referrer_bindings (user_id, referrer_id, source, ref_id) VALUES (?, ?, 'proxy', ?)",
          [userId, party.referrerId, consumedCodeId]
        );
      }
    }

    if (current === null) {
      const to = proxyTarget(party);
      await conn.execute('INSERT INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?)', [userId, to.companyId, to.referrerId]);
      await conn.execute(
        `INSERT INTO service_relation_changes (user_id, to_company_id, to_referrer_id, actor, reason, admin_user_id)
         VALUES (?, ?, ?, 'admin', 'code', ?)`,
        [userId, to.companyId, to.referrerId, adminUserId]
      );
    }
    await conn.commit();
    return { ok: true, userId, consumedCodeId, endsOn: null };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── 兌換碼對帳（客戶 10/22，#113）──
//
// 唯一一支跨所有推薦人、帶出家長手機號的查詢 —— 列在 `CROSS_SCOPE_ALLOWLIST`：路由限全域管理員，每次匯出都記一筆
// `admin_exports`（範圍 `all`），記不下就不給檔。

export interface RedeemLedgerRow {
  /** 單位層的碼（#124）這三格是 null。 */
  referrerId: number | null;
  referrerName: string | null;
  referrerKind: 'channel' | 'therapist' | null;
  /** 推薦人隸屬的單位（#122：兌換碼佣金算推薦人與單位兩方；單位層的碼就是那個單位）；沒有是 null。 */
  companyId: number | null;
  companyName: string | null;
  code: string;
  months: number;
  status: 'unused' | 'used' | 'void';
  usedByPhone: string | null;
  usedAt: string | null;
  /** 這一組發出的那段使用權的迄日（兌換或代填；`code:<編號>`／`proxy:<編號>`）。 */
  passEndsOn: string | null;
}

/** @param opts.unitCodes 服務關係開關開著（#124）才讀單位層的碼（`b.company_id`）；關著與以前同一句，遷移沒跑也匯得出來。 */
export async function listRedeemLedger(opts: { unitCodes?: boolean } = {}): Promise<RedeemLedgerRow[]> {
  const p = requirePool();
  const unitJoin = opts.unitCodes ? 'COALESCE(b.company_id, r.company_id)' : 'r.company_id';
  const [rows] = await p.execute(
    `SELECT r.id AS referrer_id, r.name AS referrer_name, r.kind AS referrer_kind, rc.id AS company_id, rc.name AS company_name,
            c.code, b.months, c.status, u.phone AS used_by_phone, c.used_at,
            (SELECT DATE_FORMAT(MAX(tp.ends_on), '%Y-%m-%d') FROM training_passes tp
              WHERE tp.unique_key IN (CONCAT('code:', c.id), CONCAT('proxy:', c.id))) AS pass_ends_on
       FROM redeem_codes c
       JOIN redeem_batches b ON b.id = c.batch_id
       LEFT JOIN referrers r ON r.id = b.referrer_id
       LEFT JOIN companies rc ON rc.id = ${unitJoin}
       LEFT JOIN users u ON u.id = c.used_by
      ORDER BY r.id ASC, c.id ASC`,
    []
  );
  return (rows as any[]).map(row => ({
    referrerId: row.referrer_id === null || row.referrer_id === undefined ? null : Number(row.referrer_id),
    referrerName: row.referrer_name ?? null,
    referrerKind: row.referrer_id === null || row.referrer_id === undefined ? null : row.referrer_kind === 'therapist' ? 'therapist' : 'channel',
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    companyName: row.company_name ?? null,
    code: row.code,
    months: Number(row.months),
    status: row.status === 'used' ? 'used' : row.status === 'void' ? 'void' : 'unused',
    usedByPhone: row.used_by_phone ?? null,
    usedAt: toIso(row.used_at),
    passEndsOn: row.pass_ends_on ?? null,
  }));
}

// ── 清分（客戶 11/03，開關 `REVENUE_SPLIT`，ADR-0016，`src/revenueSplit/split.ts`）──
// `revenue_split_rates` 是森心康的比例設定，不是家長資料；對帳讀 `payments`（跨所有家長、只帶家長編號，不 JOIN users），
// 路由限全域管理員（requireGlobal），每次匯出記一筆 admin_exports。列在 `test/adminScope.structure.test.ts`。

export interface SplitRateRecord {
  scope: 'default' | 'company' | 'referrer';
  refId: number;
  platformBp: number | null;
  companyBp: number | null;
  /**
   * 篩查渠道比例（#122）：只在服務關係開著時讀寫（`listSplitRates({ screening: true })`、`setSplitRate` 帶了這一欄）；
   * 關著不碰這一欄（還沒跑 `2026-11-24-split-screening.sql` 也讀得到）。
   */
  screeningBp?: number | null;
}

export async function listSplitRates(opts: { screening?: boolean } = {}): Promise<SplitRateRecord[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    opts.screening
      ? 'SELECT scope, ref_id, platform_bp, company_bp, screening_bp FROM revenue_split_rates ORDER BY scope, ref_id'
      : 'SELECT scope, ref_id, platform_bp, company_bp FROM revenue_split_rates ORDER BY scope, ref_id',
    []
  );
  return (rows as any[]).map(r => ({
    scope: r.scope === 'company' ? 'company' : r.scope === 'referrer' ? 'referrer' : 'default',
    refId: Number(r.ref_id),
    platformBp: r.platform_bp === null ? null : Number(r.platform_bp),
    companyBp: r.company_bp === null ? null : Number(r.company_bp),
    ...(opts.screening ? { screeningBp: r.screening_bp === null || r.screening_bp === undefined ? null : Number(r.screening_bp) } : {}),
  }));
}

/** 寫一組比例；都是 `null` 就刪掉那一列（沿用上一層）。不留修改紀錄（規格）。 */
export async function setSplitRate(input: SplitRateRecord): Promise<void> {
  const p = requirePool();
  if (input.screeningBp !== undefined) {
    // 服務關係開著（#122）：三個比例一起換。
    if (input.platformBp === null && input.companyBp === null && input.screeningBp === null) {
      await p.execute('DELETE FROM revenue_split_rates WHERE scope = ? AND ref_id = ?', [input.scope, input.refId]);
      return;
    }
    await p.execute(
      'REPLACE INTO revenue_split_rates (scope, ref_id, platform_bp, company_bp, screening_bp) VALUES (?, ?, ?, ?, ?)',
      [input.scope, input.refId, input.platformBp, input.companyBp, input.screeningBp]
    );
    return;
  }
  if (input.platformBp === null && input.companyBp === null) {
    await p.execute('DELETE FROM revenue_split_rates WHERE scope = ? AND ref_id = ?', [input.scope, input.refId]);
    return;
  }
  await p.execute(
    // 一組（scope, ref_id）一列，整列換掉：兩個比例都是這一次送來的（沒送的那一個就是 NULL＝沿用上一層）。
    'REPLACE INTO revenue_split_rates (scope, ref_id, platform_bp, company_bp) VALUES (?, ?, ?, ?)',
    [input.scope, input.refId, input.platformBp, input.companyBp]
  );
}

export interface SplitOrderRow {
  id: number;
  userId: number;
  outTradeNo: string;
  transactionId: string | null;
  scope: 't2' | 't3' | 'plan';
  months: number | null;
  amountFen: number;
  status: 'success' | 'refunded';
  paidAt: string | null;
  /** 原樣（`parseSnapshot` 讀）；開關打開之前的訂單是 null。 */
  snapshot: unknown;
}

/**
 * 一段日期（頭尾都含，`YYYY-MM-DD`，資料庫時區）付款成功或已退款的訂單，依付款時間。
 * 超過 `SPLIT_ORDERS_MAX` 筆丟 `code = SPLIT_TOO_MANY` 的錯誤 —— 不回截掉一半的清單（合計會少算）。
 */
export async function listSplitOrders(from: string, to: string): Promise<SplitOrderRow[]> {
  const p = requirePool();
  const [rows] = await p.execute(
    `SELECT pay.id, pay.user_id, pay.out_trade_no, pay.transaction_id, pay.scope, pay.months, pay.amount_fen, pay.status,
            pay.paid_at, pay.split_snapshot
       FROM payments pay
      WHERE pay.status IN ('success', 'refunded') AND pay.paid_at >= ? AND pay.paid_at < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY pay.paid_at ASC, pay.id ASC
      LIMIT ${SPLIT_ORDERS_MAX + 1}`,
    [from, to]
  );
  if ((rows as any[]).length > SPLIT_ORDERS_MAX) {
    throw Object.assign(new Error(`more than ${SPLIT_ORDERS_MAX} orders in ${from}..${to}`), { code: SPLIT_TOO_MANY });
  }
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    outTradeNo: String(r.out_trade_no),
    transactionId: r.transaction_id ?? null,
    scope: r.scope === 't2' ? 't2' : r.scope === 'plan' ? 'plan' : 't3',
    months: r.months === null || r.months === undefined ? null : Number(r.months),
    amountFen: Number(r.amount_fen),
    status: r.status === 'refunded' ? 'refunded' : 'success',
    paidAt: toIso(r.paid_at),
    snapshot: r.split_snapshot ?? null,
  }));
}

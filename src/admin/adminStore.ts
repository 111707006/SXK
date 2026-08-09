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
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { getPool, isConfigured } from '../db/mysql';
import { companyWhereSql, type CompanyCondition } from './companyScope';
import type { AssessmentRecord, DimensionScore } from '../types';
import { calculateAgeMonth } from '../utils/dateUtils';
import { ageBandOf, latestAssessedAgeMonth } from '../utils/ageBandDrift';

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
  /** 被標記（黃燈或紅燈）的維度，讓公司知道該先聯絡誰。 */
  flaggedDimensions: Array<{ dimensionId: string; dimensionName: string; status: string }>;
  /** 最近一次篩查資料的更新時間；沒做過篩查則為 null。 */
  screenedAt: string | null;
  registeredAt: string | null;
  hasBooking: boolean;
}

export interface ParentBooking {
  id: number;
  specialistId: string;
  specialistName: string | null;
  parentName: string;
  parentPhone: string;
  preferredSlot: string | null;
  reportSummary: string | null;
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
  active: boolean;
  createdAt: string | null;
}

export interface AdminUserRecord {
  id: number;
  email: string;
  role: 'global_admin' | 'company_member';
  companyId: number | null;
  active: boolean;
  createdAt: string | null;
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

function flaggedFrom(scores: DimensionScore[]): ParentListItem['flaggedDimensions'] {
  return scores
    .filter(s => s.status === 'delay' || s.status === 'borderline')
    .map(s => ({ dimensionId: s.dimensionId, dimensionName: s.dimensionName, status: s.status }));
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
    screenedAt: toIso(row.screened_at),
    registeredAt: toIso(row.created_at),
    hasBooking: Number(row.booking_count) > 0,
  };
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
    active: Number(row.active) === 1,
    createdAt: toIso(row.created_at),
  };
}

function rowToAdminUser(row: any): AdminUserRecord {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    companyId: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    active: Number(row.active) === 1,
    createdAt: toIso(row.created_at),
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

  const [rows] = await p.execute(
    `SELECT u.id, u.email, u.phone, u.company_id, u.created_at,
            ud.child, ud.completed_scores, ud.updated_at AS screened_at,
            (SELECT COUNT(*) FROM expert_bookings b WHERE b.user_id = u.id) AS booking_count
       FROM users u
       LEFT JOIN user_data ud ON ud.user_id = u.id
      WHERE ${scope.sql}
      ${bookedFilter}
      ORDER BY COALESCE(ud.updated_at, u.created_at) ${order}
      LIMIT 500`,
    scope.params
  );
  return (rows as any[]).map(rowToListItem);
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
            (SELECT COUNT(*) FROM expert_bookings b WHERE b.user_id = u.id) AS booking_count
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
            b.report_summary, b.status, b.created_at,
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
      status: b.status,
      createdAt: toIso(b.created_at),
    })),
  };
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

export async function updateScopedCompanyWebhook(
  condition: CompanyCondition,
  webhookUrl: string | null
): Promise<number> {
  if (condition.kind !== 'company') return 0;
  const p = requirePool();
  const scope = companyWhereSql(condition, 'c.id');
  const [result] = await p.execute(
    `UPDATE companies c SET c.wecom_webhook_url = ? WHERE ${scope.sql}`,
    [webhookUrl, ...scope.params]
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

export async function createCompany(name: string, slug: string): Promise<CompanyRecord> {
  const p = requirePool();
  const [result] = await p.execute('INSERT INTO companies (name, slug) VALUES (?, ?)', [name, slug]);
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
  const [rows] = await p.execute('SELECT * FROM admin_users WHERE email = ? LIMIT 1', [email]);
  const row = (rows as any[])[0];
  return row ? { ...rowToAdminUser(row), passwordHash: row.password } : null;
}

export async function findAdminUserById(id: number): Promise<AdminUserRecord | null> {
  const p = requirePool();
  const [rows] = await p.execute(
    'SELECT id, email, role, company_id, active, created_at FROM admin_users WHERE id = ? LIMIT 1',
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

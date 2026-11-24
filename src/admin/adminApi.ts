/**
 * 管理中心的前端 API 客戶端。
 *
 * 工作階段 token 與家長端**分開存放**（不同的 localStorage 鍵），與後端兩套簽章
 * 相對應。共用一個鍵會讓「後台成員在同一台電腦上也是家長」變成一個會互相踢掉
 * 對方登入狀態的 bug，而那種 bug 在後台最不該出現。
 */

import type { CouponDiscount } from '../t2/coupon';
import type { ServiceChange, ServiceTargets, ServiceView } from '../serviceRelations/adminView';
import type { LedgerPartyTotal, LedgerRow, LedgerTotals } from '../revenueSplit/ledger';
import type { AdminReceiver, AdminSharingRecord } from '../profitSharing/adminRoutes';
import type { PartyKind, ProfitSharingConfig, ReceiverType } from '../profitSharing/plan';
import type { RunResult } from '../profitSharing/run';
/** 企業微信客服二維碼：預設那張與每家公司的（鍵是公司 id），都是 `/media/wecom/…?v=` 網址。 */
export interface WecomQrList {
  default: string | null;
  companies: Record<number, string>;
}
import type { HomeMediaItem, HomeMediaKind, HomeMediaSlot } from '../homeMedia/shape';
import type { LegalDoc, LegalDocKey, LegalDocs } from '../legal/shape';
import type { UnitKind } from './units';
import type { UnitDeletePreview } from './unitDeletion';
import type { AdminCenterShape } from './companyScope';
import type { AssessmentRecord } from '../types';
import type { ActivityImportReport, ActivityPatch } from '../utils/activityAdmin';
import type { Activity } from '../t2/types';
import type { ScreeningTotal } from './adminView';
import type { T2ReportEntry } from '../components/T2Report';
import type { SummaryOptions, SummaryPage } from './parentSummary';

const TOKEN_KEY = 'sxk_admin_token';

export interface AdminIdentityView {
  /** `referrer`：推薦人（渠道商、治療師，#93），只看綁在自己名下的家長。 */
  role: 'global_admin' | 'company_member' | 'referrer';
  email: string;
  companyId: number | null;
  selection: { kind: 'company'; companyId: number } | { kind: 'unassigned' } | null;
  /** 單位管理者同時是推薦人（個人治療師單位的那個帳號，#117）；只有這種帳號才帶，值恆為 true。 */
  referrer?: true;
}

/** 清分（ADR-0016）的一組比例（萬分比；`null`＝沿用上一層）。 */
export interface AdminSplitRate {
  scope: 'default' | 'company' | 'referrer';
  refId: number;
  platformBp: number | null;
  companyBp: number | null;
  /** 篩查渠道比例（#122）：只有伺服器的清分改看服務關係時才有；只在單位那一層。 */
  screeningBp?: number | null;
}

export interface AdminSplitSettings {
  feeBp: number;
  /** 清分改看服務關係（#122）：單位那一層多一個篩查渠道比例可設。沒有這一欄＝關。 */
  screening?: boolean;
  /** 微信分账開關（`PROFIT_SHARING`）。`false` 時畫面不打 `/profit-sharing`；沒有這一欄（舊伺服器）照舊去打、404 當關著。 */
  profitSharing?: boolean;
  fallback: { platformBp: number; companyBp: number };
  rates: AdminSplitRate[];
  companies: Array<{ id: number; name: string; active: boolean }>;
  referrers: Array<{ id: number; name: string; kind: 'channel' | 'therapist'; companyId: number | null; companyName: string | null; active: boolean }>;
}

export interface AdminSplitOrders {
  from: string;
  to: string;
  rows: LedgerRow[];
  totals: LedgerTotals;
  byParty: LedgerPartyTotal[];
}

/** 微信分账（ADR-0017）：`GET /api/admin/profit-sharing`。 */
export interface AdminProfitSharing {
  config: ProfitSharingConfig;
  ready: boolean;
  receivers: AdminReceiver[];
  records: Array<Omit<AdminSharingRecord, 'snapshot'>>;
}

/** 一批 T2 優惠券（`src/admin/adminStore.ts` 的 `CouponBatchRecord`）。 */
export interface AdminCouponBatch {
  id: number;
  /** 發給哪位推薦人（2026-11-25 起必填）；之前產的批次是 null。 */
  referrerId: number | null;
  referrerName: string | null;
  note: string | null;
  discount: CouponDiscount;
  quantity: number;
  expiresOn: string | null;
  createdAt: string | null;
  unused: number;
  used: number;
  void: number;
}

/** 一張 T2 優惠券（`CouponCodeRecord`）。 */
export interface AdminCouponCode {
  id: number;
  batchId: number;
  code: string;
  status: 'unused' | 'used' | 'void';
  usedBy: number | null;
  usedAt: string | null;
}

/** 一組兌換碼（`src/admin/adminStore.ts` 的 `RedeemCodeRecord`）。 */
export interface AdminRedeemCode {
  id: number;
  batchId: number;
  referrerId: number;
  code: string;
  months: number;
  status: 'unused' | 'used' | 'void';
  usedBy: number | null;
  usedAt: string | null;
  createdAt: string | null;
}

/** 一位推薦人（`src/admin/adminStore.ts` 的 `ReferrerRecord`）。 */
export interface AdminReferrer {
  id: number;
  adminUserId: number;
  email: string;
  name: string;
  phone: string;
  kind: 'channel' | 'therapist';
  companyId: number | null;
  companyName: string | null;
  /** 所屬單位的進站代號與類型、推薦人代號（#117）：畫個人連結用（`src/admin/units.ts` 的 `referrerEntryUrl`）。 */
  companySlug?: string | null;
  companyKind?: UnitKind | null;
  code?: string | null;
  active: boolean;
  createdAt: string | null;
}

export interface AdminCompany {
  id: number;
  name: string;
  slug: string;
  wecomWebhookUrl: string | null;
  /** 家長端頁首與登入卡上的 LOGO 網址。`null` 代表用建置內建的字標。 */
  logoUrl: string | null;
  /** 合作單位的類型（#117，只在 A 畫）。舊的伺服器不帶。 */
  kind?: UnitKind;
  active: boolean;
}

export interface AdminParentListItem {
  id: number;
  email: string | null;
  phone: string | null;
  companyId: number | null;
  childName: string | null;
  childAgeMonth: number | null;
  childGender: string | null;
  flaggedDimensions: Array<{
    dimensionId: string;
    dimensionName: string;
    status: string;
    score: number;
    maxScore: number;
  }>;
  /** T1 總分；還沒做篩查是 null。 */
  screeningTotal: ScreeningTotal | null;
  screenedAt: string | null;
  registeredAt: string | null;
  hasBooking: boolean;
  /** B→A 交接的邀請（ADR-0009）：最近一次送出成功的邀請簡訊、交接碼最近一次被用（＝到過 A）。A 兩個都是 null。 */
  lastInvitedAt: string | null;
  handoffUsedAt: string | null;
  /** 從專案 B 轉進來的（ADR-0009，只有 A 會有）：第一次轉入的時間與那時的合作公司；自己進站的是 null。 */
  handoffSource: { at: string; companyName: string | null } | null;
  /** 服務關係開關開著才有（#119）：現在服務他的單位與推薦人（null＝森心康直属）、篩查渠道（改派不變）。 */
  service?: ServiceView;
  screeningChannel?: string;
}

export interface AdminInviteConfig {
  enabled: boolean;
  /** 邀請範本設好沒；沒好時 `missing` 列出缺的環境變數。 */
  ready?: boolean;
  missing?: string[];
}

export interface AdminInviteReport {
  sent: number[];
  skipped: Array<{ userId: number; reason: string }>;
  failed: Array<{ userId: number; detail: string }>;
}

export interface AdminParentDetail extends AdminParentListItem {
  /**
   * 最近一次篩查當下的測評月齡與年齡段。`childAgeMonth` 是照今天算的實足月齡，
   * 孩子跨段之後兩者會分岔 —— 而分數是照當時那一段的判準算出來的。
   */
  assessedAgeMonth: number | null;
  assessedBandName: string | null;
  scores: Array<{
    dimensionId: string; dimensionName: string; tierId: string;
    score: number; maxScore: number; status: string; completedAt: string;
  }>;
  /**
   * 這位家長歷次生成的報告，最完整的那一份型別（ADR-0007）。
   *
   * 先前這裡手寫了一個子集，漏掉 `child`、`scores` 與 `criticalMetrics` ——
   * 資料一直是完整的（後端回的就是 `AssessmentRecord[]`），只有型別以為它不是。
   * 後台要畫的是家長看到的那一份報告，而那需要快照裡的孩子與成績，不只文字。
   */
  reportHistory: AssessmentRecord[];
  /**
   * 這位家長最新的一份 T2 報告快照（#67），照存的樣子；沒做過是 `null`。
   * **只有專案 A 有這一欄**（B 沒有 T2，後端不回）—— 畫面看 `t2Report &&`，兩種「沒有」都不畫。
   */
  t2Report?: T2ReportEntry | null;
  bookings: Array<{
    id: number; specialistId: string; specialistName: string | null;
    parentName: string; parentPhone: string; preferredSlot: string | null;
    reportSummary: string | null; status: string; createdAt: string | null;
    /**
     * 四種服務中的哪一種（issue #21）。
     *
     * 型別是 `string` 而不是 `ServiceType`：這個值一路來自資料庫，而遷移之前
     * 存下的舊列讀出來可能是任何東西。畫面該做的是把認不得的值顯示成
     * 「未记录服务类型」（見 `serviceTypeLabel`），不是假設它不會發生。
     */
    serviceType: string;
  }>;
}

export interface AdminSpecialist {
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

export interface AdminUser {
  id: number;
  email: string;
  /** 推薦人帳號（#93）也在這張表裡：伺服器回 `referrer`，`companyId` 一律 null（他的單位記在 `referrers`）。 */
  role: 'global_admin' | 'company_member' | 'referrer';
  companyId: number | null;
  active: boolean;
}

export interface CompanySummaryRow {
  companyId: number | null;
  companyName: string;
  parentCount: number;
  screenedCount: number;
  bookingCount: number;
}

/**
 * localStorage 的存取一律包起來 —— 與 `src/utils/attribution.ts` 同一個理由：
 * 隱私模式與停用網站資料儲存的瀏覽器會讓 `setItem` 直接拋例外。沒有這層防護，
 * 一次登入會因為存不下 token 而整個失敗，畫面顯示一句瀏覽器的英文錯誤，
 * 而使用者的帳號密碼其實完全正確。
 *
 * 存不下的後果是「這次分頁關掉就要重登」，那是可以接受的降級；
 * 「登入不了」不是。
 */
export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 存不下就存不下。工作階段仍然在記憶體裡有效（identity 已經在 state 上），
    // 只是重新整理之後要再登入一次。
  }
}

/** 後端回的錯誤代碼，畫面據此分流。 */
export type AdminErrorCode =
  | 'ADMIN_UNAVAILABLE'
  | 'ADMIN_UNAUTHENTICATED'
  | 'NO_COMPANY_SELECTED'
  | 'FORBIDDEN'
  /** 有付款紀錄的家長刪不得（ADR-0006）。付款是對帳憑證。 */
  | 'HAS_PAYMENTS'
  | 'UNKNOWN';

export class AdminApiError extends Error {
  constructor(message: string, readonly code: AdminErrorCode, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const resp = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!resp.ok) {
    let body: any = {};
    try {
      body = await resp.json();
    } catch {
      // 非 JSON 的錯誤（例如反向代理擋掉）—— 用狀態碼說話，不假裝知道原因。
    }
    throw new AdminApiError(
      body.error || `请求失败（HTTP ${resp.status}）`,
      (body.code as AdminErrorCode) || 'UNKNOWN',
      resp.status
    );
  }
  return resp.json() as Promise<T>;
}

/**
 * 下載一個檔案（後台的導出）。錯誤與 `request` 同一套；成功時回檔案本體與伺服器給的檔名
 * （`Content-Disposition` 的 `filename*`），讀不到檔名才用 `fallbackName`。
 */
async function download(path: string, init: RequestInit, fallbackName: string): Promise<{ blob: Blob; fileName: string }> {
  const token = getAdminToken();
  const resp = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!resp.ok) {
    let body: any = {};
    try {
      body = await resp.json();
    } catch {
      // 同 `request`。
    }
    throw new AdminApiError(
      body.error || `请求失败（HTTP ${resp.status}）`,
      (body.code as AdminErrorCode) || 'UNKNOWN',
      resp.status
    );
  }
  const match = /filename\*=UTF-8''([^;]+)/i.exec(resp.headers.get('Content-Disposition') || '');
  let fileName = fallbackName;
  if (match) {
    try {
      fileName = decodeURIComponent(match[1]);
    } catch {
      // 留著預設檔名。
    }
  }
  return { blob: await resp.blob(), fileName };
}

/**
 * 換到新 token 的兩支端點共用這一段。
 *
 * **輪替不交給呼叫端做。** 公司的選定寫在 token 裡，切換公司後若還帶著舊的那一顆，
 * 後端會照舊 token 的選定回資料 —— 畫面標題寫著新公司，列出來的卻是上一家公司的
 * 家長。那是一個看起來完全正常的跨公司外洩，而它只需要少寫一行就會發生。
 * 收進這裡之後，元件沒有「忘記」這個選項。
 */
async function withRotatedToken(
  call: Promise<{ token: string; identity: AdminIdentityView }>
): Promise<{ token: string; identity: AdminIdentityView }> {
  const result = await call;
  setAdminToken(result.token);
  return result;
}

export const adminApi = {
  login: (email: string, password: string) =>
    withRotatedToken(
      request<{ token: string; identity: AdminIdentityView }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
    ),

  me: () => request<{ identity: AdminIdentityView; companies: AdminCompany[]; shape?: AdminCenterShape }>('/me'),

  selectCompany: (selection: { companyId: number } | 'unassigned' | null) =>
    withRotatedToken(
      request<{ token: string; identity: AdminIdentityView }>('/select-company', {
        method: 'POST',
        body: JSON.stringify({ selection }),
      })
    ),

  /** `assigned`（#119，服務關係開關開著才有作用）：`unassigned` 只列單位裡還沒標注推薦人的。 */
  parents: (sort: 'newest' | 'oldest', booked: 'all' | 'booked' | 'not_booked', assigned: 'all' | 'unassigned' = 'all') =>
    request<{ parents: AdminParentListItem[] }>(
      `/parents?sort=${sort}&booked=${booked}${assigned === 'unassigned' ? '&assigned=unassigned' : ''}`
    ),

  /** 改派能選的單位與推薦人（#119）。 */
  serviceTargets: () => request<ServiceTargets>('/service-targets'),

  /** 標注／改派（#119）：`to` 是 null＝拿掉服務關係（只有全域管理員）。 */
  reassign: (id: number, to: { companyId: number; referrerId: number | null } | null) =>
    request<{ changed: boolean; relation: { companyId: number; referrerId: number | null } | null }>(`/parents/${id}/service`, {
      method: 'PUT',
      body: JSON.stringify({ to }),
    }),

  /** 一位家長的改派紀錄，新的在前（#119）。 */
  serviceChanges: (id: number) => request<{ changes: ServiceChange[] }>(`/parents/${id}/service-changes`),

  parent: (id: number) => request<{ parent: AdminParentDetail }>(`/parents/${id}`),

  /** 家長彙總（#69）：一個孩子一行，與列表同一個視野、同一組篩選；一次一頁（`SUMMARY_PAGE_SIZE`）。 */
  parentSummary: (options: SummaryOptions, page: number) =>
    request<SummaryPage>(`/parent-summary?sort=${options.sort}&booked=${options.booked}&page=${page}`),

  /** 導出彙總成 `.xlsx`。每按一次伺服器記一筆導出紀錄。 */
  exportParentSummary: (options: SummaryOptions) =>
    download('/parent-summary/export', { method: 'POST', body: JSON.stringify(options) }, '家长汇总.xlsx'),

  /**
   * 刪除一位家長（ADR-0006）。**硬刪，刪掉就沒了。**
   *
   * 失敗的兩種都由 `AdminApiError` 帶出來：跨視野／不存在是 404，
   * 有付款紀錄是 409 + `HAS_PAYMENTS`。呼叫端要分開講 —— 前者是「找不到」，
   * 後者是「找得到但不准刪」，而使用者的下一步完全不同。
   */
  deleteParent: (id: number) => request<{ ok: true }>(`/parents/${id}`, { method: 'DELETE' }),

  /** B→A 交接的邀請簡訊（ADR-0009）：只有專案 B 的全域管理員叫得到。 */
  inviteConfig: () => request<AdminInviteConfig>('/handoff-invites/config'),

  /** 一批最多 `INVITE_BATCH_MAX` 位；伺服器照規則再判一次誰能收（`src/handoff/invite.ts`）。 */
  sendInvites: (userIds: number[]) =>
    request<AdminInviteReport>('/handoff-invites', { method: 'POST', body: JSON.stringify({ userIds }) }),

  specialists: () => request<{ specialists: AdminSpecialist[] }>('/specialists'),

  createSpecialist: (input: Partial<AdminSpecialist>) =>
    request<{ specialist: AdminSpecialist }>('/specialists', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateSpecialist: (id: number, input: Partial<AdminSpecialist>) =>
    request<{ ok: true }>(`/specialists/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  company: () => request<{ company: AdminCompany | null }>('/company'),

  /**
   * 更新本機構設定。**只送要改的鍵** —— 後端只寫進請求裡真的帶了的欄位，
   * 所以「只換 LOGO」不會順手把通知位置覆蓋掉（見 `adminStore` 的說明）。
   */
  updateCompanySettings: (patch: { wecomWebhookUrl?: string | null; logoUrl?: string | null }) =>
    request<{ ok: true }>('/company', { method: 'PUT', body: JSON.stringify(patch) }),

  companies: () => request<{ companies: AdminCompany[] }>('/companies'),

  // ── 停用／刪除（使用者 2026-11-23；只在 A 開了合作單位時有，B 是 404）──
  setCompanyActive: (id: number, active: boolean) =>
    request<{ ok: true }>(`/companies/${id}/active`, { method: 'POST', body: JSON.stringify({ active }) }),
  companyDeletePreview: (id: number) => request<{ preview: UnitDeletePreview }>(`/companies/${id}/delete-preview`),
  deleteCompany: (id: number) => request<{ ok: true; preview: UnitDeletePreview }>(`/companies/${id}`, { method: 'DELETE' }),
  deleteAdminUser: (id: number) => request<{ ok: true }>(`/admin-users/${id}`, { method: 'DELETE' }),
  deleteReferrer: (id: number) => request<{ ok: true }>(`/referrers/${id}`, { method: 'DELETE' }),

  /**
   * 建公司（B）／合作單位（A，#117）。`unit` 只有 A 傳：類型必選；個人治療師一次帶上那個帳號的信箱、密碼、手機號，
   * 伺服器同時建好單位管理者兼推薦人的帳號。
   */
  createCompany: (
    name: string,
    slug: string,
    unit?: { kind: UnitKind; email?: string; password?: string; phone?: string }
  ) =>
    request<{ company: AdminCompany; referrer?: AdminReferrer }>('/companies', {
      method: 'POST',
      body: JSON.stringify({ name, slug, ...unit }),
    }),

  adminUsers: () => request<{ adminUsers: AdminUser[] }>('/admin-users'),

  createAdminUser: (input: {
    email: string; password: string;
    role: 'global_admin' | 'company_member'; companyId: number | null;
  }) => request<{ adminUser: AdminUser }>('/admin-users', { method: 'POST', body: JSON.stringify(input) }),

  setAdminUserActive: (id: number, active: boolean) =>
    request<{ ok: true }>(`/admin-users/${id}/active`, {
      method: 'POST',
      body: JSON.stringify({ active }),
    }),

  summary: () => request<{ summary: CompanySummaryRow[] }>('/summary'),

  // 活動庫（#62）不吃公司條件 —— 它不是家長資料，因此這兩支不需要先選定公司。
  // 局部更新回整支，畫面直接換掉那一列。
  activities: () => request<{ activities: Activity[] }>('/activities'),

  updateActivity: (id: string, patch: ActivityPatch) =>
    request<{ activity: Activity }>(`/activities/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // 上傳示範片／封面（2026-10-08，只在專案 A）。用 XHR 而不是 fetch：fetch 沒有上傳進度，
  // 一支幾十 MB 的片在慢網路上傳一分鐘，畫面不能停在那裡不動。
  uploadActivityMedia: (
    id: string,
    kind: 'video' | 'poster',
    body: Blob,
    options: { seconds?: number | null; onProgress?: (fraction: number) => void } = {},
  ) =>
    new Promise<{ activity: Activity }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const query = kind === 'video' && options.seconds ? `?seconds=${options.seconds}` : '';
      xhr.open('PUT', `/api/admin/activities/${encodeURIComponent(id)}/${kind}${query}`);
      xhr.setRequestHeader('Content-Type', kind === 'video' ? 'video/mp4' : 'image/jpeg');
      const token = getAdminToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          // 反向代理擋掉（例如 nginx 的 413）回的是 HTML
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
        else if (xhr.status === 413 && !parsed.error) reject(new AdminApiError('档案太大，主机拒收（请联系技术人员调高上传上限）。', 'UNKNOWN', 413));
        else reject(new AdminApiError(parsed.error || `上传失败（HTTP ${xhr.status}）`, (parsed.code as AdminErrorCode) || 'UNKNOWN', xhr.status));
      };
      xhr.onerror = () => reject(new AdminApiError('网络中断，上传没有完成。', 'UNKNOWN', 0));
      xhr.send(body);
    }),

  // 分解步驟的配圖（2026-10-21）：一張 jpeg，`step` 從 1 起。回整支活動（那一步的 imageUrl 已換好）。
  uploadStepImage: async (id: string, step: number, body: Blob) => {
    const token = getAdminToken();
    const resp = await fetch(`/api/admin/activities/${encodeURIComponent(id)}/steps/${step}/image`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
    });
    let parsed: any = {};
    try {
      parsed = await resp.json();
    } catch {
      // 反向代理回的 HTML
    }
    if (!resp.ok) throw new AdminApiError(parsed.error || `上传失败（HTTP ${resp.status}）`, (parsed.code as AdminErrorCode) || 'UNKNOWN', resp.status);
    return parsed as { activity: Activity };
  },

  // ── 推薦人（客戶 10/22，#93；只有全域管理員）──
  referrers: () => request<{ referrers: AdminReferrer[] }>('/referrers'),
  createReferrer: (input: { email: string; password: string; name: string; phone: string; kind?: 'channel' | 'therapist'; companyId: number | null; code?: string }) =>
    request<{ referrer: AdminReferrer }>('/referrers', { method: 'POST', body: JSON.stringify(input) }),
  setReferrerActive: (id: number, active: boolean) =>
    request<{ ok: true }>(`/referrers/${id}/active`, { method: 'POST', body: JSON.stringify({ active }) }),

  // ── 兌換碼（客戶 10/22，#110；伺服器開關 TRAINING_PLAN 關著時這幾支是 404）──
  referrerCodes: (referrerId: number) => request<{ codes: AdminRedeemCode[] }>(`/referrers/${referrerId}/codes`),
  createCodes: (referrerId: number, months: 1 | 3 | 6 | 12, quantity: number) =>
    request<{ codes: AdminRedeemCode[] }>(`/referrers/${referrerId}/codes`, { method: 'POST', body: JSON.stringify({ months, quantity }) }),
  voidCode: (codeId: number) => request<{ ok: true }>(`/redeem-codes/${codeId}/void`, { method: 'POST', body: '{}' }),
  myCodes: () => request<{ codes: AdminRedeemCode[] }>('/referrer/codes'),
  /** 單位層的碼（#124）：全域管理員看、產某個單位的；單位管理者看本單位的。 */
  unitCodes: (unitId: number) => request<{ codes: AdminRedeemCode[] }>(`/units/${unitId}/codes`),
  createUnitCodes: (unitId: number, months: 1 | 3 | 6 | 12, quantity: number) =>
    request<{ codes: AdminRedeemCode[] }>(`/units/${unitId}/codes`, { method: 'POST', body: JSON.stringify({ months, quantity }) }),
  myUnitCodes: () => request<{ codes: AdminRedeemCode[] }>('/unit/codes'),
  unitCodesCsv: () => download('/unit/codes.csv', { method: 'GET' }, '本单位未用兑换码.csv'),
  /** 兌換碼對帳匯出（#113，只有全域管理員）。 */
  couponBatches: () => request<{ batches: AdminCouponBatch[] }>('/coupons'),
  createCoupons: (input: { referrerId: number; note: string | null; discountKind: CouponDiscount['kind']; discountValue: number; quantity: number; expiresOn: string | null }) =>
    request<{ batchId: number; codes: AdminCouponCode[] }>('/coupons', { method: 'POST', body: JSON.stringify(input) }),
  updateCouponBatch: (id: number, patch: { discountKind?: CouponDiscount['kind']; discountValue?: number; expiresOn?: string | null; note?: string | null }) =>
    request<{ ok: true }>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  couponCodes: (batchId: number) => request<{ codes: AdminCouponCode[] }>(`/coupons/${batchId}/codes`),
  couponCodesCsv: (batchId: number) => download(`/coupons/${batchId}/codes.csv`, { method: 'GET' }, `未用优惠码-第${batchId}批.csv`),
  voidCoupon: (codeId: number) => request<{ ok: true }>(`/coupon-codes/${codeId}/void`, { method: 'POST', body: '{}' }),
  /** 推薦人／單位管理者自己的優惠券（只讀；`T2_COUPON` 關著是 404）。 */
  myCoupons: () => request<{ batches: AdminCouponBatch[]; codes: AdminCouponCode[] }>('/my/coupons'),
  myCouponsCsv: () => download('/my/coupons.csv', { method: 'GET' }, '未用优惠码.csv'),
  exportRedeemLedger: () => download('/redeem-codes/export', { method: 'POST', body: '{}' }, '兑换码对帐.xlsx'),

  // ── 清分（ADR-0016；只有全域管理員、`REVENUE_SPLIT` 開著）──
  splitSettings: () => request<AdminSplitSettings>('/revenue-split'),
  setSplitRate: (input: {
    scope: AdminSplitRate['scope'];
    refId: number;
    platformPercent: string | null;
    companyPercent: string | null;
    /** 只在 `AdminSplitSettings.screening` 開著、單位那一層送（#122）。 */
    screeningPercent?: string | null;
  }) =>
    request<{ ok: true }>('/revenue-split/rates', { method: 'PUT', body: JSON.stringify(input) }),
  splitOrders: (from: string, to: string) =>
    request<AdminSplitOrders>(`/revenue-split/orders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  exportSplit: (from: string, to: string) =>
    download('/revenue-split/export', { method: 'POST', body: JSON.stringify({ from, to }) }, `清分对帐-${from}-${to}.xlsx`),
  // ── 微信分账（ADR-0017；只有全域管理員、`PROFIT_SHARING` 開著）──
  profitSharing: () => request<AdminProfitSharing>('/profit-sharing'),
  saveProfitSharingReceiver: (input: { partyKind: PartyKind; refId: number; type: ReceiverType; account: string; name: string | null }) =>
    request<{ ok: true; registered: boolean; wechatError?: string }>('/profit-sharing/receivers', { method: 'PUT', body: JSON.stringify(input) }),
  setProfitSharingReceiverActive: (partyKind: PartyKind, refId: number, active: boolean) =>
    request<{ ok: true }>('/profit-sharing/receivers/active', { method: 'POST', body: JSON.stringify({ partyKind, refId, active }) }),
  profitSharingOpenid: (phone: string) => request<{ openid: string | null }>(`/profit-sharing/openid?phone=${encodeURIComponent(phone)}`),
  runProfitSharing: () => request<RunResult>('/profit-sharing/run', { method: 'POST', body: '{}' }),
  retryProfitSharing: (id: number, mode: 'share' | 'unfreeze') =>
    request<{ ok: true }>(`/profit-sharing/orders/${id}/retry`, { method: 'POST', body: JSON.stringify({ mode }) }),
  /** 未用碼的 CSV：全域管理員給推薦人編號，推薦人自己不給。 */
  codesCsv: (referrerId: number | null) =>
    download(referrerId === null ? '/referrer/codes.csv' : `/referrers/${referrerId}/codes.csv`, { method: 'GET' }, '未用兑换码.csv'),

  // ── 代填（客戶 10/22，#112；只有推薦人）──
  proxyLookup: (phone: string) =>
    request<{ status: 'new' } | { status: 'mine' | 'unbound'; child: { name: string; birthDate: string; gender: string } | null }>(
      '/referrer/proxy/lookup', { method: 'POST', body: JSON.stringify({ phone }) }),
  proxyFill: (input: { phone: string; child: { name: string; birthDate: string; gender: 'boy' | 'girl' }; colors: Record<string, string>; tags: string[]; months: 1 | 3 | 6 | 12 }) =>
    request<{ ok: true; consumedCode: boolean }>('/referrer/proxy', { method: 'POST', body: JSON.stringify(input) }),

  // ── 首頁素材（客戶 10/22，#87；伺服器開關 HOME_MEDIA 關著時這幾支是 404）──
  homeMedia: () => request<{ items: HomeMediaItem[] }>('/home-media'),

  // 條款（11/03 第 14 頁，`LEGAL_DOCS`）
  legalDocs: () => request<LegalDocs>('/legal'),
  saveLegalDoc: (key: LegalDocKey, markdown: string) =>
    request<{ doc: LegalDoc }>(`/legal/${key}`, { method: 'PUT', body: JSON.stringify({ markdown }) }),

  uploadHomeMedia: async (slot: HomeMediaSlot, kind: HomeMediaKind, file: Blob) => {
    const token = getAdminToken();
    const resp = await fetch(`/api/admin/home-media?slot=${slot}&kind=${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    });
    let parsed: any = {};
    try {
      parsed = await resp.json();
    } catch {
      // 反向代理回的 HTML
    }
    if (!resp.ok) {
      if (resp.status === 413 && !parsed.error) throw new AdminApiError('档案太大，主机拒收（请联系技术人员调高上传上限）。', 'UNKNOWN', 413);
      throw new AdminApiError(parsed.error || `上传失败（HTTP ${resp.status}）`, (parsed.code as AdminErrorCode) || 'UNKNOWN', resp.status);
    }
    return parsed as { item: HomeMediaItem };
  },

  // ── 企業微信客服二維碼（使用者 2026-11-10；只在專案 A，B 是 404）──
  // `key` 是 `'default'` 或公司 id。三支都回整份清單。
  wecomQrs: () => request<WecomQrList>('/wecom-qr'),
  removeWecomQr: (key: 'default' | number) => request<WecomQrList>(`/wecom-qr/${key}`, { method: 'DELETE' }),
  uploadWecomQr: async (key: 'default' | number, file: Blob) => {
    const token = getAdminToken();
    const resp = await fetch(`/api/admin/wecom-qr/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'image/jpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    });
    let parsed: any = {};
    try {
      parsed = await resp.json();
    } catch {
      // 反向代理回的 HTML
    }
    if (!resp.ok) {
      if (resp.status === 413 && !parsed.error) throw new AdminApiError('档案太大，主机拒收（请联系技术人员调高上传上限）。', 'UNKNOWN', 413);
      throw new AdminApiError(parsed.error || `上传失败（HTTP ${resp.status}）`, (parsed.code as AdminErrorCode) || 'UNKNOWN', resp.status);
    }
    return parsed as WecomQrList;
  },

  uploadHomeMediaPoster: async (id: number, poster: Blob) => {
    const token = getAdminToken();
    const resp = await fetch(`/api/admin/home-media/${id}/poster`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: poster,
    });
    let parsed: any = {};
    try {
      parsed = await resp.json();
    } catch {
      // 反向代理回的 HTML
    }
    if (!resp.ok) throw new AdminApiError(parsed.error || `上传失败（HTTP ${resp.status}）`, (parsed.code as AdminErrorCode) || 'UNKNOWN', resp.status);
    return parsed as { item: HomeMediaItem };
  },

  updateHomeMedia: (id: number, patch: { link?: string | null; sortOrder?: number; active?: boolean }) =>
    request<{ item: HomeMediaItem }>(`/home-media/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  /** 刪一張素材（連檔案）；停用不想放就好，刪了不能復原。 */
  deleteHomeMedia: (id: number) => request<{ ok: true }>(`/home-media/${id}`, { method: 'DELETE' }),

  // 批量匯入（v2.1 S25）：先 dryRun 試跑、給人看過，再同一份 rows 正式匯入。
  importActivities: (rows: unknown[], dryRun: boolean) =>
    request<ActivityImportReport>('/activities/import', {
      method: 'POST',
      body: JSON.stringify({ rows, dryRun }),
    }),
};

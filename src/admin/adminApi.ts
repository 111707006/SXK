/**
 * 管理中心的前端 API 客戶端。
 *
 * 工作階段 token 與家長端**分開存放**（不同的 localStorage 鍵），與後端兩套簽章
 * 相對應。共用一個鍵會讓「後台成員在同一台電腦上也是家長」變成一個會互相踢掉
 * 對方登入狀態的 bug，而那種 bug 在後台最不該出現。
 */

const TOKEN_KEY = 'sxk_admin_token';

export interface AdminIdentityView {
  role: 'global_admin' | 'company_member';
  email: string;
  companyId: number | null;
  selection: { kind: 'company'; companyId: number } | { kind: 'unassigned' } | null;
}

export interface AdminCompany {
  id: number;
  name: string;
  slug: string;
  wecomWebhookUrl: string | null;
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
  flaggedDimensions: Array<{ dimensionId: string; dimensionName: string; status: string }>;
  screenedAt: string | null;
  registeredAt: string | null;
  hasBooking: boolean;
}

export interface AdminParentDetail extends AdminParentListItem {
  scores: Array<{
    dimensionId: string; dimensionName: string; tierId: string;
    score: number; maxScore: number; status: string; completedAt: string;
  }>;
  reportHistory: Array<{
    id: string; createdAt: string; isAiGenerated?: boolean;
    aiReport?: {
      summary: string; neuralPathwayAnalysis: string;
      rehabSuggestions: string[]; homeGuidance: string[]; prognosisPrediction: string;
    };
  }>;
  bookings: Array<{
    id: number; specialistId: string; specialistName: string | null;
    parentName: string; parentPhone: string; preferredSlot: string | null;
    reportSummary: string | null; status: string; createdAt: string | null;
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
  role: 'global_admin' | 'company_member';
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

  me: () => request<{ identity: AdminIdentityView; companies: AdminCompany[] }>('/me'),

  selectCompany: (selection: { companyId: number } | 'unassigned' | null) =>
    withRotatedToken(
      request<{ token: string; identity: AdminIdentityView }>('/select-company', {
        method: 'POST',
        body: JSON.stringify({ selection }),
      })
    ),

  parents: (sort: 'newest' | 'oldest', booked: 'all' | 'booked' | 'not_booked') =>
    request<{ parents: AdminParentListItem[] }>(`/parents?sort=${sort}&booked=${booked}`),

  parent: (id: number) => request<{ parent: AdminParentDetail }>(`/parents/${id}`),

  specialists: () => request<{ specialists: AdminSpecialist[] }>('/specialists'),

  createSpecialist: (input: Partial<AdminSpecialist>) =>
    request<{ specialist: AdminSpecialist }>('/specialists', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateSpecialist: (id: number, input: Partial<AdminSpecialist>) =>
    request<{ ok: true }>(`/specialists/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  company: () => request<{ company: AdminCompany | null }>('/company'),

  updateCompanyWebhook: (wecomWebhookUrl: string | null) =>
    request<{ ok: true }>('/company', { method: 'PUT', body: JSON.stringify({ wecomWebhookUrl }) }),

  companies: () => request<{ companies: AdminCompany[] }>('/companies'),

  createCompany: (name: string, slug: string) =>
    request<{ company: AdminCompany }>('/companies', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
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
};

/** 匯出走瀏覽器分頁開新視窗，因此需要一條帶得上 token 的路。 */
export async function fetchParentExport(id: number): Promise<string> {
  const token = getAdminToken();
  const resp = await fetch(`/api/admin/parents/${id}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    let body: any = {};
    try {
      body = await resp.json();
    } catch { /* 非 JSON 的錯誤 */ }
    throw new AdminApiError(body.error || '汇出失败', (body.code as AdminErrorCode) || 'UNKNOWN', resp.status);
  }
  return resp.text();
}

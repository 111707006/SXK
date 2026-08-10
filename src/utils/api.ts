/**
 * 帶上工作階段 token 的請求標頭。
 *
 * 從 `App.tsx` 的區域函式抽出來共用 —— 深度評估的端點現在會驗證解鎖權益
 * （`server.ts` 的 `denyIfLocked`），呼叫它們的元件散在 `AssessmentPanel`、
 * `MotionVideoAssessment` 與 `utils/asr`，每個都自己拼一次標頭遲早會漏掉一個，
 * 而漏掉的那一個就是免費的後門。
 */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('senxinkang_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * 通行證失效時要做的事。由 `App` 在掛載時登記一次。
 *
 * 放在模組層而不是 prop：發請求的地方散在六個檔案裡（深度評估、動作影片、
 * 語言專項、付費牆、ASR、專家名單），把一個 callback 一路傳下去，漏掉的那一支
 * 就是「畫面上還登入著、每一次請求都被退回」的那條路。
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * 帶通行證發請求，並且**在同一個地方**處理「伺服器不認這張通行證」。
 *
 * 這是所有需要身分的請求唯一該走的入口。401 在這裡一律代表沒有有效的工作
 * 階段（後端只有 `currentUserId` 取不到人時才回 401；「已登入但沒解鎖」回的
 * 是 403 `LOCKED`），所以處置只有一種：清掉這台裝置上的登入痕跡並回登入頁。
 *
 * **只有本來就帶了通行證的那一次**才會觸發。未登入的家長打到需要登入的端點
 * 也會拿到 401，那是一個正常的答案，不是「你的登入失效了」—— 對他跳出那句話
 * 只會讓人以為自己被登出過。
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const hadToken = localStorage.getItem('senxinkang_token') !== null;
  const resp = await fetch(input, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (resp.status === 401 && hadToken) onUnauthorized?.();
  return resp;
}

/**
 * 後端在解鎖檢查未通過時回的代碼。前端據此分流：`LOCKED` 導向付費牆、
 * `UNAUTHENTICATED` 導向登入，其餘照一般錯誤處理。
 */
export type AccessDeniedCode = 'LOCKED' | 'UNAUTHENTICATED' | 'DIMENSION_REQUIRED';

/** 從失敗的回應中取出解鎖檢查的代碼；不是解鎖問題則回 `null`。 */
export async function readAccessDenied(resp: Response): Promise<AccessDeniedCode | null> {
  if (resp.status !== 401 && resp.status !== 403 && resp.status !== 400) return null;
  try {
    const body = await resp.clone().json();
    const code = body?.code;
    return code === 'LOCKED' || code === 'UNAUTHENTICATED' || code === 'DIMENSION_REQUIRED' ? code : null;
  } catch {
    return null;
  }
}

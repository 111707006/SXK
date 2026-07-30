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

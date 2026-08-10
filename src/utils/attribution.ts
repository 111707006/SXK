/**
 * 歸屬：這位家長是從哪一家合作公司的連結進來的。
 *
 * 合作公司給出的連結長這樣：`https://<網域>/?c=<進站識別碼>`。
 * 家長**不需要在畫面上輸入任何代碼** —— 第一步就要求輸入代碼的流程，會在那一步
 * 損失掉一批人，而那批人正是這個產品要服務的對象。
 *
 * 這裡只負責「記住」。真正把歸屬寫進帳號的是建立帳號那一刻的後端
 * （`server.ts` 的 `/api/auth/sms/verify` —— 第一次驗證成功即建帳號），
 * 寫入之後就不再改變 —— 一位家長的歷史資料不該在兩家公司之間跳動。
 *
 * 識別碼無效時前端**不做任何判斷**：照樣記下、照樣送出，由後端查不到公司時
 * 判為未歸屬。前端猜一家公司填上去，錯的方向是不可逆的。
 */

const COMPANY_SLUG_KEY = 'senxinkang_company_slug';

/** 進站連結上帶識別碼的參數名。短到可以印在傳單上。 */
const QUERY_PARAM = 'c';

/** 與後端 `SLUG_PATTERN` 相同：小寫英數與連字號，長度 2–64。 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

/**
 * 從網址取出識別碼並記在瀏覽器裡。應用程式啟動時呼叫一次。
 *
 * **已經記過的不覆寫**：家長可能先從甲公司的連結進來看了一半，隔天點到乙公司
 * 轉發的連結。第一次進站的那一家才是把他帶進來的那一家。
 *
 * 回傳當前生效的識別碼（可能是這次帶進來的，也可能是先前記下的）。
 */
export function captureCompanySlug(search: string = window.location.search): string | null {
  const existing = peekCompanySlug();
  if (existing) return existing;

  const raw = new URLSearchParams(search).get(QUERY_PARAM);
  if (!raw) return null;

  const slug = raw.trim().toLowerCase();
  // 格式不對就不記 —— 記下來也只會在建立帳號時被後端判為無效，
  // 中間這段時間卻讓人以為歸屬已經抓到了。
  if (!SLUG_PATTERN.test(slug)) return null;

  try {
    localStorage.setItem(COMPANY_SLUG_KEY, slug);
  } catch {
    // 隱私模式下 localStorage 可能不可寫。歸屬抓不到不該讓整個應用程式起不來 ——
    // 未歸屬是一個正常的狀態，流程完全走得通。
  }
  return slug;
}

/** 只讀取，不寫入。註冊時附在請求上。 */
export function peekCompanySlug(): string | null {
  try {
    return localStorage.getItem(COMPANY_SLUG_KEY);
  } catch {
    return null;
  }
}

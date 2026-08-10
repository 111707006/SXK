/**
 * 掃碼帶走報告的連結（issue #22）。
 *
 * 家長在合作公司的 iPad 上看完報告，掃畫面上的二維碼就能在自己手機上打開同一份
 * 報告。手機沒有登入，所以那條連結**本身就是憑據** —— 這個模組決定它長什麼樣子。
 *
 * ⚠️ **已知取捨：永久連結加長亂數，沒有撤回手段。**
 * 連結一旦產生就永遠有效。二維碼被拍到、螢幕被錄影、連結被轉傳，那份報告就
 * 永久公開，而系統沒有任何「作廢」的動作可以做。此取捨在規格階段被明確提出並
 * 由產品端選定（見 issue #22 與 #14），**不是遺漏**。
 *
 * 既然沒有撤回，唯一剩下的防線就是**猜不到**：token 是 32 位元組的密碼學亂數，
 * 不是流水號、不是 id 的雜湊、不是時間戳。這也是為什麼長度與字元集寫在這裡並
 * 附測試 —— 哪天有人為了「網址短一點」把它砍到 8 個字元，會是一個測試失敗，
 * 而不是一件沒有人注意到的事。
 */
import crypto from 'crypto';

/** 32 位元組。以 base64url 編碼後恰好 43 個字元（無填充）。 */
export const REPORT_LINK_TOKEN_BYTES = 32;

/**
 * base64url 編碼後的長度。
 *
 * 43 = ceil(32 × 8 / 6)。這個數字寫死在這裡是為了讓
 * 「有人把位元組數改小了」變成一個看得見的失敗。
 */
export const REPORT_LINK_TOKEN_LENGTH = 43;

/** base64url 的字元集：不含 `+`、`/`、`=`，因此放進網址不需要再編碼一次。 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * 產生一個新的 token。
 *
 * `randomBytes` 而不是 `Math.random()`：後者可預測，而這串字就是整份報告的
 * 唯一保護。同一個理由讓 `outTradeNo` 可以用 `Math.random()` —— 那個值的唯一性
 * 由資料庫保證，猜到了也不能拿它做任何事。
 */
export function generateReportLinkToken(): string {
  return crypto.randomBytes(REPORT_LINK_TOKEN_BYTES).toString('base64url');
}

/**
 * 形狀檢查。**不查資料庫**，只擋掉明顯不是 token 的字串。
 *
 * 存在的理由是讓 `/r/<垃圾>` 在碰到資料庫之前就結束：一條公開路徑上的每一次
 * 查詢都是別人可以免費叫我們做的工。真正的判斷仍然是「這個 token 在不在表裡」。
 */
export function isValidReportLinkToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === REPORT_LINK_TOKEN_LENGTH &&
    TOKEN_PATTERN.test(value)
  );
}

/** 報告連結的路徑。`/r` 刻意短 —— 這串字要變成二維碼，越短的網址越好掃。 */
export function reportLinkPath(token: string): string {
  return `/r/${token}`;
}

/**
 * 二維碼裡要放的**絕對**網址。
 *
 * 手機掃到的是一張圖，不是一個網頁裡的連結 —— 沒有「當前頁面」可以當基準，
 * 所以相對路徑在這裡完全不能用。
 *
 * `configured` 來自 `PUBLIC_BASE_URL`。沒設定時退回請求本身的來源，這在正式
 * 部署上是對的（nginx 會帶 `X-Forwarded-Proto`／`Host`），在本機開發上會產出
 * `http://localhost:5000/...` —— 那串網址在手機上打不開，但那是部署的事實，
 * 不是這裡可以編一個網域出來解決的問題。
 *
 * 認不得的 `configured`（少了協定、寫成 `ftp://`）**一律忽略並退回請求來源**，
 * 不把它原樣接上去：`sxkscreen.com/r/xxx` 這種字串在二維碼裡會被當成相對路徑，
 * 掃出來是一段掃不開的文字，而畫面上二維碼看起來完全正常。
 */
export function resolveReportLinkBase(
  configured: string | undefined,
  requestOrigin: string
): string {
  const trim = (value: string) => value.trim().replace(/\/+$/, '');
  const usable = (value: string) => /^https?:\/\/[^/\s]+$/.test(value);

  if (typeof configured === 'string') {
    const cleaned = trim(configured);
    if (usable(cleaned)) return cleaned;
  }
  return trim(requestOrigin);
}

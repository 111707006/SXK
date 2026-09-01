/**
 * 在任何模組被載入之前把環境變數釘死。
 *
 * `server.ts` 在 import 當下就呼叫 `dotenv.config()`，而 dotenv **不會覆寫已存在
 * 的 key** —— 所以這裡先把值填上去（即使是空字串），本機 `.env` 就進不來。
 *
 * 最重要的是 MYSQL_*：開發機的 `.env` 有真實的 RDS 連線資訊，少了這一步，
 * 一條 HTTP 測試就會安靜地打到線上資料庫。
 */

// 資料庫一律視為未設定。需要「有資料庫」的測試自己 `vi.mock` 資料層 ——
// 那是刻意的替身，不是意外連上的真實連線。
for (const key of ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']) {
  process.env[key] = '';
}

// 外部服務的金鑰一律清空，讓程式走它們的降級路徑而不是真的送出請求。
for (const key of ['DASHSCOPE_API_KEY', 'GEMINI_API_KEY', 'WECOM_WEBHOOK_URL',
  'ALI_SMS_ACCESS_KEY_ID', 'ALI_SMS_ACCESS_KEY_SECRET']) {
  process.env[key] = '';
}

// 產品模式釘在專案 A（空字串即 'full'，見 server.ts 的 resolveAppMode）。
//
// 它決定的東西已經不只有 tier-2/3 路由掛不掛載了 —— issue #19 之後它同時決定
// 管理中心有沒有合作公司這回事。開發機的 `.env` 一旦漏一個 APP_MODE 進來，
// 後台那幾支 HTTP 測試會安靜地驗到另一個產品。
// 需要專案 B 的測試自己在檔案最上方覆寫它（見 adminIsolation.http.test.ts）。
process.env.APP_MODE = '';

// 付費牆的展示開關一律關閉。它打開時後端閘門整個不執行，若讓開發機的 `.env`
// 漏進來，`paywallGate.http.test.ts` 會全部變成綠燈卻什麼都沒驗到 ——
// 需要「開關打開」的測試自己設定它（見 `paywallDemoSwitch.http.test.ts`）。
process.env.PAYWALL_DEMO_OPEN = '';

// 固定的簽章密鑰，讓測試簽出來的 token 在同一支測試裡穩定可用。
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

// 速率限制在測試裡只會製造假失敗（同一個 IP 連發數十次請求是正常的測試行為）。
process.env.RATE_API_MAX = '100000';
process.env.RATE_AI_MAX = '100000';
process.env.RATE_AUTH_MAX = '100000';
process.env.RATE_BOOKING_MAX = '100000';

// 這一個相反 —— 要釘在**預設值**上，因為有測試就是在驗那個邊界（第 50 筆擋、
// 第 49 筆過）。`.env.example` 現在會教人去調它，而開發機的 `.env` 一旦漏進來，
// 那組測試會安靜地驗到另一個數字。
process.env.SMS_IP_DAILY_MAX = '50';

// 備案號釘成未設定。它是伺服器**執行期**才讀的（`server.ts` 的 `ICP_BEIAN`，
// 給掃碼報告頁與連結失效頁用），所以開發機的 `.env` 一旦漏進來，「沒設定就
// 不渲染」那一條會安靜地變成綠燈卻什麼都沒驗到。
// 需要「有備案號」的測試自己在檔案最上方設定它（見 reportLink.http.test.ts）。
process.env.ICP_BEIAN = '';

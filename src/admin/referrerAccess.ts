/**
 * 推薦人（渠道商、治療師；客戶 10/22，#93）在管理中心能打哪幾支。
 *
 * 推薦人登入同一個管理中心，但只看得到「我的家长」「我的兑换码」「代填」三個分頁。後台大多數端點靠
 * `requireGlobal` 擋住非全域管理員，但有幾支是「所有後台帳號」都能打的（家長彙總、導出、刪除家長、專家名單……），
 * 那些是為公司成員開的，不是為推薦人。所以推薦人改成**白名單**：不在這裡的一律 403 —— 之後新加一支「所有帳號」
 * 的端點，推薦人預設打不到，要開得特地寫進來。
 *
 * 路徑是相對 `/api/admin` 的（`req.path`）。
 */
const ALLOWED: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/me\/?$/ },
  // 我的家长：列表與詳情（範圍＝綁在我名下，`companyWhereSql` 的 referrer 條件）。
  { method: 'GET', pattern: /^\/parents\/?$/ },
  { method: 'GET', pattern: /^\/parents\/\d+\/?$/ },
  // 改派紀錄（#119，服務關係開關開著才註冊）：看得到這位家長才讀得到。改派本身（PUT）不在這裡——推薦人不能改。
  { method: 'GET', pattern: /^\/parents\/\d+\/service-changes\/?$/ },
  // 我的兑换码（#110）與代填（#112）。
  { method: 'GET', pattern: /^\/referrer\/codes\/?$/ },
  { method: 'GET', pattern: /^\/referrer\/codes\.csv$/ },
  // 我的优惠券（2026-11-25，`T2_COUPON` 開著才註冊）：只讀。
  { method: 'GET', pattern: /^\/my\/coupons\/?$/ },
  { method: 'GET', pattern: /^\/my\/coupons\.csv$/ },
  { method: 'POST', pattern: /^\/referrer\/proxy\/lookup\/?$/ },
  { method: 'POST', pattern: /^\/referrer\/proxy\/?$/ },
  // 代填簡訊重發（2026-11-24，`PROXY_SMS` 開著才註冊）。
  { method: 'POST', pattern: /^\/referrer\/proxy\/sms\/?$/ },
];

export function referrerMayCall(method: string, path: string): boolean {
  const m = method.toUpperCase();
  return ALLOWED.some(a => a.method === m && a.pattern.test(path));
}

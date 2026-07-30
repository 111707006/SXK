/**
 * 商戶訂單號（`out_trade_no`）的產生與驗證。
 *
 * 官方契約（2026-07-30 自本機官方文件庫查證，H5下单 doc_id 4012791834）：
 *
 *   string(32)，要求 6～32 個字元內，只能是數字、大小寫字母 _ - | *
 *   且在同一個商戶號下唯一。
 *
 * 為什麼要獨立成一個模組並附測試：**允許的字元集不含冒號、點、斜線**。
 * 「訂單號帶時間戳」是很自然的寫法，而 `new Date().toISOString()` 產出的
 * `2026-07-30T03:15:00.000Z` 裡有冒號、點、Z 之外還有連字號 —— 冒號與點都違規。
 * 這種錯誤在下單時才會被微信擋下，而那時已經是使用者按下付款的當下。
 *
 * 來源：https://pay.weixin.qq.com/doc/v3/merchant/4012791834
 */

/** 官方允許的字元集：數字、大小寫字母、`_`、`-`、`|`、`*` */
const ALLOWED_PATTERN = /^[0-9A-Za-z_\-|*]+$/;

export const OUT_TRADE_NO_MIN_LENGTH = 6;
export const OUT_TRADE_NO_MAX_LENGTH = 32;

/** 隨機碼只用數字與大寫字母，避免大小寫混淆造成人工對帳困擾 */
const RANDOM_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomSuffix(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
  }
  return out;
}

/**
 * 是否符合官方對 `out_trade_no` 的字元集與長度要求。
 * 唯一性由資料庫的 UNIQUE 約束保證，不在這裡檢查。
 */
export function isValidOutTradeNo(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < OUT_TRADE_NO_MIN_LENGTH || value.length > OUT_TRADE_NO_MAX_LENGTH) return false;
  return ALLOWED_PATTERN.test(value);
}

/**
 * 產生一個新的商戶訂單號。
 *
 * 格式：`SXK` + `yyyyMMddHHmmss` + 8 位隨機碼 = 25 字元。
 * 時間部分刻意不用 ISO 格式（冒號與點都不合法），改為純數字串；
 * 前綴讓人在微信商戶平台的帳單裡一眼認出是本系統的單。
 */
export function generateOutTradeNo(now: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `SXK${stamp}${randomSuffix(8)}`;
}

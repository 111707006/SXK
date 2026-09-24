/**
 * `.ics` 的短時效連結（Keep 規格 §3.8「加到日曆」，票 B7）。**伺服器專用**（用 node 的 `crypto`）。
 *
 * 【為什麼要這一支】
 * `GET /api/t2/practice-prefs.ics` 要身分，而手機要「加入日曆」得由瀏覽器自己去開一個網址
 *（`location.href`）—— 那一次請求帶不了 `Authorization`，一般連結會 401；前端先 fetch 再做成 blob，
 * iPhone Safari 又不一定給「加入日曆」。所以已登入的家長先 `POST /api/t2/practice-prefs/ics-link`
 * 換一個短時效的連結，網址本身就是憑證。
 *
 * 【為什麼是加密，不只是簽章】
 * 網址會留在瀏覽器歷史、伺服器的存取紀錄、截圖裡。只做 HMAC 的話，連結裡得帶著明文的使用者 id
 *（伺服器要知道是誰），而家長端的通行證就是那樣（payload 是 base64 的 JSON）。這裡用 AES-256-GCM：
 * 同時是**簽章**（GCM 的驗證標籤，改一個位元就解不開）與**不透明**（看不出是誰；同一位家長簽兩次，
 * 隨機的 IV 讓兩條連結也不一樣）。
 *
 * 鑰匙由 `SESSION_SECRET` 導出（HMAC-SHA256 加一個用途字串），不直接拿它當 AES 的鑰匙：同一把秘密
 * 用在兩種用途上時，兩邊的輸出要分得開。`SESSION_SECRET` 換了，舊連結跟著作廢 —— 與通行證同一件事。
 *
 * 【只有時效，不是一次性】
 * 一次性要一張表記「用過了」，而這個連結的作用是讓手機開一次日曆檔。10 分鐘內被別人拿到，看到的是
 * 那位家長選的星期幾與時間（與事件的 UID），不能改任何東西。
 */

import crypto from 'crypto';

/** 連結的有效期：夠家長在「加入日曆」那一步猶豫一下，不夠讓一條外流的連結長期有效。 */
export const ICS_LINK_TTL_MS = 10 * 60 * 1000;

/** 網址上放連結的查詢參數名：`/api/t2/practice-prefs.ics?t=…`。 */
export const ICS_LINK_PARAM = 't';

const KEY_PURPOSE = 'sxk:t2-practice-ics-link:v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyOf(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(KEY_PURPOSE).digest();
}

/** 替 `userId` 簽一條從 `now` 起 `ICS_LINK_TTL_MS` 內有效的連結。只含網址安全的字元。 */
export function createIcsLinkToken(userId: string, secret: string, now: number = Date.now()): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const plain = Buffer.from(JSON.stringify({ u: userId, e: now + ICS_LINK_TTL_MS }), 'utf8');
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
}

/**
 * 驗一條連結：鑰匙對、沒被改過、還沒過期 → 那位家長的 id；其餘一律 `null`，不丟例外。
 * `token` 是查詢參數上拿到的任何東西（可能是空字串、亂碼、別種憑證）。
 */
export function readIcsLinkToken(token: string, secret: string, now: number = Date.now()): string | null {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  // base64url 解碼會略過多餘的尾巴；再編回去不一樣就是被加長或截短過的
  if (raw.toString('base64url') !== token) return null;
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;

  let plain: Buffer;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    plain = Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]);
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(plain.toString('utf8'));
    if (typeof data?.u !== 'string' || data.u === '') return null;
    if (typeof data.e !== 'number' || !Number.isFinite(data.e) || now >= data.e) return null;
    // 簽出來的有效期不會比 TTL 長；比 TTL 長代表不是這一版簽的，不認
    if (data.e - now > ICS_LINK_TTL_MS) return null;
    return data.u;
  } catch {
    return null;
  }
}

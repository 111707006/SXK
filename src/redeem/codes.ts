/**
 * 兌換碼（客戶 10/22，issue #110）：10 碼、去掉易混字元的 base32（沒有 0、1、I、O），顯示成 `XXXX-XXXX-XX`。
 * 家長輸入時大小寫與分隔符不拘（空白、連字號、底線都拿掉）。純函式，前端與伺服器共用；亂數由呼叫端給
 * （伺服器用 `crypto.randomInt`），這裡不碰 `Math.random`。
 */

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 10;

/** 用給的亂數（0 ≤ n < 32）產一組碼。 */
export function generateCode(randomIndex: (max: number) => number): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)];
  return out;
}

/** 家長輸入的 → 存的那一個；形狀不對回 null（不打資料庫）。 */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const s = raw.toUpperCase().replace(/[\s\-_]/g, '');
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** 存的 → 顯示的 `XXXX-XXXX-XX`。 */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** 一批最多幾組（一次產太多是打錯數字）。 */
export const MAX_BATCH = 500;

/**
 * B→A 交接連結的形狀（docs/specs/b-to-a-handoff.md §2）。前端與伺服器共用，所以不 import node 的東西。
 *
 * 連結是 `https://<A>/handoff#code=<43 字>`：碼放在網址片段，不送到伺服器、不進 nginx 日誌、不隨 Referer 外流。
 */

/** 32 位元組亂數的 base64url：43 字。 */
export const HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const HANDOFF_LANDING_PATH = '/handoff';

export function isHandoffCodeShape(value: unknown): value is string {
  return typeof value === 'string' && HANDOFF_CODE_PATTERN.test(value);
}

/**
 * A 開頁時讀交接碼：路徑是 `/handoff`（結尾斜線也算）、片段裡有形狀對的 `code` 才算；
 * 其他一律 `null`（照一般開頁處理）。
 */
export function readHandoffCode(pathname: string, hash: string): string | null {
  if (pathname.replace(/\/+$/, '') !== HANDOFF_LANDING_PATH) return null;
  const code = new URLSearchParams(hash.replace(/^#/, '')).get('code');
  return isHandoffCodeShape(code) ? code : null;
}

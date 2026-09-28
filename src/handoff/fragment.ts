/**
 * B→A 交接連結的形狀（docs/specs/b-to-a-handoff.md §2）。前端與伺服器共用，所以不 import node 的東西。
 *
 * 兩種連結，碼都放在網址片段（不送到伺服器、不進 nginx 日誌、不隨 Referer 外流）：
 * - `https://<A>/handoff#code=<碼>`   B 報告頁的按鈕：家長在 B 按下就是同意，A 直接兌換
 * - `https://<A>/handoff#invite=<碼>` 後台發的簡訊邀請：A 先給家長看一句同意、按下才兌換
 */

/** 24 位元組亂數的 base64url：32 字（簡訊裡的網址短一點）。 */
export const HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export const HANDOFF_LANDING_PATH = '/handoff';

export function isHandoffCodeShape(value: unknown): value is string {
  return typeof value === 'string' && HANDOFF_CODE_PATTERN.test(value);
}

export interface HandoffLink {
  code: string;
  /** `button`＝B 報告頁按下來的（已經同意過）；`invite`＝簡訊邀請（A 先請家長同意）。 */
  via: 'button' | 'invite';
}

/**
 * A 開頁時讀交接連結：路徑是 `/handoff`（結尾斜線也算）、片段裡有形狀對的 `code` 或 `invite` 才算；
 * 其他一律 `null`（照一般開頁處理）。
 */
export function readHandoffLink(pathname: string, hash: string): HandoffLink | null {
  if (pathname.replace(/\/+$/, '') !== HANDOFF_LANDING_PATH) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get('code');
  if (isHandoffCodeShape(code)) return { code, via: 'button' };
  const invite = params.get('invite');
  if (isHandoffCodeShape(invite)) return { code: invite, via: 'invite' };
  return null;
}

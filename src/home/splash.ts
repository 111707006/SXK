/**
 * 開屏（客戶 10/22，#88，開關 `HOME_MEDIA`）：家長打開網站先看到一張活動頁，3 秒（暫採）自動進首頁、右上角「跳过」、
 * 點畫面去連結。同一個分頁工作階段只出現一次。判斷寫成純函式（測得到）；畫面在 `SplashScreen.tsx`。
 */
import type { HomeMediaItem } from '../homeMedia/shape';

export const SPLASH_SECONDS = 3;
export const SPLASH_SEEN_KEY = 'sxk_splash_seen';

/** 不出開屏的路徑：掃碼報告頁、交接落地頁、後台。家長是帶著別的事進來的。 */
export function isSplashFreePath(pathname: string): boolean {
  return (
    pathname.startsWith('/r/') ||
    pathname === '/handoff' ||
    pathname.startsWith('/handoff/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

/**
 * 該不該顯示開屏：
 * - 專案沒有首頁（B）→ 不
 * - 路徑是掃碼頁、交接落地、後台 → 不
 * - 這個分頁工作階段看過了 → 不（`seen` 讀不到時是 false：照樣顯示一次）
 * - 沒有啟用中的開屏素材（開關關著、讀失敗、逾時都是 null）→ 不
 */
export function shouldShowSplash(input: SplashContext & { splash: HomeMediaItem | null }): boolean {
  return splashPossible(input) && input.splash !== null;
}

export interface SplashContext {
  hasHome: boolean;
  pathname: string;
  seen: boolean;
}

/** 素材之外的條件都過了沒 —— 沒過就連端點都不必打。 */
export function splashPossible(input: SplashContext): boolean {
  return input.hasHome && !isSplashFreePath(input.pathname) && !input.seen;
}

/** 讀「這個分頁看過了」：storage 讀不到（隱私模式、被擋）當成沒看過。 */
export function readSplashSeen(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(SPLASH_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** 記下「看過了」：寫不進去就算了（最多下一次重新整理再看一次）。 */
export function writeSplashSeen(storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(SPLASH_SEEN_KEY, '1');
  } catch {
    // 寫不進去：不擋家長。
  }
}

/** `window.sessionStorage` 本身在某些瀏覽器設定下一讀就丟例外。 */
export function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

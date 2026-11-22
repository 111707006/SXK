/**
 * 換人提示（#120）在家長端的狀態：登入驗證、兌換碼、已登入點連結這三處收到的提示都放在這裡，
 * `ServiceSwitchPrompt` 訂閱它畫出來。家長選「不換」之後，**本次登入內**不再追問同一個來源（sessionStorage）。
 * 讀寫 sessionStorage 一律包 try/catch：不能用時照樣運作，只是不記「不換」。
 */
import { peekVisitLink } from '../utils/attribution';
import { switchSourceKey, type ServiceSwitchPrompt } from './switchSource';

const DECLINED_KEY = 'senxinkang_service_switch_declined';
const CHECKED_LINK_KEY = 'senxinkang_visit_link_checked';

let pending: ServiceSwitchPrompt | null = null;
const listeners = new Set<() => void>();

function readSet(key: string): string[] {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSet(key: string, values: string[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(values));
  } catch {
    // 不能寫：下次可能再問一次，不影響其他東西。
  }
}

function notify(): void {
  for (const l of listeners) l();
}

/** 收到一個提示：本次登入內選過「不換」的同一個來源不再掛。 */
export function offerServiceSwitch(prompt: ServiceSwitchPrompt): void {
  if (readSet(DECLINED_KEY).includes(switchSourceKey(prompt.source))) return;
  pending = prompt;
  notify();
}

export function pendingServiceSwitch(): ServiceSwitchPrompt | null {
  return pending;
}

/** 選「不換」：關掉，記下這個來源。 */
export function declineServiceSwitch(): void {
  if (pending) writeSet(DECLINED_KEY, [...new Set([...readSet(DECLINED_KEY), switchSourceKey(pending.source)])]);
  pending = null;
  notify();
}

/** 換好了、或要整個清掉（登出）。 */
export function clearServiceSwitch(): void {
  pending = null;
  notify();
}

export function subscribeServiceSwitch(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** 已登入時，這次進站的連結要不要打 `/api/service-relation/link`：同一條連結本次登入內只打一次。登入驗證已經帶過的也算。 */
export function shouldCheckVisitLink(): boolean {
  const link = peekVisitLink();
  if (!link) return false;
  const key = `${link.companySlug}:${link.referrerCode ?? ''}`;
  const checked = readSet(CHECKED_LINK_KEY);
  if (checked.includes(key)) return false;
  writeSet(CHECKED_LINK_KEY, [...checked, key]);
  return true;
}

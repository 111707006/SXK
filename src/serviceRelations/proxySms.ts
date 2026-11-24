/**
 * 代填之後寄給家長的登入簡訊（使用者 2026-11-24，開關 `PROXY_SMS`，只在專案 A）：規則與字串，前端與伺服器共用。
 *
 * - 簡訊裡的網址寫死在範本裡，只有短碼是變數：`https://<A>/g/${code}`。短碼就是「誰代填的」（推薦人 `t<編號>`、
 *   單位 `u<編號>`），伺服器轉到既有的進站連結 `?c=<單位>&t=<推薦人>`。它**不是登入憑據**：家長照樣用手機驗證碼登入，
 *   所以轉發出去也看不到孩子的資料。
 * - 第一次代填（扣了碼）自動寄；再代填不寄。可以手動重發，同一位家長 24 小時內最多一封送出成功的。
 */
import type { ProxyParty } from './rules';

/** 同一位家長兩封之間至少隔幾小時（送失敗的不算）。 */
export const PROXY_SMS_COOLDOWN_HOURS = 24;

/** 這段時間內最多試幾次（含送失敗的），免得一直打通道。 */
export const PROXY_SMS_MAX_ATTEMPTS = 5;

export type ProxySmsStatus = 'sent' | 'failed' | 'cooldown' | 'not_ready' | 'not_sent';

/** 代填、查找、重發的回應多帶的一欄；開關關著沒有這一欄。 */
export interface ProxySmsInfo {
  status: ProxySmsStatus;
  /** 給「复制连结」：站內路徑 `/g/<短碼>`。 */
  entryPath: string;
}

export function entryCodeOf(party: ProxyParty): string {
  return party.kind === 'referrer' ? `t${party.referrerId}` : `u${party.companyId}`;
}

export const entryPathOf = (code: string) => `/g/${code}`;

export function parseEntryCode(raw: unknown): { kind: 'referrer' | 'unit'; id: number } | null {
  const m = typeof raw === 'string' ? /^([tu])([1-9]\d{0,9})$/.exec(raw) : null;
  return m ? { kind: m[1] === 't' ? 'referrer' : 'unit', id: Number(m[2]) } : null;
}

/** `PROXY_SMS=1` 要同時開服務關係與訓練計劃（代填在它們之下）；B 不生效。 */
export function resolveProxySms(requested: boolean, ctx: { projectA: boolean; serviceRelations: boolean; trainingPlan: boolean }): boolean {
  if (!requested || !ctx.projectA) return false;
  if (!ctx.serviceRelations || !ctx.trainingPlan) {
    throw new Error('PROXY_SMS=1 需要同時開 SERVICE_RELATIONS=1 與 TRAINING_PLAN=1（代填在它們之下）');
  }
  return true;
}

export const PROXY_SMS_TEXT: Record<ProxySmsStatus, string> = {
  sent: '已发短信给家长，请家长点短信里的连结、用这支手机号登录。',
  failed: '短信没有送出。可以重发，或把连结复制给家长。',
  cooldown: `${PROXY_SMS_COOLDOWN_HOURS} 小时内已发过或试太多次，先不重发。可以把连结复制给家长。`,
  not_ready: '短信范本还没设定好，这次没有发。请把连结复制给家长。',
  not_sent: '这次没有发短信。需要的话可以发送，或把连结复制给家长。',
};

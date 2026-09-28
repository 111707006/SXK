/**
 * 後台「發簡訊邀請家長到 A 做深度評估」的規則（ADR-0009 第二期；使用者 2026-09-28：後台也要能一次發送）。
 * 伺服器與後台畫面共用，所以不 import node 的東西。
 *
 * 誰能收到邀請：有手機號、做過 T1、還沒到過 A（他的交接碼沒被用過）、7 天內沒有成功收過一封。
 * 伺服器發送前照這裡再判一次 —— 畫面上的勾選只是方便，不是閘門。
 */

/** 同一位家長兩封邀請之間至少隔幾天。 */
export const INVITE_COOLDOWN_DAYS = 7;

/** 一次請求最多發幾位。畫面把勾選的人切成這個大小一批一批送（簡訊通道一則一則打，一批太大請求會逾時）。 */
export const INVITE_BATCH_MAX = 50;

export type InviteStatus = 'eligible' | 'no_phone' | 'no_screening' | 'already_in_a' | 'recently_invited';

export interface InviteFacts {
  phone: string | null;
  hasScreening: boolean;
  /** 最近一次**送出成功**的邀請；送失敗的不算（那位家長沒收到）。 */
  lastInvitedAt: string | null;
  /** 他的交接碼最近一次被用的時間（按鈕或簡訊都算）＝已經到過 A。 */
  handoffUsedAt: string | null;
}

const DAY_MS = 24 * 3600 * 1000;

export function inviteStatus(facts: InviteFacts, now: Date): InviteStatus {
  if (!facts.phone || !/^1\d{10}$/.test(facts.phone)) return 'no_phone';
  if (!facts.hasScreening) return 'no_screening';
  if (facts.handoffUsedAt) return 'already_in_a';
  if (facts.lastInvitedAt) {
    const last = new Date(facts.lastInvitedAt).getTime();
    if (!Number.isNaN(last) && now.getTime() - last < INVITE_COOLDOWN_DAYS * DAY_MS) return 'recently_invited';
  }
  return 'eligible';
}

/** 後台列表與發送結果上的說法。 */
export const INVITE_STATUS_LABEL: Readonly<Record<InviteStatus, string>> = {
  eligible: '可邀请',
  no_phone: '没有手机号',
  no_screening: '还没做筛查',
  already_in_a: '已去做深度评估',
  recently_invited: `${INVITE_COOLDOWN_DAYS} 天内邀请过`,
};

/** 把勾選的 id 切成一批一批。 */
export function inviteBatches(ids: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += INVITE_BATCH_MAX) out.push(ids.slice(i, i + INVITE_BATCH_MAX));
  return out;
}

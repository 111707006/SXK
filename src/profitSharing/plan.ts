/**
 * 微信分账（ADR-0017，開關 `PROFIT_SHARING`）：一筆訂單「實際從微信分出去多少」。
 *
 * 【這一層】純函式：沒有 I/O、沒有時鐘。輸入是清分那一份快照算出的各方金額（`src/revenueSplit/split.ts`）、
 * 每個對方登記的分账接收方、商戶平台設定的最高分账比例；輸出是送給微信的接收方清單與「線下要補的」金額。
 *
 * 【為什麼會有線下要補的】
 * 1. 微信規定同一筆訂單分出去的合計 ≤ 訂單金額 × 最高分账比例（預設 30%，商戶平台 產品中心 → 分账 → 分账管理比例），
 *    也不能超過扣掉手續費的淨額。清分的預設是對方拿淨額的 80%，超過上限的那一段微信不讓分。
 * 2. 對方還沒登記接收方（或停用了）。
 * 兩種都**不猜、不丟掉**：記成 `offlineFen`，對帳表上看得到，由人線下結。
 *
 * 來源：
 * - 產品介紹（最高分账比例、冻结 30 天）：https://pay.weixin.qq.com/doc/v3/merchant/4012067962
 * - 接入易錯點（净额上限與比例上限取較小值）：https://pay.weixin.qq.com/doc/v3/merchant/4054257702
 */
import { BP_MAX, computeSplit, type SplitSnapshot } from '../revenueSplit/split';

export type PartyKind = 'company' | 'referrer';
export type ReceiverType = 'MERCHANT_ID' | 'PERSONAL_OPENID';

/** 與分账方的關係（添加分账接收方 API 的 `relation_type`，只收用得到的幾種）。 */
export const RELATION_TYPES = ['PARTNER', 'STAFF', 'DISTRIBUTOR', 'SUPPLIER'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** 後台登記的一個接收方（`profit_sharing_receivers` 一列）。 */
export interface Receiver {
  partyKind: PartyKind;
  refId: number;
  type: ReceiverType;
  /** 商戶號，或個人在服務號底下的 openid。 */
  account: string;
  /** 商戶全稱（`MERCHANT_ID` 必填，送出前加密）；個人不存姓名。 */
  name: string | null;
  relationType: RelationType;
  active: boolean;
  /** 微信那邊加過了沒有（沒加過的不能分）。 */
  registered: boolean;
}

export interface PlanLine {
  partyKind: PartyKind;
  refId: number;
  /** 清分算出來這一方該拿的。 */
  dueFen: number;
  /** 這一次從微信分出去的（0＝這一方全部線下結）。 */
  shareFen: number;
  /** 沒分出去的原因；都分出去了是 null。 */
  offlineReason: 'no_receiver' | 'over_cap' | null;
  receiver: Pick<Receiver, 'type' | 'account' | 'name'> | null;
}

export interface SharingPlan {
  /** `share`＝請求分账（同時解凍剩下的）；`unfreeze`＝沒有可分的，只解凍。 */
  action: 'share' | 'unfreeze';
  lines: PlanLine[];
  sharedFen: number;
  offlineFen: number;
  /** 這一筆訂單微信最多讓分多少。 */
  capFen: number;
}

export const keyOf = (kind: PartyKind, refId: number): string => `${kind}:${refId}`;

/** 清分快照 → 這一筆有哪幾方該拿錢（金額是 0 的不列）。 */
export function partiesDue(amountFen: number, s: SplitSnapshot): Array<{ partyKind: PartyKind; refId: number; dueFen: number }> {
  const a = computeSplit(amountFen, s);
  const out: Array<{ partyKind: PartyKind; refId: number; dueFen: number }> = [];
  const p = s.party;
  if ((p.kind === 'company' || p.kind === 'company_referrer') && a.companyFen > 0) {
    out.push({ partyKind: 'company', refId: p.companyId, dueFen: a.companyFen });
  }
  if ((p.kind === 'referrer' || p.kind === 'company_referrer') && a.referrerFen > 0) {
    out.push({ partyKind: 'referrer', refId: p.referrerId, dueFen: a.referrerFen });
  }
  return out;
}

/** 這一筆訂單微信最多讓分多少：金額 × 最高比例（往下取整），且不超過淨額。 */
export function capFen(amountFen: number, s: SplitSnapshot, maxBp: number): number {
  const net = computeSplit(amountFen, s).netFen;
  return Math.max(0, Math.min(net, Math.floor((amountFen * maxBp) / BP_MAX)));
}

/**
 * 訂單金額＋快照＋接收方 → 這一筆怎麼分。
 * 超過上限時各方**照比例縮**（往下取整，零頭不分）；沒有可用接收方的那一方整份線下結、不佔上限。
 */
export function planSharing(
  amountFen: number,
  s: SplitSnapshot,
  receivers: ReadonlyMap<string, Receiver>,
  maxBp: number,
): SharingPlan {
  const cap = capFen(amountFen, s, maxBp);
  const due = partiesDue(amountFen, s);
  const usable = (kind: PartyKind, refId: number): Receiver | null => {
    const r = receivers.get(keyOf(kind, refId));
    return r && r.active && r.registered ? r : null;
  };
  const withReceiver = due.filter(d => usable(d.partyKind, d.refId));
  const wanted = withReceiver.reduce((n, d) => n + d.dueFen, 0);
  const lines: PlanLine[] = due.map(d => {
    const r = usable(d.partyKind, d.refId);
    if (!r) return { ...d, shareFen: 0, offlineReason: 'no_receiver', receiver: null };
    const shareFen = wanted <= cap ? d.dueFen : Math.floor((d.dueFen * cap) / wanted);
    return {
      ...d,
      shareFen,
      offlineReason: shareFen < d.dueFen ? 'over_cap' : null,
      receiver: { type: r.type, account: r.account, name: r.name },
    };
  });
  const sharedFen = lines.reduce((n, l) => n + l.shareFen, 0);
  const dueFen = lines.reduce((n, l) => n + l.dueFen, 0);
  return { action: sharedFen > 0 ? 'share' : 'unfreeze', lines, sharedFen, offlineFen: dueFen - sharedFen, capFen: cap };
}

/** 開單時要不要帶 `profit_sharing: true`：至少一方有可用的接收方、而且分得出錢（否則白白冻结 30 天）。 */
export function shouldFlagOrder(amountFen: number, s: SplitSnapshot | null, receivers: ReadonlyMap<string, Receiver>, maxBp: number): boolean {
  if (!s || s.party.kind === 'none') return false;
  return planSharing(amountFen, s, receivers, maxBp).sharedFen > 0;
}

/** 商戶分账單號：`PS<訂單 id>A<第幾次>`（同一個單號重送等於一次；失敗後重試換一個）。 */
export function outOrderNo(paymentId: number, attempt: number): string {
  return `PS${paymentId}A${attempt}`;
}

// ── 設定 ──

export interface ProfitSharingConfig {
  /** 商戶平台設的最高分账比例（萬分比）。 */
  maxBp: number;
  /** 付款後幾天才分（退款期）。 */
  delayDays: number;
  /** 幾分鐘自動跑一輪；0＝只有後台按鈕。 */
  autoMinutes: number;
}

export const DEFAULT_MAX_BP = 3000;
export const DEFAULT_DELAY_DAYS = 7;
/** 冻结期 30 天，留 5 天餘裕給失敗重試。 */
export const MAX_DELAY_DAYS = 25;

function intIn(name: string, raw: string | undefined, dflt: number, min: number, max: number, hint: string): number {
  const v = (raw ?? '').trim();
  if (v === '') return dflt;
  const n = Number(v);
  if (!/^\d{1,5}$/.test(v) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name}="${raw}" is not recognised: ${hint}`);
  }
  return n;
}

/** 讀三個設定；認不得起不來。 */
export function readProfitSharingConfig(env: Record<string, string | undefined>): ProfitSharingConfig {
  const autoRaw = (env.PROFIT_SHARING_AUTO_MINUTES ?? '').trim();
  const autoMinutes = autoRaw === '' || autoRaw === '0' ? 0 : intIn('PROFIT_SHARING_AUTO_MINUTES', autoRaw, 0, 10, 1440, '0 (off) or 10–1440');
  return {
    maxBp: intIn('PROFIT_SHARING_MAX_BP', env.PROFIT_SHARING_MAX_BP, DEFAULT_MAX_BP, 1, BP_MAX, '1–10000 (3000 = 30%)'),
    delayDays: intIn('PROFIT_SHARING_DELAY_DAYS', env.PROFIT_SHARING_DELAY_DAYS, DEFAULT_DELAY_DAYS, 0, MAX_DELAY_DAYS, `0–${MAX_DELAY_DAYS}`),
    autoMinutes,
  };
}

// ── 後台輸入 ──

const MCHID = /^\d{8,12}$/;
const OPENID = /^[A-Za-z0-9_-]{20,64}$/;

export type ReceiverInput = Pick<Receiver, 'partyKind' | 'refId' | 'type' | 'account' | 'name' | 'relationType'>;

/** 後台送來的接收方；不對回錯誤句子（給管理員看）。 */
export function readReceiverInput(body: any): ReceiverInput | { error: string } {
  const partyKind = body?.partyKind;
  if (partyKind !== 'company' && partyKind !== 'referrer') return { error: '对象不正确。' };
  const refId = body?.refId;
  if (!(Number.isInteger(refId) && refId > 0)) return { error: '对象不正确。' };
  const type = body?.type;
  if (type !== 'MERCHANT_ID' && type !== 'PERSONAL_OPENID') return { error: '接收方类型不正确。' };
  const account = typeof body?.account === 'string' ? body.account.trim() : '';
  if (type === 'MERCHANT_ID' && !MCHID.test(account)) return { error: '商户号要是 8–12 位数字。' };
  if (type === 'PERSONAL_OPENID' && !OPENID.test(account)) return { error: 'openid 形状不对。' };
  const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
  if (type === 'MERCHANT_ID' && (rawName === '' || rawName.length > 100)) return { error: '请填商户全称（与对方微信支付商户号登记的名称一字不差）。' };
  const relationType = body?.relationType ?? 'PARTNER';
  if (!(RELATION_TYPES as readonly string[]).includes(relationType)) return { error: '关系类型不正确。' };
  return { partyKind, refId, type, account, name: type === 'MERCHANT_ID' ? rawName : null, relationType };
}

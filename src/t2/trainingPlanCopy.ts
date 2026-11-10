/**
 * 訓練計劃頁的字（客戶 10/22，#110；方案說明的字由客戶提供，**先放暫採字**，規格三 Further Notes）。
 * 伺服器的 `GET /api/training/plans` 與畫面都讀這一份。
 */
import type { PassMonths } from './trainingPass';

/**
 * 方案卡的字（客戶 2026-11-10 文字文稿16，照抄）：名稱、權益清單、底下一行「部分功能限免生效中」。
 * `blurb` 是手機版卡片那一行的短說明（取權益第一條以外的訓練天數）。
 * ⚠️ 「免费T2深度评估N次」「N次线上专业咨询」「专属客服」系統不計次（使用者 11/10：照文稿寫，人工兌現）。
 */
export const PLAN_BLURBS: Record<PassMonths, { title: string; blurb: string; features: string[] }> = {
  1: {
    title: '一个月',
    blurb: '30天线上家庭个性化训练',
    features: ['免费T1儿少综合发展评估', '30天线上家庭个性化训练', '30天线上专属客服服务'],
  },
  3: {
    title: '三个月',
    blurb: '90天线上家庭个性化训练',
    features: ['免费T1儿少综合发展评估', '免费T2深度评估1次', '90天线上家庭个性化训练', '90天线上专属客服服务', '1次线上专业咨询（每次10分钟）'],
  },
  6: {
    title: '六个月',
    blurb: '180天线上家庭个性化训练',
    features: ['免费T1儿少综合发展评估', '免费T2深度评估1次', '180天线上家庭个性化训练', '180天线上专属客服服务', '3次线上专业咨询（每次10分钟）'],
  },
  12: {
    title: '十二个月',
    blurb: '365天线上家庭个性化训练',
    features: ['免费T1儿少综合发展评估', '免费T2深度评估3次', '365天线上家庭个性化训练', '365天线上专属客服服务', '5次线上专业咨询（每次10分钟）'],
  },
};

/**
 * 方案的原價（劃掉的那一個）。客戶 2026-11-10 文字文稿16：原價 ¥199／399／699／999；實收照
 * `TRAINING_PLAN_PRICES_FEN`（正式站 `1:1990,3:2990,6:3990,12:9990`）。只是顯示用：實際收多少一律照伺服器
 * （`/api/training/plans` 的 `priceFen`）；原價不高於實收價時不畫。
 */
export const PLAN_LIST_PRICE_FEN: Partial<Record<PassMonths, number>> = { 1: 19900, 3: 39900, 6: 69900, 12: 99900 };

/** 分 → 「¥19.9」「¥199」。 */
export function planYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : fen % 10 === 0 ? 1 : 2)}`;
}

/** 這個方案要不要畫原價：有原價、實收價讀得到、而且原價比較高。 */
export function planListPriceFen(months: PassMonths, priceFen: number | null): number | null {
  const list = PLAN_LIST_PRICE_FEN[months];
  return list !== undefined && priceFen !== null && list > priceFen ? list : null;
}

export const TRAINING_PLAN_PAGE = {
  title: '线上家庭个性化训练',
  sub: '按孩子的评估结果安排每周的家庭活动。',
  /** 每張方案卡底下那一行（文字文稿16）。 */
  limitedFree: '部分功能限免生效中',
  pay: '开通',
  payUnavailable: '暂未开放',
  priceTbd: '价格待定',
  /** 劃掉的原價（`PLAN_LIST_PRICE_FEN`）。 */
  listPrice: (yuan: string) => `原价 ${yuan}`,
  redeemEntry: 'VIP 兑换',
  /** 「VIP 兑换」那一格（簡報 11/03 第 8 頁）。 */
  vipTitle: 'VIP 兑换',
  vipBlurb: '有 VIP 兑换码？输入后直接开通线上家庭训练。',
  /** 已經有使用權、沒有迄日（免費期）。 */
  activeNoEnd: '线上家庭训练已开通，现在可以直接开始。',
  /** 個人中心那一格的按鈕（2026-11-03）。 */
  profileRedeemHint: '有兑换码？点这里输入，开通居家训练',
  redeemPlaceholder: 'XXXX-XXXX-XX',
  redeemSubmit: '兑换',
  redeemInvalid: '兑换码不正确或已使用',
  redeemTooMany: '试得太多次了，请过一小时再试。',
  redeemNeedLogin: '请先登录，再输入兑换码。',
  activated: (endsOn: string) => `已开通，有效期至 ${Number(endsOn.slice(5, 7))} 月 ${Number(endsOn.slice(8, 10))} 日`,
  goTraining: '开始线上家庭训练',
} as const;

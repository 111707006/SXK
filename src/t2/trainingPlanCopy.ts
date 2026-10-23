/**
 * 訓練計劃頁的字（客戶 10/22，#110；方案說明的字由客戶提供，**先放暫採字**，規格三 Further Notes）。
 * 伺服器的 `GET /api/training/plans` 與畫面都讀這一份。
 */
import type { PassMonths } from './trainingPass';

export const PLAN_BLURBS: Record<PassMonths, { title: string; blurb: string }> = {
  1: { title: '一个月', blurb: '先试一个月：每周 3 个家庭活动，附示范片与打卡。' },
  3: { title: '三个月', blurb: '完整一期 12 周，期末按练习情况调整下一期的难度。' },
  6: { title: '六个月', blurb: '两期 24 周，适合需要长期陪练的方面。' },
};

export const TRAINING_PLAN_PAGE = {
  title: '线上家庭个性化训练',
  sub: '按孩子的评估结果安排每周的家庭活动。开通后 T1、T2 评估都免费。',
  pay: '开通',
  payUnavailable: '暂未开放',
  priceTbd: '价格待定',
  redeemEntry: '兑换码',
  redeemPlaceholder: 'XXXX-XXXX-XX',
  redeemSubmit: '兑换',
  redeemInvalid: '兑换码不正确或已使用',
  redeemTooMany: '试得太多次了，请过一小时再试。',
  redeemNeedLogin: '请先登录，再输入兑换码。',
  activated: (endsOn: string) => `已开通，到 ${Number(endsOn.slice(5, 7))} 月 ${Number(endsOn.slice(8, 10))} 日`,
  goTraining: '开始居家训练',
} as const;

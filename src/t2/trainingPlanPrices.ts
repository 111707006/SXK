/**
 * 訓練計劃的價錢（客戶 10/22，#111）：伺服器設定 `TRAINING_PLAN_PRICES_FEN`，寫成 `1:1990,3:2990,6:3990,12:9990`（分）。
 * 1、3、6 個月都要有；12 個月（客戶 11/10 文字文稿16 新加）可以不寫，不寫＝那張卡「价格待定」、不能付款
 * （舊的三段設定照樣起得來）。都是正整數；認不得讓程序起不來（打錯字的價錢比沒有價錢糟）。
 * 沒設＝價格待定（方案卡不能付款，只剩兌換碼）。
 */
import { PASS_MONTHS, type PassMonths } from './trainingPass';

export type PlanPrices = Partial<Record<PassMonths, number>>;

const REQUIRED_MONTHS: readonly PassMonths[] = [1, 3, 6];

export function resolvePlanPrices(raw: string | undefined): PlanPrices | null {
  const value = raw?.trim();
  if (!value) return null;
  const out: Partial<Record<number, number>> = {};
  for (const part of value.split(',')) {
    const m = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(part);
    if (!m) throw new Error(`TRAINING_PLAN_PRICES_FEN=${JSON.stringify(raw)} 认不得：要写成 1:1990,3:2990,6:3990,12:9990（分）。`);
    const months = Number(m[1]);
    const fen = Number(m[2]);
    if (!(PASS_MONTHS as readonly number[]).includes(months) || out[months] !== undefined || !(fen > 0) || fen > 10_000_000) {
      throw new Error(`TRAINING_PLAN_PRICES_FEN=${JSON.stringify(raw)}：月数只能是 1／3／6／12、各一次，价钱是正整数（分）。`);
    }
    out[months] = fen;
  }
  if (REQUIRED_MONTHS.some(m => out[m] === undefined)) {
    throw new Error(`TRAINING_PLAN_PRICES_FEN=${JSON.stringify(raw)}：1、3、6 个月三种都要有（12 个月可以不写）。`);
  }
  return out as PlanPrices;
}

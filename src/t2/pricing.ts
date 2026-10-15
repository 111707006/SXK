/**
 * T2 深度評估的價錢（使用者 2026-10-13 給的表）：照這次要做幾項深度評估分檔，**每 3 項跳一檔**。
 *
 * | 項數 | 套餐價 | 原價（指導價，劃掉） |
 * |------|--------|----------------------|
 * | 1–3  | ¥19.9  | ¥400／500／600       |
 * | 4–6  | ¥29.9  | ¥700／800／900       |
 * | 7–9  | ¥39.9  | ¥1000／1100／1200    |
 *
 * 「幾項」＝報告上那張卡寫的「N 项深度评估」（`entrancePromo.ts` 的 `count`），由伺服器的 plan 數：
 * 每個被標記、這個年齡有問卷的方面一份（暫行題量與完整版都是一個方面只出一份），所以就是表上「九維」那一欄。
 * 卡上顯示的與 `/api/payment/create` 實收的是**同一個函式、同一份 plan**（`server.ts` 的 `t2PlanFor`），不會一個算 4 項一個算 3 項。
 *
 * 單位一律是分（`utils/price.ts` 檔頭）。
 */

export const T2_MAX_PRICED_ITEMS = 9;

/** 套餐價（分），一檔三項：1–3、4–6、7–9。 */
const SALE_TIERS_FEN = [1990, 2990, 3990] as const;

/** 原價（分）：1 項 ¥400，每多一項 +¥100。 */
const GUIDE_BASE_FEN = 40000;
const GUIDE_STEP_FEN = 10000;

export interface T2Pricing {
  /** 計價的項數（1–9；超過 9 項照 9 項算）。 */
  items: number;
  /** 套餐價（分），實收這個。 */
  priceFen: number;
  /** 原價（分），只畫在卡上、劃掉，不參與計費。 */
  guidePriceFen: number;
}

/**
 * 幾項 → 價錢。0 項（沒有要做的）回 `null`：沒有東西可賣，呼叫端不該出價錢、也不該開單。
 * 不是正整數的輸入同樣回 `null` —— 算錯的項數不該變成某個價錢。
 */
export function t2PriceFor(items: number): T2Pricing | null {
  if (!Number.isInteger(items) || items <= 0) return null;
  const n = Math.min(items, T2_MAX_PRICED_ITEMS);
  return {
    items: n,
    priceFen: SALE_TIERS_FEN[Math.ceil(n / 3) - 1],
    guidePriceFen: GUIDE_BASE_FEN + (n - 1) * GUIDE_STEP_FEN,
  };
}

/**
 * 測試用的「可重複使用」碼（使用者 2026-11-10：給我們自己測試用，所有人都能用）。伺服器設定，不進資料庫：
 *
 * - `TEST_VIP_CODE`：在「VIP 兑换」輸入 → 每兌一次發一個月線上家庭訓練使用權（接在既有使用權後面），碼不會用掉。
 * - `TEST_COUPON_CODE`：在 T2「优惠码兑换」輸入 → 這位家長綁一張半價券（每位家長仍只能有一張，規則同一般優惠券），碼不會用掉。
 *
 * 形狀同一般兌換碼（10 碼、`src/redeem/codes.ts` 的字母表），大小寫與分隔符不拘。沒設＝沒有測試碼；設了但形狀不對 → 程序起不來
 * （打錯字的測試碼比沒有糟：測試的人以為設好了）。**傳出去就等於免費**：要停用就把那一行拿掉、重啟。
 */
import { normalizeCode } from './codes';

/** 測試 VIP 碼每兌一次發幾個月。 */
export const TEST_VIP_MONTHS = 1 as const;

/** 測試優惠碼的折法：半價（使用者 2026-11-10）。 */
export const TEST_COUPON_DISCOUNT = { kind: 'percent', value: 50 } as const;

/** 測試優惠碼那一批在 `coupon_batches.note` 上的記號（後台「优惠券」分頁看得到這一批與誰用過）。 */
export const TEST_COUPON_BATCH_NOTE = '测试优惠码（可重复使用）';

/** 讀一個測試碼設定：不設回 null；形狀不對丟錯。 */
export function resolveTestCode(name: string, raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null;
  const code = normalizeCode(raw.trim());
  if (!code) throw new Error(`${name} 认不得：要 10 码（字母表同兑换码，不含 0、1、I、O），例 ABCD-EFGH-JK。`);
  return code;
}

/** 兩個測試碼不能一樣（同一組碼不知道要當 VIP 還是優惠券）。 */
export function assertDistinctTestCodes(vip: string | null, coupon: string | null): void {
  if (vip && coupon && vip === coupon) throw new Error('TEST_VIP_CODE 与 TEST_COUPON_CODE 不能是同一组码。');
}

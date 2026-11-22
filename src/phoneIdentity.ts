/**
 * 專案 A 的身分開關（`A_PHONE_IDENTITY`，#115，ADR-0020 第 1 點）：家長的身分只看手機號。
 *
 * 開著時登入（與 B→A 交接）以手機號找帳號，不看連結帶的是哪個單位；資料層
 * `listUsersByPhone` 回這支手機號底下的每一個帳號（重複尚未合併時不止一個），
 * 這裡決定登入哪一個。規則固定：有報告或訂單的先，平手取 id 最小（最早建的）。
 * 與資料庫回來的順序無關 —— 同一位家長每次登入都要落在同一個帳號上。
 *
 * 伺服器專用（家長端不 import）。
 */

export interface PhoneAccountRow {
  id: number | string;
  phone: string | null;
  company_id: number | null;
  /** 這個帳號有沒有報告（`user_data.report_history` 非空）。0／1，MySQL 有時回字串。 */
  has_reports: number | string | boolean | null;
  /** 有沒有訂單（付款成功或已退款的 `payments`，或 `user_data.orders` 非空）。 */
  has_orders: number | string | boolean | null;
}

const truthy = (v: PhoneAccountRow['has_reports']) => v === true || Number(v) > 0;

const hasData = (row: PhoneAccountRow) => truthy(row.has_reports) || truthy(row.has_orders);

export function pickPhoneAccount<T extends PhoneAccountRow>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (!best) {
      best = row;
      continue;
    }
    const a = hasData(row);
    const b = hasData(best);
    if (a !== b ? a : Number(row.id) < Number(best.id)) best = row;
  }
  return best;
}

/**
 * 結算前的最後一道核對（2026-11-10 稽核）：微信說「這張單付了」時，付的是不是**我們開的那一張、那個金額**。
 *
 * 回調驗過簽，也只證明那段話是微信說的；不證明金額、商戶號、應用號跟我們的訂單對得上。對不上的情況
 * （商戶號底下另一個應用的單、改過金額的單、我們自己開單時算錯）一律**不發權益**，記一筆錯誤讓人去查 ——
 * 寧可家長來問，不可少收錢還發了東西，也不可把別人的單算成這一張。
 *
 * 讀不到的欄位當成對不上：微信的回調與查單都一定帶這三樣，缺了就是形狀不對。
 */
export interface PaidOrderFacts {
  appid: unknown;
  mchid: unknown;
  /** 訂單總金額（分），微信的 `amount.total` */
  totalFen: unknown;
}

export interface ExpectedOrder {
  appid: string;
  mchid: string;
  amountFen: number;
}

export type PaidOrderCheck = { ok: true } | { ok: false; reason: string };

export function checkPaidOrder(paid: PaidOrderFacts, expected: ExpectedOrder): PaidOrderCheck {
  if (paid.mchid !== expected.mchid) return { ok: false, reason: `mchid ${String(paid.mchid)} ≠ ${expected.mchid}` };
  if (paid.appid !== expected.appid) return { ok: false, reason: `appid ${String(paid.appid)} ≠ ${expected.appid}` };
  if (typeof paid.totalFen !== 'number' || !Number.isInteger(paid.totalFen)) {
    return { ok: false, reason: `amount.total is ${String(paid.totalFen)}` };
  }
  if (paid.totalFen !== expected.amountFen) return { ok: false, reason: `amount ${paid.totalFen} ≠ order ${expected.amountFen}` };
  return { ok: true };
}

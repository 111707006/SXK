import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { t2PriceFor } from '../src/t2/pricing';

/** T2 深度評估的價錢（使用者 2026-10-13 的表）：每 3 項跳一檔，原價 1 項 ¥400、每多一項 +¥100。 */
describe('t2PriceFor', () => {
  it('逐格對使用者的表', () => {
    const table: Array<[number, number, number]> = [
      [1, 1990, 40000], [2, 1990, 50000], [3, 1990, 60000],
      [4, 2990, 70000], [5, 2990, 80000], [6, 2990, 90000],
      [7, 3990, 100000], [8, 3990, 110000], [9, 3990, 120000],
    ];
    for (const [items, priceFen, guidePriceFen] of table) {
      expect(t2PriceFor(items), `${items} 项`).toEqual({ items, priceFen, guidePriceFen });
    }
  });

  it('超過 9 項照 9 項算；0 項或不是正整數沒有價錢', () => {
    expect(t2PriceFor(12)).toEqual(t2PriceFor(9));
    for (const bad of [0, -1, 2.5, NaN]) expect(t2PriceFor(bad), String(bad)).toBeNull();
  });

  it('伺服器：plan 附上 pricing，下單照同一份 plan 收（不是固定單價）', () => {
    const server = readFileSync(path.join(__dirname, '..', 'server.ts'), 'utf8');
    // 填表人 v2（#70）開著時後面多一個 `raterV2: true`
    expect(server).toContain("res.json({ ...outcome.plan, pricing: t2PriceFor(outcome.items)");
    const create = server.slice(server.indexOf("paidOnly.post('/api/payment/create'"), server.indexOf('async function settlePayment'));
    expect(create).toContain('await t2PlanFor(userId)');
    expect(create).toContain('amountFen = pricing.priceFen');
    expect(create).not.toContain('amountFen: UNLOCK_PRICE_FEN');
  });
});

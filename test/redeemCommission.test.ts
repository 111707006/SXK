import { describe, it, expect } from 'vitest';
import { ratesFromRecords, redeemCommission } from '../src/revenueSplit/redeemCommission';
import type { SplitRates } from '../src/revenueSplit/split';

/** 兌換碼的佣金（ADR-0020 第 7 點，#122）：面額照訓練計劃價錢、單位與推薦人照清分的公司比例分（暫採）。 */
const EMPTY: SplitRates = { default: { platformBp: null, companyBp: null }, company: new Map(), referrer: new Map() };
const PRICES = { 1: 2990, 3: 7990, 6: 13990 };
const used = { months: 3, status: 'used' as const, referrerId: 7, companyId: 3 };

describe('redeemCommission', () => {
  it('預設：單位 20%、推薦人 80%，單位往下取整、零頭歸推薦人', () => {
    expect(redeemCommission(used, PRICES, EMPTY)).toEqual({ faceFen: 7990, companyFen: 1598, referrerFen: 6392 });
    expect(redeemCommission({ ...used, months: 1 }, PRICES, EMPTY)).toEqual({ faceFen: 2990, companyFen: 598, referrerFen: 2392 });
  });

  it('比例往上一層找：推薦人 → 單位 → 預設', () => {
    const rates: SplitRates = {
      default: { platformBp: null, companyBp: 3000 },
      company: new Map([[3, { platformBp: null, companyBp: 1000 }]]),
      referrer: new Map([[7, { platformBp: null, companyBp: 2500 }]]),
    };
    expect(redeemCommission(used, PRICES, rates)!.companyFen).toBe(1997);
    expect(redeemCommission(used, PRICES, { ...rates, referrer: new Map() })!.companyFen).toBe(799);
    expect(redeemCommission(used, PRICES, { ...rates, referrer: new Map(), company: new Map() })!.companyFen).toBe(2397);
  });

  it('空白（null）：沒用過、作廢、沒價錢、那個月數沒價錢、推薦人沒有單位', () => {
    expect(redeemCommission({ ...used, status: 'unused' }, PRICES, EMPTY)).toBeNull();
    expect(redeemCommission({ ...used, status: 'void' }, PRICES, EMPTY)).toBeNull();
    expect(redeemCommission(used, null, EMPTY)).toBeNull();
    expect(redeemCommission({ ...used, months: 12 }, PRICES, EMPTY)).toBeNull();
    expect(redeemCommission({ ...used, companyId: null }, PRICES, EMPTY)).toBeNull();
  });

  it('加總等於面額、都不是負的', () => {
    for (const face of [1, 7, 2990, 123457]) {
      for (const bp of [0, 1, 2000, 9999, 10000]) {
        const c = redeemCommission(used, { 3: face }, { ...EMPTY, default: { platformBp: null, companyBp: bp } })!;
        expect(c.companyFen + c.referrerFen).toBe(face);
        expect(Math.min(c.companyFen, c.referrerFen)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('ratesFromRecords', () => {
  it('後台的比例列 → 設定', () => {
    const r = ratesFromRecords([
      { scope: 'default', refId: 0, platformBp: 2500, companyBp: null },
      { scope: 'company', refId: 3, platformBp: null, companyBp: 1000 },
      { scope: 'referrer', refId: 7, platformBp: null, companyBp: 500 },
    ]);
    expect(r.default).toEqual({ platformBp: 2500, companyBp: null });
    expect(r.company.get(3)).toEqual({ platformBp: null, companyBp: 1000 });
    expect(r.referrer.get(7)).toEqual({ platformBp: null, companyBp: 500 });
  });
});

describe('單位層的碼（#124，沒有推薦人）', () => {
  const RATES: SplitRates = ratesFromRecords([]);
  it('整個面額歸單位、推薦人 0', () => {
    expect(redeemCommission({ months: 1, status: 'used', referrerId: null, companyId: 7 }, { 1: 2990 }, RATES)).toEqual({
      faceFen: 2990,
      companyFen: 2990,
      referrerFen: 0,
    });
  });
});

describe('對帳表的單位層那一列（#124）', () => {
  it('推薦人那兩格：名字空白、類型寫「单位层」', async () => {
    const { redeemLedgerRows } = await import('../src/admin/redeemXlsx');
    const [cells] = redeemLedgerRows([
      { referrerId: null, referrerName: null, referrerKind: null, companyId: 7, companyName: '甲机构', code: 'AAAAAAAAA2', months: 1, status: 'unused', usedByPhone: null, usedAt: null, passEndsOn: null },
    ]);
    expect(cells.slice(0, 2)).toEqual(['', '单位层']);
  });
});

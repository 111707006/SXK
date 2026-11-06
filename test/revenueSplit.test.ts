import { describe, it, expect } from 'vitest';
import {
  bpFromPercent,
  computeSplit,
  parseSnapshot,
  percentLabel,
  resolveFeeBp,
  resolveSplit,
  type SplitAttribution,
  type SplitRates,
} from '../src/revenueSplit/split';
import { ledgerByParty, ledgerRows, ledgerTotals } from '../src/revenueSplit/ledger';
import { ratesFromRows } from '../src/db/revenueSplit';

/** 清分（客戶 11/03〈清分〉，ADR-0016）：誰是對方、比例往上一層找、金額怎麼取整。 */

const EMPTY: SplitRates = { default: { platformBp: null, companyBp: null }, company: new Map(), referrer: new Map() };
const ACME = { id: 3, name: '某某康复' };
const WANG = { id: 7, name: '王老师', kind: 'therapist' as const, company: ACME };
const LI = { id: 8, name: '李渠道', kind: 'channel' as const, company: null };
const who = (over: Partial<SplitAttribution>): SplitAttribution => ({ company: null, referrer: null, ...over });

describe('resolveSplit：誰是對方', () => {
  it('沒有合作方：全部是平台的', () => {
    const s = resolveSplit(EMPTY, who({}));
    expect(s.party).toEqual({ kind: 'none' });
    expect(computeSplit(19900, s)).toMatchObject({ companyFen: 0, referrerFen: 0 });
  });

  it('只有合作公司（進站代號）：平台 20%、公司 80%（預設）', () => {
    const s = resolveSplit(EMPTY, who({ company: ACME }));
    expect(s).toMatchObject({ party: { kind: 'company', companyId: 3, companyName: '某某康复' }, platformBp: 2000, companyBp: null });
  });

  it('推薦人沒有隸屬公司：平台 20%、推薦人 80%', () => {
    const s = resolveSplit(EMPTY, who({ referrer: LI }));
    expect(s).toMatchObject({ party: { kind: 'referrer', referrerId: 8 }, platformBp: 2000 });
  });

  it('公司旗下的治療師：三方，平台 20%，公司與治療師 20%／80%', () => {
    const s = resolveSplit(EMPTY, who({ referrer: WANG }));
    expect(s).toMatchObject({ party: { kind: 'company_referrer', companyId: 3, referrerId: 7, referrerKind: 'therapist' }, platformBp: 2000, companyBp: 2000 });
  });

  it('綁了推薦人就看推薦人那一邊，不看帳號上的公司（暫採）', () => {
    const s = resolveSplit(EMPTY, who({ company: { id: 9, name: '別家' }, referrer: LI }));
    expect(s.party.kind).toBe('referrer');
  });
});

describe('resolveSplit：比例往上一層找', () => {
  const rates: SplitRates = {
    default: { platformBp: 2500, companyBp: 3000 },
    company: new Map([[3, { platformBp: 1500, companyBp: null }]]),
    referrer: new Map([
      [7, { platformBp: null, companyBp: 1000 }],
      [8, { platformBp: 1000, companyBp: null }],
    ]),
  };

  it('公司覆寫平台比例；三方時公司／治療師看推薦人自己的', () => {
    expect(resolveSplit(rates, who({ referrer: WANG }))).toMatchObject({ platformBp: 1500, companyBp: 1000 });
  });

  it('推薦人沒設公司／治療師比例 → 公司的 → 預設的', () => {
    const r2: SplitRates = { ...rates, referrer: new Map() };
    expect(resolveSplit(r2, who({ referrer: WANG }))).toMatchObject({ platformBp: 1500, companyBp: 3000 });
  });

  it('隸屬公司的推薦人，平台比例不看推薦人自己的（看公司）', () => {
    const r3: SplitRates = { ...rates, referrer: new Map([[7, { platformBp: 500, companyBp: null }]]) };
    expect(resolveSplit(r3, who({ referrer: WANG })).platformBp).toBe(1500);
  });

  it('獨立推薦人看自己的；公司沒設看預設', () => {
    expect(resolveSplit(rates, who({ referrer: LI })).platformBp).toBe(1000);
    expect(resolveSplit(rates, who({ company: { id: 4, name: '没设的' } })).platformBp).toBe(2500);
  });

  it('資料庫的列 → 設定（ratesFromRows）', () => {
    const r = ratesFromRows([
      { scope: 'default', ref_id: 0, platform_bp: 2500, company_bp: null },
      { scope: 'company', ref_id: 3, platform_bp: null, company_bp: 1000 },
      { scope: 'referrer', ref_id: 7, platform_bp: '500', company_bp: null },
    ]);
    expect(r.default).toEqual({ platformBp: 2500, companyBp: null });
    expect(r.company.get(3)).toEqual({ platformBp: null, companyBp: 1000 });
    expect(r.referrer.get(7)).toEqual({ platformBp: 500, companyBp: null });
  });
});

describe('computeSplit：扣手續費之後分、零頭歸平台', () => {
  it('¥199、手續費 0.6%、三方預設', () => {
    const s = resolveSplit(EMPTY, who({ referrer: WANG }), 60);
    // 手續費 119.4 → 119；淨額 19781；對方 80% → 15824（往下取整）；公司 20% → 3164；治療師 12660；平台 3957
    expect(computeSplit(19900, s)).toEqual({ amountFen: 19900, feeFen: 119, netFen: 19781, platformFen: 3957, companyFen: 3164, referrerFen: 12660 });
  });

  it('各種金額與比例：加總恆等於淨額，每一份都不是負的', () => {
    for (const amount of [0, 1, 7, 99, 1990, 19900, 39900, 123457]) {
      for (const platformBp of [0, 1, 2000, 3333, 10000]) {
        for (const companyBp of [0, 2000, 10000]) {
          const s = resolveSplit({ default: { platformBp, companyBp }, company: new Map(), referrer: new Map() }, who({ referrer: WANG }), 60);
          const a = computeSplit(amount, s);
          expect(a.platformFen + a.companyFen + a.referrerFen).toBe(a.netFen);
          expect(a.feeFen + a.netFen).toBe(amount);
          for (const v of Object.values(a)) expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('平台 0%：對方拿全部淨額', () => {
    const s = resolveSplit({ ...EMPTY, default: { platformBp: 0, companyBp: null } }, who({ company: ACME }), 0);
    expect(computeSplit(1000, s)).toMatchObject({ platformFen: 0, companyFen: 1000 });
  });
});

describe('快照讀回、輸入檢查', () => {
  it('存進去的讀得回來；形狀不對回 null', () => {
    const s = resolveSplit(EMPTY, who({ referrer: WANG }));
    expect(parseSnapshot(JSON.stringify(s))).toEqual(s);
    expect(parseSnapshot(s)).toEqual(s);
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('{')).toBeNull();
    expect(parseSnapshot({ ...s, v: 2 })).toBeNull();
    expect(parseSnapshot({ ...s, platformBp: 12000 })).toBeNull();
    expect(parseSnapshot({ ...s, companyBp: null })).toBeNull();
    expect(parseSnapshot({ ...s, party: { kind: 'company' } })).toBeNull();
  });

  it('百分比 → 萬分比', () => {
    expect(bpFromPercent('20')).toBe(2000);
    expect(bpFromPercent('12.5')).toBe(1250);
    expect(bpFromPercent(0)).toBe(0);
    expect(bpFromPercent('100')).toBe(10000);
    expect(bpFromPercent(null)).toBeNull();
    expect(bpFromPercent('')).toBeNull();
    for (const bad of ['101', '-1', 'abc', '1.234', 12.345, true]) expect(bpFromPercent(bad), String(bad)).toBeUndefined();
    expect(percentLabel(2000)).toBe('20%');
    expect(percentLabel(1250)).toBe('12.5%');
  });

  it('WECHAT_FEE_BP：不設＝60；認不得起不來', () => {
    expect(resolveFeeBp(undefined)).toBe(60);
    expect(resolveFeeBp('38')).toBe(38);
    for (const bad of ['0.6', 'abc', '-1', '5000']) expect(() => resolveFeeBp(bad), bad).toThrow(/WECHAT_FEE_BP/);
  });
});

describe('對帳', () => {
  const s3 = resolveSplit(EMPTY, who({ referrer: WANG }), 60);
  const s2 = resolveSplit(EMPTY, who({ company: ACME }), 60);
  const order = (id: number, snapshot: unknown, status: 'success' | 'refunded' = 'success') => ({
    id, userId: id, outTradeNo: `N${id}`, transactionId: null, scope: 'plan' as const, months: 3, amountFen: 29900, status, paidAt: '2026-11-07T02:00:00Z', snapshot,
  });

  it('每一列：對方與比例的字、金額；沒快照寫「未记录」', () => {
    const rows = ledgerRows([order(1, s3), order(2, null)]);
    expect(rows[0]).toMatchObject({ product: '训练计划 3 个月', party: '某某康复 ＋ 王老师（治疗师）', rates: '平台 20% · 公司 20%／治疗师 80%' });
    expect(rows[0].amounts!.netFen).toBe(29900 - 179);
    expect(rows[1]).toMatchObject({ party: '未记录', amounts: null });
  });

  it('合計只算付款成功、有快照的；依對方合計', () => {
    const rows = ledgerRows([order(1, s3), order(2, s2), order(3, s2, 'refunded'), order(4, null)]);
    const t = ledgerTotals(rows);
    expect(t.orders).toBe(2);
    expect(t.unrecorded).toBe(1);
    expect(t.amountFen).toBe(59800);
    expect(t.platformFen + t.companyFen + t.referrerFen).toBe(t.netFen);
    const by = ledgerByParty(rows);
    expect(by.map(b => b.party).sort()).toEqual(['合作公司 · 某某康复', '某某康复 ＋ 王老师（治疗师）'].sort());
    expect(by.find(b => b.party === '合作公司 · 某某康复')!.orders).toBe(1);
  });
});

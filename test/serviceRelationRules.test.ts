import { describe, it, expect } from 'vitest';
import {
  canReassign,
  decideAttach,
  proxyAccess,
  proxyTarget,
  relationAfterConsent,
  resolveLinkSource,
  type ReassignActor,
  type RelationSource,
  type ServiceRelation,
} from '../src/serviceRelations/rules';

/**
 * 服務關係規則（#118，ADR-0020 第 3、6 點；#114「服務關係規則」）：掛上／問家長／不動、改派權限。
 * 純函式，窮舉組合。寫法參照 `test/companyScope.test.ts`：不確定的時候一律當作不動、不准。
 */

// 單位 1 底下兩位推薦人（张 11、李 12），單位 2 底下一位（王 21）。
const UNIT_A = 1;
const UNIT_B = 2;
const ZHANG = 11;
const LI = 12;
const WANG = 21;

const CURRENTS: Record<string, ServiceRelation | null> = {
  沒有關係: null,
  同單位同推薦人: { companyId: UNIT_A, referrerId: ZHANG },
  同單位不同推薦人: { companyId: UNIT_A, referrerId: LI },
  同單位還沒標注: { companyId: UNIT_A, referrerId: null },
  不同單位: { companyId: UNIT_B, referrerId: WANG },
  不同單位還沒標注: { companyId: UNIT_B, referrerId: null },
};

// 來源都指向單位 1（推薦人连结與兌換碼指向张）。
const SOURCES: Record<string, RelationSource> = {
  單位連結: { kind: 'company_link', companyId: UNIT_A },
  推薦人連結: { kind: 'referrer_link', companyId: UNIT_A, referrerId: ZHANG },
  兌換碼: { kind: 'code', companyId: UNIT_A, referrerId: ZHANG },
};

/** 期望：a＝直接掛上、q＝問家長、k＝不動。 */
const EXPECTED: Record<string, Record<string, 'a' | 'q' | 'k'>> = {
  沒有關係: { 單位連結: 'a', 推薦人連結: 'a', 兌換碼: 'a' },
  同單位同推薦人: { 單位連結: 'k', 推薦人連結: 'k', 兌換碼: 'k' },
  同單位不同推薦人: { 單位連結: 'k', 推薦人連結: 'q', 兌換碼: 'q' },
  同單位還沒標注: { 單位連結: 'k', 推薦人連結: 'q', 兌換碼: 'q' },
  不同單位: { 單位連結: 'q', 推薦人連結: 'q', 兌換碼: 'q' },
  不同單位還沒標注: { 單位連結: 'q', 推薦人連結: 'q', 兌換碼: 'q' },
};

const targetOf = (s: RelationSource): ServiceRelation => ({
  companyId: s.companyId,
  referrerId: s.kind === 'company_link' ? null : s.referrerId,
});

describe('decideAttach：現在的服務關係 × 這次的來源', () => {
  const cases = Object.keys(CURRENTS).flatMap(c => Object.keys(SOURCES).map(s => [c, s] as const));

  it('窮舉表涵蓋每一格', () => {
    expect(cases).toHaveLength(Object.keys(EXPECTED).length * 3);
  });

  it.each(cases)('%s × %s', (c, s) => {
    const current = CURRENTS[c];
    const source = SOURCES[s];
    const decision = decideAttach(current, source);
    const want = EXPECTED[c][s];
    if (want === 'a') expect(decision).toEqual({ kind: 'attach', to: targetOf(source) });
    if (want === 'q') expect(decision).toEqual({ kind: 'ask', current, to: targetOf(source) });
    if (want === 'k') expect(decision).toEqual({ kind: 'keep' });
  });

  it.each(Object.keys(CURRENTS))('來源無效（null）× %s：不動', c => {
    expect(decideAttach(CURRENTS[c], null)).toEqual({ kind: 'keep' });
  });

  it('不同單位的單位連結：問家長，換成那個單位、還沒標注', () => {
    expect(decideAttach(CURRENTS['不同單位'], { kind: 'company_link', companyId: UNIT_A })).toEqual({
      kind: 'ask',
      current: { companyId: UNIT_B, referrerId: WANG },
      to: { companyId: UNIT_A, referrerId: null },
    });
  });

  it('不改傳進來的物件', () => {
    const current = { companyId: UNIT_A, referrerId: LI };
    const frozen = Object.freeze({ ...current });
    decideAttach(frozen, Object.freeze({ ...SOURCES['推薦人連結'] }));
    expect(frozen).toEqual(current);
  });
});

describe('relationAfterConsent：家長選「換」之後，伺服器重算一次再寫', () => {
  it.each(Object.keys(CURRENTS).flatMap(c => Object.keys(SOURCES).map(s => [c, s] as const)))(
    '%s × %s：要問或要掛上才寫，否則不寫',
    (c, s) => {
      const want = EXPECTED[c][s];
      const after = relationAfterConsent(CURRENTS[c], SOURCES[s]);
      expect(after).toEqual(want === 'k' ? null : targetOf(SOURCES[s]));
    },
  );

  it('來源無效：不寫', () => {
    expect(relationAfterConsent(CURRENTS['不同單位'], null)).toBeNull();
  });
});

describe('resolveLinkSource：連結上的代號對到的單位與推薦人', () => {
  const unit = { id: UNIT_A, active: true };
  const zhang = { id: ZHANG, companyId: UNIT_A, active: true };

  it('只帶單位：單位連結', () => {
    expect(resolveLinkSource(unit, null)).toEqual({ kind: 'company_link', companyId: UNIT_A });
  });

  it('單位＋本單位的推薦人：推薦人連結', () => {
    expect(resolveLinkSource(unit, zhang)).toEqual({ kind: 'referrer_link', companyId: UNIT_A, referrerId: ZHANG });
  });

  it('推薦人不屬於該單位：當作只帶單位', () => {
    expect(resolveLinkSource(unit, { id: WANG, companyId: UNIT_B, active: true }))
      .toEqual({ kind: 'company_link', companyId: UNIT_A });
  });

  it('推薦人沒有單位（遷移前的舊資料）：當作只帶單位', () => {
    expect(resolveLinkSource(unit, { id: 99, companyId: null, active: true }))
      .toEqual({ kind: 'company_link', companyId: UNIT_A });
  });

  it('推薦人停用：當作只帶單位', () => {
    expect(resolveLinkSource(unit, { ...zhang, active: false })).toEqual({ kind: 'company_link', companyId: UNIT_A });
  });

  it('單位停用或沒有單位：沒有來源（推薦人再對也一樣）', () => {
    expect(resolveLinkSource({ id: UNIT_A, active: false }, zhang)).toBeNull();
    expect(resolveLinkSource(null, zhang)).toBeNull();
    expect(resolveLinkSource(null, null)).toBeNull();
  });
});

describe('canReassign：改派權限', () => {
  const RELS: Record<string, ServiceRelation | null> = {
    無: null,
    'A/张': { companyId: UNIT_A, referrerId: ZHANG },
    'A/李': { companyId: UNIT_A, referrerId: LI },
    'A/未標': { companyId: UNIT_A, referrerId: null },
    'B/王': { companyId: UNIT_B, referrerId: WANG },
    'B/未標': { companyId: UNIT_B, referrerId: null },
  };
  const pairs = Object.keys(RELS).flatMap(f => Object.keys(RELS).map(t => [f, t] as const));

  const globalAdmin: ReassignActor = { role: 'global_admin' };
  const managerA: ReassignActor = { role: 'unit_manager', companyId: UNIT_A };
  const referrerZhang: ReassignActor = { role: 'referrer', referrerId: ZHANG, companyId: UNIT_A };

  it.each(pairs)('全域管理員 %s → %s：都可以（含拿掉、從直屬掛上）', (f, t) => {
    expect(canReassign(globalAdmin, RELS[f], RELS[t])).toBe(true);
  });

  it.each(pairs)('單位管理者（A）%s → %s：改之前、改之後都在 A 才可以', (f, t) => {
    const inA = (r: ServiceRelation | null) => r !== null && r.companyId === UNIT_A;
    expect(canReassign(managerA, RELS[f], RELS[t])).toBe(inA(RELS[f]) && inA(RELS[t]));
  });

  it.each(pairs)('推薦人 %s → %s：一律不可以（不能手動認領）', (f, t) => {
    expect(canReassign(referrerZhang, RELS[f], RELS[t])).toBe(false);
  });
});

describe('proxyAccess：代填能不能碰這位家長（#124）', () => {
  const asReferrer = { kind: 'referrer' as const, referrerId: ZHANG, companyId: UNIT_A };
  const asUnit = { kind: 'unit' as const, companyId: UNIT_A };
  const WANT: Record<string, { referrer: string; unit: string }> = {
    沒有關係: { referrer: 'unbound', unit: 'unbound' },
    同單位同推薦人: { referrer: 'mine', unit: 'mine' },
    同單位不同推薦人: { referrer: 'other', unit: 'mine' },
    同單位還沒標注: { referrer: 'other', unit: 'mine' },
    不同單位: { referrer: 'other', unit: 'other' },
    不同單位還沒標注: { referrer: 'other', unit: 'other' },
  };
  it.each(Object.keys(CURRENTS))('%s（篩查渠道是本單位）', c => {
    expect(proxyAccess(asReferrer, CURRENTS[c], UNIT_A)).toBe(WANT[c].referrer);
    expect(proxyAccess(asUnit, CURRENTS[c], UNIT_A)).toBe(WANT[c].unit);
  });

  it('沒有服務關係、篩查渠道不是本單位（直屬或別單位進來的）：不能碰——不能靠打手機號認領，要全域管理員先指派（review）', () => {
    for (const channel of [null, UNIT_B]) {
      expect(proxyAccess(asReferrer, null, channel)).toBe('other');
      expect(proxyAccess(asUnit, null, channel)).toBe('other');
    }
  });

  it('有服務關係時不看篩查渠道', () => {
    expect(proxyAccess(asUnit, { companyId: UNIT_A, referrerId: null }, UNIT_B)).toBe('mine');
  });

  it('代填之後要掛的服務關係：推薦人＝他與他的單位；單位＝那個單位、推薦人空', () => {
    expect(proxyTarget(asReferrer)).toEqual({ companyId: UNIT_A, referrerId: ZHANG });
    expect(proxyTarget(asUnit)).toEqual({ companyId: UNIT_A, referrerId: null });
  });
});

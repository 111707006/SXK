import { readFileSync } from 'node:fs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { unitsMergedView, visibleTabs, type AdminCenterShape } from '../src/admin/adminView';
import type { AdminIdentityView } from '../src/admin/adminApi';
import { assertValidAdminUnitsMerged } from '../vite.config';

/**
 * 「后台帐号」併進「合作单位」（建置期開關 `VITE_ADMIN_UNITS_MERGED`）：開關 1、專案 A、開了合作單位，三個都成立才拿掉「后台帐号」分頁。
 * 其他情況分頁清單一格都不能變。
 */
const A_UNITS: AdminCenterShape = { multiCompany: true, projectA: true };
const A_PLAIN: AdminCenterShape = { multiCompany: false, projectA: true };
const B: AdminCenterShape = { multiCompany: true };

const god: AdminIdentityView = { role: 'global_admin', email: 'g@x.com', companyId: null, selection: { kind: 'company', companyId: 1 } };
const member: AdminIdentityView = { role: 'company_member', email: 'm@x.com', companyId: 7, selection: null };
const therapist: AdminIdentityView = { ...member, referrer: true };
const referrer: AdminIdentityView = { role: 'referrer', email: 'r@x.com', companyId: null, selection: null };

/** 開這張票之前全域管理員看到的分頁（照抄當時的 visibleTabs 結果）。 */
const BEFORE: Record<'A_UNITS' | 'A_PLAIN' | 'B', Array<{ id: string; label: string }>> = {
  A_UNITS: [
    { id: 'parents', label: '家长列表' },
    { id: 'specialists', label: '专家名单' },
    { id: 'company', label: '本机构设定' },
    { id: 'companies', label: '合作单位' },
    { id: 'adminUsers', label: '后台帐号' },
    { id: 'summary', label: '跨单位汇总' },
    { id: 'activities', label: '活动库' },
    { id: 'videos', label: '示范片与标签' },
    { id: 'homeMedia', label: '首页素材' },
    { id: 'legal', label: '条款' },
    { id: 'referrers', label: '兑换码与优惠券' },
    { id: 'revenueSplit', label: '清分' },
  ],
  A_PLAIN: [
    { id: 'parents', label: '家长列表' },
    { id: 'specialists', label: '专家名单' },
    { id: 'adminUsers', label: '后台帐号' },
    { id: 'activities', label: '活动库' },
    { id: 'videos', label: '示范片与标签' },
    { id: 'homeMedia', label: '首页素材' },
    { id: 'legal', label: '条款' },
    { id: 'referrers', label: '兑换码与优惠券' },
    { id: 'revenueSplit', label: '清分' },
  ],
  B: [
    { id: 'parents', label: '家长列表' },
    { id: 'specialists', label: '专家名单' },
    { id: 'company', label: '本机构设定' },
    { id: 'companies', label: '合作公司' },
    { id: 'adminUsers', label: '后台帐号' },
    { id: 'summary', label: '跨公司汇总' },
    { id: 'activities', label: '活动库' },
  ],
};
const SHAPES = { A_UNITS, A_PLAIN, B } as const;

describe('開關關著：分頁與現在完全相同', () => {
  for (const name of ['A_UNITS', 'A_PLAIN', 'B'] as const) {
    it(`${name}：不給選項、給 false 都一樣，而且等於開票前`, () => {
      expect(visibleTabs(god, SHAPES[name])).toEqual(BEFORE[name]);
      expect(visibleTabs(god, SHAPES[name], { unitsMerged: false })).toEqual(BEFORE[name]);
    });
  }

  it('單位管理者、個人治療師、推薦人也不變', () => {
    for (const who of [member, therapist, referrer]) {
      for (const shape of [A_UNITS, A_PLAIN, B]) {
        expect(visibleTabs(who, shape, { unitsMerged: false })).toEqual(visibleTabs(who, shape));
      }
    }
  });
});

describe('開關開著', () => {
  it('A＋合作單位：沒有「后台帐号」，有「合作单位」，其他順序不變', () => {
    const tabs = visibleTabs(god, A_UNITS, { unitsMerged: true });
    expect(tabs.map(t => t.id)).not.toContain('adminUsers');
    expect(tabs.find(t => t.id === 'companies')?.label).toBe('合作单位');
    expect(tabs).toEqual(BEFORE.A_UNITS.filter(t => t.id !== 'adminUsers'));
  });

  it('A 沒開合作單位、B：分頁照舊（「后台帐号」還在）', () => {
    expect(visibleTabs(god, A_PLAIN, { unitsMerged: true })).toEqual(BEFORE.A_PLAIN);
    expect(visibleTabs(god, B, { unitsMerged: true })).toEqual(BEFORE.B);
  });

  it('不是全域管理員的人本來就沒有那兩頁：開不開都一樣', () => {
    for (const who of [member, therapist, referrer]) {
      expect(visibleTabs(who, A_UNITS, { unitsMerged: true })).toEqual(visibleTabs(who, A_UNITS));
    }
  });

  it('unitsMergedView：三個條件都成立才是 true', () => {
    expect(unitsMergedView(true, A_UNITS)).toBe(true);
    expect(unitsMergedView(false, A_UNITS)).toBe(false);
    expect(unitsMergedView(true, A_PLAIN)).toBe(false);
    expect(unitsMergedView(true, B)).toBe(false);
  });
});

describe('VITE_ADMIN_UNITS_MERGED', () => {
  async function loadProduct(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import('../src/productConfig')).PRODUCT;
  }
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('不設、0 是關；A 帶 1 才開', async () => {
    expect((await loadProduct({})).features.adminUnitsMerged).toBe(false);
    expect((await loadProduct({ VITE_ADMIN_UNITS_MERGED: '0' })).features.adminUnitsMerged).toBe(false);
    expect((await loadProduct({ VITE_ADMIN_UNITS_MERGED: '1' })).features.adminUnitsMerged).toBe(true);
  });

  it('B 帶 1 也是關', async () => {
    const b = await loadProduct({ VITE_APP_MODE: 't1only', VITE_ADMIN_UNITS_MERGED: '1' });
    expect(b.mode).toBe('t1only');
    expect(b.features.adminUnitsMerged).toBe(false);
  });

  it('建置前擋認不得的值', () => {
    for (const ok of [undefined, '', '0', '1']) expect(() => assertValidAdminUnitsMerged(ok)).not.toThrow();
    for (const bad of ['true', 'yes', '2', ' 1']) expect(() => assertValidAdminUnitsMerged(bad)).toThrow(/VITE_ADMIN_UNITS_MERGED/);
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/assertValidDesktopLayout\(\);\s*assertValidAdminUnitsMerged\(\);/);
  });

  it('AdminApp 把開關接到分頁與合作单位那一頁', () => {
    const app = readFileSync('src/admin/AdminApp.tsx', 'utf8');
    expect(app).toContain('unitsMergedView(PRODUCT.features.adminUnitsMerged, shape)');
    expect(app).toContain('visibleTabs(current, shape, { unitsMerged })');
    expect(app).toContain('mergedAccounts={unitsMerged}');
  });
});

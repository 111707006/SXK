import { describe, it, expect } from 'vitest';
import {
  changeLine,
  referrerOptions,
  relationLabel,
  targetFromChoice,
  type ServiceTargets,
} from '../src/serviceRelations/adminView';

/** 後台改派畫面的字與選項（#119）：純函式。 */

const TARGETS: ServiceTargets = {
  units: [
    { id: 7, name: '甲机构', kind: 'institution' },
    { id: 9, name: '王老师', kind: 'therapist' },
  ],
  referrers: [
    { id: 70, name: '张', companyId: 7 },
    { id: 71, name: '李', companyId: 7 },
    { id: 90, name: '王', companyId: 9 },
  ],
};

describe('relationLabel', () => {
  it('沒有服務關係：森心康直属', () => {
    expect(relationLabel(null)).toBe('森心康直属');
  });
  it('有推薦人：單位 · 推薦人', () => {
    expect(relationLabel({ companyId: 7, companyName: '甲机构', referrerId: 70, referrerName: '张' })).toBe('甲机构 · 张');
  });
  it('還沒標注', () => {
    expect(relationLabel({ companyId: 7, companyName: '甲机构', referrerId: null, referrerName: null })).toBe('甲机构 · 还没标注');
  });
  it('名字讀不到（單位或推薦人已刪）：寫編號', () => {
    expect(relationLabel({ companyId: 7, companyName: null, referrerId: 70, referrerName: null })).toBe('单位 #7 · 推荐人 #70');
  });
});

describe('referrerOptions', () => {
  it('只列這個單位的推薦人', () => {
    expect(referrerOptions(TARGETS, 7).map(r => r.id)).toEqual([70, 71]);
    expect(referrerOptions(TARGETS, null)).toEqual([]);
  });
});

describe('targetFromChoice', () => {
  it('選「森心康直属」：null', () => {
    expect(targetFromChoice(TARGETS, null, null)).toBeNull();
  });
  it('單位＋本單位的推薦人', () => {
    expect(targetFromChoice(TARGETS, 7, 71)).toEqual({ companyId: 7, referrerId: 71 });
  });
  it('單位＋不屬於這個單位的推薦人：推薦人清掉', () => {
    expect(targetFromChoice(TARGETS, 7, 90)).toEqual({ companyId: 7, referrerId: null });
  });
});

describe('changeLine：一列改派紀錄', () => {
  const base = { id: 1, actor: 'admin' as const, reason: 'admin' as const, adminUserId: 2, createdAt: '2026-11-23T02:00:00.000Z' };
  it('從誰改成誰、誰改的、原因', () => {
    expect(changeLine(TARGETS, { ...base, fromCompanyId: 7, fromReferrerId: 70, toCompanyId: 7, toReferrerId: 71 }))
      .toEqual({ from: '甲机构 · 张', to: '甲机构 · 李', who: '后台改派' });
  });
  it('家長自己從連結掛上：從森心康直属', () => {
    expect(changeLine(TARGETS, { ...base, actor: 'parent', reason: 'link', adminUserId: null, fromCompanyId: null, fromReferrerId: null, toCompanyId: 9, toReferrerId: 90 }))
      .toEqual({ from: '森心康直属', to: '王老师 · 王', who: '家长自己（连结）' });
  });
  it('兌換碼、遷移', () => {
    expect(changeLine(TARGETS, { ...base, actor: 'parent', reason: 'code', fromCompanyId: null, fromReferrerId: null, toCompanyId: 7, toReferrerId: null }).who).toBe('家长自己（兑换码）');
    expect(changeLine(TARGETS, { ...base, actor: 'system', reason: 'migration', fromCompanyId: null, fromReferrerId: null, toCompanyId: 7, toReferrerId: null }).who).toBe('系统（资料转换）');
  });
  it('後台代填（admin＋code）不叫「后台改派」', () => {
    expect(changeLine(TARGETS, { ...base, reason: 'code', fromCompanyId: null, fromReferrerId: null, toCompanyId: 7, toReferrerId: 70 }).who).toBe('后台代填');
  });
  it('伺服器帶了名字就用（推薦人、單位管理者沒有 /service-targets 或只有本單位）', () => {
    const empty: ServiceTargets = { units: [], referrers: [] };
    expect(changeLine(empty, {
      ...base, fromCompanyId: null, fromReferrerId: null, toCompanyId: 4, toReferrerId: 40,
      fromCompanyName: null, fromReferrerName: null, toCompanyName: '测试机构', toReferrerName: '测试推荐人',
    })).toEqual({ from: '森心康直属', to: '测试机构 · 测试推荐人', who: '后台改派' });
    expect(changeLine(empty, { ...base, fromCompanyId: 8, fromReferrerId: null, toCompanyId: 4, toReferrerId: null }).from).toBe('单位 #8 · 还没标注');
  });
  it('伺服器帶了名字這一欄卻是 null：那個單位／推薦人已刪除（使用者 2026-11-23）', () => {
    const empty: ServiceTargets = { units: [], referrers: [] };
    const line = changeLine(empty, {
      ...base, fromCompanyId: 4, fromReferrerId: 40, toCompanyId: null, toReferrerId: null,
      fromCompanyName: null, fromReferrerName: null, toCompanyName: null, toReferrerName: null,
    });
    expect(line.from).toBe('已删除的单位 #4');
    expect(line.to).toBe('森心康直属');
    expect(changeLine(empty, {
      ...base, fromCompanyId: 4, fromReferrerId: 41, toCompanyId: 4, toReferrerId: null,
      fromCompanyName: '测试机构', fromReferrerName: null, toCompanyName: '测试机构', toReferrerName: null,
    }).from).toBe('测试机构 · 已删除的推荐人 #41');
  });
  it('名單裡找不到的（停用、刪掉）：寫編號', () => {
    expect(changeLine(TARGETS, { ...base, fromCompanyId: 8, fromReferrerId: 72, toCompanyId: null, toReferrerId: null }))
      .toEqual({ from: '单位 #8 · 推荐人 #72', to: '森心康直属', who: '后台改派' });
  });
});

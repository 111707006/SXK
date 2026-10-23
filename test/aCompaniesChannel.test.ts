import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { channelOf, CHANNEL_DIRECT, CHANNEL_SCREENING_SYSTEM, CHANNEL_UNASSIGNED, type SummarySource } from '../src/admin/parentSummary';
import { readCompanyBadge } from '../src/components/CompanyBadge';

/**
 * A 的合作公司（#90）：彙總與導出的「筛查渠道」四種寫法、頁首徽章讀伺服器回的東西。
 */

const source = (over: Partial<SummarySource>): SummarySource => ({
  userId: 1, phone: null, companyId: null, companyName: null, child: null, scores: [], reportHistory: [], bookingCount: 0, handoffImports: [], ...over,
});
const A_ON = { multiCompany: true, projectA: true };
const A_OFF = { multiCompany: false };
const B = { multiCompany: true };

describe('A 的篩查渠道', () => {
  it('四種各一筆：歸屬 A 的合作公司、直屬、從 B 轉入（B 有公司）、從 B 轉入（B 未歸屬）', () => {
    expect(channelOf(source({ companyId: 7, companyName: '乙医院' }), A_ON)).toBe('乙医院');
    expect(channelOf(source({}), A_ON)).toBe(CHANNEL_DIRECT);
    expect(channelOf(source({ handoffImports: [{ id: 1, at: '2026-10-01T00:00:00.000Z', companyName: '甲机构' }] }), A_ON)).toBe('甲机构');
    expect(channelOf(source({ handoffImports: [{ id: 1, at: '2026-10-01T00:00:00.000Z', companyName: null }] }), A_ON)).toBe(CHANNEL_SCREENING_SYSTEM);
  });

  it('A 沒開合作公司：照舊三種', () => {
    expect(channelOf(source({}), A_OFF)).toBe(CHANNEL_DIRECT);
    expect(channelOf(source({ handoffImports: [{ id: 1, at: '2026-10-01T00:00:00.000Z', companyName: null }] }), A_OFF)).toBe(CHANNEL_SCREENING_SYSTEM);
  });

  it('B 不變：渠道就是歸屬', () => {
    expect(channelOf(source({ companyName: '甲机构' }), B)).toBe('甲机构');
    expect(channelOf(source({}), B)).toBe(CHANNEL_UNASSIGNED);
  });
});

describe('頁首徽章', () => {
  it('讀得懂伺服器回的；LOGO 不安全就不要', () => {
    expect(readCompanyBadge({ company: { name: '乙医院', logoUrl: 'https://img.example.com/a.png' } })).toEqual({ name: '乙医院', logoUrl: 'https://img.example.com/a.png' });
    expect(readCompanyBadge({ company: { name: '乙医院', logoUrl: 'javascript:alert(1)' } })).toEqual({ name: '乙医院', logoUrl: null });
  });

  it('沒歸屬、形狀不對：不畫（頁首照規格一）', () => {
    expect(readCompanyBadge({ company: null })).toBeNull();
    expect(readCompanyBadge({ company: { name: ' ' } })).toBeNull();
    expect(readCompanyBadge(null)).toBeNull();
  });

  it('只在專案 A 的頁首、平台名稱旁邊；開關由首頁設定帶回來', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain("{PRODUCT.mode === 'full' && <CompanyBadge enabled={companiesOn} identity={userIdentity} />}");
    expect(app).toContain('setCompaniesOn(body?.companies === true)');
  });
});

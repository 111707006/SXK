import { describe, it, expect } from 'vitest';
import { renderParentExportHtml } from '../src/admin/exportView';
import type { ParentDetail } from '../src/admin/adminStore';

/**
 * 交給專家的那張紙（issue #24 的最後一條驗收條件）。
 *
 * 專家看不到家長端的畫面，他手上只有這一頁。上面若只寫「月龄 54」，他就會照
 * 54 個月的常模去讀一份 40 個月時測出來的表 —— 分數是照當時那一段的判準算的，
 * 換一段讀法就完全不同，而紙上看不出任何異狀。
 */

function detail(overrides: Partial<ParentDetail> = {}): ParentDetail {
  return {
    id: 1,
    email: 'p@x.com',
    phone: null,
    companyId: 1,
    childName: '小明',
    childAgeMonth: 54,
    childGender: 'boy',
    flaggedDimensions: [],
    screenedAt: '2026-01-05T09:00:00.000Z',
    registeredAt: '2025-12-01T09:00:00.000Z',
    hasBooking: false,
    scores: [
      {
        dimensionId: 'language',
        dimensionName: '语言沟通',
        tierId: 'T1',
        score: 5,
        maxScore: 8,
        status: 'delay',
        completedAt: '2026-01-05T09:00:00.000Z',
        assessedAgeMonth: 40,
      },
    ],
    reportHistory: [],
    bookings: [],
    assessedAgeMonth: 40,
    assessedBandName: 'B 段 2-4 岁 (幼儿期)',
    ...overrides,
  };
}

describe('匯出頁上的測評月齡與年齡段', () => {
  it('寫出那次篩查當時的月齡與年齡段', () => {
    const html = renderParentExportHtml(detail());
    expect(html).toContain('40 个月');
    expect(html).toContain('B 段 2-4 岁 (幼儿期)');
  });

  it('孩子已跨段時把兩邊都說清楚', () => {
    // 54 個月是 C 段，測的是 B 段。專家得知道這張表不是照他眼前那個年齡的判準算的。
    const html = renderParentExportHtml(detail());
    expect(html).toContain('C 段 4-6 岁 (学龄前期)');
    expect(html).toMatch(/与下表不同段/);
  });

  it('沒跨段時不多說一句 —— 提示成了雜訊就沒有人讀了', () => {
    const html = renderParentExportHtml(detail({ childAgeMonth: 46 })); // 與 40 同屬 B 段
    expect(html).not.toMatch(/不同段/);
    expect(html).toContain('40 个月');
  });

  it('舊資料沒有測評月齡時明說沒記錄，不拿今天的月齡頂替', () => {
    // 拿 `childAgeMonth` 頂上去的話，一份跨了段的篩查會偽裝成從沒跨段 ——
    // 而那正是這一頁要防的誤讀。
    const html = renderParentExportHtml(detail({ assessedAgeMonth: null, assessedBandName: null }));
    expect(html).toContain('未记录测评月龄');
    expect(html).not.toMatch(/不同段/);
  });

  it('還沒做過篩查就不寫這一行 —— 沒有一張要讀的表', () => {
    const html = renderParentExportHtml(
      detail({ scores: [], assessedAgeMonth: null, assessedBandName: null })
    );
    expect(html).toContain('尚未完成筛查');
    expect(html).not.toMatch(/筛查当时/);
  });

  it('年齡段名稱照樣走 HTML 逃脫，不從資料開一個注入口', () => {
    const html = renderParentExportHtml(detail({ childName: '<script>x</script>' }));
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

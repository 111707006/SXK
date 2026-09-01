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

/**
 * 備案號 —— 同一個函式，兩個呼叫端要不同的結果。
 *
 * `renderParentExportHtml` 有兩個呼叫端，性質完全不同：
 *
 *   - `server.ts` 的 `/r/:token`：家長掃碼帶走、收藏在手機裡反覆打開的**網頁**。
 *     它是這個網域對外的一頁，備案號必須在，否則抽查等同沒掛（處理是要求整改
 *     乃至關停接入）。
 *   - `src/admin/routes.ts` 的後台匯出：要列印給專家的**文件**，不是網頁。
 *     一張紙上印備案號沒有意義。
 *
 * 所以號碼由呼叫端傳進來，這個檔案不讀 `process.env` —— 差別寫在呼叫端才看得見。
 * 這兩條測試釘住的就是「哪一邊該有、哪一邊該沒有」。
 */
describe('匯出頁上的備案號', () => {
  const BEIAN = '沪ICP备0000000000号-9';

  it('傳了就掛在頁面底部，連回工信部', () => {
    const html = renderParentExportHtml(detail(), { icpBeian: BEIAN });
    expect(html).toContain(BEIAN);
    expect(html).toContain('https://beian.miit.gov.cn/');
  });

  // 後台匯出走的就是這條路徑（不傳這個選項）。
  it('沒傳就整段不出現 —— 寧可沒有，不掛一個不屬於自己的號碼', () => {
    const html = renderParentExportHtml(detail());
    expect(html).not.toContain('beian.miit.gov.cn');
    expect(html).not.toContain('class="beian"');
  });

  // 空字串與只有空白等同沒設定。`.env` 裡留一行 `ICP_BEIAN=` 是常見狀態，
  // 那時掛出來的會是一個空連結 —— 看起來沒東西，實際上有個可點的空洞。
  it('空字串或只有空白等同沒設定', () => {
    expect(renderParentExportHtml(detail(), { icpBeian: '' })).not.toContain('class="beian"');
    expect(renderParentExportHtml(detail(), { icpBeian: '   ' })).not.toContain('class="beian"');
  });

  it('號碼照樣走 HTML 逃脫，不從設定開一個注入口', () => {
    const html = renderParentExportHtml(detail(), { icpBeian: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
  });

  // 家長會用「列印 → 另存為 PDF」把這一頁交給專家。那份紙不是網頁。
  it('列印時藏起來', () => {
    const html = renderParentExportHtml(detail(), { icpBeian: BEIAN });
    expect(html).toMatch(/@media print[^}]*\.beian[^}]*display:\s*none/);
  });
});

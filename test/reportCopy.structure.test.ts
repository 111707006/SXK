import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 報告頁與維度卡片文案的結構護欄（issue #18）。
 *
 * 為什麼是結構測試而不是元件測試：專案**沒有 jsdom**，畫面上出現了什麼字沒有
 * 任何一條測試看得到。而這裡要釘的兩件事恰好都是「某個字有沒有出現」：
 *
 * 1. 維度卡片不得再寫「聯繫專家」（p.9）。這張卡片點下去到的是報告，把終點
 *    寫在起點上，家長點一次發現不是那件事就不會再點第二次。
 * 2. 雷達圖區段的標題是客戶逐字指定的（p.12）。這種字串被「順手排版」改掉
 *    （補個空格、破折號換成 em dash）不會有任何人發現。
 *
 * 讀原始碼而不是 import `PRODUCT`：`productConfig.ts` 只會匯出**當前建置模式**
 * 的那一份 profile，兩個 profile 都要檢查就只能讀檔。而那個「只匯出一份」正是
 * 品牌隔離的作法本身（見該檔案結尾與 scripts/check-brand.mjs），不能為了測試改掉。
 *
 * 寫法參照 `test/adminScope.structure.test.ts` 與 `test/dimensionIds.test.ts`。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例（例如「不得寫成『聯繫專家』」）不該被當成真的文案。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const productConfig = stripComments(read('src/productConfig.ts'));
// 雷達圖在 2026-09-11 隨報告本體搬進 `ReportBody.tsx`（ADR-0007）——
// 家長端與後台看的是同一個元件，那串客戶指定的標題因此只剩這一份。
const reportBody = stripComments(read('src/components/ReportBody.tsx'));

describe('維度卡片的文案（p.9）', () => {
  /** 卡片上那兩句話的**唯一**來源，兩個產品模式各一份。 */
  const CARD_COPY_FIELDS = ['dimensionCardHint', 'dimensionCardCta'];

  function valuesOf(field: string): string[] {
    const re = new RegExp(`${field}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|(null))`, 'g');
    return [...productConfig.matchAll(re)].map(m => m[1] ?? m[2] ?? m[3]);
  }

  it('護欄本身沒有壞掉：兩個產品模式各抓到一組', () => {
    // 沒有這一條，欄位改名會讓下面每一條測試「零筆全過」。
    for (const field of CARD_COPY_FIELDS) {
      expect(valuesOf(field), field).toHaveLength(2);
    }
  });

  it.each(CARD_COPY_FIELDS)('%s 不出現「联系专家」', field => {
    for (const value of valuesOf(field)) {
      expect(value, `${field} = ${value}`).not.toContain('联系专家');
      expect(value, `${field} = ${value}`).not.toContain('聯繫專家');
    }
  });

  /**
   * 這一條是「不在元件裡加模式判斷」那句驗收條件的形狀。
   *
   * 兩個產品的說法必須繼續來自產品設定 —— 一旦有人在 `DimensionGrid` 裡寫
   * `PRODUCT.mode === 't1only' ? … : …`，分歧就從一個入口變成兩個，而
   * `productConfig.ts` 開頭那條維護原則就成了一句沒人遵守的話。
   */
  it('維度卡片的說法來自產品設定，元件裡沒有模式判斷', () => {
    const grid = stripComments(read('src/components/DimensionGrid.tsx'));
    expect(grid).toContain('PRODUCT.dashboard.dimensionCardCta');
    expect(grid).toContain('PRODUCT.dashboard.dimensionCardHint');
    expect(grid).not.toMatch(/PRODUCT\.mode\s*===/);
    expect(grid).not.toMatch(/['"]t1only['"]/);
  });

  // 專案 A 的說法一個字都不能被 issue #18 碰到（該 issue 最後一條驗收條件）。
  // 2026-09-11 依客戶《家长报告用语对照表》把「立即深测」改成「进入深测」——
  // 那是另一條指示，不是 #18 的回歸；「立即」在表上是要去掉的字。
  it('專案 A 的維度卡片文案維持原樣', () => {
    expect(valuesOf('dimensionCardHint')).toContain('点击进入本维度测定');
    expect(valuesOf('dimensionCardCta')).toContain('进入深测');
  });
});

describe('雷達圖區段標題（p.12）', () => {
  // 客戶逐字指定：不加空格，破折號是兩個全形。
  it('逐字等於「9大维度结论——雷达图分析」', () => {
    expect(reportBody).toContain('9大维度结论——雷达图分析');
  });

  it('不是被「順手排版」過的那些寫法', () => {
    for (const stale of ['9 大维度结论 —— 雷达图分析', '9 大维度结论——雷达图分析']) {
      expect(reportBody, stale).not.toContain(stale);
    }
  });
});

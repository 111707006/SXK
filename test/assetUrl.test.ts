import { describe, it, expect } from 'vitest';
import { isAllowedAssetUrl } from '../src/utils/assetUrl';

/**
 * 「後台填進來、家長端原樣貼上去」的網址白名單。
 *
 * 兩個呼叫端共用這一份：活動的分解圖與示範連結（`activitySteps.ts`、`activityAdmin.ts`），
 * 以及合作公司的 LOGO（`companies.logo_url`）。原本只有前者有規則、寫在
 * 那個檔案裡，2026-09-10 加 LOGO 時抽出來共用 —— 兩套規則遲早會有一套
 * 少擋一種東西，而少擋的那一種正是它存在的理由。
 */
describe('允許的資源網址', () => {
  it.each([
    ['一般的 https 圖片', 'https://cdn.example.com/logo.png'],
    ['帶查詢字串的 https', 'https://cdn.example.com/logo.png?v=2'],
    ['站內路徑（隨建置出貨的 public/ 圖檔）', '/kefu-qr.jpg'],
    ['站內深路徑', '/assets/brand/logo.svg'],
  ])('放行：%s', (_label, url) => {
    expect(isAllowedAssetUrl(url)).toBe(true);
  });

  it.each([
    // 家長端整站走 https。http 的圖會被瀏覽器當成混合內容擋掉 ——
    // 後台看起來存好了，家長那邊是一張破圖，而且沒有人會收到訊息。
    ['http（會被瀏覽器當成混合內容擋掉）', 'http://cdn.example.com/logo.png'],
    // 把一段可執行的東西存進資料庫，再原樣貼到家長的頁面上。
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    // 這一條是整份規則裡最容易漏的：它長得像站內路徑（開頭是 /），
    // 實際上是協定相對網址，會沿用當前頁面的協定連到 example.com。
    ['協定相對網址（長得像站內路徑，其實是外連）', '//example.com/logo.png'],
    ['只有協定沒有主機', 'https://'],
    ['空字串', ''],
    ['相對路徑（沒有開頭的斜線）', 'logo.png'],
    ['前後有空白的網址（呼叫端該先 trim）', ' https://cdn.example.com/logo.png'],
  ])('擋掉：%s', (_label, url) => {
    expect(isAllowedAssetUrl(url)).toBe(false);
  });
});

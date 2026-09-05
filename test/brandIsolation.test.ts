import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 「森心康」不准出現在專案 B 的畫面上。
 *
 * B 交付給多家合作公司使用，畫面上出現交付方的品牌名是**契約問題**，不是美觀問題
 * （見 `productConfig.ts` 的 `brand` 說明）。`productConfig.ts` 的註解一直寫著
 * 「`test/brandIsolation.test.ts` 會擋住這一點被改回去」—— 2026-09-04 才發現那支
 * 測試從來沒有被建立。這個檔案補上它。
 *
 * 【這支測試擋得住什麼、擋不住什麼】
 * 「森心康」在 `src/` 底下**大量**寫死著（`WearablesMall`、`SpecializedReportView`、
 * `LanguageSpecialAssessment`、`AssessmentPanel` …）。那不是漏洞：那些是專案 A
 * 專屬的功能（商城、付費深度評估），B 的建置把整個 chunk 搖掉了。所以
 * 「原始碼裡不准出現這四個字」是個**錯的規則**，寫成測試只會當場全紅。
 *
 * 真正的保證來自建置產物 —— 而測試不建置。所以這裡守的是兩個**靜態就看得出來**、
 * 而且會同時出現在兩個產品畫面上的位置：
 *
 *   1. `productConfig.ts` 的 `t1only` 設定值（B 的品牌字串本身）
 *   2. `LegalTerms.tsx` 的條款內文（兩個產品共用同一份，最容易把品牌名寫死進去）
 *
 * ⚠️ 上線前仍應實際建一次 B 並確認產物：
 *      VITE_APP_MODE=t1only pnpm run build && grep -c 森心康 dist/assets/*.js
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * 把註解拿掉再檢查。
 *
 * 說明品牌規則的註解裡本來就必須寫出「森心康」三個字 —— 一條說不出自己在防什麼的
 * 規則沒有人會遵守。註解不會進到畫面上，所以檢查的對象是程式碼與字串。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** 不得出現在 B 畫面上的字串。 */
const BRAND_WORDS = ['森心康', 'SenXinKang', '森跃诺动'];

describe('專案 B 的品牌字串', () => {
  const source = read('src/productConfig.ts');

  /** 取出 `t1only:` 那一個 profile 的字面量區塊。 */
  const t1Block = (() => {
    const start = source.indexOf('t1only: {');
    expect(start, '找不到 t1only profile —— productConfig 改過結構，這支測試要一起更新').toBeGreaterThan(0);
    // 到 PROFILES 這個常數的收尾為止。
    const end = source.indexOf('\n};', start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  })();

  it.each(BRAND_WORDS)('t1only 的設定值裡沒有「%s」', word => {
    expect(stripComments(t1Block)).not.toContain(word);
  });

  // 反面對照：確認上面那個抽取真的抓到了東西，而不是抓到空字串然後全部通過。
  it('對照組：full 的設定值裡找得到「森心康」', () => {
    const start = source.indexOf('full: {');
    const end = source.indexOf('t1only: {', start);
    expect(stripComments(source.slice(start, end))).toContain('森心康');
  });
});

describe('兩個產品共用的條款內文', () => {
  const source = read('src/components/LegalTerms.tsx');
  const code = stripComments(source);

  /**
   * 客戶 2026-09-04 修訂版的原文裡有兩個品牌名：隱私第一條的「由森心康品牌运营」、
   * 服務條款第五條的「森跃诺动健康科技有限公司」。這份條款兩個產品共用，
   * 照抄進來就等於把品牌名印在 B 的畫面上。
   */
  it.each(BRAND_WORDS)('條款內文沒有寫死「%s」', word => {
    expect(code).not.toContain(word);
  });

  it('那兩處改走 PRODUCT.brand，才不會變成「整段拿掉」', () => {
    // 拿掉不行 —— 後面整份條款都在說「运营方」，那個詞得先被定義出來。
    expect(code).toContain('PRODUCT.brand.operatorClause');
    expect(code).toContain('PRODUCT.brand.ipHolder');
  });
});

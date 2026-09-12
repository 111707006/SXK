import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 付費牆是**一個入口、一個價格**（票 #45）。
 *
 * 【為什麼是結構測試】
 * 專案沒有 jsdom，畫面上出現什麼沒有測試看得到，只能讀原始碼 ——
 * 寫法參照 `test/parentWording.structure.test.ts`。
 *
 * 【擋的是什麼】
 * 2026-09-11 之前，總覽的九張維度卡片各掛一個「¥19.9 解锁」，付費牆賣的是
 * 其中一個維度。九個價格擺在一起讀起來就是九筆錢，而 T2 的那幾支量表本來就會
 * 同時餵好幾個維度 —— 按維度賣等於把同一份問卷賣兩次。
 * 沒有這條護欄，日後很容易有人「順手」把價格加回卡片上，而那不會讓任何東西變紅。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例（「以前寫的是 ¥19.9 解锁」）不該被當成真的文案。 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('付費牆賣的是整份，不是一個維度', () => {
  const paywall = stripComments(read('src/components/Paywall.tsx'));

  it('元件收不到維度 —— 型別上就沒有那個 prop', () => {
    expect(paywall).not.toMatch(/\bdimension\b/);
  });

  it('下單時送的是 scope，不是 dimensionId', () => {
    expect(paywall).toContain("scope: 't2'");
    expect(paywall).not.toContain('dimensionId');
  });
});

describe('九張卡片不再各賣一個維度', () => {
  const grid = stripComments(read('src/components/DimensionGrid.tsx'));

  it('卡片上沒有價格', () => {
    expect(grid).not.toContain('¥');
    expect(grid).not.toContain('unlockPriceLabel');
  });

  /**
   * 鎖頭仍然要有 —— 拿掉的是價格，不是「這裡需要解鎖」這個訊號。
   * 少了它，卡片會變成一顆按下去才知道進不去的按鈕。
   */
  it('鎖頭還在，而且是一個布林（全鎖或全開）', () => {
    expect(grid).toContain('deepAssessmentLocked');
    expect(grid).not.toContain('lockedDimensionIds');
  });

  /**
   * 而且**只畫一次**。九張卡片各掛一個鎖頭，等於把「有一件事要解鎖」講九遍，
   * 還會蓋掉被標記維度上的行動呼籲 —— 正好是最需要家長點下去的那幾張卡片。
   * 整份買一次的東西，鎖頭也只出現一次。
   */
  it('付費的鎖頭只畫一個，不在九張卡片的迴圈裡', () => {
    const mapAt = grid.indexOf('DIMENSIONS_DATA.map');
    expect(mapAt).toBeGreaterThan(-1);

    // 迴圈之前出現過一次 —— 那一條整片的提示。
    expect(grid.slice(0, mapAt)).toContain('deepAssessmentLocked');
    // 迴圈裡一次都沒有。卡片上另一個灰色鎖頭是「T1 還沒做完」，與付費無關。
    expect(grid.slice(mapAt)).not.toContain('deepAssessmentLocked');
  });
});

describe('專案 B 看不到付費牆', () => {
  const app = read('src/App.tsx');

  /**
   * B 的建置 `PRODUCT.features.paywall` 為 false。付費牆只有這一個渲染點，
   * 而它掛在那個旗標底下 —— 多一個沒有旗標的渲染點，B 的合作公司網站上就會
   * 出現一個賣不了東西的價格。
   */
  it('付費牆只有一個渲染點，且在 features.paywall 底下', () => {
    const renders = app.match(/<Paywall\b/g) ?? [];
    expect(renders).toHaveLength(1);

    const at = app.indexOf('<Paywall');
    // 往前找到這個三元分支的條件那一行。
    const branch = app.slice(Math.max(0, at - 400), at);
    expect(branch).toContain('PRODUCT.features.paywall');
    expect(branch).toContain('PRODUCT.features.tier2And3');
  });
});

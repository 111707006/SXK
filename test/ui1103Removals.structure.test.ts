import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * 簡報 11/03 的刪減（只在 1022）：條款落款不寫技術實驗室（第 14 頁）、T2 入口的提示與服務按鈕整塊不放（第 21 頁）、
 * 「1 对 1 专家咨询」二維碼卡不放「去线上家庭训练」（第 22 頁）。專案沒有 jsdom，讀原始碼。
 */
describe('簡報 11/03 的刪減', () => {
  it('條款落款：1022 只留更新日期', () => {
    const legal = readFileSync('src/components/LegalTerms.tsx', 'utf8');
    expect(legal).toMatch(/最后更新日期：\{(?:edited \?\? )?LEGAL_LAST_UPDATED\}\{PRODUCT\.features\.ui1022 \? null : <> · \{PRODUCT\.brand\.legalEntity\}<\/>\}/);
  });

  it('T2 入口：1022 不畫提示，缺口那一格也不放服務按鈕', () => {
    const entrance = readFileSync('src/components/T2EntranceV3.tsx', 'utf8');
    expect(entrance).toContain('const notices = !ui1022 && plan.notices.length > 0 && (');
    expect(entrance).toContain('{!ui1022 && serviceButtons}');
    expect(entrance).toContain('{!ui1022 && plan.gaps.length > 0 && (');
  });

  it('二維碼卡沒有去線上家庭訓練的按鈕', () => {
    const report = readFileSync('src/components/AnalysisReport.tsx', 'utf8');
    expect(report).not.toContain('booking-cta-online_training');
  });
});

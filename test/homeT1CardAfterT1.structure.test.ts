import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { HOME_CARDS_1022, HOME_TRAINING_CARD_1022, viewAfterLogin } from '../src/home/homeNav';

/**
 * 1022 首頁三排（簡報 11/03 第 13 頁，使用者 2026-11-06）：第三排 T1、T2 兩張卡。
 * T2 卡：做過 T1 → 報告上的 T2 購買區；沒做 → 評估面板先做 T1。T1 卡照舊到評估面板。
 * 第二排訓練卡一律先到方案頁。專案沒有 jsdom，接線讀原始碼。
 */
describe('1022 首頁的 T1、T2 卡與訓練卡', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const home = readFileSync('src/home/LedoHomePage.tsx', 'utf8');
  const body = app.slice(app.indexOf('const openHomeTarget = ('), app.indexOf('const openHomeLogin = ('));

  it('第三排是 T1、T2，訓練卡另外一張', () => {
    expect(HOME_CARDS_1022.map(c => [c.id, c.target])).toEqual([['t1', 'dashboard'], ['t2', 't2']]);
    expect(HOME_TRAINING_CARD_1022.target).toBe('training');
  });

  it('T2 卡：做過 T1 → goToT2Entrance，沒做 → 評估面板', () => {
    expect(body).toMatch(/if \(step\.view === 't2'\) \{\s*if \(completedScores\.some\(s => s\.tierId === 'T1'\)\) goToT2Entrance\(\);\s*else \{ setCurrentView\('dashboard'\);/);
  });

  it('T1 卡不再被帶去 T2 入口', () => {
    expect(body).not.toMatch(/step\.view === 'dashboard' && completedScores/);
  });

  it('訓練卡在 1022 一律先到方案頁', () => {
    expect(body).toMatch(/\(PRODUCT\.features\.ui1022 \|\| !trainingPass\.active\) \? 'training_plan'/);
  });

  it('未登入點 T2 卡，登入後先到評估面板', () => {
    expect(viewAfterLogin('t2', true)).toBe('dashboard');
  });

  it('1022 首頁沒有「看报告」與練習天數', () => {
    const start = home.indexOf('{PRODUCT.features.ui1022 ? (');
    const v1022 = home.slice(start, home.indexOf(') : (', start));
    expect(v1022).not.toContain("'看报告'");
    expect(v1022).not.toContain('onAction');
    expect(v1022).not.toContain('practiceDays');
    // 價錢照伺服器畫（2026-11-10 清單第 3 條），原價的刪除線在 TrainingCardPrice 裡
    expect(v1022).toContain('<TrainingCardPrice');
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * 1022（簡報 11/03 第 8 頁「点进去还是 T1 重新评估，没有 T2 了」）：做完 T1 的家長點首頁 T1 卡，帶到報告上的 T2 入口；
 * 還沒做 T1 的照舊到評估面板。專案沒有 jsdom，接線讀原始碼。
 */
describe('首頁 T1 卡做完 T1 之後', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const home = readFileSync('src/home/LedoHomePage.tsx', 'utf8');

  it('點卡：1022 開著、做過 T1 → goToT2Entrance', () => {
    const body = app.slice(app.indexOf('const openHomeTarget = ('), app.indexOf('const openHomeLogin = ('));
    expect(body).toMatch(/if \(PRODUCT\.features\.ui1022 && step\.view === 'dashboard' && completedScores\.some\(s => s\.tierId === 'T1'\)\) \{\s*goToT2Entrance\(\);\s*return;/);
  });

  it('副標改說下一步做 T2', () => {
    expect(home).toContain("card.id === 't1' && t1.length > 0 ? WORDING_1022.home.t1CardDoneSub : card.sub");
  });
});

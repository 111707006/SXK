import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RedeemCodeForm from '../src/components/training/RedeemCodeForm';
import { TRAINING_PLAN_PAGE } from '../src/t2/trainingPlanCopy';

/**
 * 兌換碼入口（使用者 2026-11-03：「加入口」）：免費期間家長不會被帶到訓練計劃頁，個人中心另放一格。
 * 兩處共用同一個 `RedeemCodeForm`（打 `POST /api/training/redeem`），伺服器那一半見 `redeemCodes.http.test.ts`。
 */

describe('RedeemCodeForm', () => {
  it('畫輸入框與「兑换」，id 照前綴（兩處同時在畫面上不撞）', () => {
    const html = renderToStaticMarkup(createElement(RedeemCodeForm, { loggedIn: true, onActivated: () => {}, idPrefix: 'profile-redeem' }));
    expect(html).toContain('id="profile-redeem-redeem"');
    expect(html).toContain('id="profile-redeem-code"');
    expect(html).toContain(TRAINING_PLAN_PAGE.redeemSubmit);
    expect(readFileSync('src/components/training/RedeemCodeForm.tsx', 'utf8')).toContain("authFetch('/api/training/redeem'");
  });
});

describe('接線', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('個人中心：伺服器開著訓練計劃才有那一格，兌換成功重讀使用權', () => {
    const block = app.slice(app.indexOf('id="profile-redeem-section"') - 200, app.indexOf('{/* 3. Completed Screening Scores */}'));
    expect(block).toMatch(/\{trainingPass !== null && \(/);
    expect(block).toContain('<RedeemCodeForm');
    expect(block).toContain('setUnlocksNonce(n => n + 1)');
  });

  it('訓練計劃頁也走同一個元件（不再自己寫一份兌換）', () => {
    const page = readFileSync('src/components/training/TrainingPlanPage.tsx', 'utf8');
    expect(page).toContain('<RedeemCodeForm');
    expect(page).not.toContain("'/api/training/redeem'");
  });
});

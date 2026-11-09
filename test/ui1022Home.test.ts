import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 首頁與登入入口改版（issue #84，`VITE_UI_1022`）：兩張卡、T1 在前、有底框、新標題與副標；沒有線下服務點；
 * 大圖「今天也陪孩子训练一下」、按鈕「居家训练」；頁首一顆「登录／注册」。
 */

async function renderHome(ui1022: '0' | '1') {
  vi.resetModules();
  vi.stubEnv('VITE_UI_1022', ui1022);
  const { default: LedoHomePage } = await import('../src/home/LedoHomePage');
  return renderToStaticMarkup(createElement(LedoHomePage, { onOpen: () => {} }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('1022 開著', () => {
  it('三排（簡報 11/03 第 13 頁）：訓練寬卡在前、T1、T2 並排在後，標題與副標是新字', async () => {
    const html = await renderHome('1');
    const training = html.indexOf('id="home-card-training"');
    const t1 = html.indexOf('id="home-card-t1"');
    const t2 = html.indexOf('id="home-card-t2"');
    expect(training).toBeGreaterThan(-1);
    expect(t1).toBeGreaterThan(training);
    expect(t2).toBeGreaterThan(t1);
    expect(html).toContain('T1 儿少综合发展评估');
    expect(html).toContain('读懂成长信号，定制适合孩子的成长支持方案');
    expect(html).toContain('T2 深度评估');
    expect(html).toContain('线上家庭个性化训练');
    expect(html).toContain('跟着练！科学助力孩子能力提升');
    // 價錢（暫採）：原價畫刪除線、折扣價
    expect(html).toMatch(/line-through[^"]*">原价 ¥199</);
    expect(html).toContain('¥19.9');
  });

  it('沒有線下服務點；T1、T2 兩張一樣大的插畫卡並排、有底框', async () => {
    const html = await renderHome('1');
    expect(html).not.toContain('home-card-offline');
    expect(html).not.toContain('线下服务点');
    expect(html).toMatch(/<div class="grid grid-cols-2 gap-3 border-t border-ledo-line pt-4"><button type="button" id="home-card-t1" class="[^"]*border-\[1\.5px\] border-ledo-line[^"]*">/);
    expect(html.match(/aspect-\[4\/3\]/g)).toHaveLength(2);
    // 插畫（使用者 2026-10-27），不是照片
    expect(html).toContain('/ledo/t1-a.jpg');
    expect(html).toContain('/ledo/t1-c.jpg');
    expect(html).toContain('/ledo/training.jpg');
    expect(html).not.toContain('/home/home-t1.jpg');
  });

  it('大圖標題與按鈕', async () => {
    const html = await renderHome('1');
    expect(html).toContain('今天也陪孩子训练一下');
    expect(html).toContain('居家训练');
    expect(html).not.toContain('去线上干预');
  });
});

describe('關著照舊', () => {
  it('三張卡、線下服務點在、舊標題', async () => {
    const html = await renderHome('0');
    expect(html).toContain('home-card-offline');
    expect(html).toContain('今天也陪孩子玩一下');
    expect(html.indexOf('id="home-card-training"')).toBeLessThan(html.indexOf('id="home-card-t1"'));
  });
});

describe('頁首登入', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  it('1022 一顆「登录／注册」，關著照舊兩顆', () => {
    expect(app).toMatch(/PRODUCT\.features\.ui1022 \? \(\s*<button[^>]*\s*type="button"\s*id="header-login-btn"[\s\S]*?\{WORDING_1022\.home\.login\}/);
    expect(app).toContain('id="header-register-btn"');
  });

  it('從頁首登入完回首頁（沒有待去的卡片）', async () => {
    const { viewAfterLogin } = await import('../src/home/homeNav');
    expect(viewAfterLogin(null, true)).toBe('home');
    expect(viewAfterLogin('training', true)).toBe('training');
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readHandoffLink } from '../src/handoff/fragment';
import { handoffInviteUrl, handoffUrl } from '../src/handoff/core';

/**
 * B→A 交接的前端（ADR-0009、docs/specs/b-to-a-handoff.md §5）。專案沒有 jsdom，畫面怎麼接只能讀原始碼；
 * 讀網址那一段是純函式，直接測。
 *
 * 要釘住的：
 * 1. A 只認 `/handoff#code=<32 字>`（按鈕）與 `/handoff#invite=<32 字>`（簡訊邀請），發出端產的連結 A 讀得回來。
 * 2. A 讀到碼就把網址換成 `/`（碼不留在網址列與瀏覽紀錄），兌換只打一次（StrictMode 跑兩次 effect）。
 * 3. 兌換成功走一般登入那一條（`handleAuthSuccess`），然後去 T2 入口；失敗回登入頁並說原因。
 *    簡訊邀請先停在同意畫面，按「同意并继续」才兌換（按鈕那一條在 B 按下時已經同意過）。
 * 4. B 的卡只掛在即時報告上、要 `consent: true`、錯誤畫在卡上；哪一半掛哪一邊由 `PRODUCT.features.handoff` 決定。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (source: string) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const CODE = 'aB3_-'.repeat(6) + 'xy';

describe('readHandoffLink', () => {
  it('發出端產的連結，A 讀得回同一個碼：按鈕是 button、簡訊是 invite', () => {
    const button = new URL(handoffUrl('https://sxkscreen.com', CODE));
    expect(readHandoffLink(button.pathname, button.hash)).toEqual({ code: CODE, via: 'button' });
    const invite = new URL(handoffInviteUrl('https://sxkscreen.com', CODE));
    expect(readHandoffLink(invite.pathname, invite.hash)).toEqual({ code: CODE, via: 'invite' });
  });

  it('結尾斜線也算', () => {
    expect(readHandoffLink('/handoff/', `#code=${CODE}`)).toEqual({ code: CODE, via: 'button' });
  });

  it.each([
    ['別的路徑', '/', `#code=${CODE}`],
    ['別的路徑（前綴相同）', '/handoff-x', `#code=${CODE}`],
    ['沒有片段', '/handoff', ''],
    ['碼太短', '/handoff', '#code=abc'],
    ['碼有不合法的字', '/handoff', `#code=${CODE.slice(0, 31)}!`],
    ['舊的 43 字', '/handoff', `#code=${CODE}${'a'.repeat(11)}`],
    ['放在別的鍵', '/handoff', `#token=${CODE}`],
  ])('%s：null', (_label, pathname, hash) => {
    expect(readHandoffLink(pathname, hash)).toBeNull();
  });
});

describe('A 的落地（App.tsx）', () => {
  const app = stripComments(read('src/App.tsx'));

  it('只有接收端讀網址；讀到就換成 /、只兌換一次', () => {
    expect(app).toMatch(/PRODUCT\.features\.handoff === 'receive' \? readHandoffLink\(window\.location\.pathname, window\.location\.hash\)/);
    expect(app).toContain("window.history.replaceState(null, '', '/')");
    expect(app).toMatch(/if \(handoffStartedRef\.current\) return;\s*handoffStartedRef\.current = true;/);
  });

  it('簡訊邀請先停在同意畫面：按下才兌換，不同意就照一般開頁', () => {
    expect(app).toContain("handoffLink.via === 'invite' ? 'confirm' : 'redeeming'");
    expect(app).toMatch(/if \(handoffLink\.via === 'invite'\) \{\s*initCloudSync\(true\);\s*return;/);
    const accept = app.slice(app.indexOf('const acceptHandoffInvite'), app.indexOf('const declineHandoffInvite'));
    expect(accept).toContain('redeemHandoff(handoffLink.code)');
    expect(app).toMatch(/id="handoff-invite-accept-btn"[\s\S]*onClick=\{acceptHandoffInvite\}/);
    expect(app).toContain('HANDOFF_INVITE.consent(');
  });

  it('兌換成功走一般登入那一條，然後去 T2 入口', () => {
    const fn = app.slice(app.indexOf('const redeemHandoff'), app.indexOf('const activeDimension'));
    expect(fn).toContain("fetch('/api/handoff/redeem'");
    expect(fn).toContain('handleAuthSuccess(');
    expect(fn).toContain('goToT2Entrance()');
    // 失敗：回登入頁說原因（410 與其他分開）
    expect(fn).toContain('HANDOFF_LANDING.invalid');
    expect(fn).toContain('HANDOFF_LANDING.unavailable');
    expect(fn).toContain('setSessionNotice(notice)');
  });

  it('兌換期間不畫舊的登入狀態', () => {
    expect(app).toMatch(/\{handoffStage === 'redeeming' \? \(\s*<div id="handoff-landing"/);
  });
});

describe('B 的卡（HandoffCard／AnalysisReport）', () => {
  const card = stripComments(read('src/components/HandoffCard.tsx'));
  const report = stripComments(read('src/components/AnalysisReport.tsx'));
  const app = stripComments(read('src/App.tsx'));

  it('先問 config，開了才畫；按下帶 consent: true 並整頁換過去', () => {
    expect(card).toContain("fetch('/api/handoff/config')");
    expect(card).toContain('if (!targetName) return null;');
    expect(card).toContain("authFetch('/api/handoff/start', { method: 'POST', body: JSON.stringify({ consent: true }) })");
    expect(card).toContain('window.location.href = data.url');
  });

  it('只掛在即時報告上、在 T2 插槽的位置', () => {
    expect(report).toMatch(/: handoff && !historicalRecord \? \(\s*<HandoffCard/);
  });

  it('只有發出端把 handoff 傳給報告', () => {
    expect(app).toContain("handoff={PRODUCT.features.handoff === 'send' ?");
  });

  it('A 是接收端、B 是發出端', () => {
    const config = stripComments(read('src/productConfig.ts'));
    const full = config.slice(config.indexOf('full: {'), config.indexOf('t1only: {'));
    const t1only = config.slice(config.indexOf('t1only: {'), config.indexOf('\n};', config.indexOf('t1only: {')));
    expect(full).toContain("handoff: 'receive'");
    expect(t1only).toContain("handoff: 'send'");
  });
});

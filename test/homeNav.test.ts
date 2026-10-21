import { describe, it, expect } from 'vitest';
import { HOME_CARDS, openHomeCard, viewAfterLogin, landingView } from '../src/home/homeNav';

/**
 * 新版首頁的去向（issue #72，規格 docs/specs/client-changes-2026-10-17.md §5.1、D15、D16）：
 * 三張卡各去哪一頁、未登入點卡先登入、登入後帶到那一頁、開關開著時預設停在首頁。
 */

describe('三張卡的去向（D16）', () => {
  it('线上家庭干预练习 → 线上干预；T1综合评估 → 评估面板；线下服务点 → 介绍页', () => {
    expect(HOME_CARDS.map(c => [c.title, c.target])).toEqual([
      ['线上家庭干预练习', 'training'],
      ['T1综合评估', 'dashboard'],
      ['线下服务点', 'offline_service'],
    ]);
  });

  it('每张卡都有「了解更多」', () => {
    for (const c of HOME_CARDS) expect(c.more).toBe('了解更多');
  });
});

describe('点卡', () => {
  it('已登入：直接到那一页', () => {
    expect(openHomeCard('training', true)).toEqual({ view: 'training' });
    expect(openHomeCard('offline_service', true)).toEqual({ view: 'offline_service' });
  });

  it('未登入：先去登入，记住要去哪一页', () => {
    expect(openHomeCard('dashboard', false)).toEqual({ login: true, after: 'dashboard' });
  });
});

describe('登入之后停在哪', () => {
  it('从卡片来的：带到那一页', () => {
    expect(viewAfterLogin('training', true)).toBe('training');
  });

  it('直接按登入的：开关开着停首页，关着照旧停评估面板', () => {
    expect(viewAfterLogin(null, true)).toBe('home');
    expect(viewAfterLogin(null, false)).toBe('dashboard');
  });

  it('开关关着就算记过卡片也照旧（关着根本点不到卡）', () => {
    expect(viewAfterLogin('training', false)).toBe('dashboard');
  });
});

describe('预设页（登出、通行证失效之后回到哪）', () => {
  it('开关开：首页；关：评估面板（与现在一样）', () => {
    expect(landingView(true)).toBe('home');
    expect(landingView(false)).toBe('dashboard');
  });
});
